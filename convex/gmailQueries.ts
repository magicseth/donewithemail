/**
 * Gmail-related queries - read-only operations for email and summary data.
 */
import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/**
 * Get user by email address.
 */
export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

/**
 * Get cached AI summaries for a list of external email IDs.
 */
export const getCachedSummaries = internalQuery({
  args: { externalIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const summaries: Record<string, {
      summary?: string;
      urgencyScore?: number;
      urgencyReason?: string;
      suggestedReply?: string;
    }> = {};

    for (const externalId of args.externalIds) {
      const email = await ctx.db
        .query("emails")
        .withIndex("by_external_id", (q) =>
          q.eq("externalId", externalId).eq("provider", "gmail")
        )
        .first();

      if (email) {
        // Look up summary from emailSummaries table
        const summaryData = await ctx.db
          .query("emailSummaries")
          .withIndex("by_email", (q) => q.eq("emailId", email._id))
          .first();

        if (summaryData) {
          summaries[externalId] = {
            summary: summaryData.summary,
            urgencyScore: summaryData.urgencyScore,
            urgencyReason: summaryData.urgencyReason,
            suggestedReply: summaryData.suggestedReply,
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
  args: { externalIds: v.array(v.string()) },
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

    for (const externalId of args.externalIds) {
      const email = await ctx.db
        .query("emails")
        .withIndex("by_external_id", (q) =>
          q.eq("externalId", externalId).eq("provider", "gmail")
        )
        .first();

      if (email) {
        // Get contact info
        const contact = await ctx.db.get(email.from);
        // Get summary from emailSummaries table
        const summaryData = await ctx.db
          .query("emailSummaries")
          .withIndex("by_email", (q) => q.eq("emailId", email._id))
          .first();

        cached[externalId] = {
          subject: email.subject,
          snippet: email.bodyPreview,
          receivedAt: email.receivedAt,
          isRead: email.isRead,
          fromEmail: contact?.email || "",
          fromName: contact?.name,
          summary: summaryData?.summary,
          urgencyScore: summaryData?.urgencyScore,
          urgencyReason: summaryData?.urgencyReason,
          suggestedReply: summaryData?.suggestedReply,
        };
      }
    }

    return cached;
  },
});
