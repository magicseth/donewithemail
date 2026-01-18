import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  emails: defineTable({
    // External provider data
    externalId: v.string(),
    provider: v.union(v.literal("gmail"), v.literal("outlook"), v.literal("imap")),
    userId: v.id("users"),

    // Email metadata
    from: v.id("contacts"),
    to: v.array(v.id("contacts")),
    cc: v.optional(v.array(v.id("contacts"))),
    subject: v.string(),
    bodyPreview: v.string(),
    bodyFull: v.string(),
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

    // AI-generated fields
    summary: v.optional(v.string()),
    urgencyScore: v.optional(v.number()),
    urgencyReason: v.optional(v.string()),
    suggestedReply: v.optional(v.string()),
    aiProcessedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_untriaged", ["userId", "isTriaged"])
    .index("by_user_received", ["userId", "receivedAt"])
    .index("by_external_id", ["externalId", "provider"])
    .index("by_from", ["from"]),

  contacts: defineTable({
    userId: v.id("users"),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    emailCount: v.number(),
    lastEmailAt: v.number(),
    relationship: v.optional(v.union(
      v.literal("vip"),
      v.literal("regular"),
      v.literal("unknown")
    )),
    // AI-generated relationship summary
    relationshipSummary: v.optional(v.string()),
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

    // Direct Gmail OAuth tokens
    gmailAccessToken: v.optional(v.string()),
    gmailRefreshToken: v.optional(v.string()),
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
});
