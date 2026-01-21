/**
 * Gmail-related queries - read-only operations for email and summary data.
 */
import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { encryptedPii } from "./pii";

/**
 * Get user by email address (with decrypted tokens for use in actions).
 */
export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) return null;

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, user._id);

    // Decrypt tokens
    let gmailAccessToken: string | undefined;
    let gmailRefreshToken: string | undefined;
    let workosRefreshToken: string | undefined;
    let name: string | undefined;

    if (pii) {
      if (user.gmailAccessToken) {
        gmailAccessToken = await pii.decrypt(user.gmailAccessToken) ?? undefined;
      }
      if (user.gmailRefreshToken) {
        gmailRefreshToken = await pii.decrypt(user.gmailRefreshToken) ?? undefined;
      }
      if (user.workosRefreshToken) {
        workosRefreshToken = await pii.decrypt(user.workosRefreshToken) ?? undefined;
      }
      if (user.name) {
        name = await pii.decrypt(user.name) ?? undefined;
      }
    }

    return {
      _id: user._id,
      _creationTime: user._creationTime,
      email: user.email,
      workosId: user.workosId,
      avatarUrl: user.avatarUrl,
      gmailTokenExpiresAt: user.gmailTokenExpiresAt,
      createdAt: user.createdAt,
      // Decrypted fields
      name,
      gmailAccessToken,
      gmailRefreshToken,
      workosRefreshToken,
    };
  },
});

/**
 * Get cached AI summaries for a list of external email IDs.
 */
export const getCachedSummaries = internalQuery({
  args: { externalIds: v.array(v.string()), userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const summaries: Record<string, {
      summary?: string;
      urgencyScore?: number;
      urgencyReason?: string;
      suggestedReply?: string;
    }> = {};

    // Get PII helper if userId is provided
    let pii = null;
    if (args.userId) {
      pii = await encryptedPii.forUserQuery(ctx, args.userId);
    }

    for (const externalId of args.externalIds) {
      const email = await ctx.db
        .query("emails")
        .withIndex("by_external_id", (q) =>
          q.eq("externalId", externalId).eq("provider", "gmail")
        )
        .first();

      if (email) {
        // Get PII helper from email's userId if not provided
        if (!pii) {
          pii = await encryptedPii.forUserQuery(ctx, email.userId);
        }

        // Look up summary from emailSummaries table
        const summaryData = await ctx.db
          .query("emailSummaries")
          .withIndex("by_email", (q) => q.eq("emailId", email._id))
          .first();

        if (summaryData && pii) {
          const decrypted = await pii.decryptMany({
            summary: summaryData.summary,
            urgencyReason: summaryData.urgencyReason,
            suggestedReply: summaryData.suggestedReply ?? undefined,
          });

          summaries[externalId] = {
            summary: decrypted.summary ?? undefined,
            urgencyScore: summaryData.urgencyScore,
            urgencyReason: decrypted.urgencyReason ?? undefined,
            suggestedReply: decrypted.suggestedReply ?? undefined,
          };
        }
      }
    }

    return summaries;
  },
});

/**
 * Get cached emails by external IDs.
 * Returns email data including any cached AI summaries.
 */
export const getCachedEmails = internalQuery({
  args: { externalIds: v.array(v.string()), userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const cached: Record<string, {
      subject: string;
      snippet: string;
      receivedAt: number;
      isRead: boolean;
      fromEmail: string;
      fromName?: string;
      summary?: string;
      urgencyScore?: number;
      urgencyReason?: string;
      suggestedReply?: string;
    }> = {};

    // Get PII helper if userId is provided
    let pii = null;
    if (args.userId) {
      pii = await encryptedPii.forUserQuery(ctx, args.userId);
    }

    for (const externalId of args.externalIds) {
      const email = await ctx.db
        .query("emails")
        .withIndex("by_external_id", (q) =>
          q.eq("externalId", externalId).eq("provider", "gmail")
        )
        .first();

      if (email) {
        // Get PII helper from email's userId if not provided
        if (!pii) {
          pii = await encryptedPii.forUserQuery(ctx, email.userId);
        }

        // Get contact info
        const contact = await ctx.db.get(email.from);
        // Get summary from emailSummaries table
        const summaryData = await ctx.db
          .query("emailSummaries")
          .withIndex("by_email", (q) => q.eq("emailId", email._id))
          .first();

        // Decrypt fields
        let subject = "";
        let snippet = "";
        let fromName: string | undefined;
        let summary: string | undefined;
        let urgencyReason: string | undefined;
        let suggestedReply: string | undefined;

        if (pii) {
          subject = await pii.decrypt(email.subject) ?? "";
          snippet = await pii.decrypt(email.bodyPreview) ?? "";
          if (contact?.name) {
            fromName = await pii.decrypt(contact.name) ?? undefined;
          }
          if (summaryData) {
            summary = await pii.decrypt(summaryData.summary) ?? undefined;
            urgencyReason = await pii.decrypt(summaryData.urgencyReason) ?? undefined;
            if (summaryData.suggestedReply) {
              suggestedReply = await pii.decrypt(summaryData.suggestedReply) ?? undefined;
            }
          }
        }

        cached[externalId] = {
          subject,
          snippet,
          receivedAt: email.receivedAt,
          isRead: email.isRead,
          fromEmail: contact?.email || "",
          fromName,
          summary,
          urgencyScore: summaryData?.urgencyScore,
          urgencyReason,
          suggestedReply,
        };
      }
    }

    return cached;
  },
});
