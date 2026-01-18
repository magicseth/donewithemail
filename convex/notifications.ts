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

// Send notification for new emails
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
