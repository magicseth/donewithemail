"use node";

import { v } from "convex/values";
import { action, internalAction, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// =============================================================================
// Auth Helper for Actions
// =============================================================================

/**
 * Validates JWT and returns user info for actions.
 * Looks up the user from the database to get the email, since the JWT
 * may not always contain the email claim.
 */
async function requireAuth(ctx: ActionCtx): Promise<{ workosId: string; email: string; userId: Id<"users"> }> {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Unauthorized: No valid authentication token");
  }

  const workosId = identity.subject;
  const tokenEmail = identity.email;

  if (!workosId && !tokenEmail) {
    throw new Error("Unauthorized: Invalid token - missing subject and email");
  }

  // Look up user from database to get reliable email
  type UserData = {
    _id: Id<"users">;
    email: string;
    gmailAccessToken?: string;
    gmailRefreshToken?: string;
    gmailTokenExpiresAt?: number;
  };

  let user: UserData | null = null;

  // Try by workosId first
  if (workosId) {
    user = await ctx.runQuery(internal.subscriptionsHelpers.getUserByWorkosId, {
      workosId,
    });
  }

  // Fallback to email from token
  if (!user && tokenEmail) {
    user = await ctx.runQuery(internal.subscriptionsHelpers.getUserByEmailInternal, {
      email: tokenEmail,
    });
  }

  if (!user) {
    throw new Error("Unauthorized: User not found in database");
  }

  return { workosId: workosId || "", email: user.email, userId: user._id };
}

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

// =============================================================================
// Internal Actions (used by authenticated actions)
// =============================================================================

// Internal version of scanExistingEmails for calling from authenticated actions
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

// =============================================================================
// Authenticated Actions (require valid JWT)
// =============================================================================

/**
 * Batch unsubscribe for the current authenticated user
 */
export const batchUnsubscribeMy = action({
  args: {
    subscriptionIds: v.array(v.id("subscriptions")),
  },
  handler: async (ctx, args): Promise<{
    completed: string[];
    manualRequired: Array<{ id: string; url: string }>;
    failed: string[];
  }> => {
    // Validate auth and get user (requireAuth looks up user from DB)
    const { userId } = await requireAuth(ctx);

    const completed: string[] = [];
    const manualRequired: Array<{ id: string; url: string }> = [];
    const failed: string[] = [];

    // Get user's Gmail access token
    type UserData = {
      _id: Id<"users">;
      gmailAccessToken?: string;
      gmailRefreshToken?: string;
    };
    const user: UserData | null = await ctx.runQuery(internal.subscriptionsHelpers.getUserByIdInternal, {
      userId,
    });

    if (!user?.gmailAccessToken) {
      throw new Error("Gmail not connected");
    }

    for (const subscriptionId of args.subscriptionIds) {
      try {
        // Verify subscription belongs to user
        type SubscriptionData = {
          _id: Id<"subscriptions">;
          userId: Id<"users">;
          listUnsubscribe?: string;
          listUnsubscribePost?: boolean;
          unsubscribeMethod?: string;
        };
        const subscription: SubscriptionData | null = await ctx.runQuery(
          internal.subscriptionsHelpers.getSubscriptionById,
          { subscriptionId }
        );

        if (!subscription) {
          failed.push(subscriptionId);
          continue;
        }

        // Ownership check
        if (subscription.userId !== userId) {
          throw new Error("Unauthorized: Subscription does not belong to you");
        }

        // Mark as processing
        await ctx.runMutation(internal.subscriptionsHelpers.updateStatus, {
          subscriptionId,
          status: "processing",
        });

        if (!subscription.listUnsubscribe) {
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
              manualRequired.push({ id: subscriptionId, url: parsed.httpUrl });
              await ctx.runMutation(internal.subscriptionsHelpers.updateStatus, {
                subscriptionId,
                status: "manual_required",
              });
            }
          } catch {
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

            const rawEmail = [
              `To: ${toEmail}`,
              `Subject: ${subject}`,
              `Content-Type: text/plain; charset=utf-8`,
              "",
              body,
            ].join("\r\n");

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
          manualRequired.push({ id: subscriptionId, url: parsed.httpUrl });
          await ctx.runMutation(internal.subscriptionsHelpers.updateStatus, {
            subscriptionId,
            status: "manual_required",
          });
        } else {
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

/**
 * Scan existing emails for the current authenticated user
 */
export const scanMyExistingEmails = action({
  args: {},
  handler: async (ctx): Promise<{ scanned: number; found: number }> => {
    // Validate auth and get email (requireAuth looks up user from DB)
    const { email } = await requireAuth(ctx);

    // Delegate to internal implementation
    return await ctx.runAction(internal.subscriptions.scanExistingEmailsInternal, {
      userEmail: email,
    });
  },
});

/**
 * Force rescan for the current authenticated user
 */
export const forceMyRescan = action({
  args: {},
  handler: async (ctx): Promise<{ reset: { deletedSubscriptions: number; resetEmails: number }; scan: { scanned: number; found: number } }> => {
    // Validate auth and get user info (requireAuth looks up user from DB)
    const { email, userId } = await requireAuth(ctx);

    // Delete all subscription records
    const deleteResult = await ctx.runMutation(internal.subscriptionsHelpers.deleteSubscriptions, {
      userId,
    });

    // Get all email IDs that need reset
    const emailIds: Id<"emails">[] = await ctx.runQuery(internal.subscriptionsHelpers.getEmailIdsForReset, {
      userId,
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
      userEmail: email,
    });

    return {
      reset: { deletedSubscriptions: deleteResult.deleted, resetEmails },
      scan,
    };
  },
});
