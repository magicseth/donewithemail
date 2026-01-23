"use node";

import { v } from "convex/values";
import { action, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { browserAgent } from "./agents/browserAgent";
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

// Browser action types that the frontend should handle
export interface BrowserAction {
  action: "navigate" | "click" | "fill" | "scroll";
  url?: string;
  target?: string;
  selector?: string;
  value?: string;
  field?: string;
  direction?: "up" | "down" | "top" | "bottom";
  amount?: string;
  reason?: string;
}

// Build a prompt that includes page context
function buildPromptWithContext(
  message: string,
  pageContent?: string,
  pageUrl?: string,
  pageTitle?: string
): string {
  if (!pageUrl && !pageContent) {
    return message;
  }

  let prompt = `Current page information:\n`;
  prompt += `- Title: ${pageTitle || "Untitled"}\n`;
  prompt += `- URL: ${pageUrl || "unknown"}\n`;

  if (pageContent) {
    // Truncate content to avoid token limits
    const maxContentLength = 8000;
    const truncatedContent =
      pageContent.length > maxContentLength
        ? pageContent.substring(0, maxContentLength) + "\n...[content truncated]..."
        : pageContent;
    prompt += `\n--- Page Content ---\n${truncatedContent}\n--- End of Page Content ---\n`;
  }

  prompt += `\nUser request: ${message}`;
  return prompt;
}

// Start a new browser chat session
export const startBrowserChat = action({
  args: {
    message: v.string(),
    pageContent: v.optional(v.string()),
    pageUrl: v.optional(v.string()),
    pageTitle: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ threadId: string; response: string; toolResults?: any[]; browserActions?: BrowserAction[] }> => {
    const user = await getAuthenticatedUser(ctx);

    // Create a title from the user's message
    const title = args.message.length > 60 ? args.message.substring(0, 57) + "..." : args.message;

    // Create a new thread for this conversation
    const { threadId } = await browserAgent.createThread(ctx, {
      userId: user._id,
      title,
    });

    console.log(`[BrowserAgent] Starting chat for user ${user._id}, threadId: ${threadId}`);
    console.log(`[BrowserAgent] User message: ${args.message}`);
    console.log(`[BrowserAgent] Page URL: ${args.pageUrl || "none"}`);

    try {
      // Build context message with page info included in the prompt
      const contextMessage = buildPromptWithContext(
        args.message,
        args.pageContent,
        args.pageUrl,
        args.pageTitle
      );

      const result = await browserAgent.generateText(
        ctx,
        { threadId, userId: user._id },
        { prompt: contextMessage, stopWhen: stepCountIs(5) } as any
      );

      console.log(`[BrowserAgent] Got response: ${result.text.substring(0, 200)}...`);
      console.log(`[BrowserAgent] Tool results: ${result.toolResults?.length ?? 0}`);

      // Track AI cost
      try {
        const usage = result.usage;
        if (usage) {
          const inputTokens = usage.inputTokens ?? 0;
          const outputTokens = usage.outputTokens ?? 0;
          await costs.addAICost(ctx, {
            messageId: `browser-chat-${threadId}-${Date.now()}`,
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
        console.error("[BrowserAgent] Failed to track cost:", e);
      }

      // Extract browser actions from tool results
      const browserActions: BrowserAction[] = [];
      if (result.toolResults) {
        for (const toolResult of result.toolResults) {
          const tr = toolResult as any;
          if (tr.result?.action) {
            browserActions.push(tr.result as BrowserAction);
          }
        }
      }

      return {
        threadId,
        response: result.text,
        toolResults: result.toolResults as any,
        browserActions,
      };
    } catch (error) {
      console.error(`[BrowserAgent] Error generating response:`, error);
      throw error;
    }
  },
});

// Continue an existing browser chat thread
export const continueBrowserChat = action({
  args: {
    threadId: v.string(),
    message: v.string(),
    pageContent: v.optional(v.string()),
    pageUrl: v.optional(v.string()),
    pageTitle: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ response: string; toolResults?: any[]; browserActions?: BrowserAction[] }> => {
    const user = await getAuthenticatedUser(ctx);

    console.log(`[BrowserAgent] Continue chat, threadId: ${args.threadId}`);
    console.log(`[BrowserAgent] User message: ${args.message}`);

    // Build context message with page info included in the prompt
    const contextMessage = buildPromptWithContext(
      args.message,
      args.pageContent,
      args.pageUrl,
      args.pageTitle
    );

    const result = await browserAgent.generateText(
      ctx,
      { threadId: args.threadId, userId: user._id },
      { prompt: contextMessage, stopWhen: stepCountIs(5) } as any
    );

    // Track AI cost
    try {
      const usage = result.usage;
      if (usage) {
        const inputTokens = usage.inputTokens ?? 0;
        const outputTokens = usage.outputTokens ?? 0;
        await costs.addAICost(ctx, {
          messageId: `browser-chat-${args.threadId}-${Date.now()}`,
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
      console.error("[BrowserAgent] Failed to track cost:", e);
    }

    // Extract browser actions from tool results
    const browserActions: BrowserAction[] = [];
    if (result.toolResults) {
      for (const toolResult of result.toolResults) {
        const tr = toolResult as any;
        if (tr.result?.action) {
          browserActions.push(tr.result as BrowserAction);
        }
      }
    }

    return {
      response: result.text,
      toolResults: result.toolResults as any,
      browserActions,
    };
  },
});
