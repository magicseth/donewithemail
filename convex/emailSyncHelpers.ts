import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// Get all users with Gmail tokens
export const getUsersWithGmail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.filter((u) => u.gmailAccessToken && u.gmailRefreshToken);
  },
});

// Update last sync timestamp
export const updateLastSync = internalMutation({
  args: {
    userId: v.id("users"),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      lastEmailSyncAt: args.timestamp,
    });
  },
});

// Check if an email already exists in our database
export const checkEmailExists = internalQuery({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    const email = await ctx.db
      .query("emails")
      .withIndex("by_external_id", (q) =>
        q.eq("externalId", args.externalId).eq("provider", "gmail")
      )
      .first();
    return !!email;
  },
});
