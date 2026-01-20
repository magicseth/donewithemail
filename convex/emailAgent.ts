"use node";

import { v } from "convex/values";
import { action, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { emailQAAgent } from "./agents/emailQA";
import { Doc } from "./_generated/dataModel";

// Helper to get authenticated user in actions
async function getAuthenticatedUser(ctx: ActionCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user: Doc<"users"> | null = await ctx.runQuery(internal.users.getUserForAuth, {
    workosId: identity.subject,
    email: identity.email,
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

// Start a new chat with the email agent
export const startChat = action({
  args: {
    message: v.string(),
  },
  handler: async (ctx, args): Promise<{ threadId: string; response: string }> => {
    const user = await getAuthenticatedUser(ctx);

    // Create a new thread for this conversation
    const { threadId } = await emailQAAgent.createThread(ctx, {
      userId: user._id,
    });

    // Generate response using the agent's generateText method directly
    // Note: Using 'as any' to bypass complex generic type inference issues with tools
    const result = await emailQAAgent.generateText(
      ctx,
      { threadId, userId: user._id },
      { prompt: args.message } as any
    );

    return {
      threadId,
      response: result.text,
    };
  },
});

// Continue an existing chat thread
export const continueChat = action({
  args: {
    threadId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<{ response: string }> => {
    const user = await getAuthenticatedUser(ctx);

    // Generate response using the agent's generateText method directly
    // Note: Using 'as any' to bypass complex generic type inference issues with tools
    const result = await emailQAAgent.generateText(
      ctx,
      { threadId: args.threadId, userId: user._id },
      { prompt: args.message } as any
    );

    return {
      response: result.text,
    };
  },
});

// Backfill embeddings for existing emails (admin/debug action)
export const backfillEmbeddings = action({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ processed: number }> => {
    const user = await getAuthenticatedUser(ctx);

    const result: { processed: number } = await ctx.runAction(internal.emailEmbeddings.backfillEmbeddings, {
      userId: user._id,
      batchSize: args.batchSize,
    });

    return result;
  },
});
