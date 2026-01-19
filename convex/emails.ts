import { v } from "convex/values";
import { mutation, internalQuery, DatabaseReader } from "./_generated/server";
import { authedQuery, authedMutation } from "./functions";
import { Id } from "./_generated/dataModel";

// Helper to fetch summary for an email
async function getSummaryForEmail(db: DatabaseReader, emailId: Id<"emails">) {
  const summary = await db
    .query("emailSummaries")
    .withIndex("by_email", (q) => q.eq("emailId", emailId))
    .first();
  return summary;
}

// =============================================================================
// INTERNAL FUNCTIONS (used by workflows, sync, etc.)
// =============================================================================

/**
 * Get a single email by ID (internal, for actions)
 */
export const getEmailById = internalQuery({
  args: {
    emailId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const id = args.emailId as Id<"emails">;
      const email = await ctx.db.get(id);
      return email;
    } catch {
      return null;
    }
  },
});

/**
 * Store a new email (called by sync)
 */
export const storeEmail = mutation({
  args: {
    externalId: v.string(),
    provider: v.union(v.literal("gmail"), v.literal("outlook"), v.literal("imap")),
    userId: v.id("users"),
    from: v.id("contacts"),
    to: v.array(v.id("contacts")),
    cc: v.optional(v.array(v.id("contacts"))),
    subject: v.string(),
    bodyPreview: v.string(),
    bodyFull: v.string(),
    receivedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Extract bodyFull to store separately
    const { bodyFull, ...emailFields } = args;

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

    // Insert email without large body fields
    const emailId = await ctx.db.insert("emails", {
      ...emailFields,
      isRead: false,
      isTriaged: false,
    });

    // Store body content in separate table
    await ctx.db.insert("emailBodies", {
      emailId,
      bodyFull,
    });

    // Queue for AI processing
    await ctx.db.insert("aiProcessingQueue", {
      emailId,
      userId: args.userId,
      status: "pending",
      createdAt: Date.now(),
    });

    return { emailId, isNew: true };
  },
});

// =============================================================================
// AUTHENTICATED ENDPOINTS (require valid JWT)
// =============================================================================

/**
 * Get untriaged emails for the current user's inbox
 */
export const getMyUntriagedEmails = authedQuery({
  args: {
    limit: v.optional(v.number()),
    sessionStart: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    // Get untriaged emails for authenticated user
    const rawUntriagedEmails = await ctx.db
      .query("emails")
      .withIndex("by_user_untriaged", (q) =>
        q.eq("userId", ctx.userId).eq("isTriaged", false)
      )
      .order("desc")
      .take(limit * 2);

    // Filter out outgoing emails
    const untriagedEmails = rawUntriagedEmails.filter(
      (e) => e.direction !== "outgoing"
    );

    // If sessionStart provided, also get recently triaged emails
    let recentlyTriagedEmails: typeof untriagedEmails = [];
    if (args.sessionStart) {
      const rawRecentlyTriaged = await ctx.db
        .query("emails")
        .withIndex("by_user_triaged_at", (q) =>
          q.eq("userId", ctx.userId).gt("triagedAt", args.sessionStart)
        )
        .collect();
      recentlyTriagedEmails = rawRecentlyTriaged.filter(
        (e) => e.direction !== "outgoing"
      );
    }

    // Merge and dedupe
    const emailMap = new Map<string, (typeof untriagedEmails)[0]>();
    for (const email of untriagedEmails) {
      emailMap.set(email._id, email);
    }
    for (const email of recentlyTriagedEmails) {
      if (!emailMap.has(email._id)) {
        emailMap.set(email._id, email);
      }
    }

    const emails = Array.from(emailMap.values())
      .sort((a, b) => b.receivedAt - a.receivedAt)
      .slice(0, limit);

    // Fetch contact and summary data
    const emailsWithData = await Promise.all(
      emails.map(async (email) => {
        const fromContact = await ctx.db.get(email.from);
        const summaryData = await getSummaryForEmail(ctx.db, email._id);
        return {
          ...email,
          fromContact,
          summary: summaryData?.summary,
          urgencyScore: summaryData?.urgencyScore,
          urgencyReason: summaryData?.urgencyReason,
          suggestedReply: summaryData?.suggestedReply,
          actionRequired: summaryData?.actionRequired,
          actionDescription: summaryData?.actionDescription,
          quickReplies: summaryData?.quickReplies,
          calendarEvent: summaryData?.calendarEvent,
          shouldAcceptCalendar: summaryData?.shouldAcceptCalendar,
          calendarEventId: summaryData?.calendarEventId,
          calendarEventLink: summaryData?.calendarEventLink,
          aiProcessedAt: summaryData?.createdAt,
        };
      })
    );

    return emailsWithData;
  },
});

/**
 * Get TODO emails (reply_needed) for current user
 */
export const getMyTodoEmails = authedQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user_received", (q) => q.eq("userId", ctx.userId))
      .order("desc")
      .filter((q) => q.eq(q.field("triageAction"), "reply_needed"))
      .take(limit);

    const emailsWithData = await Promise.all(
      emails.map(async (email) => {
        const fromContact = await ctx.db.get(email.from);
        const summaryData = await getSummaryForEmail(ctx.db, email._id);
        return {
          ...email,
          fromContact,
          summary: summaryData?.summary,
          urgencyScore: summaryData?.urgencyScore,
          urgencyReason: summaryData?.urgencyReason,
          suggestedReply: summaryData?.suggestedReply,
          actionRequired: summaryData?.actionRequired,
          actionDescription: summaryData?.actionDescription,
          quickReplies: summaryData?.quickReplies,
          calendarEvent: summaryData?.calendarEvent,
          shouldAcceptCalendar: summaryData?.shouldAcceptCalendar,
          calendarEventId: summaryData?.calendarEventId,
          calendarEventLink: summaryData?.calendarEventLink,
          aiProcessedAt: summaryData?.createdAt,
        };
      })
    );

    return emailsWithData;
  },
});

/**
 * Get a single email by ID (with ownership check)
 */
export const getMyEmail = authedQuery({
  args: {
    emailId: v.id("emails"),
  },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) return null;

    // Verify ownership
    if (email.userId !== ctx.userId) {
      throw new Error("Unauthorized: Email does not belong to you");
    }

    const fromContact = await ctx.db.get(email.from);
    const toContacts = await Promise.all(
      email.to.map((id) => ctx.db.get(id))
    );
    const summaryData = await getSummaryForEmail(ctx.db, email._id);

    return {
      ...email,
      fromContact,
      toContacts: toContacts.filter(Boolean),
      summary: summaryData?.summary,
      urgencyScore: summaryData?.urgencyScore,
      urgencyReason: summaryData?.urgencyReason,
      suggestedReply: summaryData?.suggestedReply,
      calendarEvent: summaryData?.calendarEvent,
      calendarEventId: summaryData?.calendarEventId,
      calendarEventLink: summaryData?.calendarEventLink,
      aiProcessedAt: summaryData?.createdAt,
    };
  },
});

/**
 * Get the full body of an email (for preview)
 */
export const getMyEmailBody = authedQuery({
  args: {
    emailId: v.id("emails"),
  },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) return null;

    // Verify ownership
    if (email.userId !== ctx.userId) {
      throw new Error("Unauthorized: Email does not belong to you");
    }

    // Fetch body from emailBodies table
    const body = await ctx.db
      .query("emailBodies")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    return {
      bodyFull: body?.bodyFull || email.bodyPreview,
      bodyHtml: body?.bodyHtml,
    };
  },
});

/**
 * Triage an email (with ownership check)
 */
export const triageMyEmail = authedMutation({
  args: {
    emailId: v.id("emails"),
    action: v.union(
      v.literal("done"),
      v.literal("reply_needed"),
      v.literal("delegated")
    ),
  },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) {
      throw new Error("Email not found");
    }

    // Verify ownership
    if (email.userId !== ctx.userId) {
      throw new Error("Unauthorized: Email does not belong to you");
    }

    console.log(`[Triage] Action: ${args.action} | Subject: "${email.subject}" | ID: ${args.emailId}`);

    await ctx.db.patch(args.emailId, {
      isTriaged: true,
      triageAction: args.action,
      triagedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Mark email as read (with ownership check)
 */
export const markMyEmailAsRead = authedMutation({
  args: {
    emailId: v.id("emails"),
  },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) {
      throw new Error("Email not found");
    }

    // Verify ownership
    if (email.userId !== ctx.userId) {
      throw new Error("Unauthorized: Email does not belong to you");
    }

    await ctx.db.patch(args.emailId, {
      isRead: true,
    });

    return { success: true };
  },
});

/**
 * Search emails for current user
 */
export const searchMyEmails = authedQuery({
  args: {
    searchQuery: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.searchQuery.trim()) {
      return [];
    }

    const limit = args.limit ?? 20;

    const emails = await ctx.db
      .query("emails")
      .withSearchIndex("search_content", (q) =>
        q.search("subject", args.searchQuery).eq("userId", ctx.userId)
      )
      .take(limit);

    const emailsWithData = await Promise.all(
      emails.map(async (email) => {
        const fromContact = await ctx.db.get(email.from);
        const summaryData = await getSummaryForEmail(ctx.db, email._id);
        return {
          ...email,
          fromContact,
          summary: summaryData?.summary,
          urgencyScore: summaryData?.urgencyScore,
          urgencyReason: summaryData?.urgencyReason,
          suggestedReply: summaryData?.suggestedReply,
          actionRequired: summaryData?.actionRequired,
          actionDescription: summaryData?.actionDescription,
          quickReplies: summaryData?.quickReplies,
          calendarEvent: summaryData?.calendarEvent,
          shouldAcceptCalendar: summaryData?.shouldAcceptCalendar,
          calendarEventId: summaryData?.calendarEventId,
          calendarEventLink: summaryData?.calendarEventLink,
          aiProcessedAt: summaryData?.createdAt,
        };
      })
    );

    return emailsWithData;
  },
});

/**
 * Get all emails in a thread (with ownership check)
 */
export const getMyThreadEmails = authedQuery({
  args: {
    emailId: v.id("emails"),
  },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) return [];

    // Verify ownership
    if (email.userId !== ctx.userId) {
      throw new Error("Unauthorized: Email does not belong to you");
    }

    // If no threadId, just return this email
    if (!email.threadId) {
      const fromContact = await ctx.db.get(email.from);
      const summaryData = await getSummaryForEmail(ctx.db, email._id);
      return [{
        ...email,
        fromContact,
        summary: summaryData?.summary,
        urgencyScore: summaryData?.urgencyScore,
        urgencyReason: summaryData?.urgencyReason,
        suggestedReply: summaryData?.suggestedReply,
        calendarEvent: summaryData?.calendarEvent,
        calendarEventId: summaryData?.calendarEventId,
        calendarEventLink: summaryData?.calendarEventLink,
        aiProcessedAt: summaryData?.createdAt,
      }];
    }

    // Get all emails in this thread (already scoped to user via index)
    const threadEmails = await ctx.db
      .query("emails")
      .withIndex("by_thread", (q) => q.eq("userId", ctx.userId).eq("threadId", email.threadId))
      .order("asc")
      .collect();

    const emailsWithData = await Promise.all(
      threadEmails.map(async (e) => {
        const fromContact = await ctx.db.get(e.from);
        const summaryData = await getSummaryForEmail(ctx.db, e._id);
        return {
          ...e,
          fromContact,
          summary: summaryData?.summary,
          urgencyScore: summaryData?.urgencyScore,
          urgencyReason: summaryData?.urgencyReason,
          suggestedReply: summaryData?.suggestedReply,
          calendarEvent: summaryData?.calendarEvent,
          shouldAcceptCalendar: summaryData?.shouldAcceptCalendar,
          calendarEventId: summaryData?.calendarEventId,
          calendarEventLink: summaryData?.calendarEventLink,
          aiProcessedAt: summaryData?.createdAt,
        };
      })
    );

    return emailsWithData;
  },
});

// =============================================================================
// BATCH TRIAGE ENDPOINTS
// =============================================================================

/**
 * Email preview for batch triage view
 */
interface BatchEmailPreview {
  _id: Id<"emails">;
  subject: string;
  bodyPreview: string;
  receivedAt: number;
  summary?: string;
  urgencyScore?: number;
  actionRequired?: "reply" | "action" | "fyi" | "none";
  quickReplies?: Array<{ label: string; body: string }>;
  calendarEvent?: {
    title: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    description?: string;
    recurrence?: string;
    recurrenceDescription?: string;
  };
  shouldAcceptCalendar?: boolean;
  isSubscription?: boolean;
  fromName?: string; // Sender name as it appeared in this email
  fromContact?: {
    _id: Id<"contacts">;
    email: string;
    name?: string;
    avatarUrl?: string;
  } | null;
  aiProcessedAt?: number;
}

/**
 * Get untriaged emails grouped by AI recommendation for batch triage
 */
export const getMyBatchTriagePreview = authedQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    done: BatchEmailPreview[];
    humanWaiting: BatchEmailPreview[];
    actionNeeded: BatchEmailPreview[];
    calendar: BatchEmailPreview[];
    lowConfidence: BatchEmailPreview[];
    pending: BatchEmailPreview[];
    total: number;
  }> => {
    const limit = args.limit ?? 100;

    // Get untriaged emails for authenticated user
    const rawUntriagedEmails = await ctx.db
      .query("emails")
      .withIndex("by_user_untriaged", (q) =>
        q.eq("userId", ctx.userId).eq("isTriaged", false)
      )
      .order("desc")
      .take(limit);

    // Filter out outgoing emails
    const untriagedEmails = rawUntriagedEmails.filter(
      (e) => e.direction !== "outgoing"
    );

    // Fetch contact and summary data for all emails
    const emailsWithData = await Promise.all(
      untriagedEmails.map(async (email) => {
        const fromContact = await ctx.db.get(email.from);
        const summaryData = await getSummaryForEmail(ctx.db, email._id);
        return {
          _id: email._id,
          subject: email.subject,
          bodyPreview: email.bodyPreview,
          receivedAt: email.receivedAt,
          summary: summaryData?.summary,
          urgencyScore: summaryData?.urgencyScore,
          actionRequired: summaryData?.actionRequired,
          quickReplies: summaryData?.quickReplies,
          calendarEvent: summaryData?.calendarEvent,
          shouldAcceptCalendar: summaryData?.shouldAcceptCalendar,
          isSubscription: email.isSubscription,
          fromName: email.fromName,
          fromContact: fromContact ? {
            _id: fromContact._id,
            email: fromContact.email,
            name: fromContact.name,
            avatarUrl: fromContact.avatarUrl,
          } : null,
          aiProcessedAt: summaryData?.createdAt,
        } as BatchEmailPreview;
      })
    );

    // Group emails by AI recommendation
    const done: BatchEmailPreview[] = [];
    const humanWaiting: BatchEmailPreview[] = [];
    const actionNeeded: BatchEmailPreview[] = [];
    const calendar: BatchEmailPreview[] = [];
    const lowConfidence: BatchEmailPreview[] = [];
    const pending: BatchEmailPreview[] = [];

    for (const email of emailsWithData) {
      // No AI summary yet - put in pending
      if (!email.aiProcessedAt) {
        pending.push(email);
        continue;
      }

      // Low confidence (urgency score 40-60) - needs manual review
      if (email.urgencyScore !== undefined &&
          email.urgencyScore >= 40 &&
          email.urgencyScore <= 60) {
        lowConfidence.push(email);
        continue;
      }

      // Calendar events AI recommends accepting
      if (email.shouldAcceptCalendar && email.calendarEvent) {
        calendar.push(email);
        continue;
      }

      // Reply required - a human is waiting for response
      if (email.actionRequired === "reply") {
        humanWaiting.push(email);
        continue;
      }

      // Action required (but not a direct reply)
      if (email.actionRequired === "action") {
        actionNeeded.push(email);
        continue;
      }

      // FYI or no action - mark as done
      done.push(email);
    }

    return {
      done,
      humanWaiting,
      actionNeeded,
      calendar,
      lowConfidence,
      pending,
      total: emailsWithData.length,
    };
  },
});

/**
 * Batch triage multiple emails at once
 */
export const batchTriageMyEmails = authedMutation({
  args: {
    triageActions: v.array(v.object({
      emailId: v.id("emails"),
      action: v.union(
        v.literal("done"),
        v.literal("reply_needed")
      ),
    })),
  },
  handler: async (ctx, args): Promise<{ triaged: number; errors: string[] }> => {
    const errors: string[] = [];
    let triaged = 0;

    for (const { emailId, action } of args.triageActions) {
      try {
        const email = await ctx.db.get(emailId);
        if (!email) {
          errors.push(`Email ${emailId} not found`);
          continue;
        }

        // Verify ownership
        if (email.userId !== ctx.userId) {
          errors.push(`Email ${emailId} does not belong to you`);
          continue;
        }

        // Skip if already triaged
        if (email.isTriaged) {
          continue;
        }

        await ctx.db.patch(emailId, {
          isTriaged: true,
          triageAction: action,
          triagedAt: Date.now(),
        });
        triaged++;
      } catch (err) {
        errors.push(`Failed to triage ${emailId}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    console.log(`[BatchTriage] Triaged ${triaged} emails for user ${ctx.userId}`);
    return { triaged, errors };
  },
});

/**
 * Reset a batch of triaged emails back to untriaged (for current user only)
 * Returns remaining count so client can call again if needed
 */
export const resetMyTriagedEmails = authedMutation({
  args: {},
  handler: async (ctx) => {
    const BATCH_SIZE = 50;

    // Get a single batch of triaged emails using the proper index
    const triagedEmails = await ctx.db
      .query("emails")
      .withIndex("by_user_untriaged", (q) =>
        q.eq("userId", ctx.userId).eq("isTriaged", true)
      )
      .take(BATCH_SIZE);

    // Reset this batch
    for (const email of triagedEmails) {
      await ctx.db.patch(email._id, {
        isTriaged: false,
        triageAction: undefined,
        triagedAt: undefined,
      });
    }

    // Check if there are more
    const remaining = await ctx.db
      .query("emails")
      .withIndex("by_user_untriaged", (q) =>
        q.eq("userId", ctx.userId).eq("isTriaged", true)
      )
      .first();

    const hasMore = remaining !== null;

    console.log(`[Untriage] Reset ${triagedEmails.length} emails for user ${ctx.userId}, hasMore: ${hasMore}`);
    return { success: true, count: triagedEmails.length, hasMore };
  },
});
