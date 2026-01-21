import { v } from "convex/values";
import { mutation, internalQuery, query } from "./_generated/server";
import { authedQuery, authedMutation } from "./functions";
import { encryptedPii } from "./pii";

// Type for connected provider (decrypted)
interface ConnectedProvider {
  provider: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

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
      // Get PII helper for encryption
      const pii = await encryptedPii.forUser(ctx, existing._id);
      const encryptedName = args.name ? await pii.encrypt(args.name) : undefined;

      await ctx.db.patch(existing._id, {
        email: args.email,
        name: encryptedName,
        avatarUrl: args.avatarUrl,
      });

      return { userId: existing._id, isNew: false };
    }

    // For new users, we need to create the user first, then encrypt
    // Create with empty connectedProviders (will encrypt after we have userId)
    const userId = await ctx.db.insert("users", {
      workosId: args.workosId,
      email: args.email,
      avatarUrl: args.avatarUrl,
      createdAt: Date.now(),
    });

    // Now encrypt name and connectedProviders with the new userId
    const pii = await encryptedPii.forUser(ctx, userId);
    const encryptedName = args.name ? await pii.encrypt(args.name) : undefined;
    const encryptedProviders = await pii.encrypt(JSON.stringify([]));

    await ctx.db.patch(userId, {
      name: encryptedName,
      connectedProviders: encryptedProviders,
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

    // Get PII helper
    const pii = await encryptedPii.forUser(ctx, args.userId);

    // Decrypt existing connectedProviders
    let existingProviders: ConnectedProvider[] = [];
    if (user.connectedProviders) {
      const decrypted = await pii.decrypt(user.connectedProviders);
      if (decrypted) {
        existingProviders = JSON.parse(decrypted);
      }
    }

    const otherProviders = existingProviders.filter(
      (p) => p.provider !== "gmail"
    );

    const newProviders = [
      ...otherProviders,
      {
        provider: "gmail",
        email: args.email,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
      },
    ];

    // Re-encrypt and save
    const encryptedProviders = await pii.encrypt(JSON.stringify(newProviders));
    await ctx.db.patch(args.userId, {
      connectedProviders: encryptedProviders,
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
    // Decrypt connectedProviders
    const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);
    let providers: ConnectedProvider[] = [];
    if (pii && ctx.user.connectedProviders) {
      const decrypted = await pii.decrypt(ctx.user.connectedProviders);
      if (decrypted) {
        providers = JSON.parse(decrypted);
      }
    }

    return providers.map((p) => ({
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
    // Get PII helper
    const pii = await encryptedPii.forUser(ctx, ctx.userId);

    // Decrypt existing connectedProviders
    let existingProviders: ConnectedProvider[] = [];
    if (ctx.user.connectedProviders) {
      const decrypted = await pii.decrypt(ctx.user.connectedProviders);
      if (decrypted) {
        existingProviders = JSON.parse(decrypted);
      }
    }

    const filteredProviders = existingProviders.filter(
      (p) => p.provider !== args.provider
    );

    // Re-encrypt and save
    const encryptedProviders = await pii.encrypt(JSON.stringify(filteredProviders));
    await ctx.db.patch(ctx.userId, {
      connectedProviders: encryptedProviders,
    });

    return { success: true };
  },
});
