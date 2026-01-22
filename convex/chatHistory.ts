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

    // Normalize threads: populate titles from first message if missing
    const threadInfos: ThreadInfo[] = await Promise.all(
      threads.page.map(async (thread) => {
        let title = thread.title || null;

        // If thread has no title, generate one from the first user message
        if (!title) {
          try {
            const messages = await ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
              threadId: thread._id,
              order: "asc",
              paginationOpts: {
                numItems: 1,
                cursor: null,
              },
            });

            // Get the first user message
            const firstMessage = messages.page[0];
            if (firstMessage?.message?.role === "user") {
              const messageText = extractTextFromContent(firstMessage.message.content);
              // Truncate to 60 characters for a clean title
              title = messageText.length > 60
                ? messageText.substring(0, 57) + "..."
                : messageText;

              // Update the thread with the new title so we don't need to fetch it again
              await ctx.runMutation(components.agent.threads.updateThread, {
                threadId: thread._id,
                patch: { title },
              });
            }
          } catch (err) {
            console.error(`Failed to generate title for thread ${thread._id}:`, err);
            // Continue with null title on error
          }
        }

        return {
          threadId: thread._id,
          title,
          createdAt: thread._creationTime,
          firstMessage: title, // Use title as the display text
        };
      })
    );

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
