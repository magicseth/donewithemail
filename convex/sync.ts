import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Generate avatar URL from name/email
// Uses UI Avatars service which generates nice initials-based profile photos
function getAvatarUrl(name: string | undefined, email: string): string {
  // Use name if available, otherwise use first part of email
  const displayName = name || email.split("@")[0];
  // URL encode the name for the API
  const encoded = encodeURIComponent(displayName);
  // Generate a consistent background color based on email
  const colors = ["6366F1", "8B5CF6", "EC4899", "F59E0B", "10B981", "3B82F6", "EF4444"];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash) + email.charCodeAt(i);
    hash = hash & hash;
  }
  const colorIndex = Math.abs(hash) % colors.length;
  const bgColor = colors[colorIndex];
  
  return `https://ui-avatars.com/api/?name=${encoded}&background=${bgColor}&color=fff&size=200&bold=true`;
}

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
  handler: async (ctx, args): Promise<{
    emailId: Id<"emails">;
    isNew: boolean;
    fromContactId: Id<"contacts">;
  }> => {
    const { userId, rawEmail } = args;

    // Upsert the sender contact
    const fromResult: { contactId: Id<"contacts">; isNew: boolean } = await ctx.runMutation(
      internal.sync.upsertContactInternal,
      {
        userId,
        email: rawEmail.from.email,
        name: rawEmail.from.name,
      }
    );

    // Upsert all recipient contacts
    const toContactIds: { contactId: Id<"contacts">; isNew: boolean }[] = await Promise.all(
      rawEmail.to.map((recipient): Promise<{ contactId: Id<"contacts">; isNew: boolean }> =>
        ctx.runMutation(internal.sync.upsertContactInternal, {
          userId,
          email: recipient.email,
          name: recipient.name,
        })
      )
    );

    // Upsert CC contacts if present
    let ccContactIds: { contactId: Id<"contacts">; isNew: boolean }[] = [];
    if (rawEmail.cc) {
      ccContactIds = await Promise.all(
        rawEmail.cc.map((recipient): Promise<{ contactId: Id<"contacts">; isNew: boolean }> =>
          ctx.runMutation(internal.sync.upsertContactInternal, {
            userId,
            email: recipient.email,
            name: recipient.name,
          })
        )
      );
    }

    // Store the email
    const emailResult: { emailId: Id<"emails">; isNew: boolean } = await ctx.runMutation(
      internal.sync.storeEmailInternal,
      {
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
      }
    );

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
  handler: async (ctx, args): Promise<{ contactId: Id<"contacts">; isNew: boolean }> => {
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email)
      )
      .first();

    const now = Date.now();

    if (existing) {
      // Update name and avatar if we have a better name now
      const updates: Record<string, unknown> = {
        emailCount: existing.emailCount + 1,
        lastEmailAt: now,
      };
      
      if (args.name && args.name !== existing.name) {
        updates.name = args.name;
        // Regenerate avatar with new name
        updates.avatarUrl = getAvatarUrl(args.name, args.email);
      }
      
      // If no avatar exists, generate one
      if (!existing.avatarUrl) {
        updates.avatarUrl = getAvatarUrl(args.name || existing.name, args.email);
      }
      
      await ctx.db.patch(existing._id, updates);

      return { contactId: existing._id, isNew: false };
    }

    // Generate avatar URL for new contact
    const avatarUrl = getAvatarUrl(args.name, args.email);

    const contactId = await ctx.db.insert("contacts", {
      userId: args.userId,
      email: args.email,
      name: args.name,
      avatarUrl,
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
  handler: async (ctx, args): Promise<{ emailId: Id<"emails">; isNew: boolean }> => {
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

/**
 * Backfill avatar URLs for existing contacts that don't have one
 */
export const backfillAvatarUrls = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all contacts without avatarUrl
    const contacts = await ctx.db.query("contacts").collect();
    
    let updated = 0;
    for (const contact of contacts) {
      if (!contact.avatarUrl) {
        const avatarUrl = getAvatarUrl(contact.name, contact.email);
        await ctx.db.patch(contact._id, { avatarUrl });
        updated++;
      }
    }
    
    return { updated, total: contacts.length };
  },
});
