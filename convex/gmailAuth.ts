/**
 * Gmail authentication - OAuth flow, token management, and refresh.
 */
import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { encryptedPii } from "./pii";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

// Store Gmail tokens for a user
export const storeGmailTokens = mutation({
  args: {
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if user exists, create if not
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    // Get or create user ID for encryption
    let userId = existing?._id;
    if (!userId) {
      // Create minimal user first to get ID for encryption
      userId = await ctx.db.insert("users", {
        email: args.email,
      });
    }

    // Get PII helper for encrypting tokens
    const pii = await encryptedPii.forUser(ctx, userId);
    const encryptedAccessToken = await pii.encrypt(args.accessToken);
    const encryptedRefreshToken = await pii.encrypt(args.refreshToken);

    if (existing) {
      await ctx.db.patch(existing._id, {
        gmailAccessToken: encryptedAccessToken,
        gmailRefreshToken: encryptedRefreshToken,
        gmailTokenExpiresAt: args.expiresAt,
      });
      return existing._id;
    } else {
      // User was already created above, just patch with tokens
      await ctx.db.patch(userId, {
        gmailAccessToken: encryptedAccessToken,
        gmailRefreshToken: encryptedRefreshToken,
        gmailTokenExpiresAt: args.expiresAt,
      });
      return userId;
    }
  },
});

// Get Gmail auth URL
export const getGmailAuthUrl = query({
  args: { redirectUri: v.string() },
  handler: async (ctx, args) => {
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

// Exchange authorization code for tokens (action because it makes HTTP requests)
export const exchangeCodeForTokens = action({
  args: {
    code: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args) => {
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

    // Get user email from token
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const userInfo = await userInfoResponse.json();

    // Store tokens in database
    const expiresAt = Date.now() + tokens.expires_in * 1000;
    await ctx.runMutation(api.gmailAuth.storeGmailTokens, {
      email: userInfo.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || "",
      expiresAt,
    });

    return { email: userInfo.email, success: true };
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

    return !!(user?.gmailAccessToken && user?.gmailTokenExpiresAt && user.gmailTokenExpiresAt > Date.now());
  },
});

// ============================================================================
// Token refresh and photo helpers (used by gmailSync.ts)
// ============================================================================

/**
 * Refresh access token if expired.
 * Returns the current token if still valid, or refreshes and returns new token.
 */
export async function refreshTokenIfNeeded(
  accessToken: string,
  refreshToken: string,
  expiresAt: number
): Promise<{ accessToken: string; expiresAt: number; refreshed: boolean }> {
  // If token is still valid (with 5 min buffer), return it
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return { accessToken, expiresAt, refreshed: false };
  }

  // Refresh the token
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    refreshed: true,
  };
}

/**
 * Fetch profile photo URL from Google People API.
 * Searches both contacts and "other contacts" (people you've emailed).
 */
export async function fetchProfilePhotoUrl(
  accessToken: string,
  email: string
): Promise<string | undefined> {
  try {
    // First try to search in user's contacts
    const searchUrl = `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(email)}&readMask=photos,emailAddresses&pageSize=1`;

    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.results && searchData.results.length > 0) {
        const person = searchData.results[0].person;
        if (person?.photos && person.photos.length > 0) {
          return person.photos[0].url;
        }
      }
    }

    // Try "other contacts" (people you've emailed but aren't in contacts)
    const otherContactsUrl = `https://people.googleapis.com/v1/otherContacts:search?query=${encodeURIComponent(email)}&readMask=photos,emailAddresses&pageSize=1`;

    const otherResponse = await fetch(otherContactsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (otherResponse.ok) {
      const otherData = await otherResponse.json();
      if (otherData.results && otherData.results.length > 0) {
        const person = otherData.results[0].person;
        if (person?.photos && person.photos.length > 0) {
          return person.photos[0].url;
        }
      }
    }

    return undefined;
  } catch (error) {
    console.error("Error fetching profile photo URL:", error);
    return undefined;
  }
}

/**
 * Download image and return as blob.
 */
export async function downloadImage(imageUrl: string): Promise<Blob | undefined> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return undefined;
    return await response.blob();
  } catch (error) {
    console.error("Error downloading image:", error);
    return undefined;
  }
}

/**
 * Internal mutation to update user's OAuth tokens after refresh.
 */
export const updateUserTokens = internalMutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Get PII helper for encrypting token
    const pii = await encryptedPii.forUser(ctx, args.userId);
    const encryptedAccessToken = await pii.encrypt(args.accessToken);

    await ctx.db.patch(args.userId, {
      gmailAccessToken: encryptedAccessToken,
      gmailTokenExpiresAt: args.expiresAt,
    });
  },
});
