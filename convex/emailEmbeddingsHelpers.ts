import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { encryptedPii } from "./pii";

// Save embedding to emailSummaries table
export const saveEmbedding = internalMutation({
  args: {
    emailId: v.id("emails"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    if (summary) {
      await ctx.db.patch(summary._id, {
        embedding: args.embedding,
      });
    }
  },
});

// Helper query to get summary by ID (with decrypted summary text)
export const getSummaryById = internalQuery({
  args: { summaryId: v.id("emailSummaries") },
  handler: async (ctx, args): Promise<{ emailId: Id<"emails">; summary?: string } | null> => {
    const summary = await ctx.db.get(args.summaryId);
    if (!summary) return null;

    // Get email to find userId
    const email = await ctx.db.get(summary.emailId);
    if (!email) return { emailId: summary.emailId, summary: undefined };

    // Decrypt summary text
    const pii = await encryptedPii.forUserQuery(ctx, email.userId);
    let decryptedSummary: string | undefined;
    if (pii && summary.summary) {
      decryptedSummary = (await pii.decrypt(summary.summary)) ?? undefined;
    }

    return {
      emailId: summary.emailId,
      summary: decryptedSummary,
    };
  },
});

// Helper query to get email by ID (with decrypted subject)
export const getEmailById = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) return null;

    // Decrypt subject
    const pii = await encryptedPii.forUserQuery(ctx, email.userId);
    let subject: string | null = null;
    if (pii) {
      subject = await pii.decrypt(email.subject);
    }

    return {
      ...email,
      subject: subject ?? "",
    };
  },
});

// Helper query to get contact by ID (with decrypted name)
export const getContactById = internalQuery({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return null;

    // Decrypt name
    const pii = await encryptedPii.forUserQuery(ctx, contact.userId);
    let name: string | undefined;
    if (pii && contact.name) {
      name = (await pii.decrypt(contact.name)) ?? undefined;
    }

    return {
      ...contact,
      name,
    };
  },
});

// Get full email details including body (for agent to read email content)
export const getEmailWithBody = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) return null;

    // Get email body
    const emailBody = await ctx.db
      .query("emailBodies")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    // Get contact info
    const contact = await ctx.db.get(email.from);

    // Get summary
    const summary = await ctx.db
      .query("emailSummaries")
      .withIndex("by_email", (q) => q.eq("emailId", args.emailId))
      .first();

    // Decrypt PII fields
    const pii = await encryptedPii.forUserQuery(ctx, email.userId);

    let subject = "";
    let bodyPreview = "";
    let bodyFull: string | undefined;
    let fromName: string | undefined;
    let summaryText: string | undefined;
    let deadlineDescription: string | undefined;

    if (pii) {
      subject = (await pii.decrypt(email.subject)) ?? "";
      bodyPreview = (await pii.decrypt(email.bodyPreview)) ?? "";
      if (emailBody?.bodyFull) {
        bodyFull = (await pii.decrypt(emailBody.bodyFull)) ?? undefined;
      }
      if (contact?.name) {
        fromName = (await pii.decrypt(contact.name)) ?? undefined;
      }
      if (summary?.summary) {
        summaryText = (await pii.decrypt(summary.summary)) ?? undefined;
      }
      if (summary?.deadlineDescription) {
        deadlineDescription = (await pii.decrypt(summary.deadlineDescription)) ?? undefined;
      }
    }

    return {
      _id: email._id,
      subject,
      bodyPreview,
      bodyFull,
      fromName,
      fromEmail: contact?.email,
      receivedAt: email.receivedAt,
      summary: summaryText,
      urgencyScore: summary?.urgencyScore,
      calendarEvent: summary?.calendarEvent,
      deadline: summary?.deadline,
      deadlineDescription,
    };
  },
});

// Get emails that have summaries but no embeddings
export const getEmailsNeedingEmbeddings = internalQuery({
  args: { userId: v.id("users"), limit: v.number() },
  handler: async (ctx, args) => {
    // Get all emails for user
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const needsEmbedding: Id<"emails">[] = [];

    for (const email of emails) {
      if (needsEmbedding.length >= args.limit) break;

      const summary = await ctx.db
        .query("emailSummaries")
        .withIndex("by_email", (q) => q.eq("emailId", email._id))
        .first();

      // Has summary but no embedding
      if (summary && !summary.embedding) {
        needsEmbedding.push(email._id);
      }
    }

    return needsEmbedding;
  },
});
