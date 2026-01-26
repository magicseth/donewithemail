"use node";

import { v } from "convex/values";
import { action, internalAction, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { emailQAAgent } from "./agents/emailQA";
import { Doc } from "./_generated/dataModel";
import { stepCountIs } from "@convex-dev/agent";
import { costs } from "./costs";

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
  handler: async (ctx, args): Promise<{ threadId: string; response: string; toolResults?: any[] }> => {
    const user = await getAuthenticatedUser(ctx);

    // Create a title from the user's message (truncate to 60 chars)
    const title = args.message.length > 60
      ? args.message.substring(0, 57) + "..."
      : args.message;

    // Create a new thread for this conversation
    const { threadId } = await emailQAAgent.createThread(ctx, {
      userId: user._id,
      title,
    });

    // Generate response using the agent's generateText method directly
    // Note: Using 'as any' to bypass complex generic type inference issues with tools
    console.log(`[EmailAgent] Starting chat for user ${user._id}, threadId: ${threadId}`);
    console.log(`[EmailAgent] User message: ${args.message}`);

    try {
      const result = await emailQAAgent.generateText(
        ctx,
        { threadId, userId: user._id },
        { prompt: args.message, stopWhen: stepCountIs(5) } as any
      );

      console.log(`[EmailAgent] Got response (full):`, result.text);
      console.log(`[EmailAgent] Steps:`, result.steps?.length ?? 0);
      console.log(`[EmailAgent] Tool calls (last step):`, result.toolCalls?.length ?? 0);
      console.log(`[EmailAgent] Tool results (last step):`, result.toolResults?.length ?? 0);

      // Collect all tool results from all steps (not just the last step)
      // AI SDK v5 uses 'input' and 'output' instead of 'args' and 'result'
      const allToolResults: any[] = [];
      if (result.steps) {
        for (const step of result.steps) {
          if (step.toolResults && step.toolResults.length > 0) {
            for (const toolResult of step.toolResults) {
              // Cast to any to access input/output since TypeScript union types are tricky
              const tr = toolResult as any;
              allToolResults.push({
                toolName: tr.toolName,
                args: tr.input ?? tr.args,
                result: tr.output ?? tr.result,
              });
            }
          }
        }
      }
      console.log(`[EmailAgent] All tool results from all steps:`, allToolResults.length);

      // Track AI cost
      try {
        const usage = result.usage;
        if (usage) {
          const inputTokens = usage.inputTokens ?? 0;
          const outputTokens = usage.outputTokens ?? 0;
          await costs.addAICost(ctx, {
            messageId: `agent-chat-${threadId}-${Date.now()}`,
            userId: user._id,
            threadId: threadId,
            usage: {
              promptTokens: inputTokens,
              completionTokens: outputTokens,
              totalTokens: inputTokens + outputTokens,
            },
            modelId: "claude-sonnet-4-20250514",
            providerId: "anthropic",
          });
        }
      } catch (e) {
        console.error("[EmailAgent] Failed to track cost:", e);
      }

      // Return tool results for frontend to show visual feedback
      return {
        threadId,
        response: result.text,
        toolResults: allToolResults,
      };
    } catch (error) {
      console.error(`[EmailAgent] Error generating response:`, error);
      throw error;
    }
  },
});

// Continue an existing chat thread
export const continueChat = action({
  args: {
    threadId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<{ response: string; toolResults?: any[] }> => {
    const user = await getAuthenticatedUser(ctx);

    // Generate response using the agent's generateText method directly
    // Note: Using 'as any' to bypass complex generic type inference issues with tools
    const result = await emailQAAgent.generateText(
      ctx,
      { threadId: args.threadId, userId: user._id },
      { prompt: args.message, stopWhen: stepCountIs(5) } as any
    );

    // Collect all tool results from all steps (not just the last step)
    // AI SDK v5 uses 'input' and 'output' instead of 'args' and 'result'
    const allToolResults: any[] = [];
    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolResults && step.toolResults.length > 0) {
          for (const toolResult of step.toolResults) {
            // Cast to any to access input/output since TypeScript union types are tricky
            const tr = toolResult as any;
            allToolResults.push({
              toolName: tr.toolName,
              args: tr.input ?? tr.args,
              result: tr.output ?? tr.result,
            });
          }
        }
      }
    }

    // Track AI cost
    try {
      const usage = result.usage;
      if (usage) {
        const inputTokens = usage.inputTokens ?? 0;
        const outputTokens = usage.outputTokens ?? 0;
        await costs.addAICost(ctx, {
          messageId: `agent-chat-${args.threadId}-${Date.now()}`,
          userId: user._id,
          threadId: args.threadId,
          usage: {
            promptTokens: inputTokens,
            completionTokens: outputTokens,
            totalTokens: inputTokens + outputTokens,
          },
          modelId: "claude-sonnet-4-20250514",
          providerId: "anthropic",
        });
      }
    } catch (e) {
      console.error("[EmailAgent] Failed to track cost:", e);
    }

    return {
      response: result.text,
      toolResults: allToolResults,
    };
  },
});

// Search emails for UI - allows the UI to get search results before the AI response
// This is used to show relevant emails immediately while the AI generates its response
export const searchEmailsForUI = action({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args): Promise<{ emails: Array<{ emailId: string; subject: string; from: string; receivedAt: string }> }> => {
    const user = await getAuthenticatedUser(ctx);

    console.log(`[SearchEmailsForUI] Query: "${args.query}", userId: ${user._id}`);

    try {
      const results = await ctx.runAction(internal.emailEmbeddings.searchSimilarEmails, {
        query: args.query,
        userId: user._id,
        limit: 5,
      });

      console.log(`[SearchEmailsForUI] Got ${results.length} results`);

      const emails = results.map((r: any) => ({
        emailId: r.emailId,
        subject: r.subject,
        from: r.fromName || r.fromEmail || "Unknown",
        receivedAt: new Date(r.receivedAt).toLocaleDateString(),
      }));

      return { emails };
    } catch (error) {
      console.error(`[SearchEmailsForUI] Error:`, error);
      return { emails: [] };
    }
  },
});

// Backfill embeddings for existing emails (internal action - run via CLI or dashboard)
export const backfillEmbeddings = internalAction({
  args: {
    userId: v.id("users"),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ processed: number }> => {
    const result: { processed: number } = await ctx.runAction(internal.emailEmbeddings.backfillEmbeddings, {
      userId: args.userId,
      batchSize: args.batchSize,
    });

    return result;
  },
});
