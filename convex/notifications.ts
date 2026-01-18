import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { components } from "./_generated/api";
import { PushNotifications } from "@convex-dev/expo-push-notifications";

// Initialize push notifications client
const pushNotifications = new PushNotifications(components.pushNotifications);

// Register a push token for a user
export const registerPushToken = mutation({
  args: {
    pushToken: v.string(),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Record the token using the component
    await pushNotifications.recordToken(ctx, {
      userId: user._id,
      pushToken: args.pushToken,
    });

    return { success: true };
  },
});

// Send notification for new emails (legacy - use sendHighPriorityNotification instead)
export const sendNewEmailNotification = internalMutation({
  args: {
    userId: v.id("users"),
    emailCount: v.number(),
    senderName: v.optional(v.string()),
    subject: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const title = args.emailCount === 1
      ? `New email from ${args.senderName || "someone"}`
      : `${args.emailCount} new emails`;

    const body = args.emailCount === 1 && args.subject
      ? args.subject
      : undefined;

    await pushNotifications.sendPushNotification(ctx, {
      userId: args.userId,
      notification: {
        title,
        body,
        data: { type: "new_email" },
      },
    });
  },
});

// Send notification for missed TODOs found
export const sendMissedTodosNotification = internalMutation({
  args: {
    userId: v.id("users"),
    foundCount: v.number(),
  },
  handler: async (ctx, args) => {
    // Don't send notification if no missed todos found
    if (args.foundCount === 0) {
      return;
    }

    const title = "Missed TODOs Found";
    const body = `Found ${args.foundCount} email${args.foundCount > 1 ? "s" : ""} that may need a response`;

    await pushNotifications.sendPushNotification(ctx, {
      userId: args.userId,
      notification: {
        title,
        body,
        data: {
          type: "missed_todos",
          count: args.foundCount,
        },
      },
    });
  },
});

// Send notification only for high priority emails (after AI processing)
export const sendHighPriorityNotification = internalMutation({
  args: {
    userId: v.id("users"),
    highPriorityCount: v.number(),
    totalCount: v.number(),
    mostUrgentSubject: v.optional(v.string()),
    mostUrgentSender: v.optional(v.string()),
    mostUrgentSenderAvatar: v.optional(v.string()),
    mostUrgentEmailId: v.optional(v.id("emails")),
    urgencyScore: v.number(),
  },
  handler: async (ctx, args) => {
    // Build notification based on urgency and count
    let title: string;
    let body: string | undefined;

    if (args.highPriorityCount === 1) {
      title = `Urgent: ${args.mostUrgentSender || "New email"}`;
      body = args.mostUrgentSubject;
    } else {
      title = `${args.highPriorityCount} urgent emails need attention`;
      body = args.mostUrgentSubject
        ? `Including: ${args.mostUrgentSubject}`
        : undefined;
    }

    await pushNotifications.sendPushNotification(ctx, {
      userId: args.userId,
      notification: {
        title,
        body,
        // Enable mutableContent so iOS Notification Service Extension can add the avatar
        mutableContent: args.mostUrgentSenderAvatar ? true : undefined,
        data: {
          type: "high_priority_email",
          urgencyScore: args.urgencyScore,
          highPriorityCount: args.highPriorityCount,
          emailId: args.mostUrgentEmailId,
          senderAvatar: args.mostUrgentSenderAvatar,
        },
      },
    });
  },
});
