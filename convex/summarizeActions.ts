"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";

// Initialize Anthropic provider
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Summarize a single email
// Type for quick reply options
interface QuickReply {
  label: string;
  body: string;
}

// Type for calendar event suggestion
interface CalendarEvent {
  title: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
}

// Type for summarization result
interface SummarizeResult {
  summary: string;
  urgencyScore: number;
  urgencyReason: string;
  suggestedReply?: string;
  actionRequired?: "reply" | "action" | "fyi" | "none";
  actionDescription?: string;
  quickReplies?: QuickReply[];
  calendarEvent?: CalendarEvent;
}

export const summarizeEmail = action({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args): Promise<SummarizeResult | null> => {
    // Get email content
    const email = await ctx.runQuery(internal.summarize.getEmailForSummary, {
      emailId: args.emailId,
    });

    if (!email) {
      throw new Error("Email not found");
    }

    // Skip if already processed
    if (email.aiProcessedAt) {
      return {
        summary: email.summary || "",
        urgencyScore: email.urgencyScore || 0,
        urgencyReason: email.urgencyReason || "",
        suggestedReply: email.suggestedReply,
        actionRequired: email.actionRequired,
        actionDescription: email.actionDescription,
        quickReplies: email.quickReplies,
        calendarEvent: email.calendarEvent,
      };
    }

    // Build prompt
    const emailContent = `
From: ${email.fromName || email.fromEmail || "Unknown"}
Subject: ${email.subject}

${email.bodyPreview || email.bodyFull}
`.trim();

    // Call Anthropic via AI SDK with enhanced prompt
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-5"),
      prompt: `Analyze this email and return a JSON response with these fields.
IMPORTANT: Write the summary addressing the user directly with "you" (e.g., "You need to reply" not "The user needs to reply").

1. summary: 1-2 sentence summary focused on what you need to know, written in second person ("you") shown in a scrolling list. use markdown and emojis
2. urgencyScore: 0-100 (0-20 low, 21-50 normal, 51-80 important, 81-100 urgent)
3. urgencyReason: Brief explanation of the urgency score
4. actionRequired: One of "reply" | "action" | "fyi" | "none"
   - "reply": You should reply to this email
   - "action": You should do something (not reply), like review a document
   - "fyi": Just informational, no action needed
   - "none": No action needed (spam, automated, etc.)
5. actionDescription: If action required, what specifically (e.g., "Schedule meeting", "Review attached document")
6. quickReplies: If reply needed, up to 3 quick reply options as array of {label, body}:
   - label: Short button text (max 20 chars) like "👍🏻 Sounds good!", "🔍 Let me check", "❌ Can't make it"
   - body: Full professional reply text to send
7. calendarEvent: If email mentions a meeting/event, extract {title, startTime, endTime, location, description}
   - startTime/endTime should include AM/PM (e.g., "next Tuesday 2pm" not "next Tuesday 2:00")
8. suggestedReply: If a longer custom reply seems appropriate, draft it here (optional)

Email:
${emailContent}

Respond with only valid JSON, no markdown or explanation.`,
    });

    // Parse response
    let result: SummarizeResult;
    try {
      result = JSON.parse(text);
    } catch {
      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response as JSON");
      }
    }

    // Validate quickReplies (limit to 3 and ensure proper structure)
    if (result.quickReplies) {
      result.quickReplies = result.quickReplies.slice(0, 3).filter(
        (qr): qr is QuickReply => typeof qr.label === "string" && typeof qr.body === "string"
      );
    }

    // Sanitize calendarEvent (convert null to undefined, handle arrays)
    let sanitizedCalendarEvent: CalendarEvent | undefined;
    // AI sometimes returns an array of events - take the first one
    const rawEvent = Array.isArray(result.calendarEvent)
      ? result.calendarEvent[0]
      : result.calendarEvent;
    if (rawEvent && rawEvent.title) {
      sanitizedCalendarEvent = {
        title: rawEvent.title,
        startTime: rawEvent.startTime || undefined,
        endTime: rawEvent.endTime || undefined,
        location: rawEvent.location || undefined,
        description: rawEvent.description || undefined,
      };
    }

    // Save to database
    await ctx.runMutation(internal.summarize.updateEmailSummary, {
      emailId: args.emailId,
      summary: result.summary || "",
      urgencyScore: result.urgencyScore || 0,
      urgencyReason: result.urgencyReason || "",
      suggestedReply: result.suggestedReply || undefined,
      actionRequired: result.actionRequired || undefined,
      actionDescription: result.actionDescription || undefined,
      quickReplies: result.quickReplies || undefined,
      calendarEvent: sanitizedCalendarEvent,
    });

    return result;
  },
});

// Public action for client-side summarization requests
// This wrapper allows the client to trigger summarization
export const summarizeEmailsByExternalIds = action({
  args: {
    externalIds: v.array(v.string()),
    userEmail: v.string(),
  },
  handler: async (ctx, args): Promise<Array<{
    externalId: string;
    success: boolean;
    result?: SummarizeResult;
    error?: string;
  }>> => {
    // Call the internal action
    return await ctx.runAction(internal.summarizeActions.summarizeByExternalIds, args);
  },
});

// Summarize emails by external IDs (for Gmail emails) - PARALLEL execution
// Internal action for use by workflow
export const summarizeByExternalIds = internalAction({
  args: {
    externalIds: v.array(v.string()),
    userEmail: v.string(),
  },
  handler: async (ctx, args): Promise<Array<{
    externalId: string;
    success: boolean;
    result?: SummarizeResult;
    error?: string;
  }>> => {
    type ResultType = {
      externalId: string;
      success: boolean;
      result?: SummarizeResult;
      error?: string;
    };

    // Process all emails in parallel
    const results = await Promise.all(
      args.externalIds.map(async (externalId): Promise<ResultType> => {
        try {
          // Find email by external ID
          const email = await ctx.runQuery(internal.summarize.getEmailByExternalId, {
            externalId,
          });

          if (!email) {
            return { externalId, success: false, error: "Email not found in DB" };
          }

          // Skip if already summarized
          if (email.aiProcessedAt) {
            return {
              externalId,
              success: true,
              result: {
                summary: email.summary || "",
                urgencyScore: email.urgencyScore || 0,
                urgencyReason: email.urgencyReason || "",
                suggestedReply: email.suggestedReply,
                actionRequired: email.actionRequired,
                actionDescription: email.actionDescription,
                quickReplies: email.quickReplies,
                calendarEvent: email.calendarEvent,
              },
            };
          }

          // Build context-rich prompt
          const bodyText = (email.bodyPreview || email.bodyFull || "").slice(0, 500);

          // Build sender context
          const senderName = email.fromName || email.fromEmail || "Unknown";
          const senderRelationship = email.fromRelationship === "vip" ? "VIP contact" :
            email.senderEmailCount > 10 ? "frequent correspondent" :
            email.senderEmailCount > 1 ? "known contact" : "new contact";

          // Build recipient context
          const userName = email.userName || "the user";
          const ccInfo = email.toEmails?.length > 0
            ? `\nCC'd: ${email.toEmails.join(", ")}`
            : "";

          // Build recent history context
          const recentContext = email.recentFromSender?.length > 0
            ? `\nRecent emails from this sender: ${email.recentFromSender.slice(0, 3).map((e: { subject: string }) => e.subject).join("; ")}`
            : "";

          const emailContent = `From: ${senderName} <${email.fromEmail}> (${senderRelationship})
To: ${userName}${ccInfo}
Subject: ${email.subject}${recentContext}

${bodyText}`.trim();

          // Call Anthropic via AI SDK with enhanced prompt
          const { text } = await generateText({
            model: anthropic("claude-sonnet-4-20250514"),
            prompt: `Analyze this email and return a JSON response.
IMPORTANT: Write the summary addressing the user directly with "you" (e.g., "You need to reply" not "${userName} needs to reply").

1. summary: 1-2 sentence summary focused on what you need to know or do, written in second person ("you")
2. urgencyScore: 0-100 (0-20 low, 21-50 normal, 51-80 important, 81-100 urgent)
3. urgencyReason: Brief explanation of the urgency score
4. actionRequired: One of "reply" | "action" | "fyi" | "none"
   - "reply": You should reply to this email
   - "action": You should do something (not reply)
   - "fyi": Just informational
   - "none": No action needed
5. actionDescription: If action required, what specifically
6. quickReplies: If reply needed, up to 3 quick reply options as array of {label, body}:
   - label: Short button text (max 20 chars) like "Sounds good!", "Let me check"
   - body: Full professional reply text from your perspective
7. calendarEvent: If email mentions a meeting/event, extract {title, startTime, endTime, location, description}
   - startTime/endTime should include AM/PM (e.g., "Tuesday 2pm" not "Tuesday 2:00")
8. suggestedReply: If a longer custom reply seems appropriate, draft it (optional)

Email:
${emailContent}

Respond with only valid JSON, no markdown or explanation.`,
          });

          // Parse response
          let result: SummarizeResult;
          try {
            result = JSON.parse(text);
          } catch {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              result = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error("Failed to parse AI response as JSON");
            }
          }

          // Validate quickReplies
          if (result.quickReplies) {
            result.quickReplies = result.quickReplies.slice(0, 3).filter(
              (qr): qr is QuickReply => typeof qr.label === "string" && typeof qr.body === "string"
            );
          }

          // Sanitize calendarEvent (convert null to undefined, handle arrays)
          let sanitizedCalendarEvent: CalendarEvent | undefined;
          // AI sometimes returns an array of events - take the first one
          const rawEvent = Array.isArray(result.calendarEvent)
            ? result.calendarEvent[0]
            : result.calendarEvent;
          if (rawEvent && rawEvent.title) {
            sanitizedCalendarEvent = {
              title: rawEvent.title,
              startTime: rawEvent.startTime || undefined,
              endTime: rawEvent.endTime || undefined,
              location: rawEvent.location || undefined,
              description: rawEvent.description || undefined,
            };
          }

          // Save to database
          await ctx.runMutation(internal.summarize.updateEmailSummary, {
            emailId: email._id,
            summary: result.summary || "",
            urgencyScore: result.urgencyScore || 0,
            urgencyReason: result.urgencyReason || "",
            suggestedReply: result.suggestedReply || undefined,
            actionRequired: result.actionRequired || undefined,
            actionDescription: result.actionDescription || undefined,
            quickReplies: result.quickReplies || undefined,
            calendarEvent: sanitizedCalendarEvent,
          });

          return { externalId, success: true, result };
        } catch (error) {
          return {
            externalId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );

    return results;
  },
});
