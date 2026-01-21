import { v } from "convex/values";
import { mutation, internalQuery, query } from "./_generated/server";
import { authedQuery, authedMutation } from "./functions";

// Debug: list all users (for CLI/dashboard use)
export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

// =============================================================================
// Auth Flow Functions (used by WorkOS callback)
// =============================================================================

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

    const otherProviders = (user.connectedProviders || []).filter(
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

// =============================================================================
// Internal queries for auth system
// =============================================================================

/**
 * Internal: Get user by ID
 */
export const get = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Internal: Get user by WorkOS ID or email (for auth system)
 */
export const getUserForAuth = internalQuery({
  args: {
    workosId: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.workosId) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
        .first();
      if (user) return user;
    }

    if (args.email) {
      return await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.email!))
        .first();
    }

    return null;
  },
});

// =============================================================================
// Authenticated endpoints (require valid JWT)
// =============================================================================

/**
 * Get the current authenticated user
 */
export const getMe = authedQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.user;
  },
});

/**
 * Get connected providers for the current user
 */
export const getMyConnectedProviders = authedQuery({
  args: {},
  handler: async (ctx) => {
    return (ctx.user.connectedProviders || []).map((p) => ({
      provider: p.provider,
      email: p.email,
      isConnected: true,
      expiresAt: p.expiresAt,
    }));
  },
});

/**
 * Update current user's preferences
 */
export const updateMyPreferences = authedMutation({
  args: {
    preferences: v.object({
      autoProcessEmails: v.optional(v.boolean()),
      urgencyThreshold: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.userId, {
      preferences: {
        ...ctx.user.preferences,
        ...args.preferences,
      },
    });

    return { success: true };
  },
});

/**
 * Disconnect a provider from current user
 */
export const disconnectMyProvider = authedMutation({
  args: {
    provider: v.union(v.literal("gmail"), v.literal("outlook"), v.literal("imap")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.userId, {
      connectedProviders: (ctx.user.connectedProviders || []).filter(
        (p) => p.provider !== args.provider
      ),
    });

    return { success: true };
  },
});
