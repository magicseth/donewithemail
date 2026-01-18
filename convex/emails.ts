import { v } from "convex/values";
import { mutation, query, internalQuery, DatabaseReader } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Helper to fetch summary for an email
async function getSummaryForEmail(db: DatabaseReader, emailId: Id<"emails">) {
  const summary = await db
    .query("emailSummaries")
    .withIndex("by_email", (q) => q.eq("emailId", emailId))
    .first();
  return summary;
}

/**
 * Get untriaged emails for the feed view
 */
export const getUntriagedEmails = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user_untriaged", (q) =>
        q.eq("userId", args.userId).eq("isTriaged", false)
      )
      .order("desc")
      .take(limit);

    // Fetch contact info and summary for each email
    const emailsWithData = await Promise.all(
      emails.map(async (email) => {
        const fromContact = await ctx.db.get(email.from);
        const summaryData = await getSummaryForEmail(ctx.db, email._id);
        return {
          ...email,
          fromContact,
          summary: summaryData?.summary,
          urgencyScore: summaryData?.urgencyScore,
          urgencyReason: summaryData?.urgencyReason,
          suggestedReply: summaryData?.suggestedReply,
          actionRequired: summaryData?.actionRequired,
          actionDescription: summaryData?.actionDescription,
          quickReplies: summaryData?.quickReplies,
          calendarEvent: summaryData?.calendarEvent,
          aiProcessedAt: summaryData?.createdAt,
        };
      })
    );

    return emailsWithData;
  },
});

/**
 * Get all emails for traditional inbox view
 */
export const getInboxEmails = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user_received", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    const emailsWithData = await Promise.all(
      emails.map(async (email) => {
        const fromContact = await ctx.db.get(email.from);
        const summaryData = await getSummaryForEmail(ctx.db, email._id);
        return {
          ...email,
          fromContact,
          summary: summaryData?.summary,
          urgencyScore: summaryData?.urgencyScore,
          urgencyReason: summaryData?.urgencyReason,
          suggestedReply: summaryData?.suggestedReply,
          actionRequired: summaryData?.actionRequired,
          actionDescription: summaryData?.actionDescription,
          quickReplies: summaryData?.quickReplies,
          calendarEvent: summaryData?.calendarEvent,
          aiProcessedAt: summaryData?.createdAt,
        };
      })
    );

    return emailsWithData;
  },
});

/**
 * Get inbox emails by user email (for fast cache-first loading)
 */
export const getInboxByEmail = query({
  args: {
    email: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      return [];
    }

    const limit = args.limit ?? 50;

    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user_received", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    const emailsWithData = await Promise.all(
      emails.map(async (email) => {
        const fromContact = await ctx.db.get(email.from);
        const summaryData = await getSummaryForEmail(ctx.db, email._id);
        return {
          ...email,
          fromContact,
          summary: summaryData?.summary,
          urgencyScore: summaryData?.urgencyScore,
          urgencyReason: summaryData?.urgencyReason,
          suggestedReply: summaryData?.suggestedReply,
          actionRequired: summaryData?.actionRequired,
          actionDescription: summaryData?.actionDescription,
          quickReplies: summaryData?.quickReplies,
          calendarEvent: summaryData?.calendarEvent,
          aiProcessedAt: summaryData?.createdAt,
        };
      })
    );

    return emailsWithData;
  },
});

/**
 * Get a single email by ID
 */
export const getEmail = query({
  args: {
    emailId: v.id("emails"),
  },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) return null;

    const fromContact = await ctx.db.get(email.from);
    const toContacts = await Promise.all(
      email.to.map((id) => ctx.db.get(id))
    );
    const summaryData = await getSummaryForEmail(ctx.db, email._id);

    return {
      ...email,
      fromContact,
      toContacts: toContacts.filter(Boolean),
      summary: summaryData?.summary,
      urgencyScore: summaryData?.urgencyScore,
      urgencyReason: summaryData?.urgencyReason,
      suggestedReply: summaryData?.suggestedReply,
      aiProcessedAt: summaryData?.createdAt,
    };
  },
});

/**
 * Get a single email by external ID (e.g., Gmail message ID)
 */
export const getEmailByExternalId = query({
  args: {
    externalId: v.string(),
    provider: v.optional(v.union(v.literal("gmail"), v.literal("outlook"), v.literal("imap"))),
  },
  handler: async (ctx, args) => {
    const provider = args.provider ?? "gmail";

    const email = await ctx.db
      .query("emails")
      .withIndex("by_external_id", (q) =>
        q.eq("externalId", args.externalId).eq("provider", provider)
      )
      .first();

    if (!email) return null;

    const fromContact = await ctx.db.get(email.from);
    const toContacts = await Promise.all(
      email.to.map((id) => ctx.db.get(id))
    );
    const summaryData = await getSummaryForEmail(ctx.db, email._id);

    return {
      ...email,
      fromContact,
      toContacts: toContacts.filter(Boolean),
      summary: summaryData?.summary,
      urgencyScore: summaryData?.urgencyScore,
      urgencyReason: summaryData?.urgencyReason,
      suggestedReply: summaryData?.suggestedReply,
      aiProcessedAt: summaryData?.createdAt,
    };
  },
});

/**
 * Get emails from a specific contact
 */
export const getEmailsByContact = query({
  args: {
    contactId: v.id("contacts"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const emails = await ctx.db
      .query("emails")
      .withIndex("by_from", (q) => q.eq("from", args.contactId))
      .order("desc")
      .take(limit);

    // Add summary data to each email
    const emailsWithData = await Promise.all(
      emails.map(async (email) => {
        const summaryData = await getSummaryForEmail(ctx.db, email._id);
        return {
          ...email,
          summary: summaryData?.summary,
          urgencyScore: summaryData?.urgencyScore,
          urgencyReason: summaryData?.urgencyReason,
          suggestedReply: summaryData?.suggestedReply,
          aiProcessedAt: summaryData?.createdAt,
        };
      })
    );

    return emailsWithData;
  },
});

/**
 * Triage an email (swipe action)
 */
export const triageEmail = mutation({
  args: {
    emailId: v.id("emails"),
    action: v.union(
      v.literal("done"),
      v.literal("reply_needed"),
      v.literal("delegated")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailId, {
      isTriaged: true,
      triageAction: args.action,
      triagedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Triage an email by external ID (Gmail ID)
 */
export const triageEmailByExternalId = mutation({
  args: {
    externalId: v.string(),
    provider: v.optional(v.union(v.literal("gmail"), v.literal("outlook"), v.literal("imap"))),
    action: v.union(
      v.literal("done"),
      v.literal("reply_needed"),
      v.literal("delegated")
    ),
  },
  handler: async (ctx, args) => {
    const provider = args.provider ?? "gmail";

    const email = await ctx.db
      .query("emails")
      .withIndex("by_external_id", (q) =>
        q.eq("externalId", args.externalId).eq("provider", provider)
      )
      .first();

    if (!email) {
      throw new Error(`Email not found: ${args.externalId}`);
    }

    await ctx.db.patch(email._id, {
      isTriaged: true,
      triageAction: args.action,
      triagedAt: Date.now(),
    });

    return { success: true, emailId: email._id };
  },
});

/**
 * Mark email as read
 */
export const markAsRead = mutation({
  args: {
    emailId: v.id("emails"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailId, {
      isRead: true,
    });

    return { success: true };
  },
});

/**
 * Store a new email (called by sync)
 */
export const storeEmail = mutation({
  args: {
    externalId: v.string(),
    provider: v.union(v.literal("gmail"), v.literal("outlook"), v.literal("imap")),
    userId: v.id("users"),
    from: v.id("contacts"),
    to: v.array(v.id("contacts")),
    cc: v.optional(v.array(v.id("contacts"))),
    subject: v.string(),
    bodyPreview: v.string(),
    bodyFull: v.string(),
    receivedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if email already exists
    const existing = await ctx.db
      .query("emails")
      .withIndex("by_external_id", (q) =>
        q.eq("externalId", args.externalId).eq("provider", args.provider)
      )
      .first();

    if (existing) {
      return { emailId: existing._id, isNew: false };
    }

    const emailId = await ctx.db.insert("emails", {
      ...args,
      isRead: false,
      isTriaged: false,
    });

    // Queue for AI processing
    await ctx.db.insert("aiProcessingQueue", {
      emailId,
      userId: args.userId,
      status: "pending",
      createdAt: Date.now(),
    });

    return { emailId, isNew: true };
  },
});

/**
 * Get a single email by ID (internal, for actions)
 */
export const getEmailById = internalQuery({
  args: {
    emailId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const id = args.emailId as Id<"emails">;
      const email = await ctx.db.get(id);
      return email;
    } catch {
      return null;
    }
  },
});

