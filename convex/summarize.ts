import { v } from "convex/values";
import { internalMutation, internalQuery, query, mutation } from "./_generated/server";
import { encryptedPii } from "./pii";
import { CalendarEvent, QuickReply, ActionableItem } from "./schema";

// Internal mutation to mark an event as added to calendar
export const markCalendarEventAdded = internalMutation({
  args: {
    emailId: v.id("emails"),
    calendarEventId: v.string(),
    calendarEventLink: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the email summary for this email
    const summary = await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    if (summary) {
      await ctx.db.patch(summary._id, {
        calendarEventId: args.calendarEventId,
        calendarEventLink: args.calendarEventLink,
      });
    }
  },
});

// Get basic email info for calendar event attribution
export const getEmailBasicInfo = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) return null;

    // Get sender contact info
    const contact = await ctx.db.get(email.from);

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, email.userId);

    // Decrypt PII fields
    let subject: string | undefined;
    let fromName: string | undefined;

    if (pii) {
      subject = await pii.decrypt(email.subject) ?? undefined;
      if (contact?.name) {
        fromName = await pii.decrypt(contact.name) ?? undefined;
      }
    }

    return {
      subject,
      fromName,
      fromEmail: contact?.email,
    };
  },
});

// Get email by ID for summarization (with decryption)
export const getEmailForSummary = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) return null;

    // Get sender info
    const contact = await ctx.db.get(email.from);

    // Get email body from separate table (or fallback to legacy field)
    const emailBody = await ctx.db
      .query("emailBodies")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    // Get existing summary if any
    const summary = await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    // Get attachments for this email
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .collect();

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, email.userId);

    // Decrypt email fields
    let subject: string | null = null;
    let bodyPreview: string | null = null;
    let fromName: string | null = null;
    let bodyFull: string | null = null;
    let bodyHtml: string | null = null;

    if (pii) {
      subject = await pii.decrypt(email.subject);
      bodyPreview = await pii.decrypt(email.bodyPreview);
      if (email.fromName) {
        fromName = await pii.decrypt(email.fromName);
      }
      if (contact?.name) {
        fromName = await pii.decrypt(contact.name);
      }
      if (emailBody?.bodyFull) {
        bodyFull = await pii.decrypt(emailBody.bodyFull);
      }
      if (emailBody?.bodyHtml) {
        bodyHtml = await pii.decrypt(emailBody.bodyHtml);
      }
    }

    // Decrypt summary fields if they exist
    let summaryText: string | null = null;
    let urgencyReason: string | null = null;
    let suggestedReply: string | null = null;
    let actionDescription: string | null = null;
    let quickReplies: QuickReply[] | null = null;
    let calendarEvent: CalendarEvent | null = null;

    if (pii && summary) {
      summaryText = await pii.decrypt(summary.summary);
      urgencyReason = await pii.decrypt(summary.urgencyReason);
      if (summary.suggestedReply) {
        suggestedReply = await pii.decrypt(summary.suggestedReply);
      }
      if (summary.actionDescription) {
        actionDescription = await pii.decrypt(summary.actionDescription);
      }
      if (summary.quickReplies) {
        const qrJson = await pii.decrypt(summary.quickReplies);
        if (qrJson) quickReplies = JSON.parse(qrJson);
      }
      if (summary.calendarEvent) {
        const ceJson = await pii.decrypt(summary.calendarEvent);
        if (ceJson) calendarEvent = JSON.parse(ceJson);
      }
    }

    // Decrypt attachment filenames
    const decryptedAttachments = await Promise.all(
      attachments.map(async (att) => ({
        _id: att._id,
        filename: pii ? await pii.decrypt(att.filename) : null,
        mimeType: att.mimeType,
        size: att.size,
        attachmentId: att.attachmentId,
        contentId: att.contentId,
      }))
    );

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
      // Decrypted fields
      subject,
      bodyPreview,
      bodyFull,
      bodyHtml,
      fromEmail: contact?.email,
      fromName,
      summary: summaryText,
      urgencyScore: summary?.urgencyScore,
      urgencyReason,
      suggestedReply,
      actionRequired: summary?.actionRequired,
      actionDescription,
      quickReplies,
      calendarEvent,
      aiProcessedAt: summary?.createdAt,
      attachments: decryptedAttachments,
    };
  },
});

// Get email by external ID with full context for summarization
export const getEmailByExternalId = internalQuery({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    const email = await ctx.db
      .query("emails")
      .withIndex("by_external_id", (q) =>
        q.eq("externalId", args.externalId).eq("provider", "gmail")
      )
      .first();

    if (!email) return null;

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, email.userId);

    // Get email body from separate table (or fallback to legacy field)
    const emailBody = await ctx.db
      .query("emailBodies")
      .withIndex("by_email", (q) => q.eq("emailId", email._id))
      .first();

    // Get existing summary
    const existingSummary = await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", email._id))
      .first();

    // Get sender contact info
    const fromContact = await ctx.db.get(email.from);

    // Get user info
    const user = await ctx.db.get(email.userId);

    // Get "to" contacts
    const toContacts = await Promise.all(
      email.to.map((contactId) => ctx.db.get(contactId))
    );

    // Get sender's email history with this user (for relationship context)
    const senderHistory = fromContact
      ? await ctx.db
          .query("emails")
          .withIndex("by_user_received", (q) => q.eq("userId", email.userId))
          .filter((q) => q.eq(q.field("from"), email.from))
          .order("desc")
          .take(5)
      : [];

    // Decrypt PII fields
    let subject = "";
    let bodyPreview = "";
    let bodyFull: string | undefined;
    let bodyHtml: string | undefined;
    let fromName: string | undefined;
    let userName: string | undefined;
    let summary: string | undefined;
    let urgencyReason: string | undefined;
    let suggestedReply: string | undefined;
    let actionDescription: string | undefined;
    let quickReplies: QuickReply[] | undefined;
    let calendarEvent: CalendarEvent | undefined;
    let contactFacts: Array<{ id: string; text: string; source: string; createdAt: number; sourceEmailId?: string }> = [];

    if (pii) {
      subject = (await pii.decrypt(email.subject)) ?? "";
      bodyPreview = (await pii.decrypt(email.bodyPreview)) ?? "";
      if (emailBody?.bodyFull) {
        bodyFull = (await pii.decrypt(emailBody.bodyFull)) ?? undefined;
      }
      if (emailBody?.bodyHtml) {
        bodyHtml = (await pii.decrypt(emailBody.bodyHtml)) ?? undefined;
      }
      if (fromContact?.name) {
        fromName = (await pii.decrypt(fromContact.name)) ?? undefined;
      }
      if (user?.name) {
        userName = (await pii.decrypt(user.name)) ?? undefined;
      }
      if (existingSummary?.summary) {
        summary = (await pii.decrypt(existingSummary.summary)) ?? undefined;
      }
      if (existingSummary?.urgencyReason) {
        urgencyReason = (await pii.decrypt(existingSummary.urgencyReason)) ?? undefined;
      }
      if (existingSummary?.suggestedReply) {
        suggestedReply = (await pii.decrypt(existingSummary.suggestedReply)) ?? undefined;
      }
      if (existingSummary?.actionDescription) {
        actionDescription = (await pii.decrypt(existingSummary.actionDescription)) ?? undefined;
      }
      if (existingSummary?.quickReplies) {
        const qrJson = await pii.decrypt(existingSummary.quickReplies);
        quickReplies = qrJson ? JSON.parse(qrJson) : undefined;
      }
      if (existingSummary?.calendarEvent) {
        const ceJson = await pii.decrypt(existingSummary.calendarEvent);
        calendarEvent = ceJson ? JSON.parse(ceJson) : undefined;
      }
      if (fromContact?.facts) {
        const factsJson = await pii.decrypt(fromContact.facts);
        contactFacts = factsJson ? JSON.parse(factsJson) : [];
      }
    }

    // Decrypt recent sender history subjects
    const recentFromSender = await Promise.all(
      senderHistory.map(async (e) => {
        let subj = "";
        if (pii) {
          subj = (await pii.decrypt(e.subject)) ?? "";
        }
        return { subject: subj, receivedAt: e.receivedAt };
      })
    );

    return {
      _id: email._id,
      externalId: email.externalId,
      userId: email.userId,
      from: email.from,
      to: email.to,
      receivedAt: email.receivedAt,
      threadId: email.threadId,
      subject,
      bodyPreview,
      bodyFull,
      bodyHtml,
      fromEmail: fromContact?.email,
      fromName,
      fromRelationship: fromContact?.relationship,
      senderEmailCount: fromContact?.emailCount || 0,
      userEmail: user?.email,
      userName,
      toEmails: toContacts.filter(Boolean).map((c) => c?.email),
      recentFromSender,
      summary,
      urgencyScore: existingSummary?.urgencyScore,
      urgencyReason,
      suggestedReply,
      actionRequired: existingSummary?.actionRequired,
      actionDescription,
      quickReplies,
      calendarEvent,
      aiProcessedAt: existingSummary?.createdAt,
      contactFacts,
    };
  },
});

// Save AI-suggested facts to a contact's dossier
export const saveAISuggestedFacts = internalMutation({
  args: {
    contactId: v.id("contacts"),
    emailId: v.id("emails"),
    facts: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return;

    // Get PII helper for encrypting facts
    const pii = await encryptedPii.forUser(ctx, contact.userId);

    // Decrypt existing facts if any
    let existingFactsArray: Array<{
      id: string;
      text: string;
      source: "manual" | "ai";
      createdAt: number;
      sourceEmailId?: string;
    }> = [];

    if (contact.facts) {
      const decryptedFacts = await pii.decrypt(contact.facts);
      if (decryptedFacts) {
        existingFactsArray = JSON.parse(decryptedFacts);
      }
    }

    // Add new facts
    const newFacts = args.facts.map((text) => ({
      id: crypto.randomUUID(),
      text,
      source: "ai" as const,
      createdAt: Date.now(),
      sourceEmailId: args.emailId,
    }));

    const allFacts = [...existingFactsArray, ...newFacts];

    // Encrypt and save
    const encryptedFacts = await pii.encrypt(JSON.stringify(allFacts));
    await ctx.db.patch(args.contactId, {
      facts: encryptedFacts,
    });
  },
});

// Get summary for an email (with decryption)
export const getSummary = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    if (!summary) return null;

    // Get the email to get userId for decryption
    const email = await ctx.db.get(args.emailId);
    if (!email) return null;

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, email.userId);

    if (!pii) {
      // Return raw summary without decryption if no PII helper
      return {
        ...summary,
        summary: null,
        urgencyReason: null,
        suggestedReply: null,
        actionDescription: null,
        quickReplies: null,
        calendarEvent: null,
        deadlineDescription: null,
      };
    }

    // Decrypt all PII fields
    const decryptedFields = await pii.decryptMany({
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
      _id: summary._id,
      _creationTime: summary._creationTime,
      emailId: summary.emailId,
      urgencyScore: summary.urgencyScore,
      actionRequired: summary.actionRequired,
      shouldAcceptCalendar: summary.shouldAcceptCalendar,
      calendarEventId: summary.calendarEventId,
      calendarEventLink: summary.calendarEventLink,
      createdAt: summary.createdAt,
      // Decrypted fields
      summary: decryptedFields.summary,
      urgencyReason: decryptedFields.urgencyReason,
      suggestedReply: decryptedFields.suggestedReply,
      actionDescription: decryptedFields.actionDescription,
      deadlineDescription: decryptedFields.deadlineDescription,
      quickReplies,
      calendarEvent,
    };
  },
});

// Delete summary for a single email (for reprocessing)
export const deleteSummaryForEmail = internalMutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    if (summary) {
      await ctx.db.delete(summary._id);
      return true;
    }
    return false;
  },
});

// Get email's externalId by Convex ID
export const getExternalIdForEmail = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    return email?.externalId;
  },
});

// Delete all summaries for a user's emails (for debug reset)
export const deleteAllSummariesForUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get all emails for the user
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let deleted = 0;
    for (const email of emails) {
      const summary = await ctx.db
        .query("emailSummaries")
        .withIndex("by_email", (q) => q.eq("emailId", email._id))
        .first();
      if (summary) {
        await ctx.db.delete(summary._id);
        deleted++;
      }
    }

    return deleted;
  },
});

// Get all external IDs for a user's emails (for resummarization)
export const getExternalIdsForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return emails.map((e) => e.externalId);
  },
});

// Get external IDs for unprocessed emails (no aiProcessedAt)
export const getUnprocessedExternalIdsForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Filter to only unprocessed emails
    const unprocessed = [];
    for (const email of emails) {
      // Check if there's a summary for this email
      const summary = await ctx.db
        .query("emailSummaries")
        .withIndex("by_email", (q) => q.eq("emailId", email._id))
        .first();

      if (!summary) {
        unprocessed.push(email.externalId);
      }
    }

    return unprocessed;
  },
});

// Save email summary to separate table
export const updateEmailSummary = internalMutation({
  args: {
    emailId: v.id("emails"),
    summary: v.string(),
    urgencyScore: v.number(),
    urgencyReason: v.string(),
    suggestedReply: v.optional(v.string()),
    actionRequired: v.optional(v.union(
      v.literal("reply"),
      v.literal("action"),
      v.literal("fyi"),
      v.literal("none")
    )),
    actionDescription: v.optional(v.string()),
    quickReplies: v.optional(v.array(v.object({
      label: v.string(),
      body: v.string(),
    }))),
    actionableItems: v.optional(v.array(v.object({
      type: v.union(v.literal("link"), v.literal("attachment")),
      label: v.string(),
      url: v.optional(v.string()),
      attachmentId: v.optional(v.string()),
    }))),
    calendarEvent: v.optional(v.object({
      title: v.string(),
      startTime: v.optional(v.string()),
      endTime: v.optional(v.string()),
      location: v.optional(v.string()),
      description: v.optional(v.string()),
      recurrence: v.optional(v.string()),
      recurrenceDescription: v.optional(v.string()),
    })),
    shouldAcceptCalendar: v.optional(v.boolean()),
    meetingRequest: v.optional(v.object({
      isMeetingRequest: v.boolean(),
      proposedTimes: v.optional(v.array(v.object({
        startTime: v.string(),
        endTime: v.string(),
      }))),
    })),
    deadline: v.optional(v.string()),
    deadlineDescription: v.optional(v.string()),
    importantAttachmentIds: v.optional(v.array(v.id("attachments"))),
  },
  handler: async (ctx, args) => {
    // Get the email to find the user for encryption
    const email = await ctx.db.get(args.emailId);
    if (!email) {
      throw new Error("Email not found");
    }

    // Get PII helper for encrypting summary data
    const pii = await encryptedPii.forUser(ctx, email.userId);

    // Encrypt PII fields
    const encryptedSummary = await pii.encrypt(args.summary);
    const encryptedUrgencyReason = await pii.encrypt(args.urgencyReason);
    const encryptedSuggestedReply = args.suggestedReply
      ? await pii.encrypt(args.suggestedReply)
      : undefined;
    const encryptedActionDescription = args.actionDescription
      ? await pii.encrypt(args.actionDescription)
      : undefined;
    const encryptedQuickReplies = args.quickReplies
      ? await pii.encrypt(JSON.stringify(args.quickReplies))
      : undefined;
    const encryptedActionableItems = args.actionableItems
      ? await pii.encrypt(JSON.stringify(args.actionableItems))
      : undefined;
    const encryptedCalendarEvent = args.calendarEvent
      ? await pii.encrypt(JSON.stringify(args.calendarEvent))
      : undefined;
    const encryptedMeetingRequest = args.meetingRequest
      ? await pii.encrypt(JSON.stringify(args.meetingRequest))
      : undefined;
    const encryptedDeadlineDescription = args.deadlineDescription
      ? await pii.encrypt(args.deadlineDescription)
      : undefined;

    // Check if summary already exists
    const existing = await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    const summaryData = {
      summary: encryptedSummary,
      urgencyScore: args.urgencyScore,
      urgencyReason: encryptedUrgencyReason,
      suggestedReply: encryptedSuggestedReply,
      actionRequired: args.actionRequired,
      actionDescription: encryptedActionDescription,
      quickReplies: encryptedQuickReplies,
      actionableItems: encryptedActionableItems,
      calendarEvent: encryptedCalendarEvent,
      shouldAcceptCalendar: args.shouldAcceptCalendar,
      meetingRequest: encryptedMeetingRequest,
      deadline: args.deadline,
      deadlineDescription: encryptedDeadlineDescription,
      importantAttachmentIds: args.importantAttachmentIds,
      createdAt: Date.now(),
    };

    if (existing) {
      // Update existing summary
      await ctx.db.patch(existing._id, summaryData);
    } else {
      // Insert new summary
      await ctx.db.insert("emailSummaries", {
        emailId: args.emailId,
        ...summaryData,
      });
    }
  },
});

// Get top email recipients (contacts the user has sent the most emails to)
export const getTopRecipients = query({
  args: { userEmail: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();
    if (!user) return { error: "User not found", recipients: [] };

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, user._id);

    // Get all outgoing emails
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("direction"), "outgoing"))
      .collect();

    // Count emails per recipient
    const recipientCounts = new Map<string, { count: number; name?: string; email: string }>();

    for (const email of emails) {
      if (!email.to || email.to.length === 0) continue;

      for (const contactId of email.to) {
        const contact = await ctx.db.get(contactId);
        if (!contact) continue;

        const existing = recipientCounts.get(contact.email);
        if (existing) {
          existing.count++;
        } else {
          // Decrypt contact name
          let name: string | undefined;
          if (pii && contact.name) {
            name = (await pii.decrypt(contact.name)) ?? undefined;
          }

          recipientCounts.set(contact.email, {
            count: 1,
            name,
            email: contact.email,
          });
        }
      }
    }

    // Sort by count and take top N
    const sorted = Array.from(recipientCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, args.limit || 20);

    return {
      totalOutgoing: emails.length,
      withRecipients: emails.filter(e => e.to && e.to.length > 0).length,
      recipients: sorted,
    };
  },
});

// Clear all writing styles for a user (to fix incorrect data)
export const clearWritingStyles = mutation({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();
    if (!user) return { error: "User not found", cleared: 0 };

    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    let cleared = 0;
    for (const contact of contacts) {
      if (contact.writingStyle) {
        await ctx.db.patch(contact._id, { writingStyle: undefined });
        cleared++;
      }
    }

    return { cleared };
  },
});

// Get sent emails TO a specific contact (for writing style analysis)
// This finds emails where the user is the sender and the contact is a recipient
export const getSentEmailsToContact = internalQuery({
  args: {
    userId: v.id("users"),
    contactId: v.id("contacts"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, args.userId);

    // Get all outgoing emails for this user
    const outgoingEmails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("direction"), "outgoing"))
      .collect();

    // Filter to emails sent TO this contact
    const emailsToContact = outgoingEmails.filter(
      (e) => e.to && e.to.includes(args.contactId)
    );

    // Get the email bodies and decrypt
    const emailsWithBodies = await Promise.all(
      emailsToContact.slice(0, limit).map(async (email) => {
        const body = await ctx.db
          .query("emailBodies")
          .withIndex("by_email", (q) => q.eq("emailId", email._id))
          .first();

        // Decrypt fields
        let subject = "";
        let bodyPreview = "";
        let bodyFull: string | undefined;

        if (pii) {
          subject = (await pii.decrypt(email.subject)) ?? "";
          bodyPreview = (await pii.decrypt(email.bodyPreview)) ?? "";
          if (body?.bodyFull) {
            bodyFull = (await pii.decrypt(body.bodyFull)) ?? undefined;
          }
        }

        return {
          _id: email._id,
          subject,
          bodyPreview,
          bodyFull: bodyFull || bodyPreview,
          receivedAt: email.receivedAt,
        };
      })
    );

    return emailsWithBodies;
  },
});

// Update a contact's writing style
export const updateContactWritingStyle = internalMutation({
  args: {
    contactId: v.id("contacts"),
    writingStyle: v.object({
      tone: v.string(),
      greeting: v.optional(v.string()),
      signoff: v.optional(v.string()),
      characteristics: v.optional(v.array(v.string())),
      samplePhrases: v.optional(v.array(v.string())),
      emailsAnalyzed: v.number(),
      analyzedAt: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return;

    // Get PII helper for encrypting writing style
    const pii = await encryptedPii.forUser(ctx, contact.userId);

    // Encrypt writing style as JSON
    const encryptedWritingStyle = await pii.encrypt(JSON.stringify(args.writingStyle));
    await ctx.db.patch(args.contactId, { writingStyle: encryptedWritingStyle });
  },
});

// Get all contacts for a user (for backfill)
export const getContactsForWritingStyleBackfill = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, args.userId);

    // Decrypt names
    return Promise.all(
      contacts.map(async (c) => {
        let name: string | undefined;
        if (pii && c.name) {
          name = (await pii.decrypt(c.name)) ?? undefined;
        }
        return {
          _id: c._id,
          email: c.email,
          name,
        };
      })
    );
  },
});
