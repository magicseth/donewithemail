import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get a contact by ID
 */
export const getContact = query({
  args: {
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contactId);
  },
});

/**
 * Get contact by email address for a user
 */
export const getContactByEmail = query({
  args: {
    userId: v.id("users"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contacts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email)
      )
      .first();
  },
});

/**
 * Get all contacts for a user, sorted by last email
 */
export const getContacts = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    return await ctx.db
      .query("contacts")
      .withIndex("by_user_last_email", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get VIP contacts
 */
export const getVIPContacts = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return contacts.filter((c) => c.relationship === "vip");
  },
});

/**
 * Upsert a contact (create or update)
 */
export const upsertContact = mutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email)
      )
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing contact
      await ctx.db.patch(existing._id, {
        name: args.name ?? existing.name,
        avatarUrl: args.avatarUrl ?? existing.avatarUrl,
        emailCount: existing.emailCount + 1,
        lastEmailAt: now,
      });

      return { contactId: existing._id, isNew: false };
    }

    // Create new contact
    const contactId = await ctx.db.insert("contacts", {
      userId: args.userId,
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      emailCount: 1,
      lastEmailAt: now,
      relationship: "unknown",
    });

    return { contactId, isNew: true };
  },
});

/**
 * Update contact relationship
 */
export const updateRelationship = mutation({
  args: {
    contactId: v.id("contacts"),
    relationship: v.union(
      v.literal("vip"),
      v.literal("regular"),
      v.literal("unknown")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      relationship: args.relationship,
    });

    return { success: true };
  },
});

/**
 * Update contact with AI-generated relationship summary
 */
export const updateRelationshipSummary = mutation({
  args: {
    contactId: v.id("contacts"),
    relationshipSummary: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      relationshipSummary: args.relationshipSummary,
    });

    return { success: true };
  },
});

/**
 * Get contact statistics
 */
export const getContactStats = query({
  args: {
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return null;

    // Get email count and recent emails
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_from", (q) => q.eq("from", args.contactId))
      .order("desc")
      .take(10);

    const urgentCount = emails.filter((e) => (e.urgencyScore ?? 0) > 80).length;
    const replyNeededCount = emails.filter((e) => e.triageAction === "reply_needed").length;

    return {
      contact,
      recentEmails: emails,
      stats: {
        totalEmails: contact.emailCount,
        urgentEmails: urgentCount,
        replyNeeded: replyNeededCount,
      },
    };
  },
});

/**
 * Get contact statistics by email address (searches all users' contacts)
 */
export const getContactStatsByEmail = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the contact by email (across all users for now)
    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!contact) return null;

    // Get email count and recent emails
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_from", (q) => q.eq("from", contact._id))
      .order("desc")
      .take(10);

    const urgentCount = emails.filter((e) => (e.urgencyScore ?? 0) > 80).length;
    const replyNeededCount = emails.filter((e) => e.triageAction === "reply_needed").length;

    return {
      contact,
      recentEmails: emails,
      stats: {
        totalEmails: contact.emailCount,
        urgentEmails: urgentCount,
        replyNeeded: replyNeededCount,
      },
    };
  },
});
