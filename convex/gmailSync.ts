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

    // Get the URL for the stored avatar
    let avatarUrl: string | undefined;
    if (args.avatarStorageId) {
      avatarUrl = await ctx.storage.getUrl(args.avatarStorageId) ?? undefined;
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
      // Only update avatar if we have a new one and don't have a cached one
      if (args.avatarStorageId && !existing.avatarStorageId) {
        updates.avatarStorageId = args.avatarStorageId;
        updates.avatarUrl = avatarUrl;
      }
      await ctx.db.patch(existing._id, updates);
      return { contactId: existing._id, hasAvatar: !!existing.avatarStorageId };
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
    return { contactId, hasAvatar: false };
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
    to: v.array(v.id("contacts")),
    subject: v.string(),
    bodyPreview: v.string(),
    bodyFull: v.string(),
    receivedAt: v.number(),
    isRead: v.boolean(),
    direction: v.optional(v.union(v.literal("incoming"), v.literal("outgoing"))),
    // Subscription fields
    listUnsubscribe: v.optional(v.string()),
    listUnsubscribePost: v.optional(v.boolean()),
    isSubscription: v.optional(v.boolean()),
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

    const emailId = await ctx.db.insert("emails", {
      ...args,
      isTriaged: false,
      direction: args.direction || "incoming",
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
      bodyFull: string;
      bodyPreview: string;
    };
    const email: EmailData | null = await ctx.runQuery(internal.emails.getEmailById, {
      emailId: args.emailId,
    });

    if (!email) {
      throw new Error("Email not found");
    }

    // If we already have HTML content, return it
    if (email.bodyFull && email.bodyFull.includes("<")) {
      return { body: email.bodyFull, isHtml: true };
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
    }

    // Fetch full email from Gmail
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.externalId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch email: ${response.status}`);
    }

    const data = await response.json();
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

// Internal mutation to update email body
export const updateEmailBody = internalMutation({
  args: {
    emailId: v.id("emails"),
    bodyFull: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailId, { bodyFull: args.bodyFull });
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

    // Refresh token if needed (only if we have a refresh token)
    let accessToken = user.gmailAccessToken;
    if (user.gmailRefreshToken && user.gmailTokenExpiresAt) {
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
    }

    // Fetch message list (default to 15 for faster initial load)
    // Fetch both INBOX and SENT emails
    const maxResults = args.maxResults || 15;

    // Fetch INBOX emails
    let inboxUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`;
    if (args.pageToken) {
      inboxUrl += `&pageToken=${args.pageToken}`;
    }

    const inboxResponse = await fetch(inboxUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!inboxResponse.ok) {
      const error = await inboxResponse.text();
      throw new Error(`Gmail API error: ${inboxResponse.status} - ${error}`);
    }

    const inboxData: { messages?: { id: string }[]; nextPageToken?: string } = await inboxResponse.json();
    const inboxMessageIds: { id: string; direction: "incoming" }[] = (inboxData.messages || []).map(m => ({ ...m, direction: "incoming" as const }));
    const nextPageToken = inboxData.nextPageToken;

    // Also fetch SENT emails (half as many to not overwhelm)
    const sentUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${Math.ceil(maxResults / 2)}&labelIds=SENT`;
    const sentResponse = await fetch(sentUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let sentMessageIds: { id: string; direction: "outgoing" }[] = [];
    if (sentResponse.ok) {
      const sentData: { messages?: { id: string }[] } = await sentResponse.json();
      sentMessageIds = (sentData.messages || []).map(m => ({ ...m, direction: "outgoing" as const }));
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
          const msgResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
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

          const from = unfold(getHeader("From"));
          const subject = unfold(getHeader("Subject")) || "(No subject)";
          const date = getHeader("Date");

          // Parse sender name and email - handle various formats
          let senderName = "";
          let senderEmail = "";

          if (from) {
            // Try to match "Name <email>" or just "email"
            const fromMatch = from.match(
              /(?:"?([^"<]*)"?\s*)?<?([^\s<>]+@[^\s<>]+)>?/
            );
            if (fromMatch) {
              senderName = fromMatch[1]?.trim() || "";
              senderEmail = fromMatch[2] || from;
            } else {
              senderEmail = from;
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

          // Use snippet as body preview (no full body fetch for inbox view)
          return {
            id: msg.id,
            threadId: msgData.threadId,
            subject,
            snippet: msgData.snippet || "",
            bodyHtml: "",
            bodyPlain: msgData.snippet || "",
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
          to: [], // We're not parsing recipients yet
          subject: email.subject,
          bodyPreview: email.snippet,
          bodyFull,
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

    // Step 1: Fetch all message metadata in parallel (just HTTP calls, no mutations)
    interface MessageData {
      msgId: string;
      threadId?: string;
      senderEmail: string;
      senderName: string;
      subject: string;
      snippet: string;
      receivedAt: number;
      isRead: boolean;
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
          const msgResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`,
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

          // Parse sender
          let senderName = "";
          let senderEmail = "";
          const fromMatch = from.match(/(?:"?([^"<]*)"?\s*)?<?([^\s<>]+@[^\s<>]+)>?/);
          if (fromMatch) {
            senderName = fromMatch[1]?.trim() || "";
            senderEmail = fromMatch[2] || from;
          } else {
            senderEmail = from;
          }
          if (!senderName) senderName = senderEmail;

          if (!senderEmail?.includes("@")) {
            failed.push(msgId);
            return null;
          }

          // Extract subscription headers
          const listUnsubscribe = getHeader("List-Unsubscribe") || undefined;
          const listUnsubscribePost = !!getHeader("List-Unsubscribe-Post");
          const isSubscription = !!listUnsubscribe;

          return {
            msgId,
            threadId: msgData.threadId || undefined,
            senderEmail,
            senderName: senderName !== senderEmail ? senderName : senderEmail,
            subject,
            snippet: msgData.snippet || "",
            receivedAt: date ? new Date(date).getTime() : Date.now(),
            isRead: !msgData.labelIds?.includes("UNREAD"),
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
        const { emailId, isNew } = await ctx.runMutation(internal.gmailSync.storeEmailInternal, {
          externalId: msg.msgId,
          threadId: msg.threadId,
          provider: "gmail",
          userId: user._id,
          from: contactId,
          to: [],
          subject: msg.subject,
          bodyPreview: msg.snippet,
          bodyFull: msg.snippet,
          receivedAt: msg.receivedAt,
          isRead: msg.isRead,
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

