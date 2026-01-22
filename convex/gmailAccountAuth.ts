import { v } from "convex/values";
import { action, mutation, query, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { encryptedPii } from "./pii";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

// Gmail scopes needed for the app
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

// Generate Google OAuth URL for linking additional Gmail accounts
export const getGmailAuthUrl = query({
  args: { redirectUri: v.string() },
  handler: async (_ctx, args) => {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: args.redirectUri,
      response_type: "code",
      scope: GMAIL_SCOPES,
      access_type: "offline",
      prompt: "consent", // Force consent to ensure refresh token
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },
});

// Link a new Gmail account to user's account
export const linkGmailAccount = action({
  args: {
    code: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args) => {
    // First, get the currently logged-in user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user from database
    const user = await ctx.runQuery(internal.users.getUserForAuth, {
      workosId: identity.subject,
      email: identity.email,
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Exchange code for tokens
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: args.code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: args.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Google OAuth error:", error);
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    const tokenData = await response.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;

    if (!accessToken) {
      throw new Error("No access token in response");
    }

    // Get user info from Google (for the NEW Gmail account being linked)
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!userInfoResponse.ok) {
      throw new Error("Failed to get user info from Google");
    }

    const userInfo = await userInfoResponse.json();
    const gmailEmail = userInfo.email;
    const displayName = userInfo.name;
    const avatarUrl = userInfo.picture;

    if (!gmailEmail) {
      throw new Error("No email in user info");
    }

    // Store the Gmail account linked to the CURRENT user (not the Gmail account's email)
    const accountId = await ctx.runMutation(internal.gmailAccountAuth.storeGmailAccountInternal, {
      userId: user._id,
      email: gmailEmail,
      accessToken,
      refreshToken,
      expiresIn,
      displayName,
      avatarUrl,
    });

    return {
      success: true,
      accountId,
      email: gmailEmail,
      displayName,
      avatarUrl,
    };
  },
});

// Store a Gmail account in the database
export const storeGmailAccount = mutation({
  args: {
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresIn: v.number(),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user by workosId first, then fall back to email
    const workosId = identity.subject;
    let user = workosId
      ? await ctx.db
          .query("users")
          .withIndex("by_workos_id", (q) => q.eq("workosId", workosId))
          .first()
      : null;

    if (!user && identity.email) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email!))
        .first();
    }

    if (!user) {
      throw new Error("User not found");
    }

    // Check if this Gmail account is already linked
    const existing = await ctx.db
      .query("gmailAccounts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", user._id).eq("email", args.email)
      )
      .first();

    if (existing) {
      // Update existing account with new tokens
      const pii = await encryptedPii.forUser(ctx, user._id);
      await ctx.db.patch(existing._id, {
        accessToken: await pii.encrypt(args.accessToken),
        refreshToken: args.refreshToken
          ? await pii.encrypt(args.refreshToken)
          : undefined,
        tokenExpiresAt: Date.now() + args.expiresIn * 1000,
        displayName: args.displayName
          ? await pii.encrypt(args.displayName)
          : undefined,
        avatarUrl: args.avatarUrl,
      });
      return existing._id;
    }

    // Check if this is the first Gmail account
    const existingAccounts = await ctx.db
      .query("gmailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const isPrimary = existingAccounts.length === 0;

    // Create new Gmail account
    const pii = await encryptedPii.forUser(ctx, user._id);
    const accountId = await ctx.db.insert("gmailAccounts", {
      userId: user._id,
      email: args.email,
      accessToken: await pii.encrypt(args.accessToken),
      refreshToken: args.refreshToken
        ? await pii.encrypt(args.refreshToken)
        : undefined,
      tokenExpiresAt: Date.now() + args.expiresIn * 1000,
      isPrimary,
      displayName: args.displayName
        ? await pii.encrypt(args.displayName)
        : undefined,
      avatarUrl: args.avatarUrl,
      createdAt: Date.now(),
    });

    return accountId;
  },
});

// Internal mutation for storing Gmail account (called from action with userId)
export const storeGmailAccountInternal = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresIn: v.number(),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if this Gmail account is already linked
    const existing = await ctx.db
      .query("gmailAccounts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email)
      )
      .first();

    if (existing) {
      // Update existing account with new tokens
      const pii = await encryptedPii.forUser(ctx, args.userId);
      await ctx.db.patch(existing._id, {
        accessToken: await pii.encrypt(args.accessToken),
        refreshToken: args.refreshToken
          ? await pii.encrypt(args.refreshToken)
          : undefined,
        tokenExpiresAt: Date.now() + args.expiresIn * 1000,
        displayName: args.displayName
          ? await pii.encrypt(args.displayName)
          : undefined,
        avatarUrl: args.avatarUrl,
      });
      return existing._id;
    }

    // Check if this is the first Gmail account
    const existingAccounts = await ctx.db
      .query("gmailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const isPrimary = existingAccounts.length === 0;

    // Create new Gmail account
    const pii = await encryptedPii.forUser(ctx, args.userId);
    const accountId = await ctx.db.insert("gmailAccounts", {
      userId: args.userId,
      email: args.email,
      accessToken: await pii.encrypt(args.accessToken),
      refreshToken: args.refreshToken
        ? await pii.encrypt(args.refreshToken)
        : undefined,
      tokenExpiresAt: Date.now() + args.expiresIn * 1000,
      isPrimary,
      displayName: args.displayName
        ? await pii.encrypt(args.displayName)
        : undefined,
      avatarUrl: args.avatarUrl,
      createdAt: Date.now(),
    });

    return accountId;
  },
});

// List all Gmail accounts for the current user
export const listGmailAccounts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get user by workosId first, then fall back to email
    const workosId = identity.subject;
    let user = workosId
      ? await ctx.db
          .query("users")
          .withIndex("by_workos_id", (q) => q.eq("workosId", workosId))
          .first()
      : null;

    if (!user && identity.email) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email!))
        .first();
    }

    if (!user) {
      return [];
    }

    const accounts = await ctx.db
      .query("gmailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Try to decrypt display names for UI (but don't fail if we can't)
    const pii = await encryptedPii.forUserQuery(ctx, user._id);

    const decrypted = await Promise.all(
      accounts.map(async (acc) => {
        let displayName: string | undefined;
        if (acc.displayName && pii) {
          try {
            displayName = await pii.decrypt(acc.displayName) ?? undefined;
          } catch {
            // Fall back to email if decryption fails
            displayName = undefined;
          }
        }
        return {
          _id: acc._id,
          email: acc.email,
          displayName,
          avatarUrl: acc.avatarUrl,
          isPrimary: acc.isPrimary,
          lastSyncAt: acc.lastSyncAt,
        };
      })
    );

    return decrypted;
  },
});

// Remove a Gmail account
export const removeGmailAccount = mutation({
  args: {
    accountId: v.id("gmailAccounts"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!user || account.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // Don't allow removing the primary account if there are others
    if (account.isPrimary) {
      const otherAccounts = await ctx.db
        .query("gmailAccounts")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      if (otherAccounts.length > 1) {
        throw new Error(
          "Cannot remove primary account. Make another account primary first."
        );
      }
    }

    // Delete the account
    await ctx.db.delete(args.accountId);

    // Note: Emails from this account will remain in the database
    // They won't be synced anymore but will still be accessible
  },
});

// Set an account as primary
export const setPrimaryAccount = mutation({
  args: {
    accountId: v.id("gmailAccounts"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const account = await ctx.db.get(args.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!user || account.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // Unset all other primary accounts
    const allAccounts = await ctx.db
      .query("gmailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const acc of allAccounts) {
      if (acc.isPrimary && acc._id !== args.accountId) {
        await ctx.db.patch(acc._id, { isPrimary: false });
      }
    }

    // Set this account as primary
    await ctx.db.patch(args.accountId, { isPrimary: true });
  },
});

// Check if user has any Gmail accounts connected
export const hasGmailAccounts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!user) {
      return false;
    }

    const accounts = await ctx.db
      .query("gmailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    return !!accounts;
  },
});
