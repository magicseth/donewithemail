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

// Convert HTML to plain text for AI summarization
function htmlToPlainText(html: string): string {
  if (!html) return "";

  // Check if it looks like HTML
  if (!html.includes("<")) return html;

  let text = html;

  // Remove style and script tags with their content
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // Replace common block elements with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/tr>/gi, "\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&amp;/gi, "&");
  text = text.replace(/&lt;/gi, "<");
  text = text.replace(/&gt;/gi, ">");
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/&rsquo;/gi, "'");
  text = text.replace(/&lsquo;/gi, "'");
  text = text.replace(/&rdquo;/gi, '"');
  text = text.replace(/&ldquo;/gi, '"');
  text = text.replace(/&mdash;/gi, "—");
  text = text.replace(/&ndash;/gi, "–");
  text = text.replace(/&#\d+;/g, ""); // Remove remaining numeric entities

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, "\n\n"); // Max 2 consecutive newlines
  text = text.replace(/[ \t]+/g, " "); // Collapse spaces
  text = text.replace(/^\s+|\s+$/gm, ""); // Trim each line

  return text.trim();
}

// Check if a calendar event's start time is in the past
function isEventInPast(startTime: string | undefined): boolean {
  if (!startTime) return false;

  // Try to parse as a date
  const eventDate = new Date(startTime);
  if (isNaN(eventDate.getTime())) {
    // Couldn't parse - might be relative like "next Tuesday", assume future
    return false;
  }

  // Check if it's in the past (with 1 hour buffer for timezone issues)
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  return eventDate < oneHourAgo;
}

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
  // Recurrence rule in RRULE format (without "RRULE:" prefix)
  recurrence?: string;
  // Human-readable description of recurrence
  recurrenceDescription?: string;
}

// Type for deadline
interface Deadline {
  date: string;  // ISO 8601 format
  description: string;  // e.g., "respond by", "submit proposal by"
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
  deadline?: Deadline;
  // AI prediction: should user accept this calendar invite?
  shouldAcceptCalendar?: boolean;
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

    // Build prompt - use full body, convert HTML to text
    const rawBody = email.bodyFull || email.bodyPreview || "";
    const bodyText = htmlToPlainText(rawBody).slice(0, 8000); // 8000 chars is ~2000 tokens
    const emailContent = `
From: ${email.fromName || email.fromEmail || "Unknown"}
Subject: ${email.subject}

${bodyText}
`.trim();

    // Call Anthropic via AI SDK with enhanced prompt
    const now = new Date();
    const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
    const today = `${dayOfWeek}, ${now.toISOString().split("T")[0]}`; // e.g., "Saturday, 2025-01-18"
    const { text } = await generateText({
      model: anthropic("claude-opus-4-5-20251101"),
      prompt: `Analyze this email and return a JSON response. Your goal is to help the user quickly decide what to do with this email.

TODAY'S DATE: ${today}

CONTEXT:
- The sender name and subject line are ALREADY displayed above the summary in the UI. DO NOT repeat them.
- If there's a calendar event, it will be displayed SEPARATELY below the summary with full details (title, time, location). DO NOT repeat calendar details in the summary.

SUMMARY GUIDELINES:
- MAXIMUM 240 CHARACTERS - this is for a compact inbox row view
- DO NOT repeat sender name, subject, or calendar event details (title/time/location) - they're shown separately
- Focus on the key decision point: what action is needed and why
- If it's a calendar invite, summarize the PURPOSE/context, not the logistics
- If it's a newsletter/marketing, mention the key offer briefly
- If it's a request, state what's being asked
- Use "you" to address the user directly
- Can use emojis sparingly

FIELDS:
1. summary: Super short (<240 chars) decision-ready synopsis. DO NOT repeat sender, subject, or calendar details.
   BAD: "Meeting invite for Thursday 2pm at Conference Room A"
   GOOD: "Quarterly planning session - need to discuss Q2 budget priorities"
   BAD: "John from Acme wants to meet with you"
   GOOD: "Wants to sync on partnership proposal before board meeting"
   BAD: "A newsletter about sales"
   GOOD: "🛒 20% off camping gear + free shipping >$50, ends Sunday"
2. urgencyScore: 0-100 (0-20 low, 21-50 normal, 51-80 important, 81-100 urgent)
   IMPORTANT: Marketing emails, promotional offers, newsletters, and subscriptions should NEVER score above 30, even if they have "expiring" offers or time-sensitive language. Only personal emails from real individuals warrant high urgency.
3. urgencyReason: Brief explanation
4. actionRequired: "reply" | "action" | "fyi" | "none"
5. actionDescription: Specific action needed if any
6. quickReplies: If reply needed, up to 3 options as [{label, body}] - label max 20 chars, body is full reply
7. calendarEvent: If meeting/event mentioned, extract {title, startTime, endTime, location, description, recurrence, recurrenceDescription}. Use ISO 8601 format for startTime/endTime (e.g., "2025-01-20T14:00:00"). For recurring events, include BOTH:
   - recurrence: RRULE format WITHOUT "RRULE:" prefix (e.g., "FREQ=WEEKLY;BYDAY=TU", "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU" for bi-weekly, "FREQ=MONTHLY;BYMONTHDAY=15")
   - recurrenceDescription: Human-readable text (e.g., "Every Tuesday", "Every other Tuesday", "Monthly on the 15th")
8. suggestedReply: Optional longer draft reply
9. deadline: If there's a deadline or due date mentioned (e.g., "please respond by Friday", "submit by Jan 25"), extract {date, description}. Use ISO 8601 format for date. Only include if there's a clear deadline for the recipient.
10. shouldAcceptCalendar: If calendarEvent is present, predict whether the user likely wants to accept this calendar invite (true) or decline/ignore it (false). Consider:
   - Work meetings with colleagues/team → likely accept
   - 1:1 meetings with important contacts → likely accept
   - Social events from friends/family → likely accept
   - Marketing webinars, cold outreach meetings → likely decline
   - Spam calendar invites → likely decline
   - Events at inconvenient times or conflicting with work → likely decline
   Only include this field when calendarEvent is present.

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

    // Sanitize calendarEvent (convert null to undefined, handle arrays, filter past events)
    let sanitizedCalendarEvent: CalendarEvent | undefined;
    // AI sometimes returns an array of events - take the first one
    const rawEvent = Array.isArray(result.calendarEvent)
      ? result.calendarEvent[0]
      : result.calendarEvent;
    if (rawEvent && rawEvent.title && !isEventInPast(rawEvent.startTime)) {
      sanitizedCalendarEvent = {
        title: rawEvent.title,
        startTime: rawEvent.startTime || undefined,
        endTime: rawEvent.endTime || undefined,
        location: rawEvent.location || undefined,
        description: rawEvent.description || undefined,
        recurrence: rawEvent.recurrence || undefined,
        recurrenceDescription: rawEvent.recurrenceDescription || undefined,
      };
    }

    // Sanitize deadline (only keep if not in the past)
    let sanitizedDeadline: string | undefined;
    let sanitizedDeadlineDescription: string | undefined;
    if (result.deadline && result.deadline.date && !isEventInPast(result.deadline.date)) {
      sanitizedDeadline = result.deadline.date;
      sanitizedDeadlineDescription = result.deadline.description;
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
      shouldAcceptCalendar: sanitizedCalendarEvent ? result.shouldAcceptCalendar : undefined,
      deadline: sanitizedDeadline,
      deadlineDescription: sanitizedDeadlineDescription,
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

          // Build context-rich prompt - use full body, convert HTML to text
          const rawBody = email.bodyFull || email.bodyPreview || "";
          const bodyText = htmlToPlainText(rawBody).slice(0, 8000); // 8000 chars is ~2000 tokens

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
          const now = new Date();
          const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
          const today = `${dayOfWeek}, ${now.toISOString().split("T")[0]}`; // e.g., "Saturday, 2025-01-18"
          const { text } = await generateText({
            model: anthropic("claude-opus-4-5-20251101"),
            prompt: `Analyze this email and return a JSON response. Your goal is to help the user quickly decide what to do with this email.

TODAY'S DATE: ${today}

CONTEXT:
- The sender name and subject line are ALREADY displayed above the summary in the UI. DO NOT repeat them.
- If there's a calendar event, it will be displayed SEPARATELY below the summary with full details (title, time, location). DO NOT repeat calendar details in the summary.

SUMMARY GUIDELINES:
- MAXIMUM 240 CHARACTERS - this is for a compact inbox row view
- DO NOT repeat sender name, subject, or calendar event details (title/time/location) - they're shown separately
- Focus on the key decision point: what action is needed and why
- If it's a calendar invite, summarize the PURPOSE/context, not the logistics
- If it's a newsletter/marketing, mention the key offer briefly
- If it's a request, state what's being asked
- Use "you" to address the user directly
- Can use emojis sparingly

FIELDS:
1. summary: Super short (<240 chars) decision-ready synopsis. DO NOT repeat sender, subject, or calendar details.
   BAD: "Meeting invite for Thursday 2pm at Conference Room A"
   GOOD: "Quarterly planning session - need to discuss Q2 budget priorities"
   BAD: "John from Acme wants to meet with you"
   GOOD: "Wants to sync on partnership proposal before board meeting"
   BAD: "A newsletter about sales"
   GOOD: "🛒 20% off camping gear + free shipping >$50, ends Sunday"
2. urgencyScore: 0-100 (0-20 low, 21-50 normal, 51-80 important, 81-100 urgent)
   IMPORTANT: Marketing emails, promotional offers, newsletters, and subscriptions should NEVER score above 30, even if they have "expiring" offers or time-sensitive language. Only personal emails from real individuals warrant high urgency.
3. urgencyReason: Brief explanation
4. actionRequired: "reply" | "action" | "fyi" | "none"
5. actionDescription: Specific action needed if any
6. quickReplies: If reply needed, up to 3 options as [{label, body}] - label max 20 chars, body is full reply
7. calendarEvent: If meeting/event mentioned, extract {title, startTime, endTime, location, description, recurrence, recurrenceDescription}. Use ISO 8601 format for startTime/endTime (e.g., "2025-01-20T14:00:00"). For recurring events, include BOTH:
   - recurrence: RRULE format WITHOUT "RRULE:" prefix (e.g., "FREQ=WEEKLY;BYDAY=TU", "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU" for bi-weekly, "FREQ=MONTHLY;BYMONTHDAY=15")
   - recurrenceDescription: Human-readable text (e.g., "Every Tuesday", "Every other Tuesday", "Monthly on the 15th")
8. suggestedReply: Optional longer draft reply
9. deadline: If there's a deadline or due date mentioned (e.g., "please respond by Friday", "submit by Jan 25"), extract {date, description}. Use ISO 8601 format for date. Only include if there's a clear deadline for the recipient.
10. shouldAcceptCalendar: If calendarEvent is present, predict whether the user likely wants to accept this calendar invite (true) or decline/ignore it (false). Consider:
   - Work meetings with colleagues/team → likely accept
   - 1:1 meetings with important contacts → likely accept
   - Social events from friends/family → likely accept
   - Marketing webinars, cold outreach meetings → likely decline
   - Spam calendar invites → likely decline
   - Events at inconvenient times or conflicting with work → likely decline
   Only include this field when calendarEvent is present.

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

          // Sanitize calendarEvent (convert null to undefined, handle arrays, filter past events)
          let sanitizedCalendarEvent: CalendarEvent | undefined;
          // AI sometimes returns an array of events - take the first one
          const rawEvent = Array.isArray(result.calendarEvent)
            ? result.calendarEvent[0]
            : result.calendarEvent;
          if (rawEvent && rawEvent.title && !isEventInPast(rawEvent.startTime)) {
            sanitizedCalendarEvent = {
              title: rawEvent.title,
              startTime: rawEvent.startTime || undefined,
              endTime: rawEvent.endTime || undefined,
              location: rawEvent.location || undefined,
              description: rawEvent.description || undefined,
              recurrence: rawEvent.recurrence || undefined,
              recurrenceDescription: rawEvent.recurrenceDescription || undefined,
            };
          }

          // Sanitize deadline (only keep if not in the past)
          let sanitizedDeadline: string | undefined;
          let sanitizedDeadlineDescription: string | undefined;
          if (result.deadline && result.deadline.date && !isEventInPast(result.deadline.date)) {
            sanitizedDeadline = result.deadline.date;
            sanitizedDeadlineDescription = result.deadline.description;
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
            shouldAcceptCalendar: sanitizedCalendarEvent ? result.shouldAcceptCalendar : undefined,
            deadline: sanitizedDeadline,
            deadlineDescription: sanitizedDeadlineDescription,
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

// Reprocess a single email - delete summary and regenerate
export const reprocessEmail = action({
  args: {
    emailId: v.id("emails"),
    userEmail: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      // Delete existing summary
      await ctx.runMutation(internal.summarize.deleteSummaryForEmail, {
        emailId: args.emailId,
      });

      // Get the external ID for this email
      const externalId = await ctx.runQuery(internal.summarize.getExternalIdForEmail, {
        emailId: args.emailId,
      });

      if (!externalId) {
        return { success: false, error: "Email not found" };
      }

      // Re-summarize the email
      const results = await ctx.runAction(internal.summarizeActions.summarizeByExternalIds, {
        externalIds: [externalId],
        userEmail: args.userEmail,
      });

      if (results.length > 0 && results[0].success) {
        return { success: true };
      } else {
        return { success: false, error: results[0]?.error || "Unknown error" };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
