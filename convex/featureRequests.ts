import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { PushNotifications } from "@convex-dev/expo-push-notifications";
import { encryptedPii } from "./pii";

// Debug query to list recent feature requests (internal only)
export const debugListRecent = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const requests = await ctx.db
      .query("featureRequests")
      .order("desc")
      .take(limit);

    // Return raw data with encrypted fields (they'll show as encrypted strings)
    return requests.map((req) => ({
      _id: req._id,
      status: req.status,
      progressStep: req.progressStep,
      createdAt: new Date(req.createdAt).toISOString(),
      startedAt: req.startedAt ? new Date(req.startedAt).toISOString() : null,
      completedAt: req.completedAt ? new Date(req.completedAt).toISOString() : null,
      branchName: req.branchName,
      commitHash: req.commitHash,
      easUpdateId: req.easUpdateId,
      claudeSuccess: req.claudeSuccess,
      // Encrypted fields - will show encrypted values
      transcript: req.transcript,
      error: req.error,
      progressMessage: req.progressMessage,
    }));
  },
});

// Initialize push notifications client
const pushNotifications = new PushNotifications(components.pushNotifications);

/**
 * Submit a new feature request from voice recording
 */
export const submit = mutation({
  args: {
    transcript: v.string(),
    debugLogs: v.optional(v.string()),
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

    // Get PII helper for encrypting transcript and debug logs
    const pii = await encryptedPii.forUser(ctx, user._id);
    const encryptedTranscript = await pii.encrypt(args.transcript);
    const encryptedDebugLogs = args.debugLogs
      ? await pii.encrypt(args.debugLogs)
      : undefined;

    const id = await ctx.db.insert("featureRequests", {
      userId: user._id,
      transcript: encryptedTranscript,
      status: "pending",
      createdAt: Date.now(),
      debugLogs: encryptedDebugLogs,
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
    const requests = await ctx.db
      .query("featureRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(10);

    // Decrypt transcripts and debug logs for each request
    return Promise.all(
      requests.map(async (req) => {
        const pii = await encryptedPii.forUserQuery(ctx, req.userId);
        let transcript = "";
        let debugLogs: string | undefined;
        if (pii) {
          transcript = (await pii.decrypt(req.transcript)) ?? "";
          if (req.debugLogs) {
            debugLogs = (await pii.decrypt(req.debugLogs)) ?? undefined;
          }
        }
        return {
          _id: req._id,
          userId: req.userId,
          transcript,
          debugLogs,
          status: req.status,
          createdAt: req.createdAt,
        };
      })
    );
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
    const request = await ctx.db.get(args.id);
    if (!request) {
      throw new Error("Feature request not found");
    }

    // Get PII helper for encrypting Claude output
    const pii = await encryptedPii.forUser(ctx, request.userId);
    const encryptedOutput = await pii.encrypt(args.claudeOutput);

    await ctx.db.patch(args.id, {
      claudeOutput: encryptedOutput,
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
    const request = await ctx.db.get(args.id);
    if (!request) {
      throw new Error("Feature request not found");
    }

    // Get PII helper for encrypting progress message
    const pii = await encryptedPii.forUser(ctx, request.userId);
    const encryptedProgressMessage = await pii.encrypt(args.progressMessage);

    const updates: Record<string, unknown> = {
      progressStep: args.progressStep,
      progressMessage: encryptedProgressMessage,
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

    // Get PII helper for encrypting progress message and decrypting transcript
    const pii = await encryptedPii.forUser(ctx, request.userId);
    const encryptedProgressMessage = await pii.encrypt("Ready for testing!");

    // Decrypt transcript for notification
    const decryptedTranscript = await pii.decrypt(request.transcript);

    await ctx.db.patch(args.id, {
      status: "completed",
      progressStep: "ready",
      progressMessage: encryptedProgressMessage,
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
      transcript: decryptedTranscript || "Feature request",
    });

    // Add changelog entry for the new feature
    await ctx.scheduler.runAfter(0, internal.changelog.addChangelog, {
      version: "voice",
      title: decryptedTranscript?.slice(0, 100) || "New feature",
      description: decryptedTranscript || "A new feature has been added based on your request.",
      type: "feature" as const,
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

    // Get PII helper for encrypting error and decrypting transcript
    const pii = await encryptedPii.forUser(ctx, request.userId);
    const encryptedError = await pii.encrypt(args.error);

    // Decrypt transcript for notification
    const decryptedTranscript = await pii.decrypt(request.transcript);

    await ctx.db.patch(args.id, {
      status: "failed",
      completedAt: Date.now(),
      error: encryptedError,
    });

    // Send notification to user
    await ctx.scheduler.runAfter(0, internal.featureRequests.sendFeatureFailedNotification, {
      userId: request.userId,
      transcript: decryptedTranscript || "Feature request",
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

    const requests = await ctx.db
      .query("featureRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(20);

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, user._id);

    // Decrypt PII fields for each request
    return Promise.all(
      requests.map(async (req) => {
        let transcript = "";
        let error: string | undefined;
        let progressMessage: string | undefined;
        let claudeOutput: string | undefined;
        let debugLogs: string | undefined;

        if (pii) {
          transcript = (await pii.decrypt(req.transcript)) ?? "";
          if (req.error) {
            error = (await pii.decrypt(req.error)) ?? undefined;
          }
          if (req.progressMessage) {
            progressMessage = (await pii.decrypt(req.progressMessage)) ?? undefined;
          }
          if (req.claudeOutput) {
            claudeOutput = (await pii.decrypt(req.claudeOutput)) ?? undefined;
          }
          if (req.debugLogs) {
            debugLogs = (await pii.decrypt(req.debugLogs)) ?? undefined;
          }
        }

        return {
          _id: req._id,
          _creationTime: req._creationTime,
          userId: req.userId,
          transcript,
          status: req.status,
          createdAt: req.createdAt,
          startedAt: req.startedAt,
          completedAt: req.completedAt,
          progressStep: req.progressStep,
          progressMessage,
          branchName: req.branchName,
          commitHash: req.commitHash,
          error,
          claudeOutput,
          claudeSuccess: req.claudeSuccess,
          easUpdateId: req.easUpdateId,
          easUpdateMessage: req.easUpdateMessage,
          easDashboardUrl: req.easDashboardUrl,
          combinedIntoId: req.combinedIntoId,
          debugLogs,
        };
      })
    );
  },
});

/**
 * Mark a feature request as combined into another request
 */
export const markCombined = mutation({
  args: {
    id: v.id("featureRequests"),
    combinedIntoId: v.id("featureRequests"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "combined",
      combinedIntoId: args.combinedIntoId,
      completedAt: Date.now(),
    });
  },
});

/**
 * Update transcript for a feature request (used when combining requests)
 */
export const updateTranscript = mutation({
  args: {
    id: v.id("featureRequests"),
    transcript: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.id);
    if (!request) {
      throw new Error("Feature request not found");
    }

    // Get PII helper for encrypting transcript
    const pii = await encryptedPii.forUser(ctx, request.userId);
    const encryptedTranscript = await pii.encrypt(args.transcript);

    await ctx.db.patch(args.id, {
      transcript: encryptedTranscript,
    });
  },
});

/**
 * Cancel a pending or processing feature request
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

    // Only allow cancelling pending or processing requests
    if (request.status !== "pending" && request.status !== "processing") {
      throw new Error("Can only cancel pending or processing requests");
    }

    // Get PII helper for encrypting error message
    const pii = await encryptedPii.forUser(ctx, request.userId);
    const encryptedError = await pii.encrypt("Cancelled by user");

    // Mark as cancelled (use "failed" status with specific error message)
    await ctx.db.patch(args.id, {
      status: "failed",
      completedAt: Date.now(),
      error: encryptedError,
    });

    return { success: true };
  },
});

/**
 * Reset failed feature requests back to pending (for retry)
 */
export const retryFailed = mutation({
  args: {},
  handler: async (ctx) => {
    const failed = await ctx.db
      .query("featureRequests")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect();

    let count = 0;
    for (const request of failed) {
      // Skip user-cancelled requests - need to decrypt error to check
      if (request.error) {
        const pii = await encryptedPii.forUser(ctx, request.userId);
        const decryptedError = await pii.decrypt(request.error);
        if (decryptedError === "Cancelled by user") {
          continue;
        }
      }
      await ctx.db.patch(request._id, {
        status: "pending",
        error: undefined,
        completedAt: undefined,
        progressStep: undefined,
        progressMessage: undefined,
        claudeOutput: undefined,
        claudeSuccess: undefined,
      });
      count++;
    }

    return { count };
  },
});

/**
 * Retry a single failed or cancelled feature request
 */
export const retryOne = mutation({
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
      throw new Error("Not authorized to retry this request");
    }

    // Only allow retrying failed requests
    if (request.status !== "failed") {
      throw new Error("Can only retry failed requests");
    }

    // Reset the request to pending
    await ctx.db.patch(args.id, {
      status: "pending",
      error: undefined,
      completedAt: undefined,
      progressStep: undefined,
      progressMessage: undefined,
      claudeOutput: undefined,
      claudeSuccess: undefined,
    });

    return { success: true };
  },
});

// Reset a request back to pending (for stuck requests)
export const resetToPending = internalMutation({
  args: { id: v.id("featureRequests") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "pending",
      startedAt: undefined,
      progressStep: undefined,
      progressMessage: undefined,
      error: undefined,
    });
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
