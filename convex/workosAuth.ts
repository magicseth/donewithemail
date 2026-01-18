import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { api } from "./_generated/api";

const WORKOS_API_KEY = process.env.WORKOS_API_KEY!;

// Get user's OAuth tokens from WorkOS by their WorkOS user ID
export const getOAuthTokens = action({
  args: {
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get user from WorkOS API
    const response = await fetch(
      `https://api.workos.com/user_management/users/${args.workosUserId}`,
      {
        headers: {
          Authorization: `Bearer ${WORKOS_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WorkOS API error: ${response.status} - ${error}`);
    }

    const user = await response.json();

    // Log the full response to see what's available
    console.log("WorkOS user response:", JSON.stringify(user, null, 2));

    // Check for identities with OAuth tokens
    const identities = user.identities || [];
    console.log("User identities:", JSON.stringify(identities, null, 2));

    // Find Google identity
    const googleIdentity = identities.find(
      (i: any) =>
        i.provider === "GoogleOAuth" ||
        i.type === "OAuth" ||
        i.idp_id?.includes("google")
    );

    if (googleIdentity) {
      console.log("Google identity found:", JSON.stringify(googleIdentity, null, 2));
    }

    return {
      user,
      identities,
      googleIdentity,
    };
  },
});

// Sync OAuth tokens from WorkOS to our database
export const syncOAuthTokens = action({
  args: {
    workosUserId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Get user from WorkOS API
    const response = await fetch(
      `https://api.workos.com/user_management/users/${args.workosUserId}`,
      {
        headers: {
          Authorization: `Bearer ${WORKOS_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WorkOS API error: ${response.status} - ${error}`);
    }

    const user = await response.json();
    console.log("WorkOS user for sync:", JSON.stringify(user, null, 2));

    // Look for OAuth tokens in various places
    const identities = user.identities || [];

    // Try to find Google OAuth tokens
    let accessToken: string | undefined;
    let refreshToken: string | undefined;

    for (const identity of identities) {
      console.log("Checking identity:", JSON.stringify(identity, null, 2));

      // Check various possible locations for tokens
      accessToken =
        identity.access_token ||
        identity.accessToken ||
        identity.oauth_access_token ||
        identity.credentials?.access_token;

      refreshToken =
        identity.refresh_token ||
        identity.refreshToken ||
        identity.oauth_refresh_token ||
        identity.credentials?.refresh_token;

      if (accessToken) {
        console.log("Found access token in identity");
        break;
      }
    }

    if (accessToken) {
      // Store tokens in database
      await ctx.runMutation(api.workosAuth.storeTokens, {
        email: args.email,
        workosUserId: args.workosUserId,
        accessToken,
        refreshToken,
      });

      return { success: true, hasTokens: true };
    }

    return {
      success: false,
      hasTokens: false,
      message: "No OAuth tokens found in WorkOS user identities. Make sure 'Return Google OAuth tokens' is enabled in WorkOS dashboard.",
      identities,
    };
  },
});

// Store tokens in database
export const storeTokens = mutation({
  args: {
    email: v.string(),
    workosUserId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    const updates = {
      workosId: args.workosUserId,
      gmailAccessToken: args.accessToken,
      gmailRefreshToken: args.refreshToken,
      gmailTokenExpiresAt: Date.now() + 3600 * 1000, // 1 hour
    };

    if (existing) {
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    } else {
      return await ctx.db.insert("users", {
        email: args.email,
        ...updates,
      });
    }
  },
});
