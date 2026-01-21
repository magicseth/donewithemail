"use node";

/**
 * IMAP sync actions - fetching and storing emails from IMAP servers.
 */
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { ConnectedProvider } from "./schema";
import { encryptedPii } from "./pii";

/**
 * Sync emails from IMAP for a specific user and provider
 */
export const syncImapForUser = internalAction({
  args: {
    userId: v.id("users"),
    providerEmail: v.string(),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const imapSimple = await import("imap-simple").catch((err) => {
      console.error("[IMAP] Failed to load imap-simple:", err);
      throw new Error("IMAP functionality is not available in this environment");
    });
    // @ts-ignore - mailparser types not available in Node.js action context
    const { simpleParser } = await import("mailparser").catch((err) => {
      console.error("[IMAP] Failed to load mailparser:", err);
      throw new Error("Mail parsing functionality is not available in this environment");
    });

    // Get user
    const user = await ctx.runQuery(internal.gmailSync.getUserByEmail, {
      email: args.userEmail,
    });

    if (!user) {
      console.error("[IMAP Sync] User not found:", args.userEmail);
      return { success: false, error: "User not found" };
    }

    // Get PII helper for decryption
    const pii = await encryptedPii.forUser(ctx, user._id);

    // Get connected providers
    if (!user.connectedProviders) {
      console.log("[IMAP Sync] No connected providers");
      return { success: true, newEmails: 0 };
    }

    const decrypted = await pii.decrypt(user.connectedProviders);
    if (!decrypted) {
      console.log("[IMAP Sync] Failed to decrypt connected providers");
      return { success: false, error: "Failed to decrypt providers" };
    }
    const providers: ConnectedProvider[] = JSON.parse(decrypted);

    // Find the IMAP provider for this email
    const provider = providers.find(
      (p) => p.provider === "imap" && p.email === args.providerEmail
    );

    if (!provider || !provider.imapHost || !provider.imapPassword) {
      console.error("[IMAP Sync] Provider not found or missing credentials");
      return { success: false, error: "Provider not configured" };
    }

    console.log(`[IMAP Sync] Syncing ${provider.email} from ${provider.imapHost}`);

    try {
      // Connect to IMAP server
      const config = {
        imap: {
          user: provider.email,
          password: provider.imapPassword,
          host: provider.imapHost,
          port: provider.imapPort || 993,
          tls: provider.imapTls ?? true,
          authTimeout: 10000,
        },
      };

      const connection = await imapSimple.default.connect(config);

      // Open INBOX
      await connection.openBox("INBOX");

      // Get mailbox status to check UIDVALIDITY
      const box = connection.imap._box;
      const currentUidValidity = box.uidvalidity;

      // Check if UIDVALIDITY changed (mailbox was reset)
      if (provider.uidValidity && provider.uidValidity !== currentUidValidity) {
        console.log("[IMAP Sync] UIDVALIDITY changed, resetting sync");
        provider.lastSyncUid = undefined;
      }

      // Determine which messages to fetch
      let searchCriteria: any[];
      if (provider.lastSyncUid) {
        // Fetch messages with UID greater than last synced
        searchCriteria = [["UID", `${provider.lastSyncUid + 1}:*`]];
      } else {
        // First sync - fetch recent messages (last 100)
        searchCriteria = [["ALL"]];
      }

      const fetchOptions = {
        bodies: ["HEADER", "TEXT", ""],
        markSeen: false,
        struct: true,
      };

      // Search for messages
      const messages = await connection.search(searchCriteria, fetchOptions);

      console.log(`[IMAP Sync] Found ${messages.length} messages`);

      // Limit to 50 messages per sync to avoid timeouts
      const messagesToProcess = messages.slice(0, 50);

      let newEmailCount = 0;
      let lastUid = provider.lastSyncUid || 0;

      for (const message of messagesToProcess) {
        try {
          const uid = message.attributes.uid;
          lastUid = Math.max(lastUid, uid);

          // Get the raw email content
          const all = message.parts.find((part: any) => part.which === "");
          if (!all) continue;

          // Parse email with mailparser
          const parsed = await simpleParser(all.body);

          // Extract sender
          const from = parsed.from;
          const fromValue = Array.isArray(from) ? from[0]?.value : from?.value;
          const fromAddress = fromValue?.[0];
          if (!fromAddress) continue;

          const senderEmail = fromAddress.address || "";
          const senderName = fromAddress.name || senderEmail;

          // Extract recipients
          const to = parsed.to;
          const toValue = Array.isArray(to) ? to[0]?.value : to?.value;
          const toAddresses = toValue || [];

          // Extract headers for subscription detection
          const listUnsubscribe = parsed.headers.get("list-unsubscribe") as string | undefined;
          const listUnsubscribePost = parsed.headers.get("list-unsubscribe-post") as string | undefined;
          const isSubscription = !!(listUnsubscribe || parsed.headers.get("list-id"));

          // Determine direction (incoming vs sent)
          const isOutgoing = senderEmail.toLowerCase() === provider.email.toLowerCase();
          const direction = isOutgoing ? "outgoing" : "incoming";

          // Get message date
          const receivedAt = parsed.date ? parsed.date.getTime() : Date.now();

          // Check if message has been read
          const flags = message.attributes.flags || [];
          const isRead = flags.includes("\\Seen");

          // Extract body text
          const bodyText = parsed.text || "";
          const bodyHtml = parsed.html || "";
          const bodyPreview = bodyText.slice(0, 200);

          // Create external ID (use UID with mailbox name)
          const externalId = `imap:${provider.imapHost}:INBOX:${uid}`;

          // Upsert sender contact
          const senderResult = await ctx.runMutation(internal.gmailSync.upsertContact, {
            userId: args.userId,
            email: senderEmail,
            name: senderName,
          });

          // Upsert recipient contacts
          const recipientIds: Id<"contacts">[] = [];
          for (const toAddr of toAddresses) {
            const toEmail = toAddr.address || "";
            const toName = toAddr.name || toEmail;

            if (toEmail) {
              const recipientResult = await ctx.runMutation(
                internal.gmailSync.upsertContact,
                {
                  userId: args.userId,
                  email: toEmail,
                  name: toName,
                }
              );
              recipientIds.push(recipientResult.contactId);
            }
          }

          // Store email
          const result = await ctx.runMutation(internal.gmailSync.storeEmailInternal, {
            externalId,
            threadId: parsed.messageId, // Use message ID as thread ID
            provider: "imap" as const,
            userId: args.userId,
            from: senderResult.contactId,
            to: recipientIds.length > 0 ? recipientIds : [senderResult.contactId], // Fallback to sender if no recipients
            subject: parsed.subject || "(No Subject)",
            bodyPreview,
            bodyFull: bodyText,
            receivedAt,
            isRead,
            direction,
            listUnsubscribe,
            listUnsubscribePost: !!listUnsubscribePost,
            isSubscription,
          });

          if (result.isNew) {
            newEmailCount++;
          }
        } catch (error) {
          console.error("[IMAP Sync] Error processing message:", error);
          continue;
        }
      }

      // Update provider with new lastSyncUid and uidValidity
      const updatedProviders = providers.map((p) => {
        if (p.provider === "imap" && p.email === args.providerEmail) {
          return {
            ...p,
            lastSyncUid: lastUid,
            uidValidity: currentUidValidity,
          };
        }
        return p;
      });

      // Encrypt and store updated providers
      const encrypted = await pii.encrypt(JSON.stringify(updatedProviders));
      await ctx.runMutation(internal.imapAuth.updateConnectedProviders, {
        userId: user._id,
        connectedProviders: encrypted,
      });

      // Close connection
      connection.end();

      console.log(`[IMAP Sync] Synced ${newEmailCount} new emails from ${provider.email}`);

      return { success: true, newEmails: newEmailCount };
    } catch (error: any) {
      console.error("[IMAP Sync] Error:", error);
      return { success: false, error: error.message };
    }
  },
});
