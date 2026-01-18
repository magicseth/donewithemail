import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

/**
 * Get emails from last 2 weeks that haven't been triaged
 * These are candidates for missed todos detection
 */
export const getRecentUntriagedEmails = internalQuery({
  args: {
    userId: v.id("users"),
    sinceTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user_untriaged", (q) =>
        q.eq("userId", args.userId).eq("isTriaged", false)
      )
      .filter((q) => q.gte(q.field("receivedAt"), args.sinceTimestamp))
      .collect();

    // Fetch contact info for each email so we can get the sender's email
    const emailsWithSender = await Promise.all(
      emails.map(async (email) => {
        const fromContact = await ctx.db.get(email.from);
        return {
          _id: email._id,
          subject: email.subject,
          bodyPreview: email.bodyPreview,
          threadId: email.threadId,
          receivedAt: email.receivedAt,
          fromEmail: fromContact?.email || "",
          fromName: fromContact?.name,
        };
      })
    );

    return emailsWithSender;
  },
});

/**
 * Check if user has replied to a thread
 *
 * Now that sent emails are synced, we can directly check for outgoing emails in the thread.
 * Falls back to heuristics if direction field isn't set (for older emails).
 */
export const hasUserRepliedToThread = internalQuery({
  args: {
    userId: v.id("users"),
    threadId: v.string(),
    userEmail: v.string(),
    emailTimestamp: v.number(), // The timestamp of the email we're checking
    originalSenderEmail: v.string(), // The sender of the email we're checking
  },
  handler: async (ctx, args) => {
    // Get all emails in the thread
    const threadEmails = await ctx.db
      .query("emails")
      .withIndex("by_thread", (q) =>
        q.eq("userId", args.userId).eq("threadId", args.threadId)
      )
      .collect();

    // Check if any email in thread is outgoing (user sent it)
    for (const email of threadEmails) {
      if (email.direction === "outgoing") {
        return true;
      }
    }

    // Fallback: Check if any email in thread is FROM the user (for older emails without direction)
    for (const email of threadEmails) {
      if (!email.direction) {
        const fromContact = await ctx.db.get(email.from);
        if (fromContact?.email?.toLowerCase() === args.userEmail.toLowerCase()) {
          return true;
        }
      }
    }

    // Fallback heuristic: Check if there are newer emails from the SAME sender
    // If the original sender followed up, user likely already replied or it's stale
    for (const email of threadEmails) {
      if (email.receivedAt > args.emailTimestamp) {
        const fromContact = await ctx.db.get(email.from);
        if (fromContact?.email?.toLowerCase() === args.originalSenderEmail.toLowerCase()) {
          return true;
        }
      }
    }

    return false;
  },
});

/**
 * Mark an email as needing a reply (adds to TODOs)
 */
export const markAsReplyNeeded = internalMutation({
  args: {
    emailId: v.id("emails"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailId, {
      isTriaged: true,
      triageAction: "reply_needed",
      triagedAt: Date.now(),
    });
  },
});

/**
 * Get user by email - for workflow to get user info
 */
export const getUserByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    return user;
  },
});
