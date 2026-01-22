"use node";

import { v } from "convex/values";
import { action, ActionCtx } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { emailQAAgent } from "./agents/emailQA";

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

interface ThreadInfo {
  threadId: string;
  title: string | null;
  createdAt: number;
  firstMessage: string | null;
}

// Helper to extract text from message content
function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part) {
        return String(part.text);
      }
    }
  }
  return "";
}

// List chat threads for the current user
export const listThreads = action({
  args: {},
  handler: async (ctx): Promise<ThreadInfo[]> => {
    const user = await getAuthenticatedUser(ctx);

    // Query threads from the agent component - limit to 10 recent threads for faster loading
    const threads = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId: user._id,
      order: "desc",
      paginationOpts: {
        numItems: 10,
        cursor: null,
      },
    });

    // Return threads immediately without fetching messages
    // The first message can be fetched on-demand if needed
    const threadInfos: ThreadInfo[] = threads.page.map((thread) => ({
      threadId: thread._id,
      title: thread.title || null,
      createdAt: thread._creationTime,
      firstMessage: null, // Will be populated on demand when thread is opened
    }));

    return threadInfos;
  },
});

// Delete a chat thread
export const deleteThread = action({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await getAuthenticatedUser(ctx);

    // Verify the thread belongs to this user before deleting
    const threadMeta = await emailQAAgent.getThreadMetadata(ctx, {
      threadId: args.threadId,
    });

    if (threadMeta?.userId !== user._id) {
      throw new Error("Thread not found or access denied");
    }

    // Delete the thread using the agent's method
    await emailQAAgent.deleteThreadSync(ctx, {
      threadId: args.threadId,
    });
  },
});

// Get messages for a specific thread
export const getThreadMessages = action({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args): Promise<Array<{ role: string; content: string }>> => {
    const user = await getAuthenticatedUser(ctx);

    // Verify the thread belongs to this user
    const threadMeta = await emailQAAgent.getThreadMetadata(ctx, {
      threadId: args.threadId,
    });

    if (threadMeta?.userId !== user._id) {
      throw new Error("Thread not found or access denied");
    }

    // Get all messages for this thread
    const messages = await ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
      threadId: args.threadId,
      order: "asc",
      paginationOpts: {
        numItems: 100,
        cursor: null,
      },
    });

    // Extract role and content from messages
    const result: Array<{ role: string; content: string }> = [];
    for (const msg of messages.page) {
      if (msg.message && (msg.message.role === "user" || msg.message.role === "assistant")) {
        result.push({
          role: msg.message.role,
          content: extractTextFromContent(msg.message.content),
        });
      }
    }

    return result;
  },
});
