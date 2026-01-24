"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Process text from iOS Shortcuts to extract calendar events and action items.
 * This allows users to send any text (notes, messages, voice transcripts) to DoneWith
 * and have it analyzed for actionable content.
 */
export const processText = action({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args): Promise<{
    summary: string;
    calendarEvents: Array<{
      title: string;
      startDate?: string;
      endDate?: string;
      location?: string;
      notes?: string;
    }>;
    actionItems: Array<{
      task: string;
      priority: "high" | "medium" | "low";
      dueDate?: string;
    }>;
    hasContent: boolean;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `You are an AI assistant that analyzes text to extract calendar events and action items.
Today's date is ${today}.

Analyze the provided text and extract:
1. Any calendar events (meetings, appointments, deadlines with specific dates/times)
2. Any action items or tasks that need to be done

For calendar events, extract:
- Title (required)
- Start date/time in ISO format (if mentioned or can be inferred)
- End date/time in ISO format (if mentioned)
- Location (if mentioned)
- Notes (any additional context)

For action items, extract:
- Task description (required)
- Priority (high/medium/low based on urgency/importance mentioned)
- Due date in ISO format (if mentioned)

Also provide a brief summary (1-2 sentences) of what was found.

Respond in JSON format:
{
  "summary": "Brief summary of extracted items",
  "calendarEvents": [...],
  "actionItems": [...],
  "hasContent": true/false (whether any events or action items were found)
}`;

    try {
      const result = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt: `${systemPrompt}\n\nAnalyze this text and extract calendar events and action items:\n\n${args.text}`,
      });

      // Parse the JSON response
      const responseText = result.text.trim();

      // Handle markdown code blocks if present
      let jsonText = responseText;
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
      }

      const parsed = JSON.parse(jsonText);

      return {
        summary: parsed.summary || "No actionable content found.",
        calendarEvents: parsed.calendarEvents || [],
        actionItems: parsed.actionItems || [],
        hasContent: parsed.hasContent ?? (
          (parsed.calendarEvents?.length > 0) ||
          (parsed.actionItems?.length > 0)
        ),
      };
    } catch (error) {
      console.error("[Shortcuts] Failed to process text:", error);
      return {
        summary: "Failed to process text. Please try again.",
        calendarEvents: [],
        actionItems: [],
        hasContent: false,
      };
    }
  },
});

/**
 * Simple health check for the Shortcuts integration.
 * Can be used to verify the connection is working.
 */
export const ping = action({
  args: {},
  handler: async (ctx): Promise<{ status: string; timestamp: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    return {
      status: "ok",
      timestamp: Date.now(),
    };
  },
});
