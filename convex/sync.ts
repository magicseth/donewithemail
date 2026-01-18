import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Process incoming email from Gmail webhook or polling
 */
export const processIncomingEmail = action({
  args: {
    userId: v.id("users"),
    rawEmail: v.object({
      id: v.string(),
      threadId: v.string(),
      from: v.object({
        email: v.string(),
        name: v.optional(v.string()),
      }),
      to: v.array(v.object({
        email: v.string(),
        name: v.optional(v.string()),
      })),
      cc: v.optional(v.array(v.object({
        email: v.string(),
        name: v.optional(v.string()),
      }))),
      subject: v.string(),
      bodyPreview: v.string(),
      bodyFull: v.string(),
      receivedAt: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const { userId, rawEmail } = args;

    // Upsert the sender contact
    const fromResult = await ctx.runMutation(internal.sync.upsertContactInternal, {
      userId,
      email: rawEmail.from.email,
      name: rawEmail.from.name,
    });

    // Upsert all recipient contacts
    const toContactIds = await Promise.all(
      rawEmail.to.map((recipient) =>
        ctx.runMutation(internal.sync.upsertContactInternal, {
          userId,
          email: recipient.email,
          name: recipient.name,
        })
      )
    );

    // Upsert CC contacts if present
    let ccContactIds: string[] = [];
    if (rawEmail.cc) {
      ccContactIds = await Promise.all(
        rawEmail.cc.map((recipient) =>
          ctx.runMutation(internal.sync.upsertContactInternal, {
            userId,
            email: recipient.email,
            name: recipient.name,
          })
        )
      );
    }

    // Store the email
    const emailResult = await ctx.runMutation(internal.sync.storeEmailInternal, {
      externalId: rawEmail.id,
      provider: "gmail",
      userId,
      from: fromResult.contactId,
      to: toContactIds.map((r) => r.contactId),
      cc: ccContactIds.length > 0 ? ccContactIds.map((r) => r.contactId) : undefined,
      subject: rawEmail.subject,
      bodyPreview: rawEmail.bodyPreview,
      bodyFull: rawEmail.bodyFull,
      receivedAt: rawEmail.receivedAt,
    });

    return {
      emailId: emailResult.emailId,
      isNew: emailResult.isNew,
      fromContactId: fromResult.contactId,
    };
  },
});

/**
 * Internal mutation to upsert contact (called from action)
 */
export const upsertContactInternal = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.optional(v.string()),
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
      await ctx.db.patch(existing._id, {
        name: args.name ?? existing.name,
        emailCount: existing.emailCount + 1,
        lastEmailAt: now,
      });

      return { contactId: existing._id, isNew: false };
    }

    const contactId = await ctx.db.insert("contacts", {
      userId: args.userId,
      email: args.email,
      name: args.name,
      emailCount: 1,
      lastEmailAt: now,
      relationship: "unknown",
    });

    return { contactId, isNew: true };
  },
});

/**
 * Internal mutation to store email (called from action)
 */
export const storeEmailInternal = internalMutation({
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
 * Get pending emails for AI processing
 */
export const getPendingForProcessing = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    return await ctx.db
      .query("aiProcessingQueue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(limit);
  },
});

/**
 * Mark queue item as processing
 */
export const markProcessing = mutation({
  args: {
    queueId: v.id("aiProcessingQueue"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, {
      status: "processing",
    });
  },
});

/**
 * Mark queue item as completed
 */
export const markCompleted = mutation({
  args: {
    queueId: v.id("aiProcessingQueue"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, {
      status: "completed",
      processedAt: Date.now(),
    });
  },
});

/**
 * Mark queue item as failed
 */
export const markFailed = mutation({
  args: {
    queueId: v.id("aiProcessingQueue"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, {
      status: "failed",
      error: args.error,
      processedAt: Date.now(),
    });
  },
});
