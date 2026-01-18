import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

    // Fetch contact info for each email
    const emailsWithContacts = await Promise.all(
      emails.map(async (email) => {
        const fromContact = await ctx.db.get(email.from);
        return {
          ...email,
          fromContact,
        };
      })
    );

    return emailsWithContacts;
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

    const emailsWithContacts = await Promise.all(
      emails.map(async (email) => {
        const fromContact = await ctx.db.get(email.from);
        return {
          ...email,
          fromContact,
        };
      })
    );

    return emailsWithContacts;
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

    return {
      ...email,
      fromContact,
      toContacts: toContacts.filter(Boolean),
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

    return emails;
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
 * Update email with AI-generated content
 */
export const updateEmailWithAI = mutation({
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

    return { success: true };
  },
});
