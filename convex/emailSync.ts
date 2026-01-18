"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

// Refresh access token if expired
async function refreshTokenIfNeeded(
  accessToken: string,
  refreshToken: string,
  expiresAt: number
): Promise<{ accessToken: string; expiresAt: number; refreshed: boolean }> {
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return { accessToken, expiresAt, refreshed: false };
  }

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

// Check for new emails for all users (called by cron)
export const checkNewEmailsForAllUsers = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all users with Gmail tokens
    const users = await ctx.runQuery(internal.emailSyncHelpers.getUsersWithGmail, {});

    console.log(`Checking new emails for ${users.length} users`);

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
    gmailAccessToken?: string;
    gmailRefreshToken?: string;
    gmailTokenExpiresAt?: number;
    lastEmailSyncAt?: number;
  }
) {
  if (!user.gmailAccessToken || !user.gmailRefreshToken || !user.gmailTokenExpiresAt) {
    return;
  }

  // Refresh token if needed
  let accessToken = user.gmailAccessToken;
  try {
    const refreshed = await refreshTokenIfNeeded(
      user.gmailAccessToken,
      user.gmailRefreshToken,
      user.gmailTokenExpiresAt
    );
    accessToken = refreshed.accessToken;

    if (refreshed.refreshed) {
      await ctx.runMutation(internal.gmailSync.updateUserTokens, {
        userId: user._id,
        accessToken: refreshed.accessToken,
        expiresAt: refreshed.expiresAt,
      });
    }
  } catch (error) {
    console.error(`Token refresh failed for ${user.email}:`, error);
    return;
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
  let firstNewSender: string | undefined;
  let firstNewSubject: string | undefined;

  for (const msg of messages) {
    // Check if we already have this email
    const existing = await ctx.runQuery(internal.emailSyncHelpers.checkEmailExists, {
      externalId: msg.id,
    });

    if (!existing) {
      newMessageIds.push(msg.id);

      // Get details of the first new message for the notification
      if (!firstNewSender) {
        try {
          const msgResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (msgResponse.ok) {
            const msgData = await msgResponse.json();
            const headers = msgData.payload?.headers || [];
            const fromHeader = headers.find(
              (h: any) => h.name.toLowerCase() === "from"
            );
            const subjectHeader = headers.find(
              (h: any) => h.name.toLowerCase() === "subject"
            );

            // Unfold headers (remove CRLF + whitespace from folded headers)
            const unfold = (s: string) => s.replace(/\r?\n\s+/g, "").trim();

            if (fromHeader) {
              // Extract name from "Name <email>" format
              const fromValue = unfold(fromHeader.value);
              const match = fromValue.match(/^"?([^"<]*)"?\s*<?/);
              firstNewSender = match?.[1]?.trim() || fromValue;
            }
            firstNewSubject = subjectHeader?.value ? unfold(subjectHeader.value) : undefined;
          }
        } catch (e) {
          console.error("Failed to get message details:", e);
        }
      }
    }
  }

  // Update last sync time
  await ctx.runMutation(internal.emailSyncHelpers.updateLastSync, {
    userId: user._id,
    timestamp: Date.now(),
  });

  // Send push notification if there are new emails
  if (newMessageIds.length > 0) {
    console.log(`Found ${newMessageIds.length} new emails for ${user.email}`);

    await ctx.runMutation(internal.notifications.sendNewEmailNotification, {
      userId: user._id,
      emailCount: newMessageIds.length,
      senderName: firstNewSender,
      subject: firstNewSubject,
    });
  }
}
