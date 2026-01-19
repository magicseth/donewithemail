import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// Internal mutation to mark an event as added to calendar
export const markCalendarEventAdded = internalMutation({
  args: {
    emailId: v.id("emails"),
    calendarEventId: v.string(),
    calendarEventLink: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the email summary for this email
    const summary = await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    if (summary) {
      await ctx.db.patch(summary._id, {
        calendarEventId: args.calendarEventId,
        calendarEventLink: args.calendarEventLink,
      });
    }
  },
});

// Get email by ID for summarization
export const getEmailForSummary = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) return null;

    // Get sender info
    const contact = await ctx.db.get(email.from);

    // Get existing summary if any
    const summary = await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    return {
      ...email,
      fromEmail: contact?.email,
      fromName: contact?.name,
      summary: summary?.summary,
      urgencyScore: summary?.urgencyScore,
      urgencyReason: summary?.urgencyReason,
      suggestedReply: summary?.suggestedReply,
      actionRequired: summary?.actionRequired,
      actionDescription: summary?.actionDescription,
      quickReplies: summary?.quickReplies,
      calendarEvent: summary?.calendarEvent,
      aiProcessedAt: summary?.createdAt,
    };
  },
});

// Get email by external ID with full context for summarization
export const getEmailByExternalId = internalQuery({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    const email = await ctx.db
      .query("emails")
      .withIndex("by_external_id", (q) =>
        q.eq("externalId", args.externalId).eq("provider", "gmail")
      )
      .first();

    if (!email) return null;

    // Get existing summary
    const existingSummary = await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", email._id))
      .first();

    // Get sender contact info
    const fromContact = await ctx.db.get(email.from);

    // Get user info
    const user = await ctx.db.get(email.userId);

    // Get "to" contacts
    const toContacts = await Promise.all(
      email.to.map((contactId) => ctx.db.get(contactId))
    );

    // Get sender's email history with this user (for relationship context)
    const senderHistory = fromContact
      ? await ctx.db
          .query("emails")
          .withIndex("by_user_received", (q) => q.eq("userId", email.userId))
          .filter((q) => q.eq(q.field("from"), email.from))
          .order("desc")
          .take(5)
      : [];

    return {
      ...email,
      fromEmail: fromContact?.email,
      fromName: fromContact?.name,
      fromRelationship: fromContact?.relationship,
      senderEmailCount: fromContact?.emailCount || 0,
      userEmail: user?.email,
      userName: user?.name || undefined,
      toEmails: toContacts.filter(Boolean).map((c) => c?.email),
      recentFromSender: senderHistory.map((e) => ({
        subject: e.subject,
        receivedAt: e.receivedAt,
      })),
      // Include existing summary data
      summary: existingSummary?.summary,
      urgencyScore: existingSummary?.urgencyScore,
      urgencyReason: existingSummary?.urgencyReason,
      suggestedReply: existingSummary?.suggestedReply,
      actionRequired: existingSummary?.actionRequired,
      actionDescription: existingSummary?.actionDescription,
      quickReplies: existingSummary?.quickReplies,
      calendarEvent: existingSummary?.calendarEvent,
      aiProcessedAt: existingSummary?.createdAt,
    };
  },
});

// Get summary for an email
export const getSummary = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();
  },
});

// Delete all summaries for a user's emails (for debug reset)
export const deleteAllSummariesForUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get all emails for the user
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let deleted = 0;
    for (const email of emails) {
      const summary = await ctx.db
        .query("emailSummaries")
        .withIndex("by_email", (q) => q.eq("emailId", email._id))
        .first();
      if (summary) {
        await ctx.db.delete(summary._id);
        deleted++;
      }
    }

    return deleted;
  },
});

// Get all external IDs for a user's emails (for resummarization)
export const getExternalIdsForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return emails.map((e) => e.externalId);
  },
});

// Save email summary to separate table
export const updateEmailSummary = internalMutation({
  args: {
    emailId: v.id("emails"),
    summary: v.string(),
    urgencyScore: v.number(),
    urgencyReason: v.string(),
    suggestedReply: v.optional(v.string()),
    actionRequired: v.optional(v.union(
      v.literal("reply"),
      v.literal("action"),
      v.literal("fyi"),
      v.literal("none")
    )),
    actionDescription: v.optional(v.string()),
    quickReplies: v.optional(v.array(v.object({
      label: v.string(),
      body: v.string(),
    }))),
    calendarEvent: v.optional(v.object({
      title: v.string(),
      startTime: v.optional(v.string()),
      endTime: v.optional(v.string()),
      location: v.optional(v.string()),
      description: v.optional(v.string()),
    })),
    deadline: v.optional(v.string()),
    deadlineDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if summary already exists
    const existing = await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    const summaryData = {
      summary: args.summary,
      urgencyScore: args.urgencyScore,
      urgencyReason: args.urgencyReason,
      suggestedReply: args.suggestedReply,
      actionRequired: args.actionRequired,
      actionDescription: args.actionDescription,
      quickReplies: args.quickReplies,
      calendarEvent: args.calendarEvent,
      deadline: args.deadline,
      deadlineDescription: args.deadlineDescription,
      createdAt: Date.now(),
    };

    if (existing) {
      // Update existing summary
      await ctx.db.patch(existing._id, summaryData);
    } else {
      // Insert new summary
      await ctx.db.insert("emailSummaries", {
        emailId: args.emailId,
        ...summaryData,
      });
    }
  },
});
