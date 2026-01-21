import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { encryptedPii, encryptString, decryptString, decryptJson } from "./pii";
import { ConnectedProvider } from "./schema";

// Get all users with Gmail tokens (returns user IDs and emails only - tokens are encrypted)
// Call decryptUserTokens mutation to get actual token values
export const getUsersWithGmail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.filter((u) => {
      // Check direct Gmail tokens - encrypted field exists if truthy
      if (u.gmailAccessToken) {
        // Warn if no refresh token (will fail once access token expires)
        if (!u.gmailRefreshToken) {
          console.warn(`User ${u.email} has access token but no refresh token - will need to re-authenticate when token expires`);
        }
        return true;
      }
      // Check legacy connectedProviders (encrypted JSON) - just check if it exists
      if (u.connectedProviders) {
        // Can't decrypt in query, but presence indicates some provider exists
        return true;
      }
      return false;
    });
  },
});

// Decrypt user tokens for API use (must be called from mutation/action context)
export const decryptUserTokens = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const pii = await encryptedPii.forUser(ctx, args.userId);

    let gmailAccessToken: string | null = null;
    let gmailRefreshToken: string | null = null;
    let workosRefreshToken: string | null = null;
    let connectedProviders: ConnectedProvider[] | null = null;

    if (user.gmailAccessToken) {
      gmailAccessToken = await pii.decrypt(user.gmailAccessToken);
    }
    if (user.gmailRefreshToken) {
      gmailRefreshToken = await pii.decrypt(user.gmailRefreshToken);
    }
    if (user.workosRefreshToken) {
      workosRefreshToken = await pii.decrypt(user.workosRefreshToken);
    }
    if (user.connectedProviders) {
      const json = await pii.decrypt(user.connectedProviders);
      if (json) {
        connectedProviders = JSON.parse(json) as ConnectedProvider[];
      }
    }

    return {
      _id: user._id,
      email: user.email,
      gmailAccessToken,
      gmailRefreshToken,
      workosRefreshToken,
      gmailTokenExpiresAt: user.gmailTokenExpiresAt,
      connectedProviders,
    };
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
    const pii = await encryptedPii.forUser(ctx, args.userId);
    await ctx.db.patch(args.userId, {
      gmailAccessToken: await pii.encrypt(args.gmailAccessToken),
      gmailTokenExpiresAt: args.gmailTokenExpiresAt,
      workosRefreshToken: await pii.encrypt(args.workosRefreshToken),
    });
  },
});

// Debug: Get all users with their token status (shows if tokens exist, not actual values)
export const getAllUsersDebug = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      email: u.email,
      hasGmailRefreshToken: !!u.gmailRefreshToken,
      hasGmailAccessToken: !!u.gmailAccessToken,
      gmailTokenExpiresAt: u.gmailTokenExpiresAt,
      hasConnectedProviders: !!u.connectedProviders,
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
    const pii = await encryptedPii.forUser(ctx, args.userId);
    await ctx.db.patch(args.userId, {
      gmailAccessToken: await pii.encrypt(args.gmailAccessToken),
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
