import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

// Determine the best unsubscribe method based on available options
export function determineUnsubscribeMethod(
  listUnsubscribe: string | undefined,
  listUnsubscribePost: boolean | undefined
): "http_post" | "http_get" | "mailto" | "none" {
  if (!listUnsubscribe) return "none";

  // Parse to find HTTP and mailto URLs
  const result: { httpUrl?: string; mailtoUrl?: string } = {};
  const matches = listUnsubscribe.matchAll(/<([^>]+)>/g);
  for (const match of matches) {
    const url = match[1];
    if (url.startsWith("http://") || url.startsWith("https://")) {
      result.httpUrl = url;
    } else if (url.startsWith("mailto:")) {
      result.mailtoUrl = url;
    }
  }

  // If we have HTTP URL and List-Unsubscribe-Post header, use one-click POST
  if (result.httpUrl && listUnsubscribePost) {
    return "http_post";
  }

  // If we have mailto, prefer that (more reliable than HTTP GET)
  if (result.mailtoUrl) {
    return "mailto";
  }

  // If we only have HTTP URL without POST support, it needs manual confirmation
  if (result.httpUrl) {
    return "http_get";
  }

  return "none";
}

// Internal mutation to upsert a subscription when an email with List-Unsubscribe is synced
export const upsertSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    listUnsubscribe: v.optional(v.string()),
    listUnsubscribePost: v.optional(v.boolean()),
    emailId: v.id("emails"),
    receivedAt: v.number(),
    subject: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Extract domain from sender email
    const domain = args.senderEmail.split("@")[1] || "";

    // Check if subscription already exists
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_sender", (q) =>
        q.eq("userId", args.userId).eq("senderEmail", args.senderEmail)
      )
      .first();

    const unsubscribeMethod = determineUnsubscribeMethod(
      args.listUnsubscribe,
      args.listUnsubscribePost
    );

    if (existing) {
      // Update existing subscription
      const updates: Partial<Doc<"subscriptions">> = {
        emailCount: existing.emailCount + 1,
        lastEmailAt: Math.max(existing.lastEmailAt, args.receivedAt),
      };

      // Update most recent email info if this is newer
      if (args.receivedAt > existing.lastEmailAt) {
        updates.mostRecentEmailId = args.emailId;
        if (args.subject) {
          updates.mostRecentSubject = args.subject;
        }
      }

      // Update unsubscribe info if we have better data now
      if (args.listUnsubscribe && (!existing.listUnsubscribe || unsubscribeMethod !== "none")) {
        updates.listUnsubscribe = args.listUnsubscribe;
        updates.listUnsubscribePost = args.listUnsubscribePost;
        updates.unsubscribeMethod = unsubscribeMethod;
      }

      // Update sender name if provided and we don't have one
      if (args.senderName && !existing.senderName) {
        updates.senderName = args.senderName;
      }

      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    // Create new subscription
    const subscriptionId = await ctx.db.insert("subscriptions", {
      userId: args.userId,
      senderEmail: args.senderEmail,
      senderDomain: domain,
      senderName: args.senderName,
      listUnsubscribe: args.listUnsubscribe,
      listUnsubscribePost: args.listUnsubscribePost,
      unsubscribeMethod,
      emailCount: 1,
      firstEmailAt: args.receivedAt,
      lastEmailAt: args.receivedAt,
      unsubscribeStatus: "subscribed",
      mostRecentEmailId: args.emailId,
      mostRecentSubject: args.subject,
    });

    return subscriptionId;
  },
});

// Query to get all subscriptions for a user (for the UI)
export const getSubscriptions = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    // Get user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) return [];

    // Get all subscriptions sorted by last email date
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_last_email", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return subscriptions;
  },
});

// Internal mutation to update subscription status
export const updateStatus = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    status: v.union(
      v.literal("subscribed"),
      v.literal("pending"),
      v.literal("processing"),
      v.literal("unsubscribed"),
      v.literal("failed"),
      v.literal("manual_required")
    ),
    unsubscribedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const updates: Partial<Doc<"subscriptions">> = {
      unsubscribeStatus: args.status,
    };
    if (args.unsubscribedAt) {
      updates.unsubscribedAt = args.unsubscribedAt;
    }
    await ctx.db.patch(args.subscriptionId, updates);
  },
});

// Internal query to get user by email
export const getUserByEmailInternal = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

// Internal query to get user by WorkOS ID
export const getUserByWorkosId = internalQuery({
  args: { workosId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
      .first();
  },
});

// Internal query to get user by ID
export const getUserByIdInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// Internal query to get subscription by ID
export const getSubscriptionById = internalQuery({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.subscriptionId);
  },
});

// Internal query to get emails that haven't been checked for subscriptions
export const getEmailsWithoutSubscriptionCheck = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get emails that haven't been processed yet (isSubscription is undefined)
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Filter to those without subscription check
    return emails.filter((e) => e.isSubscription === undefined);
  },
});

// Internal mutation to update email with subscription headers
export const updateEmailSubscriptionHeaders = internalMutation({
  args: {
    emailId: v.id("emails"),
    listUnsubscribe: v.optional(v.string()),
    listUnsubscribePost: v.optional(v.boolean()),
    isSubscription: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailId, {
      listUnsubscribe: args.listUnsubscribe,
      listUnsubscribePost: args.listUnsubscribePost,
      isSubscription: args.isSubscription,
    });
  },
});

// Internal query to get contact by ID
export const getContactById = internalQuery({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contactId);
  },
});

// Mutation to delete subscription records for a user (part of reset)
export const deleteSubscriptions = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const sub of subscriptions) {
      await ctx.db.delete(sub._id);
    }

    return { deleted: subscriptions.length };
  },
});

// Mutation to reset subscription flags on a batch of emails
export const resetEmailSubscriptionFlags = internalMutation({
  args: {
    emailIds: v.array(v.id("emails")),
  },
  handler: async (ctx, args) => {
    let reset = 0;
    for (const emailId of args.emailIds) {
      const email = await ctx.db.get(emailId);
      if (email) {
        await ctx.db.patch(emailId, {
          isSubscription: undefined,
          listUnsubscribe: undefined,
          listUnsubscribePost: undefined,
        });
        reset++;
      }
    }
    return { reset };
  },
});

// Query to get all email IDs for a user (for force rescan)
export const getEmailIdsForReset = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return emails.map((e) => e._id);
  },
});
