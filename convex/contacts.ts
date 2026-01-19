import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { authedQuery, authedMutation } from "./functions";

// =============================================================================
// Internal Functions (used by email sync)
// =============================================================================

/**
 * Upsert a contact (create or update) - used by email sync
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

// =============================================================================
// Authenticated endpoints (require valid JWT)
// =============================================================================

/**
 * Get a contact by ID for the current user (with ownership check)
 */
export const getMyContact = authedQuery({
  args: {
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return null;

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    return contact;
  },
});

/**
 * Get contact by email address for the current user
 */
export const getMyContactByEmail = authedQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contacts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", ctx.userId).eq("email", args.email)
      )
      .first();
  },
});

/**
 * Get all contacts for the current user, sorted by last email
 */
export const getMyContacts = authedQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    return await ctx.db
      .query("contacts")
      .withIndex("by_user_last_email", (q) => q.eq("userId", ctx.userId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get VIP contacts for the current user
 */
export const getMyVIPContacts = authedQuery({
  args: {},
  handler: async (ctx) => {
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect();

    return contacts.filter((c) => c.relationship === "vip");
  },
});

/**
 * Update contact relationship for the current user
 */
export const updateMyContactRelationship = authedMutation({
  args: {
    contactId: v.id("contacts"),
    relationship: v.union(
      v.literal("vip"),
      v.literal("regular"),
      v.literal("unknown")
    ),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    await ctx.db.patch(args.contactId, {
      relationship: args.relationship,
    });

    return { success: true };
  },
});

/**
 * Update contact relationship summary for the current user
 */
export const updateMyContactRelationshipSummary = authedMutation({
  args: {
    contactId: v.id("contacts"),
    relationshipSummary: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    await ctx.db.patch(args.contactId, {
      relationshipSummary: args.relationshipSummary,
    });

    return { success: true };
  },
});

/**
 * Add a fact to a contact's dossier
 */
export const addFact = authedMutation({
  args: {
    contactId: v.id("contacts"),
    text: v.string(),
    source: v.union(v.literal("manual"), v.literal("ai")),
    sourceEmailId: v.optional(v.id("emails")),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    const newFact = {
      id: crypto.randomUUID(),
      text: args.text,
      source: args.source,
      createdAt: Date.now(),
      sourceEmailId: args.sourceEmailId,
    };

    const facts = contact.facts || [];
    await ctx.db.patch(args.contactId, {
      facts: [...facts, newFact],
    });

    return { success: true, factId: newFact.id };
  },
});

/**
 * Update an existing fact in a contact's dossier
 */
export const updateFact = authedMutation({
  args: {
    contactId: v.id("contacts"),
    factId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    const facts = contact.facts || [];
    const factIndex = facts.findIndex((f) => f.id === args.factId);
    if (factIndex === -1) {
      throw new Error("Fact not found");
    }

    const updatedFacts = [...facts];
    updatedFacts[factIndex] = {
      ...updatedFacts[factIndex],
      text: args.text,
    };

    await ctx.db.patch(args.contactId, {
      facts: updatedFacts,
    });

    return { success: true };
  },
});

/**
 * Delete a fact from a contact's dossier
 */
export const deleteFact = authedMutation({
  args: {
    contactId: v.id("contacts"),
    factId: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    const facts = contact.facts || [];
    const updatedFacts = facts.filter((f) => f.id !== args.factId);

    await ctx.db.patch(args.contactId, {
      facts: updatedFacts,
    });

    return { success: true };
  },
});

/**
 * Get contact statistics for the current user
 */
export const getMyContactStats = authedQuery({
  args: {
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return null;

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    // Get email count and recent emails
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_from", (q) => q.eq("from", args.contactId))
      .order("desc")
      .take(10);

    // Fetch summaries for all emails to calculate urgent count
    const emailsWithSummaries = await Promise.all(
      emails.map(async (email) => {
        const summaryData = await ctx.db
          .query("emailSummaries")
          .withIndex("by_email", (q) => q.eq("emailId", email._id))
          .first();
        return {
          ...email,
          urgencyScore: summaryData?.urgencyScore,
        };
      })
    );

    const urgentCount = emailsWithSummaries.filter((e) => (e.urgencyScore ?? 0) > 80).length;
    const replyNeededCount = emails.filter((e) => e.triageAction === "reply_needed").length;

    return {
      contact,
      recentEmails: emailsWithSummaries,
      stats: {
        totalEmails: contact.emailCount,
        urgentEmails: urgentCount,
        replyNeeded: replyNeededCount,
      },
    };
  },
});

/**
 * Get contact statistics by email address for the current user
 */
export const getMyContactStatsByEmail = authedQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the contact by email for the current user only
    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", ctx.userId).eq("email", args.email)
      )
      .first();

    if (!contact) return null;

    // Get email count and recent emails
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_from", (q) => q.eq("from", contact._id))
      .order("desc")
      .take(10);

    // Fetch summaries for all emails to calculate urgent count
    const emailsWithSummaries = await Promise.all(
      emails.map(async (email) => {
        const summaryData = await ctx.db
          .query("emailSummaries")
          .withIndex("by_email", (q) => q.eq("emailId", email._id))
          .first();
        return {
          ...email,
          urgencyScore: summaryData?.urgencyScore,
        };
      })
    );

    const urgentCount = emailsWithSummaries.filter((e) => (e.urgencyScore ?? 0) > 80).length;
    const replyNeededCount = emails.filter((e) => e.triageAction === "reply_needed").length;

    return {
      contact,
      recentEmails: emailsWithSummaries,
      stats: {
        totalEmails: contact.emailCount,
        urgentEmails: urgentCount,
        replyNeeded: replyNeededCount,
      },
    };
  },
});
