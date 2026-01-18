"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { WorkOS } from "@workos-inc/node";

const WORKOS_API_KEY = process.env.WORKOS_API_KEY!;
const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID!;

// Refresh access token using WorkOS
async function refreshTokensWithWorkOS(
  workosRefreshToken: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const workos = new WorkOS(WORKOS_API_KEY);

  const result = await workos.userManagement.authenticateWithRefreshToken({
    clientId: WORKOS_CLIENT_ID,
    refreshToken: workosRefreshToken,
  });

  // Debug: Log the full response structure
  console.log("[DEBUG] WorkOS refresh response keys:", Object.keys(result));
  console.log("[DEBUG] WorkOS refresh response:", JSON.stringify(result, null, 2));

  // Extract Google OAuth tokens from the response
  const oauthTokens = (result as any).oauthTokens || (result as any).oauth_tokens;
  console.log("[DEBUG] oauthTokens:", oauthTokens);

  const googleAccessToken = oauthTokens?.access_token || oauthTokens?.accessToken;

  if (!googleAccessToken) {
    throw new Error("No Google access token in WorkOS refresh response");
  }

  return {
    accessToken: googleAccessToken,
    refreshToken: result.refreshToken, // New WorkOS refresh token (single use)
    expiresAt: Date.now() + 3600 * 1000, // Google tokens typically expire in 1 hour
  };
}

// Debug: Get all users to see their token status
export const debugUserTokens = internalAction({
  args: {},
  handler: async (ctx): Promise<Array<{ email: string; hasAccessToken: boolean; hasWorkosRefreshToken: boolean; expiresAt?: number; expiresAtFormatted?: string; isExpired?: boolean }>> => {
    const allUsers: Array<{
      email: string;
      workosRefreshToken?: string;
      gmailAccessToken?: string;
      gmailTokenExpiresAt?: number;
    }> = await ctx.runQuery(internal.emailSyncHelpers.getAllUsersDebug, {});
    console.log("All users token status:");
    const now = Date.now();
    for (const u of allUsers) {
      const expiresAt = u.gmailTokenExpiresAt;
      const isExpired = expiresAt ? now >= expiresAt : undefined;
      const expiresFormatted = expiresAt ? new Date(expiresAt).toISOString() : "N/A";
      const timeUntilExpiry = expiresAt ? Math.round((expiresAt - now) / 1000 / 60) : undefined;
      console.log(`  ${u.email}:`);
      console.log(`    accessToken=${!!u.gmailAccessToken}`);
      console.log(`    workosRefreshToken=${!!u.workosRefreshToken}`);
      console.log(`    expiresAt=${expiresFormatted} (${isExpired ? "EXPIRED" : `expires in ${timeUntilExpiry} min`})`);
    }
    return allUsers.map((u) => {
      const expiresAt = u.gmailTokenExpiresAt;
      const isExpired = expiresAt ? now >= expiresAt : undefined;
      return {
        email: u.email,
        hasAccessToken: !!u.gmailAccessToken,
        hasWorkosRefreshToken: !!u.workosRefreshToken,
        expiresAt: u.gmailTokenExpiresAt,
        expiresAtFormatted: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        isExpired,
      };
    });
  },
});

// Check for new emails for all users (called by cron)
export const checkNewEmailsForAllUsers = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all users with Gmail tokens
    const users = await ctx.runQuery(internal.emailSyncHelpers.getUsersWithGmail, {});

    console.log(`Checking new emails for ${users.length} users`);

    // Log token expiration for each user
    const now = Date.now();
    for (const user of users) {
      const expiresAt = user.gmailTokenExpiresAt;
      const isExpired = expiresAt ? now >= expiresAt : undefined;
      const timeUntilExpiry = expiresAt ? Math.round((expiresAt - now) / 1000 / 60) : undefined;
      const expiresFormatted = expiresAt ? new Date(expiresAt).toISOString() : "N/A";
      const hasGoogleRefresh = !!(user as any).gmailRefreshToken;
      console.log(`  User ${user.email}: expiresAt=${expiresFormatted} (${isExpired ? "EXPIRED" : `expires in ${timeUntilExpiry} min`}), hasGoogleRefreshToken=${hasGoogleRefresh}`);
    }

    // Debug: Log why users might be missing
    if (users.length === 0) {
      const allUsers = await ctx.runQuery(internal.emailSyncHelpers.getAllUsersDebug, {});
      console.log(`Total users in database: ${allUsers.length}`);
      for (const u of allUsers) {
        console.log(`  User ${u.email}: accessToken=${!!u.gmailAccessToken}, workosRefreshToken=${!!u.workosRefreshToken}, expiresAt=${u.gmailTokenExpiresAt}`);
      }
    }

    for (const user of users) {
      try {
        await checkNewEmailsForUser(ctx, user);
      } catch (error) {
        console.error(`Failed to check emails for user ${user.email}:`, error);
      }
    }
  },
});

// Check for new emails for a single user
async function checkNewEmailsForUser(
  ctx: any,
  user: {
    _id: any;
    email: string;
    workosRefreshToken?: string;
    gmailAccessToken?: string;
    gmailTokenExpiresAt?: number;
    lastEmailSyncAt?: number;
  }
) {
  if (!user.gmailAccessToken) {
    console.log(`User ${user.email} has no Gmail access token, skipping`);
    return;
  }

  // Check if token is expired (with 5 minute buffer)
  const tokenExpired = user.gmailTokenExpiresAt && Date.now() >= (user.gmailTokenExpiresAt - 5 * 60 * 1000);

  // DEBUG: Always try to refresh if we have a workosRefreshToken, to test the refresh flow
  const shouldRefresh = !!user.workosRefreshToken;

  // Refresh token if needed and possible
  let accessToken = user.gmailAccessToken;
  if (shouldRefresh) {
    try {
      console.log(`[DEBUG] Attempting token refresh for ${user.email} (expired=${tokenExpired})...`);
      const refreshed = await refreshTokensWithWorkOS(user.workosRefreshToken!);
      accessToken = refreshed.accessToken;

      // Update both the Gmail access token AND the WorkOS refresh token (single use)
      await ctx.runMutation(internal.emailSyncHelpers.updateUserTokensWithWorkOS, {
        userId: user._id,
        gmailAccessToken: refreshed.accessToken,
        gmailTokenExpiresAt: refreshed.expiresAt,
        workosRefreshToken: refreshed.refreshToken,
      });
      console.log(`[DEBUG] Tokens refreshed successfully for ${user.email}`);
    } catch (error) {
      console.error(`[DEBUG] Token refresh failed for ${user.email}:`, error);
      // If refresh fails but token isn't expired, continue with existing token
      if (tokenExpired) {
        return;
      }
      console.log(`[DEBUG] Token not expired, continuing with existing token for ${user.email}`);
    }
  }

  // Get last sync time (default to 1 hour ago if never synced)
  const lastSync = user.lastEmailSyncAt || Date.now() - 60 * 60 * 1000;

  // Query Gmail for messages newer than last sync
  // Using the 'after' query parameter with epoch seconds
  const afterEpoch = Math.floor(lastSync / 1000);
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=INBOX&q=after:${afterEpoch}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error(`Gmail API error for ${user.email}: ${response.status}`);
    return;
  }

  const data = await response.json();
  const messages = data.messages || [];

  // Filter to only truly new messages (not in our database yet)
  const newMessageIds: string[] = [];

  for (const msg of messages) {
    // Check if we already have this email
    const existing = await ctx.runQuery(internal.emailSyncHelpers.checkEmailExists, {
      externalId: msg.id,
    });

    if (!existing) {
      newMessageIds.push(msg.id);
    }
  }

  // Update last sync time
  await ctx.runMutation(internal.emailSyncHelpers.updateLastSync, {
    userId: user._id,
    timestamp: Date.now(),
  });

  // If there are new emails, trigger the workflow to process and conditionally notify
  if (newMessageIds.length > 0) {
    console.log(`Found ${newMessageIds.length} new emails for ${user.email}, starting workflow...`);

    // Trigger the workflow to:
    // 1. Fetch and store the emails
    // 2. Summarize them with AI
    // 3. Send push notification ONLY if any are high priority
    await ctx.runMutation(internal.emailWorkflow.startEmailProcessing, {
      userId: user._id,
      userEmail: user.email,
      externalIds: newMessageIds,
    });
  }
}
