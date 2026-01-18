import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID!;
const WORKOS_API_KEY = process.env.WORKOS_API_KEY!;

// Generate the WorkOS authorization URL
export const getAuthUrl = query({
  args: { redirectUri: v.string() },
  handler: async (_ctx, args) => {
    const params = new URLSearchParams({
      client_id: WORKOS_CLIENT_ID,
      redirect_uri: args.redirectUri,
      response_type: "code",
      provider: "GoogleOAuth",
    });

    return `https://api.workos.com/user_management/authorize?${params.toString()}`;
  },
});

// Exchange authorization code for tokens
export const authenticate = action({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    // Call WorkOS authenticate API
    const response = await fetch(
      "https://api.workos.com/user_management/authenticate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: WORKOS_CLIENT_ID,
          client_secret: WORKOS_API_KEY,
          grant_type: "authorization_code",
          code: args.code,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("WorkOS authenticate error:", error);
      throw new Error(`Authentication failed: ${error}`);
    }

    const data = await response.json();
    console.log("WorkOS authenticate response:", JSON.stringify(data, null, 2));

    // Extract user info
    const user = data.user;
    if (!user?.email) {
      throw new Error("No user email in response");
    }

    // Extract OAuth tokens (if "Return Google OAuth tokens" is enabled)
    const oauthTokens = data.oauth_tokens || data.oauthTokens;
    console.log("OAuth tokens:", JSON.stringify(oauthTokens, null, 2));

    const googleAccessToken = oauthTokens?.access_token || oauthTokens?.accessToken;
    const googleRefreshToken = oauthTokens?.refresh_token || oauthTokens?.refreshToken;

    // Store user and tokens in database
    const userId = await ctx.runMutation(api.auth.upsertUser, {
      email: user.email,
      workosUserId: user.id,
      name: user.first_name
        ? `${user.first_name} ${user.last_name || ""}`.trim()
        : undefined,
      avatarUrl: user.profile_picture_url,
      accessToken: data.access_token, // WorkOS session token
      refreshToken: data.refresh_token,
      googleAccessToken,
      googleRefreshToken,
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        avatarUrl: user.profile_picture_url,
      },
      accessToken: data.access_token,
      hasGmailAccess: !!googleAccessToken,
    };
  },
});

// Upsert user in database
export const upsertUser = mutation({
  args: {
    email: v.string(),
    workosUserId: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    googleAccessToken: v.optional(v.string()),
    googleRefreshToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    const userData = {
      email: args.email,
      workosId: args.workosUserId,
      name: args.name,
      avatarUrl: args.avatarUrl,
      gmailAccessToken: args.googleAccessToken,
      gmailRefreshToken: args.googleRefreshToken,
      gmailTokenExpiresAt: args.googleAccessToken
        ? Date.now() + 3600 * 1000
        : undefined,
    };

    if (existing) {
      await ctx.db.patch(existing._id, userData);
      return existing._id;
    } else {
      return await ctx.db.insert("users", userData);
    }
  },
});

// Get current user by email
export const getUser = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

// Check if user has Gmail access
export const hasGmailAccess = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    return !!(user?.gmailAccessToken);
  },
});
