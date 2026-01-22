/**
 * Gmail sync actions - fetching and storing emails from Gmail API.
 *
 * Extracted modules:
 * - gmailHelpers.ts: Pure helper functions (decodeBase64Url, extractBody, etc.)
 * - gmailAuth.ts: Token refresh and photo fetching
 * - gmailQueries.ts: Read-only queries (getUserByEmail, getCachedEmails, etc.)
 */
import { v } from "convex/values";
import { action, internalAction, internalMutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { encryptedPii } from "./pii";

// Import from extracted modules
import { extractBody, extractAttachments, type AttachmentInfo, getHeader, unfold as unfoldHeader, parseSender } from "./gmailHelpers";
import {
  refreshTokenIfNeeded,
  fetchProfilePhotoUrl,
  downloadImage,
} from "./gmailAuth";

// Re-export queries for backwards compatibility
export { getUserByEmail, getCachedSummaries, getCachedEmails } from "./gmailQueries";
// Re-export updateUserTokens for backwards compatibility
export { updateUserTokens } from "./gmailAuth";

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

    // Get PII helper for encrypting contact name
    const pii = await encryptedPii.forUser(ctx, args.userId);

    if (existing) {
      // Update name if provided (encrypt it)
      const updates: Record<string, unknown> = {
        emailCount: existing.emailCount + 1,
        lastEmailAt: Date.now(),
      };
      if (args.name) {
        // Always update name when provided (encrypted)
        updates.name = await pii.encrypt(args.name);
      }
      // Only update avatar if we have a new one and don't have a cached one
      if (args.avatarStorageId && !existing.avatarStorageId) {
        updates.avatarStorageId = args.avatarStorageId;
        updates.avatarUrl = avatarUrl;
      }
      await ctx.db.patch(existing._id, updates);
      return { contactId: existing._id, hasAvatar: !!existing.avatarStorageId };
    }

    // Encrypt name for new contact
    const encryptedName = args.name ? await pii.encrypt(args.name) : undefined;

    const contactId = await ctx.db.insert("contacts", {
      userId: args.userId,
      email: args.email,
      name: encryptedName,
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
    // Gmail account reference
    gmailAccountId: v.optional(v.id("gmailAccounts")),
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

    // Get PII helper for encrypting email content
    const pii = await encryptedPii.forUser(ctx, args.userId);

    // Extract bodyFull from args - it goes into emailBodies table, not emails
    const { bodyFull, subject, bodyPreview, gmailAccountId, ...restArgs } = args;

    // Encrypt PII fields
    const encryptedSubject = await pii.encrypt(subject);
    const encryptedBodyPreview = await pii.encrypt(bodyPreview);

    const emailId = await ctx.db.insert("emails", {
      ...restArgs,
      subject: encryptedSubject,
      bodyPreview: encryptedBodyPreview,
      isTriaged: false,
      direction: args.direction || "incoming",
      gmailAccountId,
    });

    // Store body in separate emailBodies table (encrypted)
    if (bodyFull) {
      const encryptedBodyFull = await pii.encrypt(bodyFull);
      await ctx.db.insert("emailBodies", {
        emailId,
        bodyFull: encryptedBodyFull,
      });
    }

    return { emailId, isNew: true };
  },
});

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
      bodyPreview: string | null;
    };
    const email: EmailData | null = await ctx.runQuery(internal.emails.getEmailById, {
      emailId: args.emailId,
    });

    if (!email) {
      throw new Error("Email not found");
    }

    // Check if we already have body stored in emailBodies table
    const existingBody = await ctx.runQuery(internal.emails.getEmailBodyById, {
      emailId: args.emailId,
    });

    if (existingBody?.bodyFull && existingBody.bodyFull.includes("<")) {
      return { body: existingBody.bodyFull, isHtml: true };
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
    const bodyFull = html || plain || email.bodyPreview || "";
    const isHtml = !!html;

    // Extract attachment metadata from the payload
    const attachments = extractAttachments(data.payload);

    // Update the email with full body
    await ctx.runMutation(internal.gmailSync.updateEmailBody, {
      emailId: args.emailId,
      bodyFull,
    });

    // Store attachment metadata (without downloading the files yet)
    for (const attachment of attachments) {
      await ctx.runMutation(internal.gmailSync.storeAttachment, {
        emailId: args.emailId,
        userId: user._id,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
        attachmentId: attachment.attachmentId,
        contentId: attachment.contentId,
      });
    }

    return { body: bodyFull, isHtml };
  },
});

// Internal mutation to update email body (stored in separate emailBodies table)
export const updateEmailBody = internalMutation({
  args: {
    emailId: v.id("emails"),
    bodyFull: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the email to find the user for encryption
    const email = await ctx.db.get(args.emailId);
    if (!email) {
      throw new Error("Email not found");
    }

    // Get PII helper for encrypting body
    const pii = await encryptedPii.forUser(ctx, email.userId);
    const encryptedBodyFull = await pii.encrypt(args.bodyFull);

    // Check if body already exists for this email
    const existingBody = await ctx.db
      .query("emailBodies")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    if (existingBody) {
      await ctx.db.patch(existingBody._id, { bodyFull: encryptedBodyFull });
    } else {
      await ctx.db.insert("emailBodies", {
        emailId: args.emailId,
        bodyFull: encryptedBodyFull,
      });
    }
  },
});

// Internal mutation to store attachment metadata (file data stored separately in Convex storage)
export const storeAttachment = internalMutation({
  args: {
    emailId: v.id("emails"),
    userId: v.id("users"),
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
    attachmentId: v.string(),
    contentId: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    // Check if attachment already exists
    const existing = await ctx.db
      .query("attachments")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .filter((q) => q.eq(q.field("attachmentId"), args.attachmentId))
      .first();

    if (existing) {
      // Update storageId if provided
      if (args.storageId && !existing.storageId) {
        await ctx.db.patch(existing._id, { storageId: args.storageId });
      }
      return existing._id;
    }

    // Get PII helper for encrypting filename
    const pii = await encryptedPii.forUser(ctx, args.userId);
    const encryptedFilename = await pii.encrypt(args.filename);

    // Insert new attachment
    const attachmentId = await ctx.db.insert("attachments", {
      emailId: args.emailId,
      userId: args.userId,
      filename: encryptedFilename,
      mimeType: args.mimeType,
      size: args.size,
      attachmentId: args.attachmentId,
      contentId: args.contentId,
      storageId: args.storageId,
      createdAt: Date.now(),
    });

    return attachmentId;
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
    gmailAccountId: v.optional(v.id("gmailAccounts")),
  },
  handler: async (ctx, args): Promise<{ stored: string[]; failed: string[] }> => {
    // Get user's Gmail tokens (fallback to legacy user tokens if no account ID provided)
    let userId: any;
    let accessToken: string;

    if (args.gmailAccountId) {
      // Use new Gmail account structure
      const account = await ctx.runMutation(
        internal.gmailAccountHelpers.decryptGmailAccountTokens,
        { accountId: args.gmailAccountId }
      );
      if (!account || !account.accessToken) {
        throw new Error("Gmail account not found or no access token");
      }
      userId = account.userId;
      accessToken = account.accessToken;
    } else {
      // Fallback to legacy user tokens
      const user = await ctx.runQuery(internal.gmailSync.getUserByEmail, {
        email: args.userEmail,
      });
      if (!user?.gmailAccessToken) {
        throw new Error("Gmail not connected");
      }
      userId = user._id;
      accessToken = user.gmailAccessToken;
    }

    // Helper for delays
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const stored: string[] = [];
    const failed: string[] = [];

    // Step 1: Fetch full messages in parallel (using format=full to get body)
    interface MessageData {
      msgId: string;
      threadId?: string;
      senderEmail: string;
      senderName: string;
      subject: string;
      snippet: string;
      bodyFull: string;  // Full body (HTML preferred, fallback to plain text)
      receivedAt: number;
      isRead: boolean;
      // Subscription fields
      listUnsubscribe?: string;
      listUnsubscribePost: boolean;
      isSubscription: boolean;
      // Attachments
      attachments: AttachmentInfo[];
    }
    const messageDataList: MessageData[] = [];

    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 200;

    for (let i = 0; i < args.messageIds.length; i += BATCH_SIZE) {
      const batch = args.messageIds.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(batch.map(async (msgId): Promise<MessageData | null> => {
        try {
          // Use format=full to get the complete email body
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

          const from = unfoldHeader(getHeader(headers, "From"));
          const subject = unfoldHeader(getHeader(headers, "Subject")) || "(No subject)";
          const date = getHeader(headers, "Date");

          // Parse sender using helper
          const sender = parseSender(from);
          if (!sender.email?.includes("@")) {
            failed.push(msgId);
            return null;
          }

          // Extract full body (HTML preferred, fallback to plain text)
          const { html, plain } = extractBody(msgData.payload);
          const bodyFull = html || plain || msgData.snippet || "";

          // Extract attachment metadata
          const attachments = extractAttachments(msgData.payload);

          // Extract subscription headers
          const listUnsubscribe = getHeader(headers, "List-Unsubscribe") || undefined;
          const listUnsubscribePost = !!getHeader(headers, "List-Unsubscribe-Post");
          const isSubscription = !!listUnsubscribe;

          return {
            msgId,
            threadId: msgData.threadId || undefined,
            senderEmail: sender.email,
            senderName: sender.name !== sender.email ? sender.name : sender.email,
            subject,
            snippet: msgData.snippet || "",
            bodyFull,
            receivedAt: date ? new Date(date).getTime() : Date.now(),
            isRead: !msgData.labelIds?.includes("UNREAD"),
            listUnsubscribe,
            listUnsubscribePost,
            isSubscription,
            attachments,
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
          userId,
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
        // Store with full body instead of just snippet
        const { emailId, isNew } = await ctx.runMutation(internal.gmailSync.storeEmailInternal, {
          externalId: msg.msgId,
          threadId: msg.threadId,
          provider: "gmail",
          userId,
          from: contactId,
          to: [],
          subject: msg.subject,
          bodyPreview: msg.snippet,
          bodyFull: msg.bodyFull,  // Use full body extracted from email
          receivedAt: msg.receivedAt,
          isRead: msg.isRead,
          listUnsubscribe: msg.listUnsubscribe,
          listUnsubscribePost: msg.listUnsubscribePost,
          isSubscription: msg.isSubscription,
          gmailAccountId: args.gmailAccountId,
        });
        stored.push(msg.msgId);

        // Store attachment metadata for new emails
        if (isNew && msg.attachments.length > 0) {
          for (const attachment of msg.attachments) {
            try {
              await ctx.runMutation(internal.gmailSync.storeAttachment, {
                emailId,
                userId,
                filename: attachment.filename,
                mimeType: attachment.mimeType,
                size: attachment.size,
                attachmentId: attachment.attachmentId,
                contentId: attachment.contentId,
              });
            } catch (e) {
              console.error(`Error storing attachment ${attachment.filename}:`, e);
            }
          }
        }

        // If this is a subscription email, upsert the subscription record
        if (msg.isSubscription && msg.listUnsubscribe) {
          try {
            await ctx.runMutation(internal.subscriptionsHelpers.upsertSubscription, {
              userId,
              senderEmail: msg.senderEmail,
              senderName: msg.senderName !== msg.senderEmail ? msg.senderName : undefined,
              listUnsubscribe: msg.listUnsubscribe,
              listUnsubscribePost: msg.listUnsubscribePost,
              emailId,
              receivedAt: msg.receivedAt,
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

// Query to get attachments for an email
export const getEmailAttachments = query({
  args: {
    emailId: v.id("emails"),
  },
  handler: async (ctx, args) => {
    // Get the email to verify ownership
    const email = await ctx.db.get(args.emailId);
    if (!email) {
      return [];
    }

    // Get PII helper for decrypting filenames (use forUserQuery in query context)
    const pii = await encryptedPii.forUserQuery(ctx, email.userId);

    // Get all attachments for this email
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .collect();

    // If no PII key exists, return attachments with placeholder filename
    if (!pii) {
      return attachments.map((attachment) => ({
        _id: attachment._id,
        filename: "[encrypted]",
        mimeType: attachment.mimeType,
        size: attachment.size,
        attachmentId: attachment.attachmentId,
        contentId: attachment.contentId,
      }));
    }

    // Decrypt filenames
    return Promise.all(
      attachments.map(async (attachment) => ({
        _id: attachment._id,
        filename: await pii.decrypt(attachment.filename),
        mimeType: attachment.mimeType,
        size: attachment.size,
        attachmentId: attachment.attachmentId,
        contentId: attachment.contentId,
      }))
    );
  },
});

// Action to download an attachment
export const downloadAttachment = action({
  args: {
    userEmail: v.string(),
    emailId: v.id("emails"),
    attachmentId: v.string(),
  },
  handler: async (ctx, args): Promise<{ data: string; mimeType: string; filename: string }> => {
    // Get the email to find its externalId
    type EmailData = {
      externalId: string;
    };
    const email: EmailData | null = await ctx.runQuery(internal.emails.getEmailById, {
      emailId: args.emailId,
    });

    if (!email) {
      throw new Error("Email not found");
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

    // Get attachment metadata from database to verify it exists and get filename
    const attachments = await ctx.runQuery(api.gmailSync.getEmailAttachments, {
      emailId: args.emailId,
    });

    const attachment = attachments.find((a: any) => a.attachmentId === args.attachmentId);
    if (!attachment) {
      throw new Error("Attachment not found");
    }

    // Fetch attachment from Gmail
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.externalId}/attachments/${args.attachmentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch attachment: ${response.status}`);
    }

    const data = await response.json();

    // Return the base64url-encoded data along with metadata
    return {
      data: data.data, // Base64url-encoded data
      mimeType: attachment.mimeType,
      filename: attachment.filename,
    };
  },
});