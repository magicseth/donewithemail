"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

// Custom error for auth failures that need user re-authentication
class GmailAuthError extends Error {
  requiresReauth: boolean;
  constructor(message: string, requiresReauth = false) {
    super(message);
    this.name = "GmailAuthError";
    this.requiresReauth = requiresReauth;
  }
}

// Refresh Google access token using stored Google refresh token
async function refreshGoogleToken(
  refreshToken: string
): Promise<{
  accessToken: string;
  expiresAt: number;
}> {
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
    const errorText = await response.text();
    console.error("[EmailSync] Token refresh failed:", response.status, errorText);

    // Check if the refresh token is invalid/revoked
    if (response.status === 400 || response.status === 401) {
      const errorLower = errorText.toLowerCase();
      if (
        errorLower.includes("invalid_grant") ||
        errorLower.includes("token has been expired or revoked") ||
        errorLower.includes("token has been revoked")
      ) {
        throw new GmailAuthError(
          "Gmail refresh token is invalid or revoked. User needs to re-authenticate.",
          true
        );
      }
    }

    throw new Error(`Failed to refresh Google token: ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

// Debug: Get all users to see their token status
export const debugUserTokens = internalAction({
  args: {},
  handler: async (ctx): Promise<Array<{ email: string; hasAccessToken: boolean; hasGmailRefreshToken: boolean; expiresAt?: number; expiresAtFormatted?: string; isExpired?: boolean }>> => {
    const allUsers: Array<{
      email: string;
      gmailRefreshToken?: string;
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
      console.log(`    gmailRefreshToken=${!!u.gmailRefreshToken}`);
      console.log(`    expiresAt=${expiresFormatted} (${isExpired ? "EXPIRED" : `expires in ${timeUntilExpiry} min`})`);
    }
    return allUsers.map((u) => {
      const expiresAt = u.gmailTokenExpiresAt;
      const isExpired = expiresAt ? now >= expiresAt : undefined;
      return {
        email: u.email,
        hasAccessToken: !!u.gmailAccessToken,
        hasGmailRefreshToken: !!u.gmailRefreshToken,
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
    // Get all Gmail accounts
    const gmailAccounts = await ctx.runQuery(internal.gmailAccountHelpers.getGmailAccountsForSync, {});
    console.log(`Checking new emails for ${gmailAccounts.length} Gmail accounts`);

    for (const rawAccount of gmailAccounts) {
      try {
        // Decrypt tokens for each account
        const decryptedAccount = await ctx.runMutation(
          internal.gmailAccountHelpers.decryptGmailAccountTokens,
          { accountId: rawAccount._id }
        );

        if (!decryptedAccount || !decryptedAccount.accessToken) {
          console.log(`Could not decrypt tokens for account ${rawAccount.email}`);
          continue;
        }

        // Sync this Gmail account
        await checkNewEmailsForGmailAccount(ctx, decryptedAccount);
      } catch (error) {
        console.error(`Failed to check emails for account ${rawAccount.email}:`, error);
      }
    }

    // Also sync legacy user Gmail tokens and IMAP accounts
    const usersWithGmail = await ctx.runQuery(internal.emailSyncHelpers.getUsersWithGmail, {});
    console.log(`Checking legacy Gmail tokens for ${usersWithGmail.length} users`);

    for (const rawUser of usersWithGmail) {
      try {
        const decryptedUser = await ctx.runMutation(internal.emailSyncHelpers.decryptUserTokens, {
          userId: rawUser._id,
        });

        if (!decryptedUser) {
          console.log(`Could not decrypt tokens for user ${rawUser.email}`);
          continue;
        }

        // Sync legacy Gmail tokens (will be deprecated)
        if (decryptedUser.gmailAccessToken) {
          await checkNewEmailsForUser(ctx, {
            _id: decryptedUser._id,
            email: decryptedUser.email,
            gmailAccessToken: decryptedUser.gmailAccessToken ?? undefined,
            gmailRefreshToken: decryptedUser.gmailRefreshToken ?? undefined,
            gmailTokenExpiresAt: decryptedUser.gmailTokenExpiresAt,
            lastEmailSyncAt: rawUser.lastEmailSyncAt,
          });
        }

        // Sync IMAP accounts if user has any
        if (decryptedUser.connectedProviders) {
          const imapProviders = decryptedUser.connectedProviders.filter(
            (p: any) => p.provider === "imap"
          );

          for (const imapProvider of imapProviders) {
            try {
              console.log(`[IMAP Sync] Syncing ${imapProvider.email} for user ${rawUser.email}`);
              await ctx.runAction(internal.imapSync.syncImapForUser, {
                userId: decryptedUser._id,
                userEmail: rawUser.email,
                providerEmail: imapProvider.email,
              });
            } catch (error) {
              console.error(`[IMAP Sync] Failed for ${imapProvider.email}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`Failed to check emails for user ${rawUser.email}:`, error);
      }
    }
  },
});

// Check for new emails for a Gmail account
async function checkNewEmailsForGmailAccount(
  ctx: any,
  account: {
    _id: any;
    userId: any;
    email: string;
    accessToken: string;
    refreshToken?: string | null;
    tokenExpiresAt: number;
    lastSyncAt?: number;
  }
) {
  if (!account.accessToken) {
    console.log(`Account ${account.email} has no access token, skipping`);
    return;
  }

  // Check if token is expired (with 5 minute buffer)
  const tokenExpired = Date.now() >= (account.tokenExpiresAt - 5 * 60 * 1000);

  // Helper to save updated token
  const saveToken = async (accessToken: string, expiresAt: number) => {
    await ctx.runMutation(internal.gmailAccountHelpers.updateGmailAccountTokens, {
      accountId: account._id,
      accessToken,
      tokenExpiresAt: expiresAt,
    });
  };

  // Refresh token if needed and possible
  let accessToken = account.accessToken;
  if (tokenExpired && account.refreshToken) {
    try {
      console.log(`Refreshing Google token for ${account.email}...`);
      const refreshed = await refreshGoogleToken(account.refreshToken);
      accessToken = refreshed.accessToken;
      await saveToken(refreshed.accessToken, refreshed.expiresAt);
      console.log(`Token refreshed for ${account.email}, expires at ${new Date(refreshed.expiresAt).toISOString()}`);
    } catch (error) {
      if (error instanceof GmailAuthError && error.requiresReauth) {
        console.error(`[EmailSync] Account ${account.email} needs to re-authenticate:`, error.message);
      } else {
        console.error(`Token refresh failed for ${account.email}:`, error);
      }
      return; // Can't continue without valid token
    }
  } else if (tokenExpired && !account.refreshToken) {
    console.log(`Account ${account.email} token expired but no refresh token available`);
    return;
  }

  // Get last sync time (default to 1 hour ago if never synced)
  const lastSync = account.lastSyncAt || Date.now() - 60 * 60 * 1000;

  // Query Gmail for messages newer than last sync
  const afterEpoch = Math.floor(lastSync / 1000);
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=INBOX&q=after:${afterEpoch}`;

  // Make Gmail API call with retry on 401
  let response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // If we get 401 and have a refresh token, try to refresh and retry
  if (response.status === 401 && account.refreshToken) {
    console.log(`[EmailSync] Got 401 for ${account.email}, attempting token refresh and retry...`);
    try {
      const refreshed = await refreshGoogleToken(account.refreshToken);
      accessToken = refreshed.accessToken;
      await saveToken(refreshed.accessToken, refreshed.expiresAt);

      // Retry the request
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error) {
      if (error instanceof GmailAuthError && error.requiresReauth) {
        console.error(`[EmailSync] Account ${account.email} needs to re-authenticate:`, error.message);
      } else {
        console.error(`[EmailSync] Token refresh failed for ${account.email}:`, error);
      }
      return;
    }
  }

  if (!response.ok) {
    console.error(`Gmail API error for ${account.email}: ${response.status}`);
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
  await ctx.runMutation(internal.gmailAccountHelpers.updateGmailAccountLastSync, {
    accountId: account._id,
    timestamp: Date.now(),
  });

  // If there are new emails, trigger the workflow to process and conditionally notify
  if (newMessageIds.length > 0) {
    console.log(`Found ${newMessageIds.length} new emails for ${account.email}, starting workflow...`);

    // Trigger the workflow with the account ID
    await ctx.runMutation(internal.emailWorkflow.startEmailProcessing, {
      userId: account.userId,
      userEmail: account.email,
      externalIds: newMessageIds,
      gmailAccountId: account._id,
    });
  }
}

// Check for new emails for a single user (legacy - for backward compatibility)
async function checkNewEmailsForUser(
  ctx: any,
  user: {
    _id: any;
    email: string;
    gmailAccessToken?: string;
    gmailRefreshToken?: string;
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

  // Helper to save updated token
  const saveToken = async (accessToken: string, expiresAt: number) => {
    await ctx.runMutation(internal.emailSyncHelpers.updateUserGmailTokens, {
      userId: user._id,
      gmailAccessToken: accessToken,
      gmailTokenExpiresAt: expiresAt,
    });
  };

  // Refresh token if needed and possible (using Google's refresh token directly)
  let accessToken = user.gmailAccessToken;
  if (tokenExpired && user.gmailRefreshToken) {
    try {
      console.log(`Refreshing Google token for ${user.email}...`);
      const refreshed = await refreshGoogleToken(user.gmailRefreshToken);
      accessToken = refreshed.accessToken;
      await saveToken(refreshed.accessToken, refreshed.expiresAt);
      console.log(`Token refreshed for ${user.email}, expires at ${new Date(refreshed.expiresAt).toISOString()}`);
    } catch (error) {
      if (error instanceof GmailAuthError && error.requiresReauth) {
        console.error(`[EmailSync] User ${user.email} needs to re-authenticate:`, error.message);
      } else {
        console.error(`Token refresh failed for ${user.email}:`, error);
      }
      return; // Can't continue without valid token
    }
  } else if (tokenExpired && !user.gmailRefreshToken) {
    console.log(`User ${user.email} token expired but no refresh token available`);
    return;
  }

  // Get last sync time (default to 1 hour ago if never synced)
  const lastSync = user.lastEmailSyncAt || Date.now() - 60 * 60 * 1000;

  // Query Gmail for messages newer than last sync
  // Using the 'after' query parameter with epoch seconds
  const afterEpoch = Math.floor(lastSync / 1000);
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=INBOX&q=after:${afterEpoch}`;

  // Make Gmail API call with retry on 401
  let response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // If we get 401 and have a refresh token, try to refresh and retry
  if (response.status === 401 && user.gmailRefreshToken) {
    console.log(`[EmailSync] Got 401 for ${user.email}, attempting token refresh and retry...`);
    try {
      const refreshed = await refreshGoogleToken(user.gmailRefreshToken);
      accessToken = refreshed.accessToken;
      await saveToken(refreshed.accessToken, refreshed.expiresAt);

      // Retry the request
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error) {
      if (error instanceof GmailAuthError && error.requiresReauth) {
        console.error(`[EmailSync] User ${user.email} needs to re-authenticate:`, error.message);
      } else {
        console.error(`[EmailSync] Token refresh failed for ${user.email}:`, error);
      }
      return;
    }
  }

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
