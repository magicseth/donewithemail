"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Parse List-Unsubscribe header to extract HTTP and mailto URLs
// Header format: <mailto:unsub@example.com>, <https://example.com/unsub>
function parseListUnsubscribe(header: string): { httpUrl?: string; mailtoUrl?: string } {
  const result: { httpUrl?: string; mailtoUrl?: string } = {};
  const matches = header.matchAll(/<([^>]+)>/g);
  for (const match of matches) {
    const url = match[1];
    if (url.startsWith("http://") || url.startsWith("https://")) {
      result.httpUrl = url;
    } else if (url.startsWith("mailto:")) {
      result.mailtoUrl = url;
    }
  }
  return result;
}

// Action to perform batch unsubscribe
export const batchUnsubscribe = action({
  args: {
    userEmail: v.string(),
    subscriptionIds: v.array(v.id("subscriptions")),
  },
  handler: async (ctx, args): Promise<{
    completed: string[];
    manualRequired: Array<{ id: string; url: string }>;
    failed: string[];
  }> => {
    const completed: string[] = [];
    const manualRequired: Array<{ id: string; url: string }> = [];
    const failed: string[] = [];

    // Get user for Gmail API access
    type UserData = {
      _id: Id<"users">;
      gmailAccessToken?: string;
      gmailRefreshToken?: string;
    };
    const user: UserData | null = await ctx.runQuery(internal.subscriptionsHelpers.getUserByEmailInternal, {
      email: args.userEmail,
    });

    if (!user?.gmailAccessToken) {
      throw new Error("Gmail not connected");
    }

    for (const subscriptionId of args.subscriptionIds) {
      try {
        // Mark as processing
        await ctx.runMutation(internal.subscriptionsHelpers.updateStatus, {
          subscriptionId,
          status: "processing",
        });

        // Get subscription details
        type SubscriptionData = {
          _id: Id<"subscriptions">;
          listUnsubscribe?: string;
          listUnsubscribePost?: boolean;
          unsubscribeMethod?: string;
        };
        const subscription: SubscriptionData | null = await ctx.runQuery(
          internal.subscriptionsHelpers.getSubscriptionById,
          { subscriptionId }
        );

        if (!subscription || !subscription.listUnsubscribe) {
          await ctx.runMutation(internal.subscriptionsHelpers.updateStatus, {
            subscriptionId,
            status: "failed",
          });
          failed.push(subscriptionId);
          continue;
        }

        const parsed = parseListUnsubscribe(subscription.listUnsubscribe);
        const method = subscription.unsubscribeMethod;

        if (method === "http_post" && parsed.httpUrl) {
          // RFC 8058 one-click unsubscribe
          try {
            const response = await fetch(parsed.httpUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: "List-Unsubscribe=One-Click",
            });

            if (response.ok || response.status === 202) {
              await ctx.runMutation(internal.subscriptionsHelpers.updateStatus, {
                subscriptionId,
                status: "unsubscribed",
                unsubscribedAt: Date.now(),
              });
              completed.push(subscriptionId);
            } else {
              // Fall back to manual
              manualRequired.push({ id: subscriptionId, url: parsed.httpUrl });
              await ctx.runMutation(internal.subscriptionsHelpers.updateStatus, {
                subscriptionId,
                status: "manual_required",
              });
            }
          } catch {
            // HTTP request failed, mark as manual required
            manualRequired.push({ id: subscriptionId, url: parsed.httpUrl });
            await ctx.runMutation(internal.subscriptionsHelpers.updateStatus, {
              subscriptionId,
              status: "manual_required",
            });
          }
        } else if (method === "mailto" && parsed.mailtoUrl) {
          // Send unsubscribe email via Gmail API
          try {
            const mailtoUrl = new URL(parsed.mailtoUrl);
            const toEmail = mailtoUrl.pathname;
            const subject = mailtoUrl.searchParams.get("subject") || "Unsubscribe";
            const body = mailtoUrl.searchParams.get("body") || "Unsubscribe";

            // Create raw email
            const rawEmail = [
              `To: ${toEmail}`,
              `Subject: ${subject}`,
              `Content-Type: text/plain; charset=utf-8`,
              "",
              body,
            ].join("\r\n");

            // Base64url encode
            const encodedEmail = Buffer.from(rawEmail)
              .toString("base64")
              .replace(/\+/g, "-")
              .replace(/\//g, "_")
              .replace(/=+$/, "");

            const response = await fetch(
              "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${user.gmailAccessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ raw: encodedEmail }),
              }
            );

            if (response.ok) {
              await ctx.runMutation(internal.subscriptionsHelpers.updateStatus, {
                subscriptionId,
                status: "unsubscribed",
                unsubscribedAt: Date.now(),
              });
              completed.push(subscriptionId);
            } else {
              await ctx.runMutation(internal.subscriptionsHelpers.updateStatus, {
                subscriptionId,
                status: "failed",
              });
              failed.push(subscriptionId);
            }
          } catch {
            await ctx.runMutation(internal.subscriptionsHelpers.updateStatus, {
              subscriptionId,
              status: "failed",
            });
            failed.push(subscriptionId);
          }
        } else if (method === "http_get" && parsed.httpUrl) {
          // HTTP GET requires manual confirmation - user must visit the URL
          manualRequired.push({ id: subscriptionId, url: parsed.httpUrl });
          await ctx.runMutation(internal.subscriptionsHelpers.updateStatus, {
            subscriptionId,
            status: "manual_required",
          });
        } else {
          // No valid unsubscribe method
          await ctx.runMutation(internal.subscriptionsHelpers.updateStatus, {
            subscriptionId,
            status: "failed",
          });
          failed.push(subscriptionId);
        }
      } catch (error) {
        console.error(`Error unsubscribing from ${subscriptionId}:`, error);
        await ctx.runMutation(internal.subscriptionsHelpers.updateStatus, {
          subscriptionId,
          status: "failed",
        });
        failed.push(subscriptionId);
      }
    }

    return { completed, manualRequired, failed };
  },
});

// Action to scan existing emails and backfill subscription data
export const scanExistingEmails = action({
  args: { userEmail: v.string() },
  handler: async (ctx, args): Promise<{ scanned: number; found: number }> => {
    // Get user
    type UserData = {
      _id: Id<"users">;
      gmailAccessToken?: string;
      gmailRefreshToken?: string;
      gmailTokenExpiresAt?: number;
    };
    const user: UserData | null = await ctx.runQuery(internal.subscriptionsHelpers.getUserByEmailInternal, {
      email: args.userEmail,
    });

    if (!user?.gmailAccessToken) {
      throw new Error("Gmail not connected");
    }

    // Get all emails for this user that we haven't processed for subscriptions yet
    type EmailData = {
      _id: Id<"emails">;
      externalId: string;
      from: Id<"contacts">;
      receivedAt: number;
      listUnsubscribe?: string;
      isSubscription?: boolean;
      subject: string;
    };
    const emails: EmailData[] = await ctx.runQuery(internal.subscriptionsHelpers.getEmailsWithoutSubscriptionCheck, {
      userId: user._id,
    });

    let scanned = 0;
    let found = 0;

    // Process in batches to avoid timeout
    const BATCH_SIZE = 20;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);

      for (const email of batch) {
        scanned++;

        // Fetch headers from Gmail if we don't have them stored
        if (email.listUnsubscribe === undefined) {
          try {
            const response = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.externalId}?format=metadata&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post&metadataHeaders=From&metadataHeaders=Subject`,
              { headers: { Authorization: `Bearer ${user.gmailAccessToken}` } }
            );

            if (response.ok) {
              const data = await response.json();
              const headers = data.payload?.headers || [];
              const getHeader = (name: string) =>
                headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value;

              const listUnsubscribe = getHeader("List-Unsubscribe");
              const listUnsubscribePost = !!getHeader("List-Unsubscribe-Post");
              const subject = getHeader("Subject") || email.subject;

              // Update email with headers
              await ctx.runMutation(internal.subscriptionsHelpers.updateEmailSubscriptionHeaders, {
                emailId: email._id,
                listUnsubscribe,
                listUnsubscribePost,
                isSubscription: !!listUnsubscribe,
              });

              if (listUnsubscribe) {
                // Get contact info for sender name
                type ContactData = { email: string; name?: string };
                const contact: ContactData | null = await ctx.runQuery(
                  internal.subscriptionsHelpers.getContactById,
                  { contactId: email.from }
                );

                await ctx.runMutation(internal.subscriptionsHelpers.upsertSubscription, {
                  userId: user._id,
                  senderEmail: contact?.email || "",
                  senderName: contact?.name,
                  listUnsubscribe,
                  listUnsubscribePost,
                  emailId: email._id,
                  receivedAt: email.receivedAt,
                  subject,
                });
                found++;
              }
            }
          } catch (error) {
            console.error(`Error fetching headers for ${email.externalId}:`, error);
          }
        } else if (email.listUnsubscribe && !email.isSubscription) {
          // We have headers stored but haven't created subscription record
          type ContactData = { email: string; name?: string };
          const contact: ContactData | null = await ctx.runQuery(
            internal.subscriptionsHelpers.getContactById,
            { contactId: email.from }
          );

          await ctx.runMutation(internal.subscriptionsHelpers.upsertSubscription, {
            userId: user._id,
            senderEmail: contact?.email || "",
            senderName: contact?.name,
            listUnsubscribe: email.listUnsubscribe,
            listUnsubscribePost: false,
            emailId: email._id,
            receivedAt: email.receivedAt,
            subject: email.subject,
          });
          found++;
        }
      }

      // Rate limit between batches
      if (i + BATCH_SIZE < emails.length) {
        await delay(500);
      }
    }

    return { scanned, found };
  },
});

// Action to force rescan all emails (resets subscription data first)
export const forceRescan = action({
  args: { userEmail: v.string() },
  handler: async (ctx, args): Promise<{ reset: { deletedSubscriptions: number; resetEmails: number }; scan: { scanned: number; found: number } }> => {
    // Get user
    type UserData = {
      _id: Id<"users">;
    };
    const user: UserData | null = await ctx.runQuery(internal.subscriptionsHelpers.getUserByEmailInternal, {
      email: args.userEmail,
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Delete all subscription records
    const deleteResult = await ctx.runMutation(internal.subscriptionsHelpers.deleteSubscriptions, {
      userId: user._id,
    });

    // Get all email IDs that need reset
    const emailIds: Id<"emails">[] = await ctx.runQuery(internal.subscriptionsHelpers.getEmailIdsForReset, {
      userId: user._id,
    });

    // Reset in batches to avoid write conflicts
    const BATCH_SIZE = 50;
    let resetEmails = 0;
    for (let i = 0; i < emailIds.length; i += BATCH_SIZE) {
      const batch = emailIds.slice(i, i + BATCH_SIZE);
      const result = await ctx.runMutation(internal.subscriptionsHelpers.resetEmailSubscriptionFlags, {
        emailIds: batch,
      });
      resetEmails += result.reset;
    }

    // Now run the scan
    const scan = await ctx.runAction(internal.subscriptions.scanExistingEmailsInternal, {
      userEmail: args.userEmail,
    });

    return {
      reset: { deletedSubscriptions: deleteResult.deleted, resetEmails },
      scan,
    };
  },
});

// Internal version of scanExistingEmails for calling from forceRescan
export const scanExistingEmailsInternal = internalAction({
  args: { userEmail: v.string() },
  handler: async (ctx, args): Promise<{ scanned: number; found: number }> => {
    // Get user
    type UserData = {
      _id: Id<"users">;
      gmailAccessToken?: string;
      gmailRefreshToken?: string;
      gmailTokenExpiresAt?: number;
    };
    const user: UserData | null = await ctx.runQuery(internal.subscriptionsHelpers.getUserByEmailInternal, {
      email: args.userEmail,
    });

    if (!user?.gmailAccessToken) {
      throw new Error("Gmail not connected");
    }

    // Get all emails for this user that we haven't processed for subscriptions yet
    type EmailData = {
      _id: Id<"emails">;
      externalId: string;
      from: Id<"contacts">;
      receivedAt: number;
      listUnsubscribe?: string;
      isSubscription?: boolean;
      subject: string;
    };
    const emails: EmailData[] = await ctx.runQuery(internal.subscriptionsHelpers.getEmailsWithoutSubscriptionCheck, {
      userId: user._id,
    });

    let scanned = 0;
    let found = 0;

    // Process in batches to avoid timeout
    const BATCH_SIZE = 20;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);

      for (const email of batch) {
        scanned++;

        // Fetch headers from Gmail if we don't have them stored
        if (email.listUnsubscribe === undefined) {
          try {
            const response = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.externalId}?format=metadata&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post&metadataHeaders=From&metadataHeaders=Subject`,
              { headers: { Authorization: `Bearer ${user.gmailAccessToken}` } }
            );

            if (response.ok) {
              const data = await response.json();
              const headers = data.payload?.headers || [];
              const getHeader = (name: string) =>
                headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value;

              const listUnsubscribe = getHeader("List-Unsubscribe");
              const listUnsubscribePost = !!getHeader("List-Unsubscribe-Post");
              const subject = getHeader("Subject") || email.subject;

              // Update email with headers
              await ctx.runMutation(internal.subscriptionsHelpers.updateEmailSubscriptionHeaders, {
                emailId: email._id,
                listUnsubscribe,
                listUnsubscribePost,
                isSubscription: !!listUnsubscribe,
              });

              if (listUnsubscribe) {
                // Get contact info for sender name
                type ContactData = { email: string; name?: string };
                const contact: ContactData | null = await ctx.runQuery(
                  internal.subscriptionsHelpers.getContactById,
                  { contactId: email.from }
                );

                await ctx.runMutation(internal.subscriptionsHelpers.upsertSubscription, {
                  userId: user._id,
                  senderEmail: contact?.email || "",
                  senderName: contact?.name,
                  listUnsubscribe,
                  listUnsubscribePost,
                  emailId: email._id,
                  receivedAt: email.receivedAt,
                  subject,
                });
                found++;
              }
            }
          } catch (error) {
            console.error(`Error fetching headers for ${email.externalId}:`, error);
          }
        }
      }

      // Rate limit between batches
      if (i + BATCH_SIZE < emails.length) {
        await delay(500);
      }
    }

    return { scanned, found };
  },
});
