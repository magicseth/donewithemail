import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
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

// Internal query to get email body from emailBodies table
export const getEmailBodyById = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emailBodies")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();
  },
});

// Internal query to get cached summaries for a list of external IDs
export const getCachedSummaries = internalQuery({
  args: { externalIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const summaries: Record<string, {
      summary?: string;
      urgencyScore?: number;
      urgencyReason?: string;
      suggestedReply?: string;
    }> = {};

    for (const externalId of args.externalIds) {
      const email = await ctx.db
        .query("emails")
        .withIndex("by_external_id", (q) =>
          q.eq("externalId", externalId).eq("provider", "gmail")
        )
        .first();

      if (email) {
        // Look up summary from emailSummaries table
        const summaryData = await ctx.db
          .query("emailSummaries")
          .withIndex("by_email", (q) => q.eq("emailId", email._id))
          .first();

        if (summaryData) {
          summaries[externalId] = {
            summary: summaryData.summary,
            urgencyScore: summaryData.urgencyScore,
            urgencyReason: summaryData.urgencyReason,
            suggestedReply: summaryData.suggestedReply,
          };
        }
      }
    }

    return summaries;
  },
});

// Internal query to get cached emails by external IDs
export const getCachedEmails = internalQuery({
  args: { externalIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const cached: Record<string, {
      subject: string;
      snippet: string;
      receivedAt: number;
      isRead: boolean;
      fromEmail: string;
      fromName?: string;
      summary?: string;
      urgencyScore?: number;
      urgencyReason?: string;
      suggestedReply?: string;
    }> = {};

    for (const externalId of args.externalIds) {
      const email = await ctx.db
        .query("emails")
        .withIndex("by_external_id", (q) =>
          q.eq("externalId", externalId).eq("provider", "gmail")
        )
        .first();

      if (email) {
        // Get contact info
        const contact = await ctx.db.get(email.from);
        // Get summary from emailSummaries table
        const summaryData = await ctx.db
          .query("emailSummaries")
          .withIndex("by_email", (q) => q.eq("emailId", email._id))
          .first();

        cached[externalId] = {
          subject: email.subject,
          snippet: email.bodyPreview,
          receivedAt: email.receivedAt,
          isRead: email.isRead,
          fromEmail: contact?.email || "",
          fromName: contact?.name,
          summary: summaryData?.summary,
          urgencyScore: summaryData?.urgencyScore,
          urgencyReason: summaryData?.urgencyReason,
          suggestedReply: summaryData?.suggestedReply,
        };
      }
    }

    return cached;
  },
});

// Internal mutation to upsert contact and return ID
// Generate fallback avatar URL from name/email using UI Avatars service
function getFallbackAvatarUrl(name: string | undefined, email: string): string {
  const displayName = name || email.split("@")[0];
  const encoded = encodeURIComponent(displayName);
  // Generate a consistent background color based on email
  const colors = ["6366F1", "8B5CF6", "EC4899", "F59E0B", "10B981", "3B82F6", "EF4444"];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash) + email.charCodeAt(i);
    hash = hash & hash;
  }
  const colorIndex = Math.abs(hash) % colors.length;
  const bgColor = colors[colorIndex];
  return `https://ui-avatars.com/api/?name=${encoded}&background=${bgColor}&color=fff&size=200&bold=true`;
}

export const upsertContact = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email)
      )
      .first();

    // Get the URL for the stored avatar, or generate a fallback
    let avatarUrl: string | undefined;
    if (args.avatarStorageId) {
      avatarUrl = await ctx.storage.getUrl(args.avatarStorageId) ?? undefined;
    }
    // Always ensure we have an avatar URL (fallback to generated initials)
    if (!avatarUrl) {
      avatarUrl = getFallbackAvatarUrl(args.name, args.email);
    }

    if (existing) {
      // Update name if provided and different
      const updates: Record<string, unknown> = {
        emailCount: existing.emailCount + 1,
        lastEmailAt: Date.now(),
      };
      if (args.name && args.name !== existing.name) {
        updates.name = args.name;
      }
      // Update avatar if we have a new storage one, OR if existing doesn't have any avatar
      if (args.avatarStorageId && !existing.avatarStorageId) {
        updates.avatarStorageId = args.avatarStorageId;
        updates.avatarUrl = avatarUrl;
      } else if (!existing.avatarUrl) {
        // Backfill fallback avatar if missing
        updates.avatarUrl = avatarUrl;
      }
      await ctx.db.patch(existing._id, updates);
      return { contactId: existing._id, hasAvatar: !!existing.avatarStorageId || !!existing.avatarUrl };
    }

    const contactId = await ctx.db.insert("contacts", {
      userId: args.userId,
      email: args.email,
      name: args.name,
      avatarStorageId: args.avatarStorageId,
      avatarUrl,
      emailCount: 1,
      lastEmailAt: Date.now(),
    });
    return { contactId, hasAvatar: !!avatarUrl };
  },
});

// Internal mutation to store email
export const storeEmailInternal = internalMutation({
  args: {
    externalId: v.string(),
    threadId: v.optional(v.string()),
    provider: v.union(v.literal("gmail"), v.literal("outlook"), v.literal("imap")),
    userId: v.id("users"),
    from: v.id("contacts"),
    fromName: v.optional(v.string()), // Sender name as it appeared in this email
    to: v.array(v.id("contacts")),
    subject: v.string(),
    bodyPreview: v.string(),
    bodyFull: v.string(),
    bodyHtml: v.optional(v.string()),
    rawPayload: v.optional(v.string()),
    receivedAt: v.number(),
    isRead: v.boolean(),
    direction: v.optional(v.union(v.literal("incoming"), v.literal("outgoing"))),
    // Subscription fields
    listUnsubscribe: v.optional(v.string()),
    listUnsubscribePost: v.optional(v.boolean()),
    isSubscription: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Extract body fields to store separately
    const { bodyFull, bodyHtml, rawPayload, ...emailFields } = args;

    // Check if email already exists
    const existing = await ctx.db
      .query("emails")
      .withIndex("by_external_id", (q) =>
        q.eq("externalId", args.externalId).eq("provider", args.provider)
      )
      .first();

    if (existing) {
      // Update direction if it was previously missing
      const updates: Record<string, unknown> = {};
      if (args.direction && !existing.direction) {
        updates.direction = args.direction;
      }
      // Update subscription fields if they were previously missing
      if (args.listUnsubscribe !== undefined && existing.listUnsubscribe === undefined) {
        updates.listUnsubscribe = args.listUnsubscribe;
        updates.listUnsubscribePost = args.listUnsubscribePost;
        updates.isSubscription = args.isSubscription;
      }
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }
      return { emailId: existing._id, isNew: false };
    }

    // Insert email without large body fields (stored separately in emailBodies)
    const emailId = await ctx.db.insert("emails", {
      ...emailFields,
      isTriaged: false,
      direction: args.direction || "incoming",
    });

    // Store body content in separate table to keep emails table lightweight
    await ctx.db.insert("emailBodies", {
      emailId,
      bodyFull,
      bodyHtml,
      rawPayload,
    });

    return { emailId, isNew: true };
  },
});

// Internal mutation to update user's OAuth tokens after refresh
export const updateUserTokens = internalMutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      gmailAccessToken: args.accessToken,
      gmailTokenExpiresAt: args.expiresAt,
    });
  },
});

// Custom error class for auth errors that require re-authentication
export class GmailAuthError extends Error {
  constructor(message: string, public requiresReauth: boolean = false) {
    super(message);
    this.name = "GmailAuthError";
  }
}

// Refresh access token if expired or forced
async function refreshGoogleToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number }> {
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
    console.error("[GmailSync] Token refresh failed:", response.status, errorText);

    // Check if the refresh token is invalid/revoked
    if (response.status === 400 || response.status === 401) {
      const errorLower = errorText.toLowerCase();
      if (
        errorLower.includes("invalid_grant") ||
        errorLower.includes("token has been expired or revoked") ||
        errorLower.includes("token has been revoked")
      ) {
        throw new GmailAuthError(
          "Gmail access has been revoked. Please sign out and sign in again.",
          true
        );
      }
    }

    throw new GmailAuthError(`Failed to refresh Gmail token: ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

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

  const result = await refreshGoogleToken(refreshToken);
  return {
    ...result,
    refreshed: true,
  };
}

// Helper to make Gmail API calls with automatic retry on 401
async function gmailApiCall<T>(
  url: string,
  accessToken: string,
  refreshToken: string | undefined,
  options: RequestInit = {}
): Promise<{ data: T; newToken?: { accessToken: string; expiresAt: number } }> {
  const makeRequest = async (token: string) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  };

  let response = await makeRequest(accessToken);

  // If unauthorized and we have a refresh token, try to refresh and retry once
  if (response.status === 401 && refreshToken) {
    console.log("[GmailSync] Got 401, attempting token refresh and retry...");

    try {
      const newToken = await refreshGoogleToken(refreshToken);
      response = await makeRequest(newToken.accessToken);

      if (response.ok) {
        const data = await response.json();
        return { data, newToken };
      }
    } catch (refreshError) {
      // If refresh failed, throw that error (may indicate re-auth needed)
      throw refreshError;
    }
  }

  if (!response.ok) {
    const errorText = await response.text();

    // Check for specific auth errors that need re-auth
    if (response.status === 401 || response.status === 403) {
      throw new GmailAuthError(
        `Gmail API authorization failed (${response.status}): ${errorText}`,
        true
      );
    }

    throw new Error(`Gmail API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return { data };
}

// Fetch profile photo URL from Google People API
async function fetchProfilePhotoUrl(
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
          // Return the first photo URL
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

    // No photo found
    return undefined;
  } catch (error) {
    console.error("Error fetching profile photo URL:", error);
    return undefined;
  }
}

// Download image and return as blob
async function downloadImage(imageUrl: string): Promise<Blob | undefined> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return undefined;
    return await response.blob();
  } catch (error) {
    console.error("Error downloading image:", error);
    return undefined;
  }
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

// Fetch full email body on demand (for email detail view)
export const fetchEmailBody = action({
  args: {
    userEmail: v.string(),
    emailId: v.id("emails"),
  },
  handler: async (ctx, args): Promise<{ body: string; isHtml: boolean }> => {
    // Get the email to find its externalId
    type EmailData = {
      externalId: string;
      bodyFull?: string; // Optional - may be in emailBodies table
      bodyPreview: string;
    };
    const email: EmailData | null = await ctx.runQuery(internal.emails.getEmailById, {
      emailId: args.emailId,
    });

    if (!email) {
      throw new Error("Email not found");
    }

    // First check the emailBodies table for the body content
    type EmailBodyData = {
      bodyFull: string;
      bodyHtml?: string;
    };
    const emailBody: EmailBodyData | null = await ctx.runQuery(internal.gmailSync.getEmailBodyById, {
      emailId: args.emailId,
    });

    // If we have body in the emailBodies table, return it
    if (emailBody?.bodyHtml && emailBody.bodyHtml.includes("<")) {
      return { body: emailBody.bodyHtml, isHtml: true };
    }
    if (emailBody?.bodyFull && emailBody.bodyFull.includes("<")) {
      return { body: emailBody.bodyFull, isHtml: true };
    }
    if (emailBody?.bodyFull) {
      return { body: emailBody.bodyFull, isHtml: false };
    }

    // Fallback: check legacy bodyFull on emails table (for backwards compatibility)
    if (email.bodyFull && email.bodyFull.includes("<")) {
      return { body: email.bodyFull, isHtml: true };
    }
    if (email.bodyFull) {
      return { body: email.bodyFull, isHtml: false };
    }

    // Get user's Gmail tokens
    const user = await ctx.runQuery(internal.gmailSync.getUserByEmail, {
      email: args.userEmail,
    });

    if (!user?.gmailAccessToken) {
      throw new Error("Gmail not connected");
    }

    // Refresh token if needed
    let accessToken: string = user.gmailAccessToken;
    if (user.gmailRefreshToken && user.gmailTokenExpiresAt) {
      try {
        const refreshed = await refreshTokenIfNeeded(
          user.gmailAccessToken,
          user.gmailRefreshToken,
          user.gmailTokenExpiresAt
        );
        accessToken = refreshed.accessToken;

        // Save refreshed token to database
        if (refreshed.refreshed) {
          await ctx.runMutation(internal.gmailSync.updateUserTokens, {
            userId: user._id,
            accessToken: refreshed.accessToken,
            expiresAt: refreshed.expiresAt,
          });
        }
      } catch (error) {
        if (error instanceof GmailAuthError && error.requiresReauth) {
          throw error;
        }
        console.error("[GmailSync] Token refresh failed, trying with existing token:", error);
      }
    }

    // Fetch full email from Gmail with auto-retry on 401
    const result = await gmailApiCall<{ payload: any }>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.externalId}?format=full`,
      accessToken,
      user.gmailRefreshToken
    );

    // Save new token if we got one from a retry
    if (result.newToken) {
      await ctx.runMutation(internal.gmailSync.updateUserTokens, {
        userId: user._id,
        accessToken: result.newToken.accessToken,
        expiresAt: result.newToken.expiresAt,
      });
    }

    const data = result.data;
    const { html, plain } = extractBody(data.payload);
    const bodyFull = html || plain || email.bodyPreview;
    const isHtml = !!html;

    // Update the email with full body
    await ctx.runMutation(internal.gmailSync.updateEmailBody, {
      emailId: args.emailId,
      bodyFull,
    });

    return { body: bodyFull, isHtml };
  },
});

// Internal mutation to update email body (stores in emailBodies table)
export const updateEmailBody = internalMutation({
  args: {
    emailId: v.id("emails"),
    bodyFull: v.string(),
    bodyHtml: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if body record already exists
    const existing = await ctx.db
      .query("emailBodies")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    if (existing) {
      // Update existing body record
      await ctx.db.patch(existing._id, {
        bodyFull: args.bodyFull,
        ...(args.bodyHtml && { bodyHtml: args.bodyHtml }),
      });
    } else {
      // Create new body record
      await ctx.db.insert("emailBodies", {
        emailId: args.emailId,
        bodyFull: args.bodyFull,
        bodyHtml: args.bodyHtml,
      });
    }
  },
});

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

    // Helper to save updated token to database
    const saveTokenIfNeeded = async (newToken?: { accessToken: string; expiresAt: number }): Promise<string | null> => {
      if (newToken) {
        await ctx.runMutation(internal.gmailSync.updateUserTokens, {
          userId: user._id,
          accessToken: newToken.accessToken,
          expiresAt: newToken.expiresAt,
        });
        return newToken.accessToken;
      }
      return null;
    };

    // Refresh token if needed (only if we have a refresh token)
    let accessToken: string = user.gmailAccessToken;
    if (user.gmailRefreshToken && user.gmailTokenExpiresAt) {
      try {
        const refreshed = await refreshTokenIfNeeded(
          user.gmailAccessToken,
          user.gmailRefreshToken,
          user.gmailTokenExpiresAt
        );
        accessToken = refreshed.accessToken;

        // Save refreshed token to database so it persists
        if (refreshed.refreshed) {
          await ctx.runMutation(internal.gmailSync.updateUserTokens, {
            userId: user._id,
            accessToken: refreshed.accessToken,
            expiresAt: refreshed.expiresAt,
          });
        }
      } catch (error) {
        // If it's a re-auth error, re-throw it
        if (error instanceof GmailAuthError && error.requiresReauth) {
          throw error;
        }
        // For other errors, log and continue with existing token (might still work)
        console.error("[GmailSync] Token refresh failed, trying with existing token:", error);
      }
    }

    // Fetch message list (default to 15 for faster initial load)
    // Fetch both INBOX and SENT emails
    const maxResults = args.maxResults || 15;

    // Fetch INBOX emails with auto-retry on 401
    let inboxUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`;
    if (args.pageToken) {
      inboxUrl += `&pageToken=${args.pageToken}`;
    }

    type MessageListResponse = { messages?: { id: string }[]; nextPageToken?: string };

    const inboxResult: { data: MessageListResponse; newToken?: { accessToken: string; expiresAt: number } } = await gmailApiCall<MessageListResponse>(
      inboxUrl,
      accessToken,
      user.gmailRefreshToken
    );

    // Save new token if we got one from a retry
    const newToken: string | null = await saveTokenIfNeeded(inboxResult.newToken);
    if (newToken) {
      accessToken = newToken;
    }

    const inboxData: MessageListResponse = inboxResult.data;
    const inboxMessageIds: { id: string; direction: "incoming" }[] = (inboxData.messages || []).map((m: { id: string }) => ({ ...m, direction: "incoming" as const }));
    const nextPageToken: string | undefined = inboxData.nextPageToken;

    // Also fetch SENT emails (half as many to not overwhelm)
    const sentUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${Math.ceil(maxResults / 2)}&labelIds=SENT`;

    let sentMessageIds: { id: string; direction: "outgoing" }[] = [];
    try {
      const sentResult = await gmailApiCall<MessageListResponse>(
        sentUrl,
        accessToken,
        user.gmailRefreshToken
      );
      await saveTokenIfNeeded(sentResult.newToken);
      sentMessageIds = (sentResult.data.messages || []).map(m => ({ ...m, direction: "outgoing" as const }));
    } catch (error) {
      // Sent folder is less critical, log and continue
      console.error("[GmailSync] Failed to fetch sent emails:", error);
    }

    // Combine both lists, removing duplicates (some emails might be in both INBOX and SENT)
    const seenIds = new Set<string>();
    const messageIds: { id: string; direction: "incoming" | "outgoing" }[] = [];
    for (const msg of [...inboxMessageIds, ...sentMessageIds]) {
      if (!seenIds.has(msg.id)) {
        seenIds.add(msg.id);
        messageIds.push(msg);
      }
    }

    // Type for cached email data
    type CachedEmailData = {
      subject: string;
      snippet: string;
      receivedAt: number;
      isRead: boolean;
      fromEmail: string;
      fromName?: string;
      summary?: string;
      urgencyScore?: number;
      urgencyReason?: string;
      suggestedReply?: string;
    };

    // Check which emails are already cached in the database
    const allExternalIds = messageIds.map(m => m.id);
    const cachedEmails: Record<string, CachedEmailData> = await ctx.runQuery(internal.gmailSync.getCachedEmails, {
      externalIds: allExternalIds,
    });

    // Only fetch from Gmail the emails we don't have cached
    const uncachedIds = messageIds.filter(m => !cachedEmails[m.id]);
    console.log(`Fetching ${uncachedIds.length} emails from Gmail (${Object.keys(cachedEmails).length} cached)`);

    // Helper to add delay between requests to avoid rate limits
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Process emails in batches to avoid Gmail rate limits (250 req/100s)
    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 200; // 200ms between batches = ~25 req/s max

    const fetchedEmails: Array<{
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
      direction: "incoming" | "outgoing";
    }> = [];

    // Process in batches
    for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
      const batch = uncachedIds.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (msg) => {
        try {
          // Use format=full to get complete email body for accurate summarization
          const msgResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (!msgResponse.ok) {
            console.error(`Failed to fetch message ${msg.id}: ${msgResponse.status}`);
            return null;
          }

          const msgData = await msgResponse.json();

          const headers = msgData.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find(
              (h: { name: string; value: string }) =>
                h.name.toLowerCase() === name.toLowerCase()
            )?.value || "";

          // Get headers and unfold them (remove CRLF + whitespace from folded headers)
          // Use empty string replacement to handle folds that occur mid-word/mid-email
          const unfold = (s: string) => s.replace(/\r?\n\s+/g, "").trim();

          const rawFrom = getHeader("From");
          const from = unfold(rawFrom);
          const subject = unfold(getHeader("Subject")) || "(No subject)";
          const date = getHeader("Date");

          // Parse sender name and email - handle various formats
          let senderName = "";
          let senderEmail = "";

          if (from) {
            // Parse "From" header - handle formats:
            // 1. "Name <email@example.com>"
            // 2. Name <email@example.com>
            // 3. <email@example.com>
            // 4. email@example.com (bare email)

            // First, check if there are angle brackets
            const angleMatch = from.match(/<([^<>]+@[^<>]+)>/);
            if (angleMatch) {
              // Email is in angle brackets, name is everything before
              senderEmail = angleMatch[1].trim();
              const beforeBracket = from.substring(0, from.indexOf('<')).trim();
              // Remove surrounding quotes from name if present
              senderName = beforeBracket.replace(/^["']|["']$/g, '').trim();
            } else {
              // No angle brackets - treat as bare email address
              // Extract just the email part (handles "name email@domain" edge cases)
              const emailMatch = from.match(/([^\s<>]+@[^\s<>]+)/);
              if (emailMatch) {
                senderEmail = emailMatch[1];
              } else {
                senderEmail = from.trim();
              }
              senderName = "";
            }

            // If name is empty but we have email, use email as name
            if (!senderName) {
              senderName = senderEmail;
            }
          }

          // Skip if we couldn't extract an email address
          if (!senderEmail || !senderEmail.includes("@")) {
            console.error(`Could not parse sender from: ${from}`);
            return null;
          }

          // Extract full body content from payload
          const { html, plain } = extractBody(msgData.payload);

          return {
            id: msg.id,
            threadId: msgData.threadId,
            subject,
            snippet: msgData.snippet || "",
            bodyHtml: html,
            bodyPlain: plain || msgData.snippet || "",
            rawPayload: JSON.stringify(msgData.payload), // Store raw payload for reprocessing
            receivedAt: date ? new Date(date).getTime() : Date.now(),
            isRead: !msgData.labelIds?.includes("UNREAD"),
            labels: msgData.labelIds || [],
            from: {
              name: senderName,
              email: senderEmail,
            },
            direction: msg.direction,
          };
        } catch (err) {
          console.error(`Error fetching message ${msg.id}:`, err);
          return null;
        }
      }));

      // Add valid results from this batch
      fetchedEmails.push(...batchResults.filter((e): e is NonNullable<typeof e> => e !== null));

      // Delay between batches to respect rate limits
      if (i + BATCH_SIZE < uncachedIds.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    // Type for combined email data
    type EmailData = {
      id: string;
      threadId: string;
      subject: string;
      snippet: string;
      bodyHtml: string;
      bodyPlain: string;
      rawPayload?: string; // Raw Gmail API payload JSON for reprocessing
      receivedAt: number;
      isRead: boolean;
      labels: string[];
      from: { name: string; email: string };
      direction: "incoming" | "outgoing";
      summary?: string;
      urgencyScore?: number;
      urgencyReason?: string;
      suggestedReply?: string;
    };

    // Combine cached and fetched emails in original order
    const emails: EmailData[] = messageIds.map((m): EmailData | undefined => {
      const cached = cachedEmails[m.id];
      if (cached) {
        return {
          id: m.id,
          threadId: "", // Not needed for display
          subject: cached.subject,
          snippet: cached.snippet,
          bodyHtml: "",
          bodyPlain: "",
          receivedAt: cached.receivedAt,
          isRead: cached.isRead,
          labels: [],
          from: { name: cached.fromName || cached.fromEmail, email: cached.fromEmail },
          direction: m.direction, // Use direction from message list
          // Include cached AI data
          summary: cached.summary,
          urgencyScore: cached.urgencyScore,
          urgencyReason: cached.urgencyReason,
          suggestedReply: cached.suggestedReply,
        };
      }
      return fetchedEmails.find(e => e.id === m.id);
    }).filter((e): e is EmailData => e !== undefined);

    // Batch fetch and cache profile photos for all unique senders
    const uniqueEmails = [...new Set(emails.map((e: EmailData) => e.from.email))];
    const storageIdCache: Record<string, Id<"_storage"> | undefined> = {};

    // Fetch and store photos in parallel (limit to avoid rate limiting)
    const photoPromises = uniqueEmails.slice(0, 10).map(async (senderEmail) => {
      try {
        // First get the photo URL from Google People API
        const photoUrl = await fetchProfilePhotoUrl(accessToken, senderEmail);
        if (!photoUrl) return;

        // Download the image
        const imageBlob = await downloadImage(photoUrl);
        if (!imageBlob) return;

        // Store in Convex storage
        const storageId = await ctx.storage.store(imageBlob);
        storageIdCache[senderEmail] = storageId;
      } catch (error) {
        console.error("Error caching photo for", senderEmail, error);
      }
    });
    await Promise.all(photoPromises);

    // Step 1: Collect unique contacts with their info
    const uniqueContactsMap = new Map<string, { name: string; avatarStorageId?: Id<"_storage"> }>();
    for (const email of emails) {
      if (!uniqueContactsMap.has(email.from.email)) {
        uniqueContactsMap.set(email.from.email, {
          name: email.from.name !== email.from.email ? email.from.name : email.from.email,
          avatarStorageId: storageIdCache[email.from.email],
        });
      }
    }

    // Step 2: Upsert contacts SEQUENTIALLY to avoid write conflicts
    const contactIdCache = new Map<string, Id<"contacts">>();
    for (const [email, info] of uniqueContactsMap) {
      try {
        const result = await ctx.runMutation(internal.gmailSync.upsertContact, {
          userId: user._id,
          email,
          name: info.name !== email ? info.name : undefined,
          avatarStorageId: info.avatarStorageId,
        });
        contactIdCache.set(email, result.contactId);
      } catch (e) {
        console.error("Failed to upsert contact:", email, e);
      }
    }

    // Step 3: Store emails using cached contact IDs
    for (const email of emails) {
      try {
        const contactId = contactIdCache.get(email.from.email);
        if (!contactId) {
          console.error("Missing contact ID for:", email.from.email);
          continue;
        }

        // Store the email (prefer HTML body, fall back to plain text)
        const bodyFull = email.bodyHtml || email.bodyPlain || email.snippet;
        await ctx.runMutation(internal.gmailSync.storeEmailInternal, {
          externalId: email.id,
          threadId: email.threadId || undefined,
          provider: "gmail",
          userId: user._id,
          from: contactId,
          fromName: email.from.name || undefined, // Store sender name from this specific email
          to: [], // We're not parsing recipients yet
          subject: email.subject,
          bodyPreview: email.snippet,
          bodyFull,
          bodyHtml: email.bodyHtml || undefined,
          rawPayload: email.rawPayload,
          receivedAt: email.receivedAt,
          isRead: email.isRead,
          direction: email.direction,
        });
      } catch (e) {
        console.error("Failed to store email:", email.id, e);
      }
    }

    // Fetch cached summaries for all emails
    const externalIds: string[] = emails.map((e: EmailData) => e.id);
    type CachedSummary = {
      summary?: string;
      urgencyScore?: number;
      urgencyReason?: string;
      suggestedReply?: string;
    };
    const cachedSummaries: Record<string, CachedSummary> = await ctx.runQuery(
      internal.gmailSync.getCachedSummaries,
      { externalIds }
    );

    // Merge cached summaries into email data
    const emailsWithSummaries: EmailData[] = emails.map((email: EmailData): EmailData => {
      const cached: CachedSummary | undefined = cachedSummaries[email.id];
      return {
        ...email,
        summary: cached?.summary ?? email.summary,
        urgencyScore: cached?.urgencyScore ?? email.urgencyScore,
        urgencyReason: cached?.urgencyReason ?? email.urgencyReason,
        suggestedReply: cached?.suggestedReply ?? email.suggestedReply,
      };
    });

    return { emails: emailsWithSummaries, nextPageToken };
  },
});

// Internal action to fetch and store specific emails by ID (for workflow use)
export const fetchAndStoreEmailsByIds = internalAction({
  args: {
    userEmail: v.string(),
    messageIds: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<{ stored: string[]; failed: string[] }> => {
    // Get user's Gmail tokens
    const user = await ctx.runQuery(internal.gmailSync.getUserByEmail, {
      email: args.userEmail,
    });

    if (!user?.gmailAccessToken) {
      throw new Error("Gmail not connected");
    }

    let accessToken = user.gmailAccessToken;

    // Helper for delays
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const unfold = (s: string) => s.replace(/\r?\n\s+/g, "").trim();

    const stored: string[] = [];
    const failed: string[] = [];

    // Step 1: Fetch all message data in parallel (just HTTP calls, no mutations)
    interface MessageData {
      msgId: string;
      threadId?: string;
      senderEmail: string;
      senderName: string;
      subject: string;
      snippet: string;
      bodyHtml: string;
      bodyPlain: string;
      rawPayload: string;
      receivedAt: number;
      isRead: boolean;
      direction: "incoming" | "outgoing";
      // Subscription fields
      listUnsubscribe?: string;
      listUnsubscribePost: boolean;
      isSubscription: boolean;
    }
    const messageDataList: MessageData[] = [];

    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 200;

    for (let i = 0; i < args.messageIds.length; i += BATCH_SIZE) {
      const batch = args.messageIds.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(batch.map(async (msgId): Promise<MessageData | null> => {
        try {
          // Use format=full to get complete email body for accurate summarization
          const msgResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (!msgResponse.ok) {
            console.error(`Failed to fetch message ${msgId}: ${msgResponse.status}`);
            failed.push(msgId);
            return null;
          }

          const msgData = await msgResponse.json();
          const headers = msgData.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

          const from = unfold(getHeader("From"));
          const subject = unfold(getHeader("Subject")) || "(No subject)";
          const date = getHeader("Date");

          // Parse sender - check for angle brackets first to avoid greedy regex issues
          let senderName = "";
          let senderEmail = "";
          if (from) {
            const angleMatch = from.match(/<([^<>]+@[^<>]+)>/);
            if (angleMatch) {
              // Email is in angle brackets, name is everything before
              senderEmail = angleMatch[1].trim();
              const beforeBracket = from.substring(0, from.indexOf('<')).trim();
              senderName = beforeBracket.replace(/^["']|["']$/g, '').trim();
            } else {
              // No angle brackets - treat as bare email address
              const emailMatch = from.match(/([^\s<>]+@[^\s<>]+)/);
              if (emailMatch) {
                senderEmail = emailMatch[1];
              } else {
                senderEmail = from.trim();
              }
              senderName = "";
            }
            if (!senderName) {
              senderName = senderEmail;
            }
          }

          if (!senderEmail?.includes("@")) {
            failed.push(msgId);
            return null;
          }

          // Extract subscription headers
          const listUnsubscribe = getHeader("List-Unsubscribe") || undefined;
          const listUnsubscribePost = !!getHeader("List-Unsubscribe-Post");
          const isSubscription = !!listUnsubscribe;

          // Detect direction: outgoing if sender matches user email
          const direction: "incoming" | "outgoing" =
            senderEmail.toLowerCase() === args.userEmail.toLowerCase() ? "outgoing" : "incoming";

          // Extract full body content from payload
          const { html, plain } = extractBody(msgData.payload);

          return {
            msgId,
            threadId: msgData.threadId || undefined,
            senderEmail,
            senderName: senderName !== senderEmail ? senderName : senderEmail,
            subject,
            snippet: msgData.snippet || "",
            bodyHtml: html,
            bodyPlain: plain || msgData.snippet || "",
            rawPayload: JSON.stringify(msgData.payload),
            receivedAt: date ? new Date(date).getTime() : Date.now(),
            isRead: !msgData.labelIds?.includes("UNREAD"),
            direction,
            listUnsubscribe,
            listUnsubscribePost,
            isSubscription,
          };
        } catch (e) {
          console.error(`Error fetching message ${msgId}:`, e);
          failed.push(msgId);
          return null;
        }
      }));

      messageDataList.push(...results.filter((r): r is MessageData => r !== null));

      if (i + BATCH_SIZE < args.messageIds.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    // Step 2: Collect unique contacts and upsert them SEQUENTIALLY to avoid write conflicts
    const uniqueContacts = new Map<string, string>(); // email -> name
    for (const msg of messageDataList) {
      if (!uniqueContacts.has(msg.senderEmail)) {
        uniqueContacts.set(msg.senderEmail, msg.senderName);
      }
    }

    const contactIdCache = new Map<string, Id<"contacts">>();
    for (const [email, name] of uniqueContacts) {
      try {
        const result = await ctx.runMutation(internal.gmailSync.upsertContact, {
          userId: user._id,
          email,
          name: name !== email ? name : undefined,
        });
        contactIdCache.set(email, result.contactId);
      } catch (e) {
        console.error(`Error upserting contact ${email}:`, e);
      }
    }

    // Step 3: Store emails (can be done in parallel since each email is unique)
    for (const msg of messageDataList) {
      const contactId = contactIdCache.get(msg.senderEmail);
      if (!contactId) {
        failed.push(msg.msgId);
        continue;
      }

      try {
        // Prefer HTML body, fall back to plain text, then snippet
        const bodyFull = msg.bodyHtml || msg.bodyPlain || msg.snippet;
        const { emailId, isNew } = await ctx.runMutation(internal.gmailSync.storeEmailInternal, {
          externalId: msg.msgId,
          threadId: msg.threadId,
          provider: "gmail",
          userId: user._id,
          from: contactId,
          fromName: msg.senderName || undefined, // Store sender name from this specific email
          to: [],
          subject: msg.subject,
          bodyPreview: msg.snippet,
          bodyFull,
          bodyHtml: msg.bodyHtml || undefined,
          rawPayload: msg.rawPayload,
          receivedAt: msg.receivedAt,
          isRead: msg.isRead,
          direction: msg.direction,
          listUnsubscribe: msg.listUnsubscribe,
          listUnsubscribePost: msg.listUnsubscribePost,
          isSubscription: msg.isSubscription,
        });
        stored.push(msg.msgId);

        // If this is a subscription email, upsert the subscription record
        if (msg.isSubscription && msg.listUnsubscribe) {
          try {
            await ctx.runMutation(internal.subscriptionsHelpers.upsertSubscription, {
              userId: user._id,
              senderEmail: msg.senderEmail,
              senderName: msg.senderName !== msg.senderEmail ? msg.senderName : undefined,
              listUnsubscribe: msg.listUnsubscribe,
              listUnsubscribePost: msg.listUnsubscribePost,
              emailId,
              receivedAt: msg.receivedAt,
              subject: msg.subject,
            });
          } catch (e) {
            console.error(`Error upserting subscription for ${msg.senderEmail}:`, e);
          }
        }
      } catch (e) {
        console.error(`Error storing email ${msg.msgId}:`, e);
        failed.push(msg.msgId);
      }
    }

    return { stored, failed };
  },
});

