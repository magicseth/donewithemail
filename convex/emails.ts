import { v } from "convex/values";
import { mutation, internalQuery, DatabaseReader, QueryCtx } from "./_generated/server";
import { authedQuery, authedMutation } from "./functions";
import { Id, Doc } from "./_generated/dataModel";
import { encryptedPii, EncryptedField } from "./pii";
import { QuickReply, CalendarEvent } from "./schema";

// Helper to fetch summary for an email
async function getSummaryForEmail(db: DatabaseReader, emailId: Id<"emails">) {
  const summary = await db
    .query("emailSummaries")
    .withIndex("by_email", (q) => q.eq("emailId", emailId))
    .first();
  return summary;
}

// Helper to decrypt email fields in query context
async function decryptEmailForQuery(
  ctx: QueryCtx,
  userId: Id<"users">,
  email: Doc<"emails">
): Promise<{
  subject: string | null;
  bodyPreview: string | null;
  fromName: string | null;
}> {
  const pii = await encryptedPii.forUserQuery(ctx, userId);
  if (!pii) {
    return { subject: null, bodyPreview: null, fromName: null };
  }
  const decrypted = await pii.decryptMany({
    subject: email.subject,
    bodyPreview: email.bodyPreview,
    fromName: email.fromName ?? undefined,
  });
  return {
    subject: decrypted.subject,
    bodyPreview: decrypted.bodyPreview,
    fromName: decrypted.fromName,
  };
}

// Helper to decrypt contact name in query context
async function decryptContactNameForQuery(
  ctx: QueryCtx,
  userId: Id<"users">,
  name: EncryptedField | undefined
): Promise<string | undefined> {
  if (!name) return undefined;
  const pii = await encryptedPii.forUserQuery(ctx, userId);
  if (!pii) return undefined;
  const decrypted = await pii.decrypt(name);
  return decrypted ?? undefined;
}

// Helper to decrypt summary fields in query context
async function decryptSummaryForQuery(
  ctx: QueryCtx,
  userId: Id<"users">,
  summary: Doc<"emailSummaries"> | null
): Promise<{
  summary: string | null;
  urgencyReason: string | null;
  suggestedReply: string | null;
  actionDescription: string | null;
  quickReplies: QuickReply[] | null;
  calendarEvent: CalendarEvent | null;
  deadlineDescription: string | null;
} | null> {
  if (!summary) return null;
  const pii = await encryptedPii.forUserQuery(ctx, userId);
  if (!pii) return null;

  const decrypted = await pii.decryptMany({
    summary: summary.summary,
    urgencyReason: summary.urgencyReason,
    suggestedReply: summary.suggestedReply ?? undefined,
    actionDescription: summary.actionDescription ?? undefined,
    deadlineDescription: summary.deadlineDescription ?? undefined,
  });

  // Decrypt JSON fields
  let quickReplies: QuickReply[] | null = null;
  if (summary.quickReplies) {
    const qrJson = await pii.decrypt(summary.quickReplies);
    if (qrJson) quickReplies = JSON.parse(qrJson);
  }

  let calendarEvent: CalendarEvent | null = null;
  if (summary.calendarEvent) {
    const ceJson = await pii.decrypt(summary.calendarEvent);
    if (ceJson) calendarEvent = JSON.parse(ceJson);
  }

  return {
    summary: decrypted.summary,
    urgencyReason: decrypted.urgencyReason,
    suggestedReply: decrypted.suggestedReply,
    actionDescription: decrypted.actionDescription,
    quickReplies,
    calendarEvent,
    deadlineDescription: decrypted.deadlineDescription,
  };
}

// =============================================================================
// INTERNAL FUNCTIONS (used by workflows, sync, etc.)
// =============================================================================

/**
 * Get a single email by ID (internal, for actions) with decryption
 */
export const getEmailById = internalQuery({
  args: {
    emailId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const id = args.emailId as Id<"emails">;
      const email = await ctx.db.get(id);
      if (!email) return null;

      // Get PII helper for decryption
      const pii = await encryptedPii.forUserQuery(ctx, email.userId);

      // Decrypt PII fields
      let subject: string | null = null;
      let bodyPreview: string | null = null;
      let fromName: string | null = null;

      if (pii) {
        subject = await pii.decrypt(email.subject);
        bodyPreview = await pii.decrypt(email.bodyPreview);
        if (email.fromName) {
          fromName = await pii.decrypt(email.fromName);
        }
      }

      return {
        _id: email._id,
        _creationTime: email._creationTime,
        externalId: email.externalId,
        provider: email.provider,
        userId: email.userId,
        from: email.from,
        to: email.to,
        cc: email.cc,
        receivedAt: email.receivedAt,
        isRead: email.isRead,
        isTriaged: email.isTriaged,
        triageAction: email.triageAction,
        triagedAt: email.triagedAt,
        threadId: email.threadId,
        direction: email.direction,
        listUnsubscribe: email.listUnsubscribe,
        listUnsubscribePost: email.listUnsubscribePost,
        isSubscription: email.isSubscription,
        // Decrypted fields
        subject,
        bodyPreview,
        fromName,
      };
    } catch {
      return null;
    }
  },
});

// Get email body from the separate emailBodies table (with decryption)
export const getEmailBodyById = internalQuery({
  args: {
    emailId: v.id("emails"),
  },
  handler: async (ctx, args) => {
    const body = await ctx.db
      .query("emailBodies")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    if (!body) return null;

    // Get the email to get userId for decryption
    const email = await ctx.db.get(args.emailId);
    if (!email) return null;

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, email.userId);

    let bodyFull: string | null = null;
    let bodyHtml: string | null = null;
    let rawPayload: string | null = null;

    if (pii) {
      bodyFull = await pii.decrypt(body.bodyFull);
      if (body.bodyHtml) {
        bodyHtml = await pii.decrypt(body.bodyHtml);
      }
      if (body.rawPayload) {
        rawPayload = await pii.decrypt(body.rawPayload);
      }
    }

    return {
      _id: body._id,
      emailId: body.emailId,
      bodyFull,
      bodyHtml,
      rawPayload,
    };
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
    const { bodyFull, subject, bodyPreview, ...otherFields } = args;

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

    // Get PII helper for encrypting email content
    const pii = await encryptedPii.forUser(ctx, args.userId);

    // Encrypt PII fields
    const encryptedSubject = await pii.encrypt(subject);
    const encryptedBodyPreview = await pii.encrypt(bodyPreview);
    const encryptedBodyFull = await pii.encrypt(bodyFull);

    // Insert email with encrypted fields
    const emailId = await ctx.db.insert("emails", {
      ...otherFields,
      subject: encryptedSubject,
      bodyPreview: encryptedBodyPreview,
      isRead: false,
      isTriaged: false,
    });

    // Store body content in separate table (encrypted)
    await ctx.db.insert("emailBodies", {
      emailId,
      bodyFull: encryptedBodyFull,
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
    const limit = args.limit ?? 200;

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

    // Batch fetch contacts - deduplicate IDs first
    const contactIds = [...new Set(emails.map((e) => e.from))];
    const contactsArray = await Promise.all(
      contactIds.map((id) => ctx.db.get(id))
    );
    const contactsMap = new Map(
      contactIds.map((id, i) => [id, contactsArray[i]])
    );

    // Batch fetch summaries in parallel
    const emailIds = emails.map((e) => e._id);
    const summariesArray = await Promise.all(
      emailIds.map((id) =>
        ctx.db
          .query("emailSummaries")
          .withIndex("by_email", (q) => q.eq("emailId", id))
          .first()
      )
    );
    const summariesMap = new Map(
      emailIds.map((id, i) => [id, summariesArray[i]])
    );

    // Get PII helper for decryption (returns null if user has no key yet)
    const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);

    // Map emails with pre-fetched data and decrypt PII fields
    const emailsWithData = await Promise.all(
      emails.map(async (email) => {
        const fromContact = contactsMap.get(email.from);
        const summaryData = summariesMap.get(email._id);

        // Decrypt email fields
        let decryptedEmail = { subject: null as string | null, bodyPreview: null as string | null, fromName: null as string | null };
        if (pii) {
          const decrypted = await pii.decryptMany({
            subject: email.subject,
            bodyPreview: email.bodyPreview,
            fromName: email.fromName ?? undefined,
          });
          decryptedEmail = {
            subject: decrypted.subject,
            bodyPreview: decrypted.bodyPreview,
            fromName: decrypted.fromName,
          };
        }

        // Decrypt contact name
        let decryptedContactName: string | undefined;
        if (pii && fromContact?.name) {
          decryptedContactName = await pii.decrypt(fromContact.name) ?? undefined;
        }

        // Decrypt summary fields
        let decryptedSummary: {
          summary: string | null;
          urgencyReason: string | null;
          suggestedReply: string | null;
          actionDescription: string | null;
          quickReplies: QuickReply[] | null;
          calendarEvent: CalendarEvent | null;
        } | null = null;

        if (pii && summaryData) {
          const decrypted = await pii.decryptMany({
            summary: summaryData.summary,
            urgencyReason: summaryData.urgencyReason,
            suggestedReply: summaryData.suggestedReply ?? undefined,
            actionDescription: summaryData.actionDescription ?? undefined,
          });

          let quickReplies: QuickReply[] | null = null;
          if (summaryData.quickReplies) {
            const qrJson = await pii.decrypt(summaryData.quickReplies);
            if (qrJson) quickReplies = JSON.parse(qrJson);
          }

          let calendarEvent: CalendarEvent | null = null;
          if (summaryData.calendarEvent) {
            const ceJson = await pii.decrypt(summaryData.calendarEvent);
            if (ceJson) calendarEvent = JSON.parse(ceJson);
          }

          decryptedSummary = {
            summary: decrypted.summary,
            urgencyReason: decrypted.urgencyReason,
            suggestedReply: decrypted.suggestedReply,
            actionDescription: decrypted.actionDescription,
            quickReplies,
            calendarEvent,
          };
        }

        return {
          _id: email._id,
          externalId: email.externalId,
          threadId: email.threadId,
          provider: email.provider,
          userId: email.userId,
          from: email.from,
          to: email.to,
          cc: email.cc,
          receivedAt: email.receivedAt,
          isRead: email.isRead,
          isTriaged: email.isTriaged,
          triageAction: email.triageAction,
          triagedAt: email.triagedAt,
          direction: email.direction,
          listUnsubscribe: email.listUnsubscribe,
          isSubscription: email.isSubscription,
          // Decrypted fields
          subject: decryptedEmail.subject ?? "",
          bodyPreview: decryptedEmail.bodyPreview ?? "",
          fromName: decryptedEmail.fromName ?? undefined,
          fromContact: fromContact ? {
            _id: fromContact._id,
            email: fromContact.email,
            name: decryptedContactName,
            avatarUrl: fromContact.avatarUrl,
          } : undefined,
          summary: decryptedSummary?.summary ?? undefined,
          urgencyScore: summaryData?.urgencyScore,
          urgencyReason: decryptedSummary?.urgencyReason ?? undefined,
          suggestedReply: decryptedSummary?.suggestedReply ?? undefined,
          actionRequired: summaryData?.actionRequired,
          actionDescription: decryptedSummary?.actionDescription ?? undefined,
          quickReplies: decryptedSummary?.quickReplies ?? undefined,
          calendarEvent: decryptedSummary?.calendarEvent ?? undefined,
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
    const limit = args.limit ?? 200;

    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user_received", (q) => q.eq("userId", ctx.userId))
      .order("desc")
      .filter((q) => q.eq(q.field("triageAction"), "reply_needed"))
      .take(limit);

    // Batch fetch contacts
    const contactIds = [...new Set(emails.map((e) => e.from))];
    const contactsArray = await Promise.all(
      contactIds.map((id) => ctx.db.get(id))
    );
    const contactsMap = new Map(
      contactIds.map((id, i) => [id, contactsArray[i]])
    );

    // Batch fetch summaries
    const emailIds = emails.map((e) => e._id);
    const summariesArray = await Promise.all(
      emailIds.map((id) =>
        ctx.db
          .query("emailSummaries")
          .withIndex("by_email", (q) => q.eq("emailId", id))
          .first()
      )
    );
    const summariesMap = new Map(
      emailIds.map((id, i) => [id, summariesArray[i]])
    );

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);

    const emailsWithData = await Promise.all(
      emails.map(async (email) => {
        const fromContact = contactsMap.get(email.from);
        const summaryData = summariesMap.get(email._id);

        // Decrypt email fields
        let decryptedEmail = { subject: null as string | null, bodyPreview: null as string | null, fromName: null as string | null };
        if (pii) {
          const decrypted = await pii.decryptMany({
            subject: email.subject,
            bodyPreview: email.bodyPreview,
            fromName: email.fromName ?? undefined,
          });
          decryptedEmail = {
            subject: decrypted.subject,
            bodyPreview: decrypted.bodyPreview,
            fromName: decrypted.fromName,
          };
        }

        // Decrypt contact name
        let decryptedContactName: string | undefined;
        if (pii && fromContact?.name) {
          decryptedContactName = await pii.decrypt(fromContact.name) ?? undefined;
        }

        // Decrypt summary fields
        let decryptedSummary: {
          summary: string | null;
          urgencyReason: string | null;
          suggestedReply: string | null;
          actionDescription: string | null;
          quickReplies: QuickReply[] | null;
          calendarEvent: CalendarEvent | null;
        } | null = null;

        if (pii && summaryData) {
          const decrypted = await pii.decryptMany({
            summary: summaryData.summary,
            urgencyReason: summaryData.urgencyReason,
            suggestedReply: summaryData.suggestedReply ?? undefined,
            actionDescription: summaryData.actionDescription ?? undefined,
          });

          let quickReplies: QuickReply[] | null = null;
          if (summaryData.quickReplies) {
            const qrJson = await pii.decrypt(summaryData.quickReplies);
            if (qrJson) quickReplies = JSON.parse(qrJson);
          }

          let calendarEvent: CalendarEvent | null = null;
          if (summaryData.calendarEvent) {
            const ceJson = await pii.decrypt(summaryData.calendarEvent);
            if (ceJson) calendarEvent = JSON.parse(ceJson);
          }

          decryptedSummary = {
            summary: decrypted.summary,
            urgencyReason: decrypted.urgencyReason,
            suggestedReply: decrypted.suggestedReply,
            actionDescription: decrypted.actionDescription,
            quickReplies,
            calendarEvent,
          };
        }

        return {
          _id: email._id,
          externalId: email.externalId,
          threadId: email.threadId,
          provider: email.provider,
          userId: email.userId,
          from: email.from,
          to: email.to,
          cc: email.cc,
          receivedAt: email.receivedAt,
          isRead: email.isRead,
          isTriaged: email.isTriaged,
          triageAction: email.triageAction,
          triagedAt: email.triagedAt,
          direction: email.direction,
          listUnsubscribe: email.listUnsubscribe,
          isSubscription: email.isSubscription,
          // Decrypted fields
          subject: decryptedEmail.subject ?? "",
          bodyPreview: decryptedEmail.bodyPreview ?? "",
          fromName: decryptedEmail.fromName ?? undefined,
          fromContact: fromContact ? {
            _id: fromContact._id,
            email: fromContact.email,
            name: decryptedContactName,
            avatarUrl: fromContact.avatarUrl,
          } : undefined,
          summary: decryptedSummary?.summary ?? undefined,
          urgencyScore: summaryData?.urgencyScore,
          urgencyReason: decryptedSummary?.urgencyReason ?? undefined,
          suggestedReply: decryptedSummary?.suggestedReply ?? undefined,
          actionRequired: summaryData?.actionRequired,
          actionDescription: decryptedSummary?.actionDescription ?? undefined,
          quickReplies: decryptedSummary?.quickReplies ?? undefined,
          calendarEvent: decryptedSummary?.calendarEvent ?? undefined,
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

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);

    // Decrypt email fields
    let subject = "";
    let bodyPreview = "";
    let fromName: string | undefined;
    if (pii) {
      const decrypted = await pii.decryptMany({
        subject: email.subject,
        bodyPreview: email.bodyPreview,
        fromName: email.fromName ?? undefined,
      });
      subject = decrypted.subject ?? "";
      bodyPreview = decrypted.bodyPreview ?? "";
      fromName = decrypted.fromName ?? undefined;
    }

    // Decrypt contact names
    let decryptedFromContact: { _id: string; email: string; name?: string; avatarUrl?: string; relationship?: string } | undefined;
    if (fromContact && pii) {
      const decryptedName = fromContact.name ? await pii.decrypt(fromContact.name) : null;
      decryptedFromContact = {
        _id: fromContact._id,
        email: fromContact.email,
        name: decryptedName ?? undefined,
        avatarUrl: fromContact.avatarUrl,
        relationship: fromContact.relationship,
      };
    } else if (fromContact) {
      decryptedFromContact = {
        _id: fromContact._id,
        email: fromContact.email,
        avatarUrl: fromContact.avatarUrl,
        relationship: fromContact.relationship,
      };
    }

    const decryptedToContacts = await Promise.all(
      toContacts.filter(Boolean).map(async (c) => {
        if (!c) return null;
        let name: string | undefined;
        if (pii && c.name) {
          name = await pii.decrypt(c.name) ?? undefined;
        }
        return {
          _id: c._id,
          email: c.email,
          name,
          avatarUrl: c.avatarUrl,
        };
      })
    );

    // Decrypt summary fields
    let summary: string | undefined;
    let urgencyReason: string | undefined;
    let suggestedReply: string | undefined;
    let calendarEvent: CalendarEvent | undefined;
    let meetingRequest: { isMeetingRequest: boolean; proposedTimes?: Array<{ startTime: string; endTime: string }> } | undefined;
    if (pii && summaryData) {
      const decrypted = await pii.decryptMany({
        summary: summaryData.summary,
        urgencyReason: summaryData.urgencyReason,
        suggestedReply: summaryData.suggestedReply ?? undefined,
      });
      summary = decrypted.summary ?? undefined;
      urgencyReason = decrypted.urgencyReason ?? undefined;
      suggestedReply = decrypted.suggestedReply ?? undefined;

      if (summaryData.calendarEvent) {
        const ceJson = await pii.decrypt(summaryData.calendarEvent);
        if (ceJson) calendarEvent = JSON.parse(ceJson);
      }

      if ((summaryData as any).meetingRequest) {
        const mrJson = await pii.decrypt((summaryData as any).meetingRequest);
        if (mrJson) meetingRequest = JSON.parse(mrJson);
      }
    }

    return {
      _id: email._id,
      externalId: email.externalId,
      threadId: email.threadId,
      provider: email.provider,
      userId: email.userId,
      from: email.from,
      to: email.to,
      cc: email.cc,
      receivedAt: email.receivedAt,
      isRead: email.isRead,
      isTriaged: email.isTriaged,
      triageAction: email.triageAction,
      triagedAt: email.triagedAt,
      direction: email.direction,
      subject,
      bodyPreview,
      fromName,
      fromContact: decryptedFromContact,
      toContacts: decryptedToContacts.filter(Boolean),
      summary,
      urgencyScore: summaryData?.urgencyScore,
      urgencyReason,
      suggestedReply,
      calendarEvent,
      meetingRequest,
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

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);

    let bodyFull: string | null = null;
    let bodyHtml: string | null = null;
    let bodyPreview: string | null = null;

    if (pii) {
      if (body?.bodyFull) {
        bodyFull = await pii.decrypt(body.bodyFull);
      }
      if (body?.bodyHtml) {
        bodyHtml = await pii.decrypt(body.bodyHtml);
      }
      // Fallback to bodyPreview from email
      bodyPreview = await pii.decrypt(email.bodyPreview);
    }

    return {
      bodyFull: bodyFull || bodyPreview || "",
      bodyHtml: bodyHtml ?? undefined,
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

    console.log(`[Triage] Action: ${args.action} | Email ID: ${args.emailId}`);

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
 * NOTE: Search is disabled while PII encryption is active.
 * Encrypted fields cannot be searched with standard search indexes.
 * TODO: Implement client-side search or searchable encryption if needed.
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

    // Search is disabled with PII encryption - encrypted subjects can't be searched
    // Return recent emails instead as a fallback
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user_received", (q) => q.eq("userId", ctx.userId))
      .order("desc")
      .take(limit);

    // Batch fetch contacts
    const contactIds = [...new Set(emails.map((e) => e.from))];
    const contactsArray = await Promise.all(
      contactIds.map((id) => ctx.db.get(id))
    );
    const contactsMap = new Map(
      contactIds.map((id, i) => [id, contactsArray[i]])
    );

    // Batch fetch summaries
    const emailIds = emails.map((e) => e._id);
    const summariesArray = await Promise.all(
      emailIds.map((id) =>
        ctx.db
          .query("emailSummaries")
          .withIndex("by_email", (q) => q.eq("emailId", id))
          .first()
      )
    );
    const summariesMap = new Map(
      emailIds.map((id, i) => [id, summariesArray[i]])
    );

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);

    const emailsWithData = await Promise.all(
      emails.map(async (email) => {
        const fromContact = contactsMap.get(email.from);
        const summaryData = summariesMap.get(email._id);

        // Decrypt email fields
        let subject = "";
        let bodyPreview = "";
        let fromName: string | undefined;
        if (pii) {
          const decrypted = await pii.decryptMany({
            subject: email.subject,
            bodyPreview: email.bodyPreview,
            fromName: email.fromName ?? undefined,
          });
          subject = decrypted.subject ?? "";
          bodyPreview = decrypted.bodyPreview ?? "";
          fromName = decrypted.fromName ?? undefined;
        }

        // Decrypt contact name
        let decryptedContactName: string | undefined;
        if (pii && fromContact?.name) {
          decryptedContactName = await pii.decrypt(fromContact.name) ?? undefined;
        }

        // Decrypt summary fields
        let summary: string | undefined;
        let urgencyReason: string | undefined;
        let suggestedReply: string | undefined;
        let actionDescription: string | undefined;
        let quickReplies: QuickReply[] | undefined;
        let calendarEvent: CalendarEvent | undefined;

        if (pii && summaryData) {
          const decryptedSummary = await pii.decryptMany({
            summary: summaryData.summary,
            urgencyReason: summaryData.urgencyReason,
            suggestedReply: summaryData.suggestedReply ?? undefined,
            actionDescription: summaryData.actionDescription ?? undefined,
          });
          summary = decryptedSummary.summary ?? undefined;
          urgencyReason = decryptedSummary.urgencyReason ?? undefined;
          suggestedReply = decryptedSummary.suggestedReply ?? undefined;
          actionDescription = decryptedSummary.actionDescription ?? undefined;

          if (summaryData.quickReplies) {
            const qrJson = await pii.decrypt(summaryData.quickReplies);
            if (qrJson) quickReplies = JSON.parse(qrJson);
          }

          if (summaryData.calendarEvent) {
            const ceJson = await pii.decrypt(summaryData.calendarEvent);
            if (ceJson) calendarEvent = JSON.parse(ceJson);
          }
        }

        return {
          _id: email._id,
          externalId: email.externalId,
          threadId: email.threadId,
          provider: email.provider,
          userId: email.userId,
          from: email.from,
          to: email.to,
          cc: email.cc,
          receivedAt: email.receivedAt,
          isRead: email.isRead,
          isTriaged: email.isTriaged,
          triageAction: email.triageAction,
          triagedAt: email.triagedAt,
          direction: email.direction,
          // Decrypted fields
          subject,
          bodyPreview,
          fromName,
          fromContact: fromContact ? {
            _id: fromContact._id,
            email: fromContact.email,
            name: decryptedContactName,
            avatarUrl: fromContact.avatarUrl,
          } : undefined,
          summary,
          urgencyScore: summaryData?.urgencyScore,
          urgencyReason,
          suggestedReply,
          actionRequired: summaryData?.actionRequired,
          actionDescription,
          quickReplies,
          calendarEvent,
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

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);

    // Helper to decrypt an email with its related data
    async function decryptEmailData(
      e: Doc<"emails">,
      fromContact: Doc<"contacts"> | null,
      toContacts: (Doc<"contacts"> | null)[],
      summaryData: Doc<"emailSummaries"> | null
    ) {
      // Decrypt email fields
      let subject = "";
      let bodyPreview = "";
      let fromName: string | undefined;
      if (pii) {
        const decrypted = await pii.decryptMany({
          subject: e.subject,
          bodyPreview: e.bodyPreview,
          fromName: e.fromName ?? undefined,
        });
        subject = decrypted.subject ?? "";
        bodyPreview = decrypted.bodyPreview ?? "";
        fromName = decrypted.fromName ?? undefined;
      }

      // Decrypt contact names
      let decryptedFromContact: { _id: string; email: string; name?: string; avatarUrl?: string; relationship?: string } | undefined;
      if (fromContact && pii) {
        const decryptedName = fromContact.name ? await pii.decrypt(fromContact.name) : null;
        decryptedFromContact = {
          _id: fromContact._id,
          email: fromContact.email,
          name: decryptedName ?? undefined,
          avatarUrl: fromContact.avatarUrl,
          relationship: fromContact.relationship,
        };
      } else if (fromContact) {
        decryptedFromContact = {
          _id: fromContact._id,
          email: fromContact.email,
          avatarUrl: fromContact.avatarUrl,
          relationship: fromContact.relationship,
        };
      }

      const decryptedToContacts = await Promise.all(
        toContacts.filter(Boolean).map(async (c) => {
          if (!c) return null;
          let name: string | undefined;
          if (pii && c.name) {
            name = await pii.decrypt(c.name) ?? undefined;
          }
          return { _id: c._id, email: c.email, name, avatarUrl: c.avatarUrl };
        })
      );

      // Decrypt summary fields
      let summary: string | undefined;
      let urgencyReason: string | undefined;
      let suggestedReply: string | undefined;
      let calendarEvent: CalendarEvent | undefined;
      let meetingRequest: { isMeetingRequest: boolean; proposedTimes?: Array<{ startTime: string; endTime: string }> } | undefined;
      if (pii && summaryData) {
        const decrypted = await pii.decryptMany({
          summary: summaryData.summary,
          urgencyReason: summaryData.urgencyReason,
          suggestedReply: summaryData.suggestedReply ?? undefined,
        });
        summary = decrypted.summary ?? undefined;
        urgencyReason = decrypted.urgencyReason ?? undefined;
        suggestedReply = decrypted.suggestedReply ?? undefined;

        if (summaryData.calendarEvent) {
          const ceJson = await pii.decrypt(summaryData.calendarEvent);
          if (ceJson) calendarEvent = JSON.parse(ceJson);
        }

        if ((summaryData as any).meetingRequest) {
          const mrJson = await pii.decrypt((summaryData as any).meetingRequest);
          if (mrJson) meetingRequest = JSON.parse(mrJson);
        }
      }

      return {
        _id: e._id,
        externalId: e.externalId,
        threadId: e.threadId,
        provider: e.provider,
        userId: e.userId,
        from: e.from,
        to: e.to,
        cc: e.cc,
        receivedAt: e.receivedAt,
        isRead: e.isRead,
        isTriaged: e.isTriaged,
        triageAction: e.triageAction,
        triagedAt: e.triagedAt,
        direction: e.direction,
        subject,
        bodyPreview,
        fromName,
        fromContact: decryptedFromContact,
        toContacts: decryptedToContacts.filter(Boolean),
        summary,
        urgencyScore: summaryData?.urgencyScore,
        urgencyReason,
        suggestedReply,
        calendarEvent,
        meetingRequest,
        shouldAcceptCalendar: summaryData?.shouldAcceptCalendar,
        calendarEventId: summaryData?.calendarEventId,
        calendarEventLink: summaryData?.calendarEventLink,
        aiProcessedAt: summaryData?.createdAt,
      };
    }

    // If no threadId, just return this email
    if (!email.threadId) {
      const fromContact = await ctx.db.get(email.from);
      const summaryData = await getSummaryForEmail(ctx.db, email._id);
      const toContacts = email.direction === "outgoing" && email.to?.length
        ? await Promise.all(email.to.map(id => ctx.db.get(id)))
        : [];
      return [await decryptEmailData(email, fromContact, toContacts, summaryData)];
    }

    // Get all emails in this thread
    const threadEmails = await ctx.db
      .query("emails")
      .withIndex("by_thread", (q) => q.eq("userId", ctx.userId).eq("threadId", email.threadId))
      .order("asc")
      .collect();

    // Batch fetch contacts
    const fromContactIds = [...new Set(threadEmails.map((e) => e.from))];
    const toContactIds = [...new Set(threadEmails.flatMap((e) => e.to || []))];
    const allContactIds = [...new Set([...fromContactIds, ...toContactIds])];
    const contactsArray = await Promise.all(
      allContactIds.map((id) => ctx.db.get(id))
    );
    const contactsMap = new Map(
      allContactIds.map((id, i) => [id, contactsArray[i]])
    );

    // Batch fetch summaries
    const emailIds = threadEmails.map((e) => e._id);
    const summariesArray = await Promise.all(
      emailIds.map((id) =>
        ctx.db
          .query("emailSummaries")
          .withIndex("by_email", (q) => q.eq("emailId", id))
          .first()
      )
    );
    const summariesMap = new Map(
      emailIds.map((id, i) => [id, summariesArray[i]])
    );

    // Decrypt all emails
    const emailsWithData = await Promise.all(
      threadEmails.map(async (e) => {
        const fromContact = contactsMap.get(e.from) ?? null;
        const toContacts = (e.to || []).map(id => contactsMap.get(id) ?? null);
        const summaryData = summariesMap.get(e._id) ?? null;
        return decryptEmailData(e, fromContact, toContacts, summaryData);
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
  /** True if this email is already triaged as reply_needed (in TODO list) */
  isInTodo?: boolean;
}

/**
 * Get untriaged emails grouped by AI recommendation for batch triage
 * Uses sessionStart to prevent UI refresh during active triage session
 */
export const getMyBatchTriagePreview = authedQuery({
  args: {
    limit: v.optional(v.number()),
    sessionStart: v.optional(v.number()),
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
    const limit = args.limit ?? 200;

    // Get untriaged emails for authenticated user
    const rawUntriagedEmails = await ctx.db
      .query("emails")
      .withIndex("by_user_untriaged", (q) =>
        q.eq("userId", ctx.userId).eq("isTriaged", false)
      )
      .order("desc")
      .take(limit);

    // Filter out outgoing emails
    // If sessionStart provided, only show emails received before session started
    // This prevents new emails from appearing mid-triage
    const untriagedEmails = rawUntriagedEmails.filter((e) => {
      if (e.direction === "outgoing") return false;
      if (args.sessionStart && e.receivedAt > args.sessionStart) return false;
      return true;
    });

    // Also get triaged emails marked as reply_needed (TODO) for Human Waiting section
    // If sessionStart provided, include emails triaged after session start OR
    // emails that already existed in TODO before session
    const rawTodoEmails = await ctx.db
      .query("emails")
      .withIndex("by_user_reply_needed", (q) =>
        q.eq("userId", ctx.userId).eq("triageAction", "reply_needed")
      )
      .order("desc")
      .take(limit);

    const todoEmails = args.sessionStart
      ? rawTodoEmails.filter((e) => {
          const sessionStart = args.sessionStart!;
          // Include if triaged during this session (after sessionStart)
          if (e.triagedAt && e.triagedAt >= sessionStart) return true;
          // Include if already in TODO before session started
          if (e.triagedAt && e.triagedAt < sessionStart) return true;
          return false;
        })
      : rawTodoEmails;

    // Combine all emails for batch lookups
    const allEmails = [...untriagedEmails, ...todoEmails];

    // Batch fetch contacts
    const contactIds = [...new Set(allEmails.map((e) => e.from))];
    const contactsArray = await Promise.all(
      contactIds.map((id) => ctx.db.get(id))
    );
    const contactsMap = new Map(
      contactIds.map((id, i) => [id, contactsArray[i]])
    );

    // Batch fetch summaries
    const emailIds = allEmails.map((e) => e._id);
    const summariesArray = await Promise.all(
      emailIds.map((id) =>
        ctx.db
          .query("emailSummaries")
          .withIndex("by_email", (q) => q.eq("emailId", id))
          .first()
      )
    );
    const summariesMap = new Map(
      emailIds.map((id, i) => [id, summariesArray[i]])
    );

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);

    // Helper to convert email to BatchEmailPreview using pre-fetched data
    const emailToPreview = async (email: typeof untriagedEmails[0]): Promise<BatchEmailPreview> => {
      const fromContact = contactsMap.get(email.from);
      const summaryData = summariesMap.get(email._id);

      // Decrypt email fields
      let subject = "";
      let bodyPreview = "";
      let fromName: string | undefined;
      if (pii) {
        const decrypted = await pii.decryptMany({
          subject: email.subject,
          bodyPreview: email.bodyPreview,
          fromName: email.fromName ?? undefined,
        });
        subject = decrypted.subject ?? "";
        bodyPreview = decrypted.bodyPreview ?? "";
        fromName = decrypted.fromName ?? undefined;
      }

      // Decrypt contact name
      let decryptedContactName: string | undefined;
      if (pii && fromContact?.name) {
        decryptedContactName = await pii.decrypt(fromContact.name) ?? undefined;
      }

      // Decrypt summary fields
      let summary: string | undefined;
      let quickReplies: QuickReply[] | undefined;
      let calendarEvent: CalendarEvent | undefined;

      if (pii && summaryData) {
        summary = await pii.decrypt(summaryData.summary) ?? undefined;

        if (summaryData.quickReplies) {
          const qrJson = await pii.decrypt(summaryData.quickReplies);
          if (qrJson) quickReplies = JSON.parse(qrJson);
        }

        if (summaryData.calendarEvent) {
          const ceJson = await pii.decrypt(summaryData.calendarEvent);
          if (ceJson) calendarEvent = JSON.parse(ceJson);
        }
      }

      // Fetch important attachments if specified in summary
      let importantAttachments: Array<{
        _id: string;
        filename: string;
        mimeType: string;
        size: number;
        attachmentId: string;
      }> | undefined;

      if ((summaryData as any)?.importantAttachmentIds && (summaryData as any).importantAttachmentIds.length > 0) {
        const attachments = await Promise.all(
          (summaryData as any).importantAttachmentIds.map((id: any) => ctx.db.get(id))
        );

        if (pii) {
          importantAttachments = await Promise.all(
            attachments
              .filter((att): att is NonNullable<typeof att> => att !== null)
              .map(async (att: any) => ({
                _id: att._id,
                filename: (await pii.decrypt(att.filename)) ?? "",
                mimeType: att.mimeType,
                size: att.size,
                attachmentId: att.attachmentId,
              }))
          );
        }
      }

      return {
        _id: email._id,
        subject,
        bodyPreview,
        receivedAt: email.receivedAt,
        summary,
        urgencyScore: summaryData?.urgencyScore,
        actionRequired: summaryData?.actionRequired,
        quickReplies,
        calendarEvent,
        shouldAcceptCalendar: summaryData?.shouldAcceptCalendar,
        isSubscription: email.isSubscription,
        fromName,
        fromContact: fromContact ? {
          _id: fromContact._id,
          email: fromContact.email,
          name: decryptedContactName,
          avatarUrl: fromContact.avatarUrl,
        } : null,
        aiProcessedAt: summaryData?.createdAt,
        importantAttachments,
        isPunted: email.isPunted ?? false,
      } as any;
    };

    // Map emails with pre-fetched data and decrypt
    const emailsWithData = await Promise.all(untriagedEmails.map(emailToPreview));
    const todoEmailsWithData = await Promise.all(todoEmails.map(emailToPreview));

    // Group emails by AI recommendation
    const done: BatchEmailPreview[] = [];
    // Start with already-triaged TODO emails, mark them with isInTodo flag
    const humanWaiting: BatchEmailPreview[] = todoEmailsWithData.map(e => ({ ...e, isInTodo: true }));
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
      total: emailsWithData.length + todoEmailsWithData.length,
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

        // Allow re-triaging from reply_needed to done (e.g., marking TODO item as done)
        // Skip if already triaged with the same action
        if (email.isTriaged && email.triageAction === action) {
          continue;
        }

        await ctx.db.patch(emailId, {
          isTriaged: true,
          triageAction: action,
          triagedAt: Date.now(),
          isPunted: undefined, // Clear punt state when triaged
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
 * Mark all untriaged emails from a specific sender as done
 */
export const triageMyEmailsFromSender = authedMutation({
  args: {
    senderEmail: v.string(),
  },
  handler: async (ctx, args): Promise<{ triaged: number }> => {
    // Find the contact by email
    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", ctx.userId).eq("email", args.senderEmail)
      )
      .first();

    if (!contact) {
      console.log(`[TriageSender] No contact found for ${args.senderEmail}`);
      return { triaged: 0 };
    }

    // Get all untriaged emails from this sender
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_from", (q) => q.eq("from", contact._id))
      .collect();

    // Filter to untriaged only for this user
    const untriagedEmails = emails.filter(
      (e) => e.userId === ctx.userId && !e.isTriaged
    );

    // Mark all as done
    let triaged = 0;
    for (const email of untriagedEmails) {
      await ctx.db.patch(email._id, {
        isTriaged: true,
        triageAction: "done",
        triagedAt: Date.now(),
      });
      triaged++;
    }

    console.log(`[TriageSender] Marked ${triaged} emails from ${args.senderEmail} as done`);
    return { triaged };
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
        isPunted: undefined,
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

/**
 * Untriage a single email (undo triage action)
 */
export const untriagedMyEmail = authedMutation({
  args: {
    emailId: v.id("emails"),
  },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) {
      throw new Error("Email not found");
    }
    if (email.userId !== ctx.userId) {
      throw new Error("Email does not belong to you");
    }

    await ctx.db.patch(args.emailId, {
      isTriaged: false,
      triageAction: undefined,
      triagedAt: undefined,
      isPunted: undefined,
    });

    return { success: true };
  },
});

/**
 * Toggle punt state for an email during batch triage
 * Punted emails will be marked as reply_needed when category is marked done
 */
export const togglePuntEmail = authedMutation({
  args: {
    emailId: v.id("emails"),
  },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) {
      throw new Error("Email not found");
    }
    if (email.userId !== ctx.userId) {
      throw new Error("Email does not belong to you");
    }

    // Toggle punt state
    const newPuntState = !email.isPunted;
    await ctx.db.patch(args.emailId, {
      isPunted: newPuntState,
    });

    console.log(`[TogglePunt] Email ${args.emailId} punt state: ${newPuntState}`);
    return { success: true, isPunted: newPuntState };
  },
});

// Re-export attachment functions from gmailSync
export { getEmailAttachments, downloadAttachment } from "./gmailSync";
