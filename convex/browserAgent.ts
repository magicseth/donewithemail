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
      console.log(`[BrowserAgent] Steps: ${(result as any).steps?.length ?? 0}`);
      console.log(`[BrowserAgent] Tool results (last step): ${result.toolResults?.length ?? 0}`);

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
      // AI SDK returns tool results in steps array - each step has its own toolResults
      // result.toolResults only contains results from the LAST step
      const browserActions: BrowserAction[] = [];

      // Collect all tool results from all steps
      const allToolResults: any[] = [];
      const steps = (result as any).steps || [];
      for (const step of steps) {
        if (step.toolResults && Array.isArray(step.toolResults)) {
          allToolResults.push(...step.toolResults);
        }
      }
      // Also include toolResults from the top level (last step)
      if (result.toolResults && Array.isArray(result.toolResults)) {
        // Only add if not already included from steps
        for (const tr of result.toolResults) {
          if (!allToolResults.includes(tr)) {
            allToolResults.push(tr);
          }
        }
      }

      console.log(`[BrowserAgent] Processing ${allToolResults.length} total tool results from ${steps.length} steps`);

      for (const toolResult of allToolResults) {
        const tr = toolResult as any;
        console.log(`[BrowserAgent] Tool result:`, JSON.stringify(tr, null, 2));
        // AI SDK v5 puts the tool return value directly in result property
        // The structure is: { toolCallId, toolName, result: { action, ... } }
        const actionData = tr.result ?? tr.output?.value ?? tr.output;
        if (actionData?.action) {
          console.log(`[BrowserAgent] Found browser action: ${actionData.action}`);
          browserActions.push(actionData as BrowserAction);
        }
      }
      console.log(`[BrowserAgent] Extracted ${browserActions.length} browser actions`);

      return {
        threadId,
        response: result.text,
        toolResults: allToolResults,
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
    // AI SDK returns tool results in steps array - each step has its own toolResults
    // result.toolResults only contains results from the LAST step
    const browserActions: BrowserAction[] = [];

    // Collect all tool results from all steps
    const allToolResults: any[] = [];
    const steps = (result as any).steps || [];
    for (const step of steps) {
      if (step.toolResults && Array.isArray(step.toolResults)) {
        allToolResults.push(...step.toolResults);
      }
    }
    // Also include toolResults from the top level (last step)
    if (result.toolResults && Array.isArray(result.toolResults)) {
      // Only add if not already included from steps
      for (const tr of result.toolResults) {
        if (!allToolResults.includes(tr)) {
          allToolResults.push(tr);
        }
      }
    }

    console.log(`[BrowserAgent] Processing ${allToolResults.length} total tool results from ${steps.length} steps`);

    for (const toolResult of allToolResults) {
      const tr = toolResult as any;
      console.log(`[BrowserAgent] Tool result:`, JSON.stringify(tr, null, 2));
      // AI SDK v5 puts the tool return value directly in result property
      // The structure is: { toolCallId, toolName, result: { action, ... } }
      const actionData = tr.result ?? tr.output?.value ?? tr.output;
      if (actionData?.action) {
        console.log(`[BrowserAgent] Found browser action: ${actionData.action}`);
        browserActions.push(actionData as BrowserAction);
      }
    }
    console.log(`[BrowserAgent] Extracted ${browserActions.length} browser actions`);

    return {
      response: result.text,
      toolResults: allToolResults,
      browserActions,
    };
  },
});
