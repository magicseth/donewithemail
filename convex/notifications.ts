import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { components } from "./_generated/api";
import { PushNotifications } from "@convex-dev/expo-push-notifications";
import { authedMutation } from "./functions";

// Initialize push notifications client
const pushNotifications = new PushNotifications(components.pushNotifications);

// =============================================================================
// Internal Mutations (called by workflows, crons, etc.)
// =============================================================================

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
    // Debug: Log avatar URL being sent
    console.log(`[Notification] Sending high priority notification, avatar URL: ${args.mostUrgentSenderAvatar || "none"}`);

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

    const notificationPayload = {
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
          senderName: args.mostUrgentSender,
        },
      },
    };

    console.log(`[Notification] Full payload:`, JSON.stringify(notificationPayload, null, 2));

    await pushNotifications.sendPushNotification(ctx, notificationPayload);
  },
});

// =============================================================================
// Authenticated Mutations (require valid JWT)
// =============================================================================

/**
 * Register a push token for the current authenticated user
 */
export const registerMyPushToken = authedMutation({
  args: {
    pushToken: v.string(),
  },
  handler: async (ctx, args) => {
    // Record the token using the component
    await pushNotifications.recordToken(ctx, {
      userId: ctx.userId,
      pushToken: args.pushToken,
    });

    return { success: true };
  },
});

/**
 * Send a test notification with avatar for the current authenticated user
 */
export const sendMyTestNotificationWithAvatar = authedMutation({
  args: {
    testContactEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let avatarUrl: string;
    let contactName = "Test User";

    // If a test contact email is provided, look up their avatar
    if (args.testContactEmail) {
      const contact = await ctx.db
        .query("contacts")
        .withIndex("by_user_email", (q) =>
          q.eq("userId", ctx.userId).eq("email", args.testContactEmail!)
        )
        .first();

      if (!contact) {
        throw new Error(`Contact not found: ${args.testContactEmail}`);
      }

      contactName = contact.name || contact.email;

      // Get fresh URL from storage if available
      if (contact.avatarStorageId) {
        const freshUrl = await ctx.storage.getUrl(contact.avatarStorageId);
        if (freshUrl) {
          avatarUrl = freshUrl;
          console.log(`[Notification] Using fresh storage URL for ${contact.email}: ${avatarUrl}`);
        } else {
          throw new Error(`Failed to get storage URL for contact: ${args.testContactEmail}`);
        }
      } else if (contact.avatarUrl) {
        avatarUrl = contact.avatarUrl;
        console.log(`[Notification] Using cached avatarUrl for ${contact.email}: ${avatarUrl}`);
      } else {
        throw new Error(`Contact has no avatar: ${args.testContactEmail}`);
      }
    } else {
      // Use a well-known public avatar URL for testing
      avatarUrl = "https://ui-avatars.com/api/?name=Test+User&background=6366F1&color=fff&size=200&bold=true";
    }

    const notificationPayload = {
      userId: ctx.userId,
      notification: {
        title: `Test: ${contactName}`,
        body: "This is a test notification with an avatar",
        mutableContent: true,
        data: {
          type: "test",
          senderAvatar: avatarUrl,
          senderName: contactName,
        },
      },
    };

    console.log(`[Notification] Sending test notification with avatar:`, JSON.stringify(notificationPayload, null, 2));

    await pushNotifications.sendPushNotification(ctx, notificationPayload);

    return { success: true, avatarUrl, contactName };
  },
});

/**
 * Send a test communication notification for the current authenticated user
 */
export const sendMyTestCommunicationNotification = authedMutation({
  args: {
    testContactEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let avatarUrl: string;
    let contactName = "Test User";

    // If a test contact email is provided, look up their avatar
    if (args.testContactEmail) {
      const contact = await ctx.db
        .query("contacts")
        .withIndex("by_user_email", (q) =>
          q.eq("userId", ctx.userId).eq("email", args.testContactEmail!)
        )
        .first();

      if (!contact) {
        throw new Error(`Contact not found: ${args.testContactEmail}`);
      }

      contactName = contact.name || contact.email;

      // Get fresh URL from storage if available
      if (contact.avatarStorageId) {
        const freshUrl = await ctx.storage.getUrl(contact.avatarStorageId);
        if (freshUrl) {
          avatarUrl = freshUrl;
        } else {
          throw new Error(`Failed to get storage URL for contact: ${args.testContactEmail}`);
        }
      } else if (contact.avatarUrl) {
        avatarUrl = contact.avatarUrl;
      } else {
        throw new Error(`Contact has no avatar: ${args.testContactEmail}`);
      }
    } else {
      // Use a well-known public avatar URL for testing
      avatarUrl = "https://ui-avatars.com/api/?name=Test+User&background=6366F1&color=fff&size=200&bold=true";
    }

    const notificationPayload = {
      userId: ctx.userId,
      notification: {
        title: `Comm: ${contactName}`,
        body: "Testing Communication Notification (circular avatar)",
        mutableContent: true,
        data: {
          type: "test_communication",
          senderAvatar: avatarUrl,
          senderName: contactName,
          avatarStyle: "communication",  // This triggers the communication path
        },
      },
    };

    console.log(`[Notification] Sending COMMUNICATION test:`, JSON.stringify(notificationPayload, null, 2));

    await pushNotifications.sendPushNotification(ctx, notificationPayload);

    return { success: true, avatarUrl, contactName, style: "communication" };
  },
});
