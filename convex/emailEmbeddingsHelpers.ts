import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Save embedding to emailSummaries table
export const saveEmbedding = internalMutation({
  args: {
    emailId: v.id("emails"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    if (summary) {
      await ctx.db.patch(summary._id, {
        embedding: args.embedding,
      });
    }
  },
});

// Helper query to get summary by ID
export const getSummaryById = internalQuery({
  args: { summaryId: v.id("emailSummaries") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.summaryId);
  },
});

// Helper query to get email by ID
export const getEmailById = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.emailId);
  },
});

// Helper query to get contact by ID
export const getContactById = internalQuery({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contactId);
  },
});

// Get full email details including body (for agent to read email content)
export const getEmailWithBody = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) return null;

    // Get email body
    const emailBody = await ctx.db
      .query("emailBodies")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    // Get contact info
    const contact = await ctx.db.get(email.from);

    // Get summary
    const summary = await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    return {
      _id: email._id,
      subject: email.subject,
      bodyPreview: email.bodyPreview,
      bodyFull: emailBody?.bodyFull,
      fromName: contact?.name,
      fromEmail: contact?.email,
      receivedAt: email.receivedAt,
      summary: summary?.summary,
      urgencyScore: summary?.urgencyScore,
      calendarEvent: summary?.calendarEvent,
      deadline: summary?.deadline,
      deadlineDescription: summary?.deadlineDescription,
    };
  },
});

// Get emails that have summaries but no embeddings
export const getEmailsNeedingEmbeddings = internalQuery({
  args: { userId: v.id("users"), limit: v.number() },
  handler: async (ctx, args) => {
    // Get all emails for user
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const needsEmbedding: Id<"emails">[] = [];

    for (const email of emails) {
      if (needsEmbedding.length >= args.limit) break;

      const summary = await ctx.db
        .query("emailSummaries")
        .withIndex("by_email", (q) => q.eq("emailId", email._id))
        .first();

      // Has summary but no embedding
      if (summary && !summary.embedding) {
        needsEmbedding.push(email._id);
      }
    }

    return needsEmbedding;
  },
});
