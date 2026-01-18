import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

// Generate Gmail OAuth URL
export const getGmailAuthUrl = query({
  args: { redirectUri: v.string() },
  handler: async (_ctx, args) => {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: args.redirectUri,
      response_type: "code",
      scope: GMAIL_SCOPES,
      access_type: "offline",
      prompt: "consent",
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },
});

// Exchange authorization code for tokens
export const exchangeCode = action({
  args: {
    code: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args) => {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code: args.code,
        grant_type: "authorization_code",
        redirect_uri: args.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens = await tokenResponse.json();

    // Get user email from Google
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    if (!userInfoResponse.ok) {
      throw new Error("Failed to get user info from Google");
    }

    const userInfo = await userInfoResponse.json();

    // Store tokens in database
    const expiresAt = Date.now() + tokens.expires_in * 1000;
    await ctx.runMutation(api.gmailOAuth.storeGmailTokens, {
      email: userInfo.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || "",
      expiresAt,
    });

    return { email: userInfo.email, success: true };
  },
});

// Store Gmail tokens for a user
export const storeGmailTokens = mutation({
  args: {
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Find or create user
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        gmailAccessToken: args.accessToken,
        gmailRefreshToken: args.refreshToken,
        gmailTokenExpiresAt: args.expiresAt,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("users", {
        email: args.email,
        gmailAccessToken: args.accessToken,
        gmailRefreshToken: args.refreshToken,
        gmailTokenExpiresAt: args.expiresAt,
      });
    }
  },
});

// Check if user has Gmail connected
export const hasGmailConnected = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    return !!(
      user?.gmailAccessToken &&
      user?.gmailTokenExpiresAt &&
      user.gmailTokenExpiresAt > Date.now()
    );
  },
});
