import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// Get all users with Gmail tokens
export const getUsersWithGmail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.filter((u) => {
      // Check direct Gmail tokens - require access token, refresh is optional but recommended
      if (u.gmailAccessToken) {
        // Warn if no refresh token (will fail once access token expires)
        if (!u.gmailRefreshToken) {
          console.warn(`User ${u.email} has access token but no refresh token - will need to re-authenticate when token expires`);
        }
        return true;
      }
      // Check legacy connectedProviders array
      if (u.connectedProviders) {
        const gmailProvider = u.connectedProviders.find(
          (p) => p.provider === "gmail"
        );
        if (gmailProvider?.accessToken) {
          return true;
        }
      }
      return false;
    });
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

// Update user tokens after WorkOS refresh (includes new single-use refresh token)
export const updateUserTokensWithWorkOS = internalMutation({
  args: {
    userId: v.id("users"),
    gmailAccessToken: v.string(),
    gmailTokenExpiresAt: v.number(),
    workosRefreshToken: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      gmailAccessToken: args.gmailAccessToken,
      gmailTokenExpiresAt: args.gmailTokenExpiresAt,
      workosRefreshToken: args.workosRefreshToken,
    });
  },
});

// Debug: Get all users with their token status
export const getAllUsersDebug = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      email: u.email,
      gmailRefreshToken: u.gmailRefreshToken,
      gmailAccessToken: u.gmailAccessToken,
      gmailTokenExpiresAt: u.gmailTokenExpiresAt,
      connectedProviders: u.connectedProviders,
    }));
  },
});

// Update Gmail tokens after Google refresh (doesn't touch WorkOS refresh token)
export const updateUserGmailTokens = internalMutation({
  args: {
    userId: v.id("users"),
    gmailAccessToken: v.string(),
    gmailTokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      gmailAccessToken: args.gmailAccessToken,
      gmailTokenExpiresAt: args.gmailTokenExpiresAt,
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
