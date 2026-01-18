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
      model: anthropic("claude-opus-4-5-20251101"),
      prompt: `Analyze this email and return a JSON response. Your goal is to help the user quickly decide what to do with this email.

CONTEXT: The sender name and subject line are ALREADY displayed above the summary in the UI. DO NOT repeat them.

SUMMARY GUIDELINES:
- Be concise but include ALL key details needed to make a decision without opening the email
- DO NOT start with the sender name or repeat the subject - those are already visible
- Include specific dates, amounts, deadlines, or asks
- If it's a newsletter/marketing, say what it's promoting and if there's a deal
- If it's a request, state exactly what's being asked and by when
- If it's informational, state the key facts
- Use "you" to address the user directly
- Can use markdown formatting and emojis sparingly

FIELDS:
1. summary: Decision-ready synopsis with key details (what, when, how much, deadline). DO NOT repeat sender or subject.
   BAD: "John from Acme wants to meet with you"
   GOOD: "📅 Wants to meet Thursday 2pm to discuss Q2 budget (~$50k)"
   BAD: "A newsletter about sales"
   GOOD: "🛒 20% off sale ends Sunday - camping gear + free shipping over $50"
2. urgencyScore: 0-100 (0-20 low, 21-50 normal, 51-80 important, 81-100 urgent)
3. urgencyReason: Brief explanation
4. actionRequired: "reply" | "action" | "fyi" | "none"
5. actionDescription: Specific action needed if any
6. quickReplies: If reply needed, up to 3 options as [{label, body}] - label max 20 chars, body is full reply
7. calendarEvent: If meeting/event mentioned, extract {title, startTime, endTime, location, description}
8. suggestedReply: Optional longer draft reply

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
            model: anthropic("claude-opus-4-5-20251101"),
            prompt: `Analyze this email and return a JSON response. Your goal is to help the user quickly decide what to do with this email.

CONTEXT: The sender name and subject line are ALREADY displayed above the summary in the UI. DO NOT repeat them.

SUMMARY GUIDELINES:
- Be concise but include ALL key details needed to make a decision without opening the email
- DO NOT start with the sender name or repeat the subject - those are already visible
- Include specific dates, amounts, deadlines, or asks
- If it's a newsletter/marketing, say what it's promoting and if there's a deal
- If it's a request, state exactly what's being asked and by when
- If it's informational, state the key facts
- Use "you" to address the user directly
- Can use markdown formatting and emojis sparingly

FIELDS:
1. summary: Decision-ready synopsis with key details (what, when, how much, deadline). DO NOT repeat sender or subject.
   BAD: "John from Acme wants to meet with you"
   GOOD: "📅 Wants to meet Thursday 2pm to discuss Q2 budget (~$50k)"
   BAD: "A newsletter about sales"
   GOOD: "🛒 20% off sale ends Sunday - camping gear + free shipping over $50"
2. urgencyScore: 0-100 (0-20 low, 21-50 normal, 51-80 important, 81-100 urgent)
3. urgencyReason: Brief explanation
4. actionRequired: "reply" | "action" | "fyi" | "none"
5. actionDescription: Specific action needed if any
6. quickReplies: If reply needed, up to 3 options as [{label, body}] - label max 20 chars, body is full reply
7. calendarEvent: If meeting/event mentioned, extract {title, startTime, endTime, location, description}
8. suggestedReply: Optional longer draft reply

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

// Debug action to reset and resummarize all emails for a user
export const resetAndResummarizeAll = action({
  args: { userEmail: v.string() },
  handler: async (ctx, args): Promise<{ deleted: number; queued: number }> => {
    // Get user
    const user = await ctx.runQuery(internal.gmailSync.getUserByEmail, {
      email: args.userEmail,
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Delete all summaries for this user's emails
    const deleted = await ctx.runMutation(internal.summarize.deleteAllSummariesForUser, {
      userId: user._id,
    });

    // Get all external IDs for the user's emails
    const externalIds: string[] = await ctx.runQuery(internal.summarize.getExternalIdsForUser, {
      userId: user._id,
    });

    // Trigger summarization in batches
    const BATCH_SIZE = 10;
    let queued = 0;

    for (let i = 0; i < externalIds.length; i += BATCH_SIZE) {
      const batch = externalIds.slice(i, i + BATCH_SIZE);
      // Run summarization (don't await to avoid timeout)
      ctx.runAction(internal.summarizeActions.summarizeByExternalIds, {
        externalIds: batch,
        userEmail: args.userEmail,
      });
      queued += batch.length;
    }

    return { deleted, queued };
  },
});
