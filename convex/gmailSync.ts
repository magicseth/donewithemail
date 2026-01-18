import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

// Internal query to get user by email
export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

// Internal mutation to upsert contact and return ID
export const upsertContact = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email)
      )
      .first();

    if (existing) {
      // Update name if provided and different
      if (args.name && args.name !== existing.name) {
        await ctx.db.patch(existing._id, { name: args.name });
      }
      // Update email count and last email time
      await ctx.db.patch(existing._id, {
        emailCount: existing.emailCount + 1,
        lastEmailAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("contacts", {
      userId: args.userId,
      email: args.email,
      name: args.name,
      emailCount: 1,
      lastEmailAt: Date.now(),
    });
  },
});

// Internal mutation to store email
export const storeEmailInternal = internalMutation({
  args: {
    externalId: v.string(),
    provider: v.union(v.literal("gmail"), v.literal("outlook"), v.literal("imap")),
    userId: v.id("users"),
    from: v.id("contacts"),
    to: v.array(v.id("contacts")),
    subject: v.string(),
    bodyPreview: v.string(),
    bodyFull: v.string(),
    receivedAt: v.number(),
    isRead: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check if email already exists
    const existing = await ctx.db
      .query("emails")
      .withIndex("by_external_id", (q) =>
        q.eq("externalId", args.externalId).eq("provider", args.provider)
      )
      .first();

    if (existing) {
      return { emailId: existing._id, isNew: false };
    }

    const emailId = await ctx.db.insert("emails", {
      ...args,
      isTriaged: false,
    });

    return { emailId, isNew: true };
  },
});

// Refresh access token if expired
async function refreshTokenIfNeeded(
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

// Helper to decode base64url with proper UTF-8 support
function decodeBase64Url(data: string): string {
  try {
    // Replace URL-safe characters
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    // Decode base64 to binary string
    const binaryString = atob(base64);
    // Convert binary string to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    // Decode UTF-8
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(bytes);
  } catch {
    return "";
  }
}

// Extract email body from Gmail payload (handles multipart messages)
function extractBody(payload: any): { html: string; plain: string } {
  let html = "";
  let plain = "";

  // Check if body is directly in payload
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/html") {
      html = decoded;
    } else {
      plain = decoded;
    }
  }

  // Check parts for multipart messages
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        html = decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/plain" && part.body?.data) {
        plain = decodeBase64Url(part.body.data);
      }
      // Recursively check nested parts
      if (part.parts) {
        const nested = extractBody(part);
        if (nested.html) html = nested.html;
        if (nested.plain && !plain) plain = nested.plain;
      }
    }
  }

  return { html, plain };
}

// Fetch emails from Gmail using stored tokens
export const fetchEmails = action({
  args: {
    userEmail: v.string(),
    maxResults: v.optional(v.number()),
    pageToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get user's Gmail tokens from database
    const user = await ctx.runQuery(internal.gmailSync.getUserByEmail, {
      email: args.userEmail,
    });

    if (!user?.gmailAccessToken) {
      throw new Error(
        "Gmail not connected. Please sign out and sign in again to connect Gmail."
      );
    }

    // Refresh token if needed (only if we have a refresh token)
    let accessToken = user.gmailAccessToken;
    if (user.gmailRefreshToken && user.gmailTokenExpiresAt) {
      const refreshed = await refreshTokenIfNeeded(
        user.gmailAccessToken,
        user.gmailRefreshToken,
        user.gmailTokenExpiresAt
      );
      accessToken = refreshed.accessToken;
    }

    // Fetch message list
    const maxResults = args.maxResults || 50;
    let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
    if (args.pageToken) {
      url += `&pageToken=${args.pageToken}`;
    }

    const listResponse = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listResponse.ok) {
      const error = await listResponse.text();
      throw new Error(`Gmail API error: ${listResponse.status} - ${error}`);
    }

    const listData: { messages?: { id: string }[]; nextPageToken?: string } = await listResponse.json();
    const messageIds: { id: string }[] = listData.messages || [];
    const nextPageToken = listData.nextPageToken;

    // Fetch full message details for all messages
    const emails: Array<{
      id: string;
      threadId: string;
      subject: string;
      snippet: string;
      bodyHtml: string;
      bodyPlain: string;
      receivedAt: number;
      isRead: boolean;
      labels: string[];
      from: { name: string; email: string };
    }> = await Promise.all(
      messageIds.map(async (msg: { id: string }) => {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const msgData = await msgResponse.json();

        const headers = msgData.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find(
            (h: { name: string; value: string }) =>
              h.name.toLowerCase() === name.toLowerCase()
          )?.value || "";

        const from = getHeader("From");
        const subject = getHeader("Subject") || "(No subject)";
        const date = getHeader("Date");

        // Parse sender name and email
        const fromMatch = from.match(
          /(?:"?([^"]*)"?\s)?<?([^\s<>]+@[^\s<>]+)>?/
        );
        const senderName = fromMatch?.[1]?.trim() || fromMatch?.[2] || from;
        const senderEmail = fromMatch?.[2] || from;

        // Extract full body
        const body = extractBody(msgData.payload || {});

        return {
          id: msg.id,
          threadId: msgData.threadId,
          subject,
          snippet: msgData.snippet || "",
          bodyHtml: body.html,
          bodyPlain: body.plain,
          receivedAt: date ? new Date(date).getTime() : Date.now(),
          isRead: !msgData.labelIds?.includes("UNREAD"),
          labels: msgData.labelIds || [],
          from: {
            name: senderName,
            email: senderEmail,
          },
        };
      })
    );

    // Store emails in Convex database
    for (const email of emails) {
      try {
        // Create/update contact for sender
        const contactId = await ctx.runMutation(internal.gmailSync.upsertContact, {
          userId: user._id,
          email: email.from.email,
          name: email.from.name !== email.from.email ? email.from.name : undefined,
        });

        // Store the email (prefer HTML body, fall back to plain text)
        const bodyFull = email.bodyHtml || email.bodyPlain || email.snippet;
        await ctx.runMutation(internal.gmailSync.storeEmailInternal, {
          externalId: email.id,
          provider: "gmail",
          userId: user._id,
          from: contactId,
          to: [], // We're not parsing recipients yet
          subject: email.subject,
          bodyPreview: email.snippet,
          bodyFull,
          receivedAt: email.receivedAt,
          isRead: email.isRead,
        });
      } catch (e) {
        console.error("Failed to store email:", email.id, e);
      }
    }

    return { emails, nextPageToken };
  },
});
