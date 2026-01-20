"use node";

import { Agent, createTool, type ToolCtx } from "@convex-dev/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { components, internal } from "../_generated/api";
import { z } from "zod";
import { Id } from "../_generated/dataModel";

// Custom context type that includes userId
type EmailToolCtx = ToolCtx & {
  userId: string;
};

// Search result type
interface SearchResult {
  emailId: Id<"emails">;
  subject: string;
  summary: string;
  fromName: string | null;
  fromEmail: string | null;
  receivedAt: number;
  score: number;
}

// Tool to search emails by semantic meaning
const searchEmailsTool = createTool({
  description:
    "Search user's emails by semantic meaning. Use this to find emails about reservations, appointments, orders, meetings, receipts, confirmations, etc. Returns a list of relevant emails with summaries.",
  args: z.object({
    query: z
      .string()
      .describe("What to search for, e.g. 'ifly reservation' or 'dentist appointment' or 'amazon order'"),
  }),
  handler: async (ctx: EmailToolCtx, args): Promise<{ error: string } | { message: string } | { emails: Array<{ emailId: Id<"emails">; subject: string; summary: string; from: string; receivedAt: string; relevanceScore: number }> }> => {
    if (!ctx.userId) {
      return { error: "User not authenticated" };
    }

    const results: SearchResult[] = await ctx.runAction(internal.emailEmbeddings.searchSimilarEmails, {
      query: args.query,
      userId: ctx.userId as Id<"users">,
      limit: 5,
    });

    if (results.length === 0) {
      return { message: "No relevant emails found for that search." };
    }

    return {
      emails: results.map((r: SearchResult) => ({
        emailId: r.emailId,
        subject: r.subject,
        summary: r.summary,
        from: r.fromName || r.fromEmail || "Unknown",
        receivedAt: new Date(r.receivedAt).toLocaleDateString(),
        relevanceScore: r.score,
      })),
    };
  },
});

// Email details type
interface EmailDetails {
  _id: Id<"emails">;
  subject: string;
  bodyPreview: string;
  bodyFull?: string;
  fromName?: string;
  fromEmail?: string;
  receivedAt: number;
  summary?: string;
  urgencyScore?: number;
  calendarEvent?: unknown;
  deadline?: string;
  deadlineDescription?: string;
}

// Tool to get full email details
const getEmailDetailsTool = createTool({
  description:
    "Get full details of a specific email including the full body text. Use this after searching to read the complete content of an email.",
  args: z.object({
    emailId: z.string().describe("The email ID from a previous search result"),
  }),
  handler: async (ctx: EmailToolCtx, args): Promise<{ error: string } | { subject: string; from: string; receivedAt: string; summary?: string; body?: string; calendarEvent?: unknown; deadline: { date: string; description?: string } | null }> => {
    const email: EmailDetails | null = await ctx.runQuery(internal.emailEmbeddingsHelpers.getEmailWithBody, {
      emailId: args.emailId as Id<"emails">,
    });

    if (!email) {
      return { error: "Email not found" };
    }

    return {
      subject: email.subject,
      from: email.fromName || email.fromEmail || "Unknown",
      receivedAt: new Date(email.receivedAt).toLocaleDateString(),
      summary: email.summary,
      body: email.bodyFull || email.bodyPreview,
      calendarEvent: email.calendarEvent,
      deadline: email.deadline
        ? {
            date: email.deadline,
            description: email.deadlineDescription,
          }
        : null,
    };
  },
});

/**
 * Email Q&A Agent
 *
 * Helps users find information in their emails by searching
 * semantically and reading email content.
 */
export const emailQAAgent = new Agent(components.agent, {
  name: "Email Assistant",
  languageModel: anthropic("claude-sonnet-4-20250514"),
  instructions: `You are an email assistant for Sayless, helping users find information in their emails.

When answering questions:
1. First use the searchEmails tool to find relevant emails
2. If needed, use getEmailDetails to read the full content of specific emails
3. Answer the question accurately based on the email content
4. If you can't find relevant emails, say so clearly

Guidelines:
- Be concise and accurate
- Quote relevant parts of emails when helpful (dates, times, confirmation numbers, etc.)
- If the user asks about reservations, appointments, or events, look for dates, times, and confirmation details
- If you find multiple relevant emails, summarize the key information from each
- Always cite which email the information came from

Example questions you can help with:
- "When is my ifly reservation?"
- "What's the confirmation number for my hotel booking?"
- "Do I have any upcoming appointments?"
- "What was the price in that Amazon receipt?"`,

  tools: {
    searchEmails: searchEmailsTool,
    getEmailDetails: getEmailDetailsTool,
  },
});
