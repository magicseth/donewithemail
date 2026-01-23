import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { piiField } from "@convex-dev/encrypted-pii";

export default defineSchema({
  emails: defineTable({
    // External provider data
    externalId: v.string(),
    threadId: v.optional(v.string()), // Gmail thread ID for grouping conversations
    provider: v.union(v.literal("gmail"), v.literal("outlook"), v.literal("imap")),
    userId: v.id("users"),

    // Gmail account reference (for multiple Gmail accounts support)
    gmailAccountId: v.optional(v.id("gmailAccounts")),

    // Email metadata (ENCRYPTED)
    from: v.id("contacts"),
    fromName: v.optional(piiField()), // Sender name as it appeared in this email's From header
    to: v.array(v.id("contacts")),
    cc: v.optional(v.array(v.id("contacts"))),
    subject: piiField(),
    bodyPreview: piiField(),
    // Large body content stored in emailBodies table (migrated)
    receivedAt: v.number(),

    // User state
    isRead: v.boolean(),
    isTriaged: v.boolean(),
    triageAction: v.optional(v.union(
      v.literal("done"),
      v.literal("reply_needed"),
      v.literal("delegated")
    )),
    triagedAt: v.optional(v.number()),
    // Punt state - flagged for human review during batch triage (before final triage)
    isPunted: v.optional(v.boolean()),

    // Follow-up reminder tracking
    lastReminderAt: v.optional(v.number()),

    // Direction: incoming (received) or outgoing (sent)
    direction: v.optional(v.union(v.literal("incoming"), v.literal("outgoing"))),

    // Subscription/newsletter detection
    listUnsubscribe: v.optional(v.string()),
    listUnsubscribePost: v.optional(v.boolean()),
    isSubscription: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_user_untriaged", ["userId", "isTriaged", "receivedAt"])
    .index("by_user_received", ["userId", "receivedAt"])
    .index("by_user_triaged_at", ["userId", "triagedAt"])
    .index("by_external_id", ["externalId", "provider"])
    .index("by_from", ["from"])
    .index("by_thread", ["userId", "threadId"])
    .index("by_user_reply_needed", ["userId", "triageAction", "triagedAt"]),
    // Note: search index on subject removed since it's now encrypted

  // Email bodies stored separately to keep emails table lightweight
  // This allows querying many emails without hitting memory limits
  emailBodies: defineTable({
    emailId: v.id("emails"),
    bodyFull: piiField(),
    bodyHtml: v.optional(piiField()),
    rawPayload: v.optional(piiField()),
  })
    .index("by_email", ["emailId"]),

  // Email attachments stored separately with files in Convex storage
  attachments: defineTable({
    emailId: v.id("emails"),
    userId: v.id("users"),
    filename: piiField(), // Original filename (ENCRYPTED)
    mimeType: v.string(), // e.g., "application/pdf", "image/png"
    size: v.number(), // Size in bytes
    storageId: v.optional(v.id("_storage")), // Reference to file in Convex storage
    attachmentId: v.string(), // Gmail attachment ID for fetching
    contentId: v.optional(v.string()), // For inline images (Content-ID header)
    createdAt: v.number(),
  })
    .index("by_email", ["emailId"])
    .index("by_user", ["userId"]),

  // AI-generated email summaries (separate table for cleaner data model)
  emailSummaries: defineTable({
    emailId: v.id("emails"),
    summary: piiField(),
    urgencyScore: v.number(),
    urgencyReason: piiField(),
    suggestedReply: v.optional(piiField()),

    // Action required type
    actionRequired: v.optional(v.union(
      v.literal("reply"),      // User should reply
      v.literal("action"),     // User should do something (not reply)
      v.literal("fyi"),        // Just informational
      v.literal("none")        // No action needed
    )),
    actionDescription: v.optional(piiField()), // e.g., "Schedule meeting", "Review document"

    // Quick reply options - encrypted as JSON string
    quickReplies: v.optional(piiField()), // JSON: Array<{label: string, body: string}>

    // Actionable items (links, attachments) that require user action - encrypted as JSON string
    actionableItems: v.optional(piiField()), // JSON: Array<{type: 'link' | 'attachment', label: string, url?: string, attachmentId?: string}>

    // Calendar event suggestion - encrypted as JSON string
    calendarEvent: v.optional(piiField()), // JSON: {title, startTime, endTime, location, description, recurrence, recurrenceDescription}

    // AI prediction: should user accept this calendar invite?
    // true = likely want to attend, false = likely decline/ignore
    shouldAcceptCalendar: v.optional(v.boolean()),

    // Set when user adds the event to their calendar
    calendarEventId: v.optional(v.string()),
    calendarEventLink: v.optional(v.string()),

    // Meeting request detection - encrypted as JSON string
    // JSON: {isMeetingRequest: boolean, proposedTimes: Array<{startTime: string, endTime: string}>}
    meetingRequest: v.optional(piiField()),

    // Deadline extracted from email (ISO string)
    deadline: v.optional(v.string()),
    deadlineDescription: v.optional(piiField()),  // e.g., "respond by", "submit by"
    deadlineReminderSent: v.optional(v.boolean()),

    createdAt: v.number(),

    // Vector embedding for semantic search (1536-dim for text-embedding-3-small)
    embedding: v.optional(v.array(v.float64())),

    // Important attachments (AI-identified subset of attachments worth highlighting)
    importantAttachmentIds: v.optional(v.array(v.id("attachments"))),
  })
    .index("by_email", ["emailId"])
    .index("by_deadline", ["deadline"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["emailId"],
    }),

  contacts: defineTable({
    userId: v.id("users"),
    email: v.string(), // Keep unencrypted for index lookups
    name: v.optional(piiField()),
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")), // Cached avatar in Convex storage
    emailCount: v.number(),
    lastEmailAt: v.number(),
    relationship: v.optional(v.union(
      v.literal("vip"),
      v.literal("regular"),
      v.literal("unknown")
    )),
    // AI-generated relationship summary (ENCRYPTED)
    relationshipSummary: v.optional(piiField()),
    // Dossier facts about this contact - encrypted as JSON string
    facts: v.optional(piiField()), // JSON: Array<{id, text, source, createdAt, sourceEmailId?}>
    // Writing style analysis - encrypted as JSON string
    writingStyle: v.optional(piiField()), // JSON: {tone, greeting, signoff, characteristics, samplePhrases, emailsAnalyzed, analyzedAt}
  })
    .index("by_user", ["userId"])
    .index("by_email", ["email"])
    .index("by_user_email", ["userId", "email"])
    .index("by_user_last_email", ["userId", "lastEmailAt"]),

  // Gmail accounts - support multiple Gmail accounts per user
  gmailAccounts: defineTable({
    userId: v.id("users"),
    email: v.string(), // Gmail address (keep unencrypted for display)

    // OAuth tokens (ENCRYPTED)
    accessToken: piiField(),
    refreshToken: v.optional(piiField()), // Google refresh token (for gmail_oauth accounts)
    tokenExpiresAt: v.number(),

    // WorkOS session refresh token (if this account was linked via WorkOS)
    workosRefreshToken: v.optional(piiField()),

    // Authentication source - determines how to refresh tokens
    // workos: Refresh via WorkOS API (primary account from WorkOS OAuth)
    // gmail_oauth: Refresh via Google API directly (linked additional accounts)
    authSource: v.optional(v.union(
      v.literal("workos"),
      v.literal("gmail_oauth")
    )),

    // Account metadata
    isPrimary: v.boolean(), // Primary account (first one connected)
    displayName: v.optional(piiField()), // User's name from Google
    avatarUrl: v.optional(v.string()),

    // Last sync timestamp for this account
    lastSyncAt: v.optional(v.number()),

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_email", ["userId", "email"])
    .index("by_email", ["email"]),

  users: defineTable({
    // WorkOS user ID (optional for Gmail-only auth)
    workosId: v.optional(v.string()),
    email: v.string(), // Keep unencrypted for index lookups
    name: v.optional(piiField()),
    avatarUrl: v.optional(v.string()),

    // WorkOS session tokens (used to refresh Google OAuth tokens)
    // These are sensitive but needed for auth operations - encrypt them
    workosRefreshToken: v.optional(piiField()),

    // DEPRECATED: Legacy Gmail tokens (use gmailAccounts table instead)
    // Kept for backward compatibility during migration
    gmailAccessToken: v.optional(piiField()),
    gmailRefreshToken: v.optional(piiField()), // Legacy - now using WorkOS refresh
    gmailTokenExpiresAt: v.optional(v.number()),

    // Connected email providers - encrypted as JSON string
    connectedProviders: v.optional(piiField()), // JSON: Array<{provider, email, accessToken, refreshToken, expiresAt}>

    // User preferences
    preferences: v.optional(v.object({
      autoProcessEmails: v.optional(v.boolean()),
      urgencyThreshold: v.optional(v.number()),
    })),

    // Last sync timestamp for detecting new emails (used by cron job)
    lastEmailSyncAt: v.optional(v.number()),

    // Track last app open for changelog display
    lastOpenedAt: v.optional(v.number()),

    // User's last known timezone (IANA format, e.g., "America/Los_Angeles")
    // Used by AI summarizer to calculate relative dates correctly
    timezone: v.optional(v.string()),

    createdAt: v.optional(v.number()),
  })
    .index("by_workos_id", ["workosId"])
    .index("by_email", ["email"]),

  // Queue for emails pending AI processing
  aiProcessingQueue: defineTable({
    emailId: v.id("emails"),
    userId: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_email", ["emailId"]),

  // Subscriptions/newsletters grouped by sender
  subscriptions: defineTable({
    userId: v.id("users"),
    senderEmail: v.string(), // Keep unencrypted for index lookups
    senderDomain: v.string(),
    senderName: v.optional(piiField()),
    listUnsubscribe: v.optional(v.string()),
    listUnsubscribePost: v.optional(v.boolean()),
    unsubscribeMethod: v.optional(v.union(
      v.literal("http_post"),
      v.literal("http_get"),
      v.literal("mailto"),
      v.literal("none")
    )),
    emailCount: v.number(),
    firstEmailAt: v.number(),
    lastEmailAt: v.number(),
    unsubscribeStatus: v.union(
      v.literal("subscribed"),
      v.literal("pending"),
      v.literal("processing"),
      v.literal("unsubscribed"),
      v.literal("failed"),
      v.literal("manual_required")
    ),
    unsubscribedAt: v.optional(v.number()),
    mostRecentEmailId: v.optional(v.id("emails")),
    mostRecentSubject: v.optional(piiField()),
  })
    .index("by_user", ["userId"])
    .index("by_user_sender", ["userId", "senderEmail"])
    .index("by_user_last_email", ["userId", "lastEmailAt"]),

  // Feature requests from voice recording (processed by local Claude Code)
  featureRequests: defineTable({
    userId: v.id("users"),
    transcript: piiField(),           // Voice transcript (ENCRYPTED)
    status: v.union(
      v.literal("pending"),           // Waiting for local processor
      v.literal("processing"),        // Claude Code is working on it
      v.literal("completed"),         // Done, EAS update pushed
      v.literal("failed"),            // Something went wrong
      v.literal("combined")           // Combined into another request
    ),
    // Progress tracking
    progressStep: v.optional(v.union(
      v.literal("cloning"),           // Cloning repo
      v.literal("implementing"),      // Claude Code working
      v.literal("pushing"),           // Pushing feature branch
      v.literal("merging"),           // Merging to preview
      v.literal("deploying_backend"), // Running convex dev --once
      v.literal("uploading"),         // Running EAS update
      v.literal("ready")              // Ready for testing
    )),
    progressMessage: v.optional(piiField()),  // Human-readable status (ENCRYPTED)
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(piiField()),
    // Output from Claude Code (ENCRYPTED)
    claudeOutput: v.optional(piiField()),      // Claude's final output/summary
    claudeSuccess: v.optional(v.boolean()),    // Did Claude think it succeeded?
    commitHash: v.optional(v.string()),
    branchName: v.optional(v.string()),
    easUpdateId: v.optional(v.string()),
    easUpdateMessage: v.optional(v.string()),
    easDashboardUrl: v.optional(v.string()),
    // Debug logs from the app when the request was submitted (ENCRYPTED)
    debugLogs: v.optional(piiField()),
    // If this request was combined into another, reference to the combined request
    combinedIntoId: v.optional(v.id("featureRequests")),
  })
    .index("by_status", ["status", "createdAt"])
    .index("by_user", ["userId", "createdAt"]),

  // Changelog entries - new features and updates shown to users
  changelogs: defineTable({
    version: v.string(),              // App version (e.g., "1.1.0")
    title: v.string(),                // Short title (e.g., "Email Attachments")
    description: v.string(),          // Full description of the change
    type: v.union(
      v.literal("feature"),           // New feature
      v.literal("improvement"),       // Enhancement to existing feature
      v.literal("bugfix"),            // Bug fix
      v.literal("other")              // Other changes
    ),
    createdAt: v.number(),            // When this changelog entry was added
    publishedAt: v.number(),          // When to show this to users (allows scheduling)
  })
    .index("by_published", ["publishedAt"]),
});

// Type helpers for encrypted JSON fields
export type QuickReply = {
  label: string;
  body: string;
};

export type ActionableItem = {
  type: 'link' | 'attachment';
  label: string;
  url?: string;
  attachmentId?: string;
};

export type CalendarEvent = {
  title: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  recurrence?: string;
  recurrenceDescription?: string;
};

export type MeetingRequest = {
  isMeetingRequest: boolean;
  proposedTimes?: Array<{
    startTime: string;
    endTime: string;
  }>;
};

export type ContactFact = {
  id: string;
  text: string;
  source: "manual" | "ai";
  createdAt: number;
  sourceEmailId?: string;
};

export type WritingStyle = {
  tone: string;
  greeting?: string;
  signoff?: string;
  characteristics?: string[];
  samplePhrases?: string[];
  emailsAnalyzed: number;
  analyzedAt: number;
};

export type ConnectedProvider = {
  provider: "gmail" | "outlook" | "imap";
  email: string;
  accessToken?: string;     // Optional for IMAP (uses password instead)
  refreshToken?: string;    // Optional for IMAP
  expiresAt?: number;       // Optional for IMAP (no expiry for basic auth)

  // IMAP-specific fields
  imapHost?: string;        // e.g., "imap.gmail.com"
  imapPort?: number;        // e.g., 993
  imapPassword?: string;    // Encrypted password for IMAP
  imapTls?: boolean;        // Use TLS (default true)
  lastSyncUid?: number;     // Last synced UID for incremental sync
  uidValidity?: number;     // UIDVALIDITY for mailbox state tracking
};
