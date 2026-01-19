import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { PushNotifications } from "@convex-dev/expo-push-notifications";

// Hours after marking "reply_needed" before sending first reminder
const STALE_REPLY_HOURS = 24;
// Hours between subsequent reminders
const REMINDER_INTERVAL_HOURS = 24;

// Get emails marked reply_needed that haven't been replied to
export const getStaleReplyNeededEmails = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const staleThreshold = now - STALE_REPLY_HOURS * 60 * 60 * 1000;
    const reminderThreshold = now - REMINDER_INTERVAL_HOURS * 60 * 60 * 1000;

    // Get all users
    const users = await ctx.db.query("users").collect();

    const staleEmails: Array<{
      userId: string;
      userEmail: string;
      emailId: string;
      subject: string;
      senderName: string;
      triagedAt: number;
    }> = [];

    for (const user of users) {
      // Get reply_needed emails for this user that are old enough
      const emails = await ctx.db
        .query("emails")
        .withIndex("by_user_reply_needed", (q) =>
          q.eq("userId", user._id).eq("triageAction", "reply_needed")
        )
        .collect();

      for (const email of emails) {
        // Skip if triaged too recently
        if (!email.triagedAt || email.triagedAt > staleThreshold) {
          continue;
        }

        // Skip if we sent a reminder recently
        if (email.lastReminderAt && email.lastReminderAt > reminderThreshold) {
          continue;
        }

        // Get sender info
        const contact = await ctx.db.get(email.from);

        staleEmails.push({
          userId: user._id,
          userEmail: user.email,
          emailId: email._id,
          subject: email.subject,
          senderName: contact?.name || contact?.email || "Unknown",
          triagedAt: email.triagedAt,
        });
      }
    }

    return staleEmails;
  },
});

// Mark that we sent a reminder for an email
export const markReminderSent = internalMutation({
  args: {
    emailId: v.id("emails"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailId, {
      lastReminderAt: Date.now(),
    });
  },
});

// Get upcoming deadlines that need reminders
export const getUpcomingDeadlines = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    // Look for deadlines in the next 24 hours
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Get all summaries with deadlines
    const summaries = await ctx.db
      .query("emailSummaries")
      .withIndex("by_deadline")
      .collect();

    const upcomingDeadlines: Array<{
      userId: string;
      userEmail: string;
      emailId: string;
      subject: string;
      deadline: string;
      deadlineDescription: string;
      summaryId: string;
    }> = [];

    for (const summary of summaries) {
      if (!summary.deadline || summary.deadlineReminderSent) {
        continue;
      }

      const deadlineDate = new Date(summary.deadline);

      // Skip if deadline is in the past or more than 24h away
      if (deadlineDate < now || deadlineDate > tomorrow) {
        continue;
      }

      // Get the email and user info
      const email = await ctx.db.get(summary.emailId);
      if (!email) continue;

      const user = await ctx.db.get(email.userId);
      if (!user) continue;

      upcomingDeadlines.push({
        userId: user._id,
        userEmail: user.email,
        emailId: summary.emailId,
        subject: email.subject,
        deadline: summary.deadline,
        deadlineDescription: summary.deadlineDescription || "Deadline",
        summaryId: summary._id,
      });
    }

    return upcomingDeadlines;
  },
});

// Mark that we sent a deadline reminder
export const markDeadlineReminderSent = internalMutation({
  args: {
    summaryId: v.id("emailSummaries"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.summaryId, {
      deadlineReminderSent: true,
    });
  },
});

// Initialize push notifications client
const pushNotifications = new PushNotifications(components.pushNotifications);

// Send reminder for stale reply_needed email
export const sendStaleReplyReminder = internalMutation({
  args: {
    userId: v.id("users"),
    subject: v.string(),
    senderName: v.string(),
  },
  handler: async (ctx, args) => {
    await pushNotifications.sendPushNotification(ctx, {
      userId: args.userId,
      notification: {
        title: "Reply needed",
        body: `Don't forget to reply to ${args.senderName}: ${args.subject}`,
        data: {
          type: "stale_reply_reminder",
        },
      },
    });
  },
});

// Send reminder for upcoming deadline
export const sendDeadlineReminder = internalMutation({
  args: {
    userId: v.id("users"),
    subject: v.string(),
    deadlineDescription: v.string(),
    deadline: v.string(),
  },
  handler: async (ctx, args) => {
    // Format the deadline nicely
    const deadlineDate = new Date(args.deadline);
    const timeStr = deadlineDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    await pushNotifications.sendPushNotification(ctx, {
      userId: args.userId,
      notification: {
        title: `⏰ ${args.deadlineDescription}`,
        body: `"${args.subject}" - due ${timeStr}`,
        data: {
          type: "deadline_reminder",
        },
      },
    });
  },
});

// Type for stale email
interface StaleEmail {
  userId: string;
  userEmail: string;
  emailId: string;
  subject: string;
  senderName: string;
  triagedAt: number;
}

// Type for upcoming deadline
interface UpcomingDeadline {
  userId: string;
  userEmail: string;
  emailId: string;
  subject: string;
  deadline: string;
  deadlineDescription: string;
  summaryId: string;
}

// Main function to check and send all reminders
export const checkAndSendReminders = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ staleReminders: number; deadlineReminders: number }> => {
    // Check for stale reply_needed emails
    const staleEmails: StaleEmail[] = await ctx.runQuery(internal.reminders.getStaleReplyNeededEmails, {});

    console.log(`[Reminders] Found ${staleEmails.length} stale reply_needed emails`);

    for (const email of staleEmails) {
      try {
        await ctx.runMutation(internal.reminders.sendStaleReplyReminder, {
          userId: email.userId as any,
          subject: email.subject,
          senderName: email.senderName,
        });
        await ctx.runMutation(internal.reminders.markReminderSent, {
          emailId: email.emailId as any,
        });
        console.log(`[Reminders] Sent stale reply reminder for: ${email.subject}`);
      } catch (error) {
        console.error(`[Reminders] Failed to send reminder for ${email.emailId}:`, error);
      }
    }

    // Check for upcoming deadlines
    const upcomingDeadlines: UpcomingDeadline[] = await ctx.runQuery(internal.reminders.getUpcomingDeadlines, {});

    console.log(`[Reminders] Found ${upcomingDeadlines.length} upcoming deadlines`);

    for (const deadline of upcomingDeadlines) {
      try {
        await ctx.runMutation(internal.reminders.sendDeadlineReminder, {
          userId: deadline.userId as any,
          subject: deadline.subject,
          deadlineDescription: deadline.deadlineDescription,
          deadline: deadline.deadline,
        });
        await ctx.runMutation(internal.reminders.markDeadlineReminderSent, {
          summaryId: deadline.summaryId as any,
        });
        console.log(`[Reminders] Sent deadline reminder for: ${deadline.subject}`);
      } catch (error) {
        console.error(`[Reminders] Failed to send deadline reminder for ${deadline.emailId}:`, error);
      }
    }

    return {
      staleReminders: staleEmails.length,
      deadlineReminders: upcomingDeadlines.length,
    };
  },
});
