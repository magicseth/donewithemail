import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { encryptedPii } from "./pii";
import { Id } from "./_generated/dataModel";

// Get all Gmail accounts that need syncing
export const getGmailAccountsForSync = internalQuery({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("gmailAccounts").collect();
    return accounts.map((acc) => ({
      _id: acc._id,
      userId: acc.userId,
      email: acc.email,
      lastSyncAt: acc.lastSyncAt,
      tokenExpiresAt: acc.tokenExpiresAt,
    }));
  },
});

// Decrypt Gmail account tokens for API use
export const decryptGmailAccountTokens = internalMutation({
  args: {
    accountId: v.id("gmailAccounts"),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return null;

    const pii = await encryptedPii.forUser(ctx, account.userId);

    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    let workosRefreshToken: string | null = null;

    if (account.accessToken) {
      accessToken = await pii.decrypt(account.accessToken);
    }
    if (account.refreshToken) {
      refreshToken = await pii.decrypt(account.refreshToken);
    }
    if (account.workosRefreshToken) {
      workosRefreshToken = await pii.decrypt(account.workosRefreshToken);
    }

    return {
      _id: account._id,
      userId: account.userId,
      email: account.email,
      accessToken,
      refreshToken,
      workosRefreshToken,
      tokenExpiresAt: account.tokenExpiresAt,
      lastSyncAt: account.lastSyncAt,
    };
  },
});

// Update Gmail account tokens after refresh
export const updateGmailAccountTokens = internalMutation({
  args: {
    accountId: v.id("gmailAccounts"),
    accessToken: v.string(),
    tokenExpiresAt: v.number(),
    refreshToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    const pii = await encryptedPii.forUser(ctx, account.userId);

    const updates: any = {
      accessToken: await pii.encrypt(args.accessToken),
      tokenExpiresAt: args.tokenExpiresAt,
    };

    if (args.refreshToken) {
      updates.refreshToken = await pii.encrypt(args.refreshToken);
    }

    await ctx.db.patch(args.accountId, updates);
  },
});

// Update last sync time for a Gmail account
export const updateGmailAccountLastSync = internalMutation({
  args: {
    accountId: v.id("gmailAccounts"),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, {
      lastSyncAt: args.timestamp,
    });
  },
});

// Get user ID from Gmail account ID
export const getUserIdFromAccount = internalQuery({
  args: {
    accountId: v.id("gmailAccounts"),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    return account?.userId ?? null;
  },
});

// Get Gmail account by email for a specific user
export const getGmailAccountByEmail = internalQuery({
  args: {
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // First find the user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) {
      // Try to find Gmail account directly by email
      const account = await ctx.db
        .query("gmailAccounts")
        .withIndex("by_email", (q) => q.eq("email", args.userEmail))
        .first();
      return account ? { _id: account._id, userId: account.userId } : null;
    }

    // Find Gmail account for this user with matching email
    // Don't fall back to "any account" - we need exact email match for sending
    const account = await ctx.db
      .query("gmailAccounts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", user._id).eq("email", args.userEmail)
      )
      .first();

    if (account) {
      return { _id: account._id, userId: account.userId };
    }

    // No exact match found - return null so caller can fall back to legacy user tokens
    return null;
  },
});
