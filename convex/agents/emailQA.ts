"use node";

import { Agent, createTool, type ToolCtx } from "@convex-dev/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { components, internal, api } from "../_generated/api";
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
  handler: async (ctx: EmailToolCtx, args): Promise<any> => {
    console.log(`[SearchEmailsTool] Called with query: "${args.query}", userId: ${ctx.userId}`);

    if (!ctx.userId) {
      console.log(`[SearchEmailsTool] Error: User not authenticated`);
      return { error: "User not authenticated" };
    }

    try {
      console.log(`[SearchEmailsTool] Calling searchSimilarEmails action...`);
      // @ts-ignore - Type instantiation depth issue with Convex SDK
      const results = await ctx.runAction(internal.emailEmbeddings.searchSimilarEmails, {
        query: args.query,
        userId: ctx.userId as Id<"users">,
        limit: 5,
      }) as SearchResult[];

      console.log(`[SearchEmailsTool] Got ${results.length} results`);

      if (results.length === 0) {
        return { message: "No relevant emails found for that search." };
      }

      const mapped = results.map((r: SearchResult) => ({
        emailId: r.emailId,
        subject: r.subject,
        summary: r.summary,
        from: r.fromName || r.fromEmail || "Unknown",
        receivedAt: new Date(r.receivedAt).toLocaleDateString(),
        relevanceScore: r.score,
      }));

      console.log(`[SearchEmailsTool] Returning emails:`, mapped.map(e => e.subject));
      return { emails: mapped };
    } catch (error) {
      console.error(`[SearchEmailsTool] Error:`, error);
      throw error;
    }
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
  handler: async (ctx: EmailToolCtx, args): Promise<any> => {
    // @ts-ignore - Type instantiation depth issue with Convex SDK
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

// Tool to create calendar events
const createCalendarEventTool = createTool({
  description:
    "Create a calendar event from email information. Use this when the user explicitly asks to add an event to their calendar or schedule something.",
  args: z.object({
    title: z.string().describe("Event title/summary"),
    startTime: z.string().describe("Start time in ISO format or relative format like 'tomorrow 2pm' or 'next Tuesday 10am'"),
    endTime: z.string().optional().describe("End time in ISO format or relative format. Defaults to 1 hour after start."),
    location: z.string().optional().describe("Event location if available"),
    description: z.string().optional().describe("Event description or notes"),
    emailId: z.string().optional().describe("Associated email ID for attribution"),
  }),
  handler: async (ctx: EmailToolCtx, args): Promise<any> => {
    try {
      console.log(`[CreateCalendarEventTool] Creating event: "${args.title}" at ${args.startTime}`);

      // Get user's email
      // @ts-ignore - Type instantiation depth issue with Convex SDK
      const user = await ctx.runQuery(internal.users.get, {
        userId: ctx.userId as Id<"users">,
      });

      if (!user?.email) {
        return {
          success: false,
          error: "User email not found",
        };
      }

      // Get user's timezone (default to America/Los_Angeles if not available)
      const timezone = "America/Los_Angeles"; // TODO: Get from user settings

      // @ts-ignore - Type instantiation depth issue with Convex SDK
      const result = await ctx.runAction(api.calendar.addToCalendar, {
        userEmail: user.email,
        title: args.title,
        startTime: args.startTime,
        endTime: args.endTime,
        location: args.location,
        description: args.description,
        timezone,
        emailId: args.emailId as Id<"emails"> | undefined,
      }) as any;

      console.log(`[CreateCalendarEventTool] Event created: ${result.htmlLink}`);

      return {
        success: true,
        eventLink: result.htmlLink,
      };
    } catch (error) {
      console.error(`[CreateCalendarEventTool] Error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create calendar event",
      };
    }
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
5. If the user asks to add something to their calendar or schedule an event, use the createCalendarEvent tool

Guidelines:
- Be concise and accurate
- Quote relevant parts of emails when helpful (dates, times, confirmation numbers, etc.)
- If the user asks about reservations, appointments, or events, look for dates, times, and confirmation details
- If you find multiple relevant emails, summarize the key information from each
- IMPORTANT: When citing an email, use a markdown link with the format [Email Subject](email:EMAIL_ID) where EMAIL_ID is the emailId from the search results. This allows users to tap and view the original email.
- When creating calendar events, extract all relevant details (time, location, description) from the email

Example of citing an email:
- "Based on your [iFLY Portland Order Confirmation](email:abc123xyz), your reservation is for..."
- "I found this in [Amazon Order #123](email:def456)..."

Example questions you can help with:
- "When is my ifly reservation?"
- "What's the confirmation number for my hotel booking?"
- "Do I have any upcoming appointments?"
- "What was the price in that Amazon receipt?"
- "Add my dentist appointment to my calendar"
- "Schedule the team meeting from that email"`,

  tools: {
    searchEmails: searchEmailsTool,
    getEmailDetails: getEmailDetailsTool,
    createCalendarEvent: createCalendarEventTool,
  },
});
