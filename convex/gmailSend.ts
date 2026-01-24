"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

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

type Attachment = {
  filename: string;
  mimeType: string;
  data: string; // Base64 encoded
};

// Build RFC 2822 email message with optional attachments
function buildEmailMessage(
  from: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string,
  inReplyTo?: string,
  attachments?: Attachment[]
): string {
  // Add footer to email body
  const bodyWithFooter = body + "\n\n--\ndonewith.email";

  // If no attachments, use simple text format
  if (!attachments || attachments.length === 0) {
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

    const message = headers.join("\r\n") + "\r\n\r\n" + bodyWithFooter;

    return Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  // With attachments, use multipart/mixed format
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  let headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
    headers.push(`References: ${inReplyTo}`);
  }

  // Build message parts
  let parts: string[] = [];

  // Text part
  parts.push([
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    bodyWithFooter,
  ].join("\r\n"));

  // Attachment parts
  for (const attachment of attachments) {
    parts.push([
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}`,
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      attachment.data,
    ].join("\r\n"));
  }

  // Closing boundary
  parts.push(`--${boundary}--`);

  const message = headers.join("\r\n") + "\r\n\r\n" + parts.join("\r\n");

  // Base64url encode
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Send email via Gmail API
export const sendEmail = action({
  args: {
    userEmail: v.string(),
    to: v.string(),
    subject: v.string(),
    body: v.string(),
    replyToMessageId: v.optional(v.string()),
    attachments: v.optional(v.array(v.object({
      storageId: v.id("_storage"),
      filename: v.string(),
      mimeType: v.string(),
    }))),
  },
  handler: async (ctx, args): Promise<{ messageId: string; threadId: string }> => {
    // Get Gmail account from gmailAccounts table
    const gmailAccountInfo = await ctx.runQuery(
      internal.gmailAccountHelpers.getGmailAccountByEmail,
      { userEmail: args.userEmail }
    );

    if (!gmailAccountInfo) {
      throw new Error("Gmail account not found. Please reconnect your account.");
    }

    const accountTokens = await ctx.runMutation(
      internal.gmailAccountHelpers.decryptGmailAccountTokens,
      { accountId: gmailAccountInfo._id }
    );

    if (!accountTokens?.accessToken) {
      throw new Error("Gmail account tokens not found");
    }

    // Refresh token if needed
    let accessToken: string;
    if (accountTokens.refreshToken && accountTokens.tokenExpiresAt) {
      const refreshed = await refreshTokenIfNeeded(
        accountTokens.accessToken,
        accountTokens.refreshToken,
        accountTokens.tokenExpiresAt
      );
      accessToken = refreshed.accessToken;

      // Save refreshed token to database
      if (refreshed.refreshed) {
        await ctx.runMutation(internal.gmailAccountHelpers.updateGmailAccountTokens, {
          accountId: gmailAccountInfo._id,
          accessToken: refreshed.accessToken,
          tokenExpiresAt: refreshed.expiresAt,
        });
      }
    } else {
      accessToken = accountTokens.accessToken;
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

    // Fetch attachments from storage if provided
    let attachmentData: Attachment[] | undefined;
    if (args.attachments && args.attachments.length > 0) {
      attachmentData = await Promise.all(
        args.attachments.map(async (att) => {
          const url = await ctx.storage.getUrl(att.storageId);
          if (!url) {
            throw new Error(`Attachment not found: ${att.filename}`);
          }
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          return {
            filename: att.filename,
            mimeType: att.mimeType,
            data: base64,
          };
        })
      );
    }

    // Build email message
    const rawMessage = buildEmailMessage(
      args.userEmail,
      args.to,
      args.subject,
      args.body,
      threadId,
      inReplyTo,
      attachmentData
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
    // Get Gmail account from gmailAccounts table
    const gmailAccountInfo = await ctx.runQuery(
      internal.gmailAccountHelpers.getGmailAccountByEmail,
      { userEmail: args.userEmail }
    );

    if (!gmailAccountInfo) {
      throw new Error("Gmail account not found. Please reconnect your account.");
    }

    const accountTokens = await ctx.runMutation(
      internal.gmailAccountHelpers.decryptGmailAccountTokens,
      { accountId: gmailAccountInfo._id }
    );

    if (!accountTokens?.accessToken) {
      throw new Error("Gmail account tokens not found");
    }

    // Refresh token if needed
    let accessToken: string;
    if (accountTokens.refreshToken && accountTokens.tokenExpiresAt) {
      const refreshed = await refreshTokenIfNeeded(
        accountTokens.accessToken,
        accountTokens.refreshToken,
        accountTokens.tokenExpiresAt
      );
      accessToken = refreshed.accessToken;

      // Save refreshed token to database
      if (refreshed.refreshed) {
        await ctx.runMutation(internal.gmailAccountHelpers.updateGmailAccountTokens, {
          accountId: gmailAccountInfo._id,
          accessToken: refreshed.accessToken,
          tokenExpiresAt: refreshed.expiresAt,
        });
      }
    } else {
      accessToken = accountTokens.accessToken;
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

