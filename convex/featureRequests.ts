import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
    await ctx.db.patch(args.id, {
      status: "failed",
      completedAt: Date.now(),
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
