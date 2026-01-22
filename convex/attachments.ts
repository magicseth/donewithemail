/**
 * Attachment queries and actions for fetching and managing email attachments.
 */
import { v } from "convex/values";
import { query, action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { encryptedPii } from "./pii";
import { refreshTokenIfNeeded } from "./gmailAuth";

/**
 * Query to get all attachments for an email.
 * Returns decrypted attachment metadata.
 */
export const getEmailAttachments = query({
  args: {
    emailId: v.id("emails"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the email to verify ownership
    const email = await ctx.db.get(args.emailId);
    if (!email) {
      throw new Error("Email not found");
    }

    // Get all attachments for this email
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .collect();

    // Get PII helper for decrypting filenames (read-only query context)
    const pii = await encryptedPii.forUserQuery(ctx, email.userId);
    if (!pii) {
      // User has no encryption key yet - return empty array
      return [];
    }

    // Decrypt filenames and generate storage URLs
    const decryptedAttachments = await Promise.all(
      attachments.map(async (attachment) => {
        const filename = await pii.decrypt(attachment.filename);
        let url: string | null = null;

        // Generate URL if file is stored
        if (attachment.storageId) {
          url = await ctx.storage.getUrl(attachment.storageId);
        }

        return {
          _id: attachment._id,
          filename,
          mimeType: attachment.mimeType,
          size: attachment.size,
          url,
          contentId: attachment.contentId,
          // Include attachmentId for downloading if not yet stored
          attachmentId: attachment.storageId ? undefined : attachment.attachmentId,
        };
      })
    );

    return decryptedAttachments;
  },
});

/**
 * Action to download an attachment from Gmail and store it in Convex storage.
 */
export const downloadAttachment = action({
  args: {
    userEmail: v.string(),
    emailId: v.id("emails"),
    attachmentDbId: v.id("attachments"),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    // Get the attachment record
    const attachment = await ctx.runQuery((internal as any).attachments.getAttachmentById, {
      attachmentDbId: args.attachmentDbId,
    });

    if (!attachment) {
      throw new Error("Attachment not found");
    }

    // Check if already downloaded
    if (attachment.storageId) {
      const url = await ctx.storage.getUrl(attachment.storageId);
      if (url) {
        return { url };
      }
    }

    // Get the email to find its externalId
    const email = await ctx.runQuery(internal.emails.getEmailById, {
      emailId: args.emailId,
    });

    if (!email) {
      throw new Error("Email not found");
    }

    // Get user's Gmail tokens
    const user = await ctx.runQuery(internal.gmailSync.getUserByEmail, {
      email: args.userEmail,
    });

    if (!user?.gmailAccessToken) {
      throw new Error("Gmail not connected");
    }

    // Refresh token if needed
    let accessToken: string = user.gmailAccessToken;
    if (user.gmailRefreshToken && user.gmailTokenExpiresAt) {
      const refreshed = await refreshTokenIfNeeded(
        user.gmailAccessToken,
        user.gmailRefreshToken,
        user.gmailTokenExpiresAt
      );
      accessToken = refreshed.accessToken;

      if (refreshed.refreshed) {
        await ctx.runMutation(internal.gmailSync.updateUserTokens, {
          userId: user._id,
          accessToken: refreshed.accessToken,
          expiresAt: refreshed.expiresAt,
        });
      }
    }

    // Download attachment from Gmail
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.externalId}/attachments/${attachment.attachmentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.status}`);
    }

    const data = await response.json();

    // Decode base64url-encoded data
    const base64 = data.data.replace(/-/g, "+").replace(/_/g, "/");
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create a blob with the appropriate MIME type
    const blob = new Blob([bytes], { type: attachment.mimeType });

    // Store in Convex storage
    const storageId = await ctx.storage.store(blob);

    // Update attachment record with storageId
    await ctx.runMutation(internal.gmailSync.storeAttachment, {
      emailId: args.emailId,
      userId: user._id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      attachmentId: attachment.attachmentId,
      contentId: attachment.contentId,
      storageId,
    });

    // Get URL for the stored file
    const url = await ctx.storage.getUrl(storageId);
    if (!url) {
      throw new Error("Failed to generate URL for stored file");
    }

    return { url };
  },
});

/**
 * Internal query to get attachment by ID (used by actions).
 */
export const getAttachmentById = internalMutation({
  args: {
    attachmentDbId: v.id("attachments"),
  },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentDbId as any) as any;
    if (!attachment) {
      return null;
    }

    // Get PII helper for decrypting filename (mutation context allows read/write)
    const pii = await encryptedPii.forUser(ctx, attachment.userId);
    const filename = await pii.decrypt(attachment.filename);

    return {
      _id: attachment._id,
      emailId: attachment.emailId,
      userId: attachment.userId,
      filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      attachmentId: attachment.attachmentId,
      contentId: attachment.contentId,
      storageId: attachment.storageId,
    };
  },
});
