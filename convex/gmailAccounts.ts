/**
 * Gmail accounts - user-facing queries for managing multiple Gmail accounts
 */
import { v } from "convex/values";
import { authedQuery } from "./functions";

// Get all Gmail accounts for the authenticated user
export const getMyGmailAccounts = authedQuery({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db
      .query("gmailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect();

    return accounts.map((account) => ({
      _id: account._id,
      email: account.email,
      isPrimary: account.isPrimary,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      createdAt: account.createdAt,
    }));
  },
});

// Get Gmail account by email (for looking up which account to use)
export const getGmailAccountByEmail = authedQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("gmailAccounts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", ctx.userId).eq("email", args.email)
      )
      .first();

    if (!account) return null;

    return {
      _id: account._id,
      email: account.email,
      isPrimary: account.isPrimary,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
    };
  },
});
