import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  emails: defineTable({
    // External provider data
    externalId: v.string(),
    threadId: v.optional(v.string()), // Gmail thread ID for grouping conversations
    provider: v.union(v.literal("gmail"), v.literal("outlook"), v.literal("imap")),
    userId: v.id("users"),

    // Email metadata
    from: v.id("contacts"),
    fromName: v.optional(v.string()), // Sender name as it appeared in this email's From header
    to: v.array(v.id("contacts")),
    cc: v.optional(v.array(v.id("contacts"))),
    subject: v.string(),
    bodyPreview: v.string(),
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
    .index("by_user_reply_needed", ["userId", "triageAction", "triagedAt"])
    .searchIndex("search_content", {
      searchField: "subject",
      filterFields: ["userId"],
    }),

  // Email bodies stored separately to keep emails table lightweight
  // This allows querying many emails without hitting memory limits
  emailBodies: defineTable({
    emailId: v.id("emails"),
    bodyFull: v.string(),
    bodyHtml: v.optional(v.string()),
    rawPayload: v.optional(v.string()),
  })
    .index("by_email", ["emailId"]),

  // AI-generated email summaries (separate table for cleaner data model)
  emailSummaries: defineTable({
    emailId: v.id("emails"),
    summary: v.string(),
    urgencyScore: v.number(),
    urgencyReason: v.string(),
    suggestedReply: v.optional(v.string()),

    // Action required type
    actionRequired: v.optional(v.union(
      v.literal("reply"),      // User should reply
      v.literal("action"),     // User should do something (not reply)
      v.literal("fyi"),        // Just informational
      v.literal("none")        // No action needed
    )),
    actionDescription: v.optional(v.string()), // e.g., "Schedule meeting", "Review document"

    // Quick reply options (up to 3)
    quickReplies: v.optional(v.array(v.object({
      label: v.string(),       // Button text: "Sounds good!", "Let me check"
      body: v.string(),        // Full reply text to send
    }))),

    // Calendar event suggestion
    calendarEvent: v.optional(v.object({
      title: v.string(),
      startTime: v.optional(v.string()),  // ISO string or relative like "next Tuesday 2pm"
      endTime: v.optional(v.string()),
      location: v.optional(v.string()),
      description: v.optional(v.string()),
      // Recurrence rule for repeating events (RRULE format for Google Calendar API)
      recurrence: v.optional(v.string()),
      // Human-readable description of recurrence (e.g., "Every other Tuesday")
      recurrenceDescription: v.optional(v.string()),
    })),

    // AI prediction: should user accept this calendar invite?
    // true = likely want to attend, false = likely decline/ignore
    shouldAcceptCalendar: v.optional(v.boolean()),

    // Set when user adds the event to their calendar
    calendarEventId: v.optional(v.string()),
    calendarEventLink: v.optional(v.string()),

    // Deadline extracted from email (ISO string)
    deadline: v.optional(v.string()),
    deadlineDescription: v.optional(v.string()),  // e.g., "respond by", "submit by"
    deadlineReminderSent: v.optional(v.boolean()),

    createdAt: v.number(),

    // Vector embedding for semantic search (1536-dim for text-embedding-3-small)
    embedding: v.optional(v.array(v.float64())),
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
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")), // Cached avatar in Convex storage
    emailCount: v.number(),
    lastEmailAt: v.number(),
    relationship: v.optional(v.union(
      v.literal("vip"),
      v.literal("regular"),
      v.literal("unknown")
    )),
    // AI-generated relationship summary
    relationshipSummary: v.optional(v.string()),
    // Dossier facts about this contact
    facts: v.optional(v.array(v.object({
      id: v.string(),           // UUID for editing/deleting
      text: v.string(),         // "Seth is Leaf's father"
      source: v.union(v.literal("manual"), v.literal("ai")),
      createdAt: v.number(),
      sourceEmailId: v.optional(v.id("emails")),
    }))),
    // Writing style analysis (how the user writes to this contact)
    writingStyle: v.optional(v.object({
      tone: v.string(),                          // "casual", "formal", "friendly professional"
      greeting: v.optional(v.string()),          // "Hey!", "Hi John,", "Dear Mr. Smith,"
      signoff: v.optional(v.string()),           // "Cheers", "Best,", "Thanks!"
      characteristics: v.optional(v.array(v.string())), // ["uses emojis", "short sentences"]
      samplePhrases: v.optional(v.array(v.string())),   // Actual phrases from emails
      emailsAnalyzed: v.number(),
      analyzedAt: v.number(),
    })),
  })
    .index("by_user", ["userId"])
    .index("by_email", ["email"])
    .index("by_user_email", ["userId", "email"])
    .index("by_user_last_email", ["userId", "lastEmailAt"]),

  users: defineTable({
    // WorkOS user ID (optional for Gmail-only auth)
    workosId: v.optional(v.string()),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),

    // WorkOS session tokens (used to refresh Google OAuth tokens)
    workosRefreshToken: v.optional(v.string()),

    // Direct Gmail OAuth tokens (obtained from WorkOS oauth_tokens)
    gmailAccessToken: v.optional(v.string()),
    gmailRefreshToken: v.optional(v.string()), // Legacy - now using WorkOS refresh
    gmailTokenExpiresAt: v.optional(v.number()),

    // Connected email providers (legacy/multi-provider)
    connectedProviders: v.optional(v.array(v.object({
      provider: v.union(v.literal("gmail"), v.literal("outlook"), v.literal("imap")),
      email: v.string(),
      accessToken: v.string(),
      refreshToken: v.string(),
      expiresAt: v.number(),
    }))),

    // User preferences
    preferences: v.optional(v.object({
      autoProcessEmails: v.optional(v.boolean()),
      urgencyThreshold: v.optional(v.number()),
    })),

    // Last sync timestamp for detecting new emails (used by cron job)
    lastEmailSyncAt: v.optional(v.number()),

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
    senderEmail: v.string(),
    senderDomain: v.string(),
    senderName: v.optional(v.string()),
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
    mostRecentSubject: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_sender", ["userId", "senderEmail"])
    .index("by_user_last_email", ["userId", "lastEmailAt"]),

  // Feature requests from voice recording (processed by local Claude Code)
  featureRequests: defineTable({
    userId: v.id("users"),
    transcript: v.string(),           // Voice transcript
    status: v.union(
      v.literal("pending"),           // Waiting for local processor
      v.literal("processing"),        // Claude Code is working on it
      v.literal("completed"),         // Done, EAS update pushed
      v.literal("failed")             // Something went wrong
    ),
    // Progress tracking
    progressStep: v.optional(v.union(
      v.literal("cloning"),           // Cloning repo
      v.literal("implementing"),      // Claude Code working
      v.literal("pushing"),           // Pushing feature branch
      v.literal("merging"),           // Merging to voice-preview
      v.literal("deploying_backend"), // Running convex dev --once
      v.literal("uploading"),         // Running EAS update
      v.literal("ready")              // Ready for testing
    )),
    progressMessage: v.optional(v.string()),  // Human-readable status
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    // Output from Claude Code
    claudeOutput: v.optional(v.string()),      // Claude's final output/summary
    claudeSuccess: v.optional(v.boolean()),    // Did Claude think it succeeded?
    commitHash: v.optional(v.string()),
    branchName: v.optional(v.string()),
    easUpdateId: v.optional(v.string()),
    easUpdateMessage: v.optional(v.string()),
    easDashboardUrl: v.optional(v.string()),
    // Debug logs from the app when the request was submitted
    debugLogs: v.optional(v.string()),
  })
    .index("by_status", ["status", "createdAt"])
    .index("by_user", ["userId", "createdAt"]),
});
