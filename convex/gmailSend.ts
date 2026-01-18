"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

// Refresh access token if expired
async function refreshTokenIfNeeded(
  accessToken: string,
  refreshToken: string,
  expiresAt: number
): Promise<{ accessToken: string; expiresAt: number }> {
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return { accessToken, expiresAt };
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
  };
}

// Build RFC 2822 email message
function buildEmailMessage(
  from: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string,
  inReplyTo?: string
): string {
  const boundary = `boundary_${Date.now()}`;

  let headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
  ];

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
    headers.push(`References: ${inReplyTo}`);
  }

  const message = headers.join("\r\n") + "\r\n\r\n" + body;

  // Base64url encode
  const encoded = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return encoded;
}

// Send email via Gmail API
export const sendEmail = action({
  args: {
    userEmail: v.string(),
    to: v.string(),
    subject: v.string(),
    body: v.string(),
    replyToMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ messageId: string; threadId: string }> => {
    // Get user's Gmail tokens
    type UserWithGmail = {
      gmailAccessToken?: string;
      gmailRefreshToken?: string;
      gmailTokenExpiresAt?: number;
    };
    const user: UserWithGmail | null = await ctx.runQuery(internal.gmailSync.getUserByEmail, {
      email: args.userEmail,
    });

    if (!user?.gmailAccessToken) {
      throw new Error("Gmail not connected");
    }

    // Refresh token if needed
    let accessToken: string = user.gmailAccessToken;
    if (user.gmailRefreshToken && user.gmailTokenExpiresAt) {
      const refreshed = await refreshTokenIfNeeded(
        user.gmailAccessToken,
        user.gmailRefreshToken,
        user.gmailTokenExpiresAt
      );
      accessToken = refreshed.accessToken;
    }

    // Get thread ID and message ID if this is a reply
    let threadId: string | undefined;
    let inReplyTo: string | undefined;

    if (args.replyToMessageId) {
      // Fetch original message to get thread ID and Message-ID header
      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${args.replyToMessageId}?format=metadata&metadataHeaders=Message-ID`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (msgResponse.ok) {
        const msgData = await msgResponse.json();
        threadId = msgData.threadId;

        const messageIdHeader = msgData.payload?.headers?.find(
          (h: { name: string; value: string }) => h.name.toLowerCase() === "message-id"
        );
        inReplyTo = messageIdHeader?.value;
      }
    }

    // Build email message
    const rawMessage = buildEmailMessage(
      args.userEmail,
      args.to,
      args.subject,
      args.body,
      threadId,
      inReplyTo
    );

    // Send via Gmail API
    const sendUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
    const sendBody: { raw: string; threadId?: string } = { raw: rawMessage };
    if (threadId) {
      sendBody.threadId = threadId;
    }

    const sendResponse: Response = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendBody),
    });

    if (!sendResponse.ok) {
      const error = await sendResponse.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    const result: { id: string; threadId: string } = await sendResponse.json();
    return { messageId: result.id, threadId: result.threadId };
  },
});

// Send a reply to an email (simplified for quick replies)
export const sendReply = action({
  args: {
    userEmail: v.string(),
    to: v.string(),
    subject: v.string(),
    body: v.string(),
    inReplyTo: v.optional(v.string()), // Convex ID of the email being replied to
  },
  handler: async (ctx, args): Promise<{ messageId: string; threadId: string }> => {
    // Get user's Gmail tokens
    type UserWithGmail = {
      gmailAccessToken?: string;
      gmailRefreshToken?: string;
      gmailTokenExpiresAt?: number;
    };
    const user: UserWithGmail | null = await ctx.runQuery(internal.gmailSync.getUserByEmail, {
      email: args.userEmail,
    });

    if (!user?.gmailAccessToken) {
      throw new Error("Gmail not connected");
    }

    // Refresh token if needed
    let accessToken: string = user.gmailAccessToken;
    if (user.gmailRefreshToken && user.gmailTokenExpiresAt) {
      const refreshed = await refreshTokenIfNeeded(
        user.gmailAccessToken,
        user.gmailRefreshToken,
        user.gmailTokenExpiresAt
      );
      accessToken = refreshed.accessToken;
    }

    // Get thread ID and message ID if this is a reply to a known email
    let threadId: string | undefined;
    let messageIdHeader: string | undefined;

    if (args.inReplyTo) {
      // Get the email from our database to find its external ID
      const email = await ctx.runQuery(internal.emails.getEmailById, {
        emailId: args.inReplyTo,
      });

      if (email?.externalId) {
        // Fetch original message to get thread ID and Message-ID header
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.externalId}?format=metadata&metadataHeaders=Message-ID`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (msgResponse.ok) {
          const msgData = await msgResponse.json();
          threadId = msgData.threadId;

          const header = msgData.payload?.headers?.find(
            (h: { name: string; value: string }) => h.name.toLowerCase() === "message-id"
          );
          messageIdHeader = header?.value;
        }
      }
    }

    // Build email message
    const rawMessage = buildEmailMessage(
      args.userEmail,
      args.to,
      args.subject,
      args.body,
      threadId,
      messageIdHeader
    );

    // Send via Gmail API
    const sendUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
    const sendBody: { raw: string; threadId?: string } = { raw: rawMessage };
    if (threadId) {
      sendBody.threadId = threadId;
    }

    const sendResponse: Response = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendBody),
    });

    if (!sendResponse.ok) {
      const error = await sendResponse.text();
      throw new Error(`Failed to send reply: ${error}`);
    }

    const result: { id: string; threadId: string } = await sendResponse.json();
    return { messageId: result.id, threadId: result.threadId };
  },
});

