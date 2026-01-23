"use node";

import { v } from "convex/values";
import { action, internalAction, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { costs } from "./costs";

// Initialize Anthropic provider
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Model IDs
const OPUS_MODEL = "claude-opus-4-5-20251101";
const SONNET_MODEL = "claude-sonnet-4-20250514";

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second

// Usage stats type (aligned with neutral-cost API)
interface UsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Check if an error is retryable (server errors, rate limits, timeouts)
function isRetryableError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  // Retry on: 500-series errors, rate limits (429), timeouts, network errors
  return (
    errorMessage.includes("500") ||
    errorMessage.includes("502") ||
    errorMessage.includes("503") ||
    errorMessage.includes("504") ||
    errorMessage.includes("429") ||
    errorMessage.includes("rate limit") ||
    errorMessage.includes("Rate limit") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("Timeout") ||
    errorMessage.includes("ETIMEDOUT") ||
    errorMessage.includes("ECONNRESET") ||
    errorMessage.includes("network") ||
    errorMessage.includes("Network") ||
    errorMessage.includes("Internal Server Error") ||
    errorMessage.includes("Service Unavailable") ||
    errorMessage.includes("Bad Gateway")
  );
}

// Sleep helper for exponential backoff
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get "today's date" formatted for the AI prompt, using the user's timezone.
 * This fixes off-by-one errors when users are in different timezones than UTC.
 * @param timezone - IANA timezone string (e.g., "America/Los_Angeles")
 * @returns Formatted date string like "Saturday, 2025-01-18"
 */
function getTodayDateForPrompt(timezone?: string): string {
  const now = new Date();

  // Get the date in the user's timezone (or system timezone if not provided)
  const dateStr = timezone
    ? now.toLocaleDateString("en-CA", { timeZone: timezone }) // en-CA gives YYYY-MM-DD
    : now.toISOString().split("T")[0];

  const dayOfWeek = timezone
    ? now.toLocaleDateString("en-US", { weekday: "long", timeZone: timezone })
    : now.toLocaleDateString("en-US", { weekday: "long" });

  return `${dayOfWeek}, ${dateStr}`;
}

// Generate text with Opus, falling back to Sonnet on overload, with retry logic
async function generateTextWithFallback(prompt: string): Promise<{ text: string; model: string; usage: UsageStats }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Try Opus first
      const result = await generateText({
        model: anthropic(OPUS_MODEL),
        prompt,
      });
      return {
        text: result.text,
        model: OPUS_MODEL,
        usage: {
          promptTokens: result.usage?.inputTokens ?? 0,
          completionTokens: result.usage?.outputTokens ?? 0,
          totalTokens: result.usage?.totalTokens ?? 0,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if it's an overload error - fall back to Sonnet immediately
      if (errorMessage.includes("Overloaded") || errorMessage.includes("overloaded") || errorMessage.includes("529")) {
        console.log(`[Summarize] Opus overloaded, falling back to Sonnet`);
        try {
          const result = await generateText({
            model: anthropic(SONNET_MODEL),
            prompt,
          });
          return {
            text: result.text,
            model: SONNET_MODEL,
            usage: {
              promptTokens: result.usage?.inputTokens ?? 0,
              completionTokens: result.usage?.outputTokens ?? 0,
              totalTokens: result.usage?.totalTokens ?? 0,
            },
          };
        } catch (sonnetError) {
          // If Sonnet also fails with a retryable error, continue retry loop
          if (isRetryableError(sonnetError)) {
            lastError = sonnetError instanceof Error ? sonnetError : new Error(String(sonnetError));
            const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
            console.log(`[Summarize] Sonnet failed with retryable error, attempt ${attempt + 1}/${MAX_RETRIES}, retrying in ${delay}ms: ${lastError.message}`);
            await sleep(delay);
            continue;
          }
          throw sonnetError;
        }
      }

      // Check if this is a retryable error
      if (isRetryableError(error)) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.log(`[Summarize] Retryable error, attempt ${attempt + 1}/${MAX_RETRIES}, retrying in ${delay}ms: ${lastError.message}`);
        await sleep(delay);
        continue;
      }

      // Non-retryable error, throw immediately
      throw error;
    }
  }

  // All retries exhausted
  throw lastError || new Error("All retry attempts failed");
}

// Convert HTML to plain text for AI summarization
function htmlToPlainText(html: string): string {
  if (!html) return "";

  // Check if it looks like HTML
  if (!html.includes("<")) return html;

  let text = html;

  // Remove style and script tags with their content
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // IMPORTANT: Convert <a> links to "text (url)" format BEFORE stripping tags
  // This preserves URLs for the AI to extract actionable items
  text = text.replace(
    /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi,
    (_, url, linkText) => {
      // Skip tracking pixels, tiny images, unsubscribe links, and mailto links
      if (
        url.includes('tracking') ||
        url.includes('pixel') ||
        url.includes('beacon') ||
        url.includes('unsubscribe') ||
        url.startsWith('mailto:') ||
        linkText.trim().length === 0
      ) {
        return linkText || '';
      }
      // Format: "Link Text (https://...)" so AI can see both
      return linkText ? `${linkText} (${url})` : url;
    }
  );

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

// Type for actionable items (links, attachments that need user action)
interface ActionableItem {
  type: 'link' | 'attachment';
  label: string;
  url?: string;
  attachmentId?: string;
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
  actionableItems?: ActionableItem[];
  calendarEvent?: CalendarEvent;
  deadline?: Deadline;
  // AI prediction: should user accept this calendar invite?
  shouldAcceptCalendar?: boolean;
  // Meeting request detection with proposed time slots
  meetingRequest?: {
    isMeetingRequest: boolean;
    proposedTimes?: Array<{
      startTime: string;
      endTime: string;
    }>;
  };
  // NEW facts about the sender discovered from this email
  suggestedFacts?: string[];
  // Filenames of important attachments that should be shown in inbox
  importantAttachments?: string[];
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
        suggestedReply: email.suggestedReply ?? undefined,
        actionRequired: email.actionRequired,
        actionDescription: email.actionDescription ?? undefined,
        quickReplies: email.quickReplies ?? undefined,
        calendarEvent: email.calendarEvent ?? undefined,
      };
    }

    // Build prompt - use full body, convert HTML to text
    const rawBody = email.bodyFull || email.bodyPreview || "";
    const bodyText = htmlToPlainText(rawBody).slice(0, 8000); // 8000 chars is ~2000 tokens

    // Build attachment list (exclude inline images)
    const attachmentList = (email.attachments || [])
      .filter((att: any) => !att.isInline && att.filename)
      .map((att: any) => `- ${att.filename} (${att.mimeType}, ${Math.round(att.size / 1024)}KB)`)
      .join('\n');

    const emailContent = `
From: ${email.fromName || email.fromEmail || "Unknown"}
Subject: ${email.subject}

${bodyText}
${attachmentList ? `\n\nAttachments:\n${attachmentList}` : ''}
`.trim();

    // Call Anthropic via AI SDK with enhanced prompt (Opus with Sonnet fallback)
    // Use user's timezone for "today's date" to avoid off-by-one errors
    const today = getTodayDateForPrompt(email.userTimezone);
    const { text, model, usage } = await generateTextWithFallback(`Analyze this email and return a JSON response. Your goal is to help the user quickly decide what to do with this email.

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

DATE REFERENCES:
- NEVER use relative date words like "today", "yesterday", "tomorrow", "this week" directly
- Instead, use date placeholders in the format {{DATE:YYYY-MM-DD}}
- Examples: "Meeting {{DATE:2025-01-20}}" instead of "Meeting today"
- Examples: "Deadline {{DATE:2025-01-22}}" instead of "Deadline on Wednesday"
- The placeholders will be converted to relative dates at display time

FIELDS:
1. summary: Super short (<240 chars) decision-ready synopsis. DO NOT repeat sender, subject, or calendar details. Use {{DATE:YYYY-MM-DD}} for any date references.
   BAD: "Meeting invite for Thursday 2pm at Conference Room A"
   GOOD: "Quarterly planning session - need to discuss Q2 budget priorities"
   BAD: "John from Acme wants to meet with you"
   GOOD: "Wants to sync on partnership proposal before board meeting"
   BAD: "A newsletter about sales"
   GOOD: "🛒 20% off camping gear + free shipping >$50, ends {{DATE:2025-01-26}}"
2. urgencyScore: 0-100 (0-20 low, 21-50 normal, 51-80 important, 81-100 urgent)
   IMPORTANT: Marketing emails, promotional offers, newsletters, and subscriptions should NEVER score above 30, even if they have "expiring" offers or time-sensitive language. Only personal emails from real individuals warrant high urgency.
3. urgencyReason: Brief explanation
4. actionRequired: "reply" | "action" | "fyi" | "none"
5. actionDescription: Specific action needed if any. Use {{DATE:YYYY-MM-DD}} for any date references.
6. quickReplies: If reply needed, up to 3 options as [{label, body}] - label max 20 chars, body is full reply
7. actionableItems: If the email requires clicking a link or opening an attachment, provide up to 3 actionable items as [{type, label, url}]. Examples:
   - LinkedIn message notification → {type: "link", label: "Open LinkedIn", url: "https://linkedin.com/..."}
   - Shared document → {type: "link", label: "View Document", url: "https://docs.google.com/..."}
   - Important PDF attachment → {type: "attachment", label: "View Invoice.pdf", attachmentId: "..."}
   - Zoom meeting link → {type: "link", label: "Join Zoom", url: "https://zoom.us/..."}
   Only include items that require immediate action. Extract actual URLs from the email body.
8. calendarEvent: If meeting/event mentioned, extract {title, startTime, endTime, location, description, recurrence, recurrenceDescription}. Use ISO 8601 format for startTime/endTime (e.g., "2025-01-20T14:00:00"). For recurring events, include BOTH:
   - recurrence: RRULE format WITHOUT "RRULE:" prefix (e.g., "FREQ=WEEKLY;BYDAY=TU", "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU" for bi-weekly, "FREQ=MONTHLY;BYMONTHDAY=15")
   - recurrenceDescription: Human-readable text (e.g., "Every Tuesday", "Every other Tuesday", "Monthly on the 15th")
9. suggestedReply: Optional longer draft reply
10. deadline: If there's a deadline or due date mentioned (e.g., "please respond by Friday", "submit by Jan 25"), extract {date, description}. Use ISO 8601 format for date. Only include if there's a clear deadline for the recipient.
11. shouldAcceptCalendar: If calendarEvent is present, predict whether the user likely wants to accept this calendar invite (true) or decline/ignore it (false). Consider:
   - Work meetings with colleagues/team → likely accept
   - 1:1 meetings with important contacts → likely accept
   - Social events from friends/family → likely accept
   - Marketing webinars, cold outreach meetings → likely decline
   - Spam calendar invites → likely decline
   - Events at inconvenient times or conflicting with work → likely decline
   Only include this field when calendarEvent is present.
11. meetingRequest: Detect if this email is asking the recipient to schedule a meeting and contains proposed time slots. Return {isMeetingRequest: true, proposedTimes: [{startTime, endTime}, ...]} if:
   - Sender is asking recipient to meet (not just announcing a scheduled meeting)
   - Email contains 2 or more specific time options/suggestions for the recipient to choose from
   - Times should be in ISO 8601 format (e.g., "2025-01-20T14:00:00")
   - Examples: "Are you free Tuesday 2pm or Wednesday 3pm?", "Could we meet Jan 20 at 10am or Jan 21 at 2pm?"
   - NOT meeting requests: Single fixed meeting time, meetings already scheduled, calendar invites without options
   If not a meeting request with multiple options, return {isMeetingRequest: false}.
12. importantAttachments: If the email has attachments, identify which ones (if any) are important enough to show in the inbox preview. Array of EXACT filenames (as shown in the Attachments list). Important attachments are:
   - Documents that require review/approval (contracts, proposals, reports, invoices)
   - Files explicitly mentioned in the email body as needing action
   - Documents with deadlines or time-sensitive content
   - NOT: Marketing materials, newsletters, signature images, logos, generic PDFs
   - NOT: Automated receipts, invoices from services (unless requiring action)
   - Maximum 2 attachments in the array
   - Use EXACT filenames from the Attachments list above
   - If no attachments are important, omit this field or return empty array

Email:
${emailContent}

Respond with only valid JSON, no markdown or explanation.`);

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

    // Map important attachment filenames to IDs
    let importantAttachmentIds: string[] | undefined;
    if (result.importantAttachments && result.importantAttachments.length > 0 && email.attachments) {
      importantAttachmentIds = email.attachments
        .filter((att: any) =>
          result.importantAttachments!.some((filename: string) =>
            att.filename && att.filename.toLowerCase().includes(filename.toLowerCase())
          )
        )
        .map((att: any) => att._id)
        .slice(0, 2); // Max 2 important attachments
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
      actionableItems: result.actionableItems || undefined,
      calendarEvent: sanitizedCalendarEvent,
      shouldAcceptCalendar: sanitizedCalendarEvent ? result.shouldAcceptCalendar : undefined,
      meetingRequest: result.meetingRequest || undefined,
      deadline: sanitizedDeadline,
      deadlineDescription: sanitizedDeadlineDescription,
      importantAttachmentIds,
    } as any);

    // Track AI usage cost per user
    try {
      await costs.addAICost(ctx, {
        messageId: args.emailId,
        userId: email.userId,
        threadId: email.threadId || args.emailId,
        usage: {
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        },
        modelId: model,
        providerId: "anthropic",
      });
    } catch (e) {
      console.error("[Summarize] Failed to track AI cost:", e);
    }

    // Generate embedding for semantic search (async, don't block)
    ctx.scheduler.runAfter(0, internal.emailEmbeddings.generateEmbedding, {
      emailId: args.emailId,
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
      factsToSave?: {
        contactId: Id<"contacts">;
        emailId: Id<"emails">;
        facts: string[];
      };
    };

    // Process all emails in parallel
    const results = await Promise.all(
      args.externalIds.map(async (externalId): Promise<ResultType> => {
        // Find email by external ID first (outside inner try-catch so we can create fallback summary)
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

        try {

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

          // Build facts context for AI, grouped by month/year
          let factsContext = "";
          if (email.contactFacts?.length > 0) {
            const factsByMonth: Record<string, string[]> = {};
            for (const f of email.contactFacts) {
              const date = new Date(f.createdAt);
              const key = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
              if (!factsByMonth[key]) factsByMonth[key] = [];
              factsByMonth[key].push(f.text);
            }
            // Sort by date (most recent first)
            const sortedMonths = Object.entries(factsByMonth).sort((a, b) => {
              return new Date(b[0]).getTime() - new Date(a[0]).getTime();
            });
            const factsFormatted = sortedMonths
              .map(([month, facts]) => `${month}: ${facts.join("; ")}`)
              .join(" | ");
            factsContext = `\nKnown facts about sender: ${factsFormatted}`;
          }

          const emailContent = `From: ${senderName} <${email.fromEmail}> (${senderRelationship})
To: ${userName}${ccInfo}
Subject: ${email.subject}${recentContext}${factsContext}

${bodyText}`.trim();

          // Call Anthropic via AI SDK with enhanced prompt (Opus with Sonnet fallback)
          // Use user's timezone for "today's date" to avoid off-by-one errors
          const today = getTodayDateForPrompt(email.userTimezone);
          const { text, model, usage } = await generateTextWithFallback(`Analyze this email and return a JSON response. Your goal is to help the user quickly decide what to do with this email.

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

DATE REFERENCES:
- NEVER use relative date words like "today", "yesterday", "tomorrow", "this week" directly
- Instead, use date placeholders in the format {{DATE:YYYY-MM-DD}}
- Examples: "Meeting {{DATE:2025-01-20}}" instead of "Meeting today"
- Examples: "Deadline {{DATE:2025-01-22}}" instead of "Deadline on Wednesday"
- The placeholders will be converted to relative dates at display time

FIELDS:
1. summary: Super short (<240 chars) decision-ready synopsis. DO NOT repeat sender, subject, or calendar details. Use {{DATE:YYYY-MM-DD}} for any date references.
   BAD: "Meeting invite for Thursday 2pm at Conference Room A"
   GOOD: "Quarterly planning session - need to discuss Q2 budget priorities"
   BAD: "John from Acme wants to meet with you"
   GOOD: "Wants to sync on partnership proposal before board meeting"
   BAD: "A newsletter about sales"
   GOOD: "🛒 20% off camping gear + free shipping >$50, ends {{DATE:2025-01-26}}"
2. urgencyScore: 0-100 (0-20 low, 21-50 normal, 51-80 important, 81-100 urgent)
   IMPORTANT: Marketing emails, promotional offers, newsletters, and subscriptions should NEVER score above 30, even if they have "expiring" offers or time-sensitive language. Only personal emails from real individuals warrant high urgency.
3. urgencyReason: Brief explanation
4. actionRequired: "reply" | "action" | "fyi" | "none"
5. actionDescription: Specific action needed if any. Use {{DATE:YYYY-MM-DD}} for any date references.
6. quickReplies: If reply needed, up to 3 options as [{label, body}] - label max 20 chars, body is full reply
7. actionableItems: If the email requires clicking a link or opening an attachment, provide up to 3 actionable items as [{type, label, url}]. Examples:
   - LinkedIn message notification → {type: "link", label: "Open LinkedIn", url: "https://linkedin.com/..."}
   - Shared document → {type: "link", label: "View Document", url: "https://docs.google.com/..."}
   - Important PDF attachment → {type: "attachment", label: "View Invoice.pdf", attachmentId: "..."}
   - Zoom meeting link → {type: "link", label: "Join Zoom", url: "https://zoom.us/..."}
   Only include items that require immediate action. Extract actual URLs from the email body.
8. calendarEvent: If meeting/event mentioned, extract {title, startTime, endTime, location, description, recurrence, recurrenceDescription}. Use ISO 8601 format for startTime/endTime (e.g., "2025-01-20T14:00:00"). For recurring events, include BOTH:
   - recurrence: RRULE format WITHOUT "RRULE:" prefix (e.g., "FREQ=WEEKLY;BYDAY=TU", "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU" for bi-weekly, "FREQ=MONTHLY;BYMONTHDAY=15")
   - recurrenceDescription: Human-readable text (e.g., "Every Tuesday", "Every other Tuesday", "Monthly on the 15th")
9. suggestedReply: Optional longer draft reply
10. deadline: If there's a deadline or due date mentioned (e.g., "please respond by Friday", "submit by Jan 25"), extract {date, description}. Use ISO 8601 format for date. Only include if there's a clear deadline for the recipient.
11. shouldAcceptCalendar: If calendarEvent is present, predict whether the user likely wants to accept this calendar invite (true) or decline/ignore it (false). Consider:
   - Work meetings with colleagues/team → likely accept
   - 1:1 meetings with important contacts → likely accept
   - Social events from friends/family → likely accept
   - Marketing webinars, cold outreach meetings → likely decline
   - Spam calendar invites → likely decline
   - Events at inconvenient times or conflicting with work → likely decline
   Only include this field when calendarEvent is present.
11. suggestedFacts: Array of NEW facts about the sender learned from this email. Focus on:
   - Professional role/title (e.g., "Works at Acme Corp as VP of Sales")
   - Personal relationships (e.g., "Has a daughter named Emma")
   - Location/timezone (e.g., "Based in Seattle")
   Only include clearly stated facts not already in "Known facts about sender". Return empty array if none.

Email:
${emailContent}

Respond with only valid JSON, no markdown or explanation.`);

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
            actionableItems: result.actionableItems || undefined,
            calendarEvent: sanitizedCalendarEvent,
            shouldAcceptCalendar: sanitizedCalendarEvent ? result.shouldAcceptCalendar : undefined,
            meetingRequest: result.meetingRequest || undefined,
            deadline: sanitizedDeadline,
            deadlineDescription: sanitizedDeadlineDescription,
          } as any);

          // Track AI usage cost per user
          try {
            await costs.addAICost(ctx, {
              messageId: email._id,
              userId: email.userId,
              threadId: email.threadId || email._id,
              usage: {
                promptTokens: usage.promptTokens,
                completionTokens: usage.completionTokens,
                totalTokens: usage.totalTokens,
              },
              modelId: model,
              providerId: "anthropic",
            });
          } catch (e) {
            console.error("[Summarize] Failed to track AI cost:", e);
          }

          // Collect facts to save (will be batched per contact after parallel processing)
          const factsToSave = result.suggestedFacts && result.suggestedFacts.length > 0 && email.from
            ? { contactId: email.from, emailId: email._id, facts: result.suggestedFacts }
            : undefined;

          // Generate embedding for semantic search (async, don't block)
          ctx.scheduler.runAfter(0, internal.emailEmbeddings.generateEmbedding, {
            emailId: email._id,
          });

          return { externalId, success: true, result, factsToSave };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error(`[Summarize] Failed after retries for ${externalId}: ${errorMessage}`);

          // Create a fallback summary so the email moves to inbox instead of being stuck
          // This marks the email as "processed" (with a failure placeholder) so it appears in inbox
          if (email) {
            try {
              await ctx.runMutation(internal.summarize.updateEmailSummary, {
                emailId: email._id,
                summary: "Unable to analyze email. Tap to view.",
                urgencyScore: 50, // Neutral urgency - will appear in inbox
                urgencyReason: `AI analysis failed: ${errorMessage}`,
                actionRequired: "fyi" as const,
              });
              console.log(`[Summarize] Created fallback summary for ${externalId}`);
            } catch (fallbackError) {
              console.error(`[Summarize] Failed to create fallback summary for ${externalId}:`, fallbackError);
            }
          }

          return {
            externalId,
            success: false,
            error: errorMessage,
          };
        }
      })
    );

    // Batch facts by contact to avoid write conflicts
    // Group all facts by contactId, then save once per contact
    const factsByContact = new Map<string, { contactId: Id<"contacts">; emailIds: Id<"emails">[]; facts: string[] }>();
    for (const r of results) {
      if (r.factsToSave) {
        const key = r.factsToSave.contactId;
        const existing = factsByContact.get(key);
        if (existing) {
          existing.emailIds.push(r.factsToSave.emailId);
          existing.facts.push(...r.factsToSave.facts);
        } else {
          factsByContact.set(key, {
            contactId: r.factsToSave.contactId,
            emailIds: [r.factsToSave.emailId],
            facts: r.factsToSave.facts,
          });
        }
      }
    }

    // Save batched facts sequentially (one mutation per contact, no conflicts)
    for (const batch of factsByContact.values()) {
      try {
        await ctx.runMutation(internal.summarize.saveAISuggestedFacts, {
          contactId: batch.contactId,
          emailId: batch.emailIds[0], // Use first email as source
          facts: batch.facts,
        });
      } catch (e) {
        console.error("[Summarize] Failed to save facts for contact:", batch.contactId, e);
      }
    }

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

// Retry all unprocessed emails for a user
export const retryUnprocessedEmails = action({
  args: { userEmail: v.string() },
  handler: async (ctx, args): Promise<{ queued: number }> => {
    // Get user
    const user = await ctx.runQuery(internal.gmailSync.getUserByEmail, {
      email: args.userEmail,
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Get external IDs for unprocessed emails
    const externalIds: string[] = await ctx.runQuery(internal.summarize.getUnprocessedExternalIdsForUser, {
      userId: user._id,
    });

    if (externalIds.length === 0) {
      return { queued: 0 };
    }

    // Trigger summarization in batches
    const BATCH_SIZE = 5; // Smaller batches to avoid overload
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

    return { queued };
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

// =============================================================================
// WRITING STYLE ANALYSIS
// =============================================================================

/**
 * Analyze writing style from emails sent TO a specific contact.
 * This captures how the USER writes to this RECIPIENT.
 */
export const analyzeWritingStyle = internalAction({
  args: {
    userId: v.id("users"),
    contactId: v.id("contacts"),
    contactName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // Get sent emails TO this contact
    const emails = await ctx.runQuery(internal.summarize.getSentEmailsToContact, {
      userId: args.userId,
      contactId: args.contactId,
      limit: 20,
    });

    if (emails.length < 2) {
      return { success: false, error: "Not enough sent emails to this contact" };
    }

    // Build email samples for analysis
    const emailSamples = emails.slice(0, 10).map((e: { subject: string; bodyFull?: string; bodyPreview: string }, i: number) => {
      const body = htmlToPlainText(e.bodyFull || e.bodyPreview).slice(0, 500);
      return `Email ${i + 1}:\nSubject: ${e.subject}\nBody: ${body}`;
    }).join("\n\n---\n\n");

    const contactLabel = args.contactName || "this contact";

    const prompt = `Analyze the writing style in these emails that a user has sent TO ${contactLabel}. Focus on how the sender writes to this specific recipient.

${emailSamples}

Provide a JSON analysis of the sender's writing style when communicating with this person:
{
  "tone": "brief description of overall tone (e.g., 'formal', 'casual', 'friendly professional', 'urgent and direct')",
  "greeting": "typical greeting used or null if none (e.g., 'Hi John,', 'Hey!', 'Dear Mr. Smith,')",
  "signoff": "typical sign-off used or null if none (e.g., 'Best,', 'Thanks!', '- Seth')",
  "characteristics": ["list", "of", "writing", "traits"],
  "samplePhrases": ["actual", "phrases", "from", "emails", "that", "are", "distinctive"]
}

Return ONLY valid JSON, no other text.`;

    try {
      const { text, model, usage } = await generateTextWithFallback(prompt);

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { success: false, error: "Could not parse AI response" };
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Save to the contact
      await ctx.runMutation(internal.summarize.updateContactWritingStyle, {
        contactId: args.contactId,
        writingStyle: {
          tone: analysis.tone || "unknown",
          greeting: analysis.greeting || undefined,
          signoff: analysis.signoff || undefined,
          characteristics: analysis.characteristics || [],
          samplePhrases: analysis.samplePhrases || [],
          emailsAnalyzed: emails.length,
          analyzedAt: Date.now(),
        },
      });

      // Track AI usage cost per user
      try {
        await costs.addAICost(ctx, {
          messageId: args.contactId,
          userId: args.userId,
          threadId: args.contactId,
          usage: {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          },
          modelId: model,
          providerId: "anthropic",
        });
      } catch (e) {
        console.error("[WritingStyle] Failed to track AI cost:", e);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Backfill writing styles for all contacts the user has sent emails to.
 */
export const backfillWritingStyles = action({
  args: { userEmail: v.string() },
  handler: async (ctx, args): Promise<{ processed: number; errors: number }> => {
    // Get user
    const user = await ctx.runQuery(internal.gmailQueries.getUserByEmail, {
      email: args.userEmail,
    });
    if (!user) {
      throw new Error("User not found");
    }

    // Get all contacts for this user
    const contacts = await ctx.runQuery(internal.summarize.getContactsForWritingStyleBackfill, {
      userId: user._id,
    });

    console.log(`[WritingStyle Backfill] Processing ${contacts.length} contacts for ${args.userEmail}`);

    let processed = 0;
    let errors = 0;

    for (const contact of contacts) {
      // Skip user's own contact
      if (contact.email === args.userEmail) {
        continue;
      }

      // Check if there are sent emails TO this contact
      const sentEmails = await ctx.runQuery(internal.summarize.getSentEmailsToContact, {
        userId: user._id,
        contactId: contact._id,
        limit: 5,
      });

      if (sentEmails.length < 2) {
        continue; // Not enough emails to analyze
      }

      try {
        const result = await ctx.runAction(internal.summarizeActions.analyzeWritingStyle, {
          userId: user._id,
          contactId: contact._id,
          contactName: contact.name || contact.email,
        });

        if (result.success) {
          processed++;
          console.log(`[WritingStyle] Analyzed style for ${contact.name || contact.email}`);
        } else {
          errors++;
          console.error(`[WritingStyle] Failed for ${contact.email}: ${result.error}`);
        }
      } catch (error) {
        errors++;
        console.error(`[WritingStyle] Error for ${contact.email}:`, error);
      }
    }

    console.log(`[WritingStyle Backfill] Completed: ${processed} processed, ${errors} errors`);
    return { processed, errors };
  },
});
