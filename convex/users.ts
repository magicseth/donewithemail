import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get user by WorkOS ID
 */
export const getByWorkosId = query({
  args: {
    workosId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
      .first();
  },
});

/**
 * Get user by ID
 */
export const getUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Create or update user from WorkOS auth
 */
export const upsertFromWorkOS = mutation({
  args: {
    workosId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        avatarUrl: args.avatarUrl,
      });

      return { userId: existing._id, isNew: false };
    }

    const userId = await ctx.db.insert("users", {
      workosId: args.workosId,
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      connectedProviders: [],
      createdAt: Date.now(),
    });

    return { userId, isNew: true };
  },
});

/**
 * Connect a Gmail account to a user
 */
export const connectGmailAccount = mutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const otherProviders = user.connectedProviders.filter(
      (p) => p.provider !== "gmail"
    );

    await ctx.db.patch(args.userId, {
      connectedProviders: [
        ...otherProviders,
        {
          provider: "gmail",
          email: args.email,
          accessToken: args.accessToken,
          refreshToken: args.refreshToken,
          expiresAt: args.expiresAt,
        },
      ],
    });

    return { success: true };
  },
});

/**
 * Disconnect a provider from a user
 */
export const disconnectProvider = mutation({
  args: {
    userId: v.id("users"),
    provider: v.union(v.literal("gmail"), v.literal("outlook"), v.literal("imap")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(args.userId, {
      connectedProviders: user.connectedProviders.filter(
        (p) => p.provider !== args.provider
      ),
    });

    return { success: true };
  },
});

/**
 * Update user preferences
 */
export const updatePreferences = mutation({
  args: {
    userId: v.id("users"),
    preferences: v.object({
      autoProcessEmails: v.optional(v.boolean()),
      urgencyThreshold: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(args.userId, {
      preferences: {
        ...user.preferences,
        ...args.preferences,
      },
    });

    return { success: true };
  },
});

/**
 * Get connected provider info (without sensitive tokens)
 */
export const getConnectedProviders = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    return user.connectedProviders.map((p) => ({
      provider: p.provider,
      email: p.email,
      isConnected: true,
      expiresAt: p.expiresAt,
    }));
  },
});
