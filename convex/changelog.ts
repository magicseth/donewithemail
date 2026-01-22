import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get changelogs published since a given timestamp.
 * Used to show "what's new" to users when they open the app.
 */
export const getChangelogsSince = query({
  args: {
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { since } = args;
    const now = Date.now();

    // Get all changelogs published after 'since' timestamp and before now
    const changelogs = await ctx.db
      .query("changelogs")
      .withIndex("by_published")
      .filter((q) => {
        const afterSince = since ? q.gte(q.field("publishedAt"), since) : true;
        const beforeNow = q.lte(q.field("publishedAt"), now);
        return q.and(afterSince, beforeNow);
      })
      .order("desc")
      .collect();

    return changelogs;
  },
});

/**
 * Get all changelogs (for viewing in settings).
 */
export const getAllChangelogs = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Only show published changelogs
    const changelogs = await ctx.db
      .query("changelogs")
      .withIndex("by_published")
      .filter((q) => q.lte(q.field("publishedAt"), now))
      .order("desc")
      .collect();

    return changelogs;
  },
});

/**
 * Update user's last opened timestamp.
 * Called when the app starts to track when the user last opened the app.
 */
export const updateLastOpened = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .unique();

    if (!user) {
      // User record doesn't exist yet - this can happen if they authenticated
      // but the user record hasn't been created yet. Just skip updating.
      console.warn("updateLastOpened: User not found for email:", identity.email);
      return;
    }

    await ctx.db.patch(user._id, {
      lastOpenedAt: Date.now(),
    });
  },
});

/**
 * Get user's last opened timestamp.
 */
export const getLastOpened = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .unique();

    if (!user) {
      return null;
    }

    return user.lastOpenedAt ?? null;
  },
});

/**
 * Internal mutation to add a changelog entry.
 * This would typically be called by a deployment script or manually via the dashboard.
 */
export const addChangelog = internalMutation({
  args: {
    version: v.string(),
    title: v.string(),
    description: v.string(),
    type: v.union(
      v.literal("feature"),
      v.literal("improvement"),
      v.literal("bugfix"),
      v.literal("other")
    ),
    publishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.insert("changelogs", {
      version: args.version,
      title: args.title,
      description: args.description,
      type: args.type,
      createdAt: now,
      publishedAt: args.publishedAt ?? now,
    });
  },
});
