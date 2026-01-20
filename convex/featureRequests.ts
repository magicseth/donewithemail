import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { PushNotifications } from "@convex-dev/expo-push-notifications";

// Initialize push notifications client
const pushNotifications = new PushNotifications(components.pushNotifications);

/**
 * Submit a new feature request from voice recording
 */
export const submit = mutation({
  args: {
    transcript: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user - try by workosId first, then fall back to email
    const workosId = identity.subject;
    let user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", workosId))
      .first();

    if (!user && identity.email) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email!))
        .first();
    }

    if (!user) {
      throw new Error("User not found");
    }

    const id = await ctx.db.insert("featureRequests", {
      userId: user._id,
      transcript: args.transcript,
      status: "pending",
      createdAt: Date.now(),
    });

    return { id };
  },
});

/**
 * Get pending feature requests (for local watcher)
 */
export const getPending = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("featureRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(10);
  },
});

/**
 * Mark a feature request as processing (called by local watcher)
 */
export const markProcessing = mutation({
  args: {
    id: v.id("featureRequests"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "processing",
      startedAt: Date.now(),
    });
  },
});

/**
 * Update Claude output on a feature request (called by local watcher)
 */
export const updateClaudeOutput = mutation({
  args: {
    id: v.id("featureRequests"),
    claudeOutput: v.string(),
    claudeSuccess: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      claudeOutput: args.claudeOutput,
      claudeSuccess: args.claudeSuccess,
    });
  },
});

/**
 * Update progress on a feature request (called by local watcher)
 */
export const updateProgress = mutation({
  args: {
    id: v.id("featureRequests"),
    progressStep: v.union(
      v.literal("cloning"),
      v.literal("implementing"),
      v.literal("pushing"),
      v.literal("merging"),
      v.literal("deploying_backend"),
      v.literal("uploading"),
      v.literal("ready")
    ),
    progressMessage: v.string(),
    branchName: v.optional(v.string()),
    commitHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      progressStep: args.progressStep,
      progressMessage: args.progressMessage,
    };
    if (args.branchName) updates.branchName = args.branchName;
    if (args.commitHash) updates.commitHash = args.commitHash;
    await ctx.db.patch(args.id, updates);
  },
});

/**
 * Mark a feature request as completed
 */
export const markCompleted = mutation({
  args: {
    id: v.id("featureRequests"),
    commitHash: v.optional(v.string()),
    branchName: v.optional(v.string()),
    easUpdateId: v.optional(v.string()),
    easUpdateMessage: v.optional(v.string()),
    easDashboardUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) {
      throw new Error("Feature request not found");
    }

    await ctx.db.patch(args.id, {
      status: "completed",
      progressStep: "ready",
      progressMessage: "Ready for testing!",
      completedAt: Date.now(),
      commitHash: args.commitHash,
      branchName: args.branchName,
      easUpdateId: args.easUpdateId,
      easUpdateMessage: args.easUpdateMessage,
      easDashboardUrl: args.easDashboardUrl,
    });

    // Send notification to user
    await ctx.scheduler.runAfter(0, internal.featureRequests.sendFeatureCompletedNotification, {
      userId: request.userId,
      transcript: request.transcript,
    });
  },
});

/**
 * Mark a feature request as failed
 */
export const markFailed = mutation({
  args: {
    id: v.id("featureRequests"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) {
      throw new Error("Feature request not found");
    }

    await ctx.db.patch(args.id, {
      status: "failed",
      completedAt: Date.now(),
      error: args.error,
    });

    // Send notification to user
    await ctx.scheduler.runAfter(0, internal.featureRequests.sendFeatureFailedNotification, {
      userId: request.userId,
      transcript: request.transcript,
      error: args.error,
    });
  },
});

/**
 * Get my feature requests
 */
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get user - try by workosId first, then fall back to email
    const workosId = identity.subject;
    let user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", workosId))
      .first();

    if (!user && identity.email) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email!))
        .first();
    }

    if (!user) {
      return [];
    }

    return await ctx.db
      .query("featureRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(20);
  },
});

/**
 * Cancel a pending feature request
 */
export const cancel = mutation({
  args: {
    id: v.id("featureRequests"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.id);
    if (!request) {
      throw new Error("Feature request not found");
    }

    // Verify ownership by checking user
    const workosId = identity.subject;
    let user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", workosId))
      .first();

    if (!user && identity.email) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email!))
        .first();
    }

    if (!user || request.userId !== user._id) {
      throw new Error("Not authorized to cancel this request");
    }

    // Only allow cancelling pending requests
    if (request.status !== "pending") {
      throw new Error("Can only cancel pending requests");
    }

    // Delete the request
    await ctx.db.delete(args.id);

    return { success: true };
  },
});

// =============================================================================
// Internal Mutations (for notifications)
// =============================================================================

/**
 * Send notification when a feature request is completed
 */
export const sendFeatureCompletedNotification = internalMutation({
  args: {
    userId: v.id("users"),
    transcript: v.string(),
  },
  handler: async (ctx, args) => {
    const truncatedTranscript = args.transcript.length > 50
      ? args.transcript.slice(0, 47) + "..."
      : args.transcript;

    await pushNotifications.sendPushNotification(ctx, {
      userId: args.userId,
      notification: {
        title: "Feature Ready!",
        body: truncatedTranscript,
        data: {
          type: "feature_completed",
        },
      },
    });
  },
});

/**
 * Send notification when a feature request fails
 */
export const sendFeatureFailedNotification = internalMutation({
  args: {
    userId: v.id("users"),
    transcript: v.string(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const truncatedTranscript = args.transcript.length > 40
      ? args.transcript.slice(0, 37) + "..."
      : args.transcript;

    await pushNotifications.sendPushNotification(ctx, {
      userId: args.userId,
      notification: {
        title: "Feature Failed",
        body: truncatedTranscript,
        data: {
          type: "feature_failed",
          error: args.error,
        },
      },
    });
  },
});
