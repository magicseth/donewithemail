import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// Get email by ID for summarization
export const getEmailForSummary = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) return null;

    // Get sender info
    const contact = await ctx.db.get(email.from);

    return {
      ...email,
      fromEmail: contact?.email,
      fromName: contact?.name,
    };
  },
});

// Get email by external ID
export const getEmailByExternalId = internalQuery({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emails")
      .withIndex("by_external_id", (q) =>
        q.eq("externalId", args.externalId).eq("provider", "gmail")
      )
      .first();
  },
});

// Update email with AI summary
export const updateEmailSummary = internalMutation({
  args: {
    emailId: v.id("emails"),
    summary: v.string(),
    urgencyScore: v.number(),
    urgencyReason: v.string(),
    suggestedReply: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailId, {
      summary: args.summary,
      urgencyScore: args.urgencyScore,
      urgencyReason: args.urgencyReason,
      suggestedReply: args.suggestedReply,
      aiProcessedAt: Date.now(),
    });
  },
});
