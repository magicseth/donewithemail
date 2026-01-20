import { v } from "convex/values";
import { internalMutation, internalQuery, query, mutation } from "./_generated/server";

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

    return {
      subject: email.subject,
      fromName: contact?.name,
      fromEmail: contact?.email,
    };
  },
});

// Get email by ID for summarization
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

    return {
      ...email,
      // Body content from emailBodies table
      bodyFull: emailBody?.bodyFull,
      bodyHtml: emailBody?.bodyHtml,
      fromEmail: contact?.email,
      fromName: contact?.name,
      summary: summary?.summary,
      urgencyScore: summary?.urgencyScore,
      urgencyReason: summary?.urgencyReason,
      suggestedReply: summary?.suggestedReply,
      actionRequired: summary?.actionRequired,
      actionDescription: summary?.actionDescription,
      quickReplies: summary?.quickReplies,
      calendarEvent: summary?.calendarEvent,
      aiProcessedAt: summary?.createdAt,
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

    return {
      ...email,
      // Body content from emailBodies table
      bodyFull: emailBody?.bodyFull,
      bodyHtml: emailBody?.bodyHtml,
      fromEmail: fromContact?.email,
      fromName: fromContact?.name,
      fromRelationship: fromContact?.relationship,
      senderEmailCount: fromContact?.emailCount || 0,
      userEmail: user?.email,
      userName: user?.name || undefined,
      toEmails: toContacts.filter(Boolean).map((c) => c?.email),
      recentFromSender: senderHistory.map((e) => ({
        subject: e.subject,
        receivedAt: e.receivedAt,
      })),
      // Include existing summary data
      summary: existingSummary?.summary,
      urgencyScore: existingSummary?.urgencyScore,
      urgencyReason: existingSummary?.urgencyReason,
      suggestedReply: existingSummary?.suggestedReply,
      actionRequired: existingSummary?.actionRequired,
      actionDescription: existingSummary?.actionDescription,
      quickReplies: existingSummary?.quickReplies,
      calendarEvent: existingSummary?.calendarEvent,
      aiProcessedAt: existingSummary?.createdAt,
      // Contact facts for AI context
      contactFacts: fromContact?.facts || [],
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

    const existingFacts = contact.facts || [];
    const newFacts = args.facts.map((text) => ({
      id: crypto.randomUUID(),
      text,
      source: "ai" as const,
      createdAt: Date.now(),
      sourceEmailId: args.emailId,
    }));

    await ctx.db.patch(args.contactId, {
      facts: [...existingFacts, ...newFacts],
    });
  },
});

// Get summary for an email
export const getSummary = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();
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
    deadline: v.optional(v.string()),
    deadlineDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if summary already exists
    const existing = await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    const summaryData = {
      summary: args.summary,
      urgencyScore: args.urgencyScore,
      urgencyReason: args.urgencyReason,
      suggestedReply: args.suggestedReply,
      actionRequired: args.actionRequired,
      actionDescription: args.actionDescription,
      quickReplies: args.quickReplies,
      calendarEvent: args.calendarEvent,
      shouldAcceptCalendar: args.shouldAcceptCalendar,
      deadline: args.deadline,
      deadlineDescription: args.deadlineDescription,
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
          recipientCounts.set(contact.email, {
            count: 1,
            name: contact.name,
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

    // Get the email bodies
    const emailsWithBodies = await Promise.all(
      emailsToContact.slice(0, limit).map(async (email) => {
        const body = await ctx.db
          .query("emailBodies")
          .withIndex("by_email", (q) => q.eq("emailId", email._id))
          .first();
        return {
          ...email,
          bodyFull: body?.bodyFull || email.bodyPreview,
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
    await ctx.db.patch(args.contactId, { writingStyle: args.writingStyle });
  },
});

// Get all contacts for a user (for backfill)
export const getContactsForWritingStyleBackfill = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});
