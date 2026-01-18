"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";

// Initialize Anthropic provider
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Type for AI analysis result
interface AnalysisResult {
  emailId: string;
  needsResponse: boolean;
  reason: string;
}

// Batch size for AI analysis to avoid rate limits
const BATCH_SIZE = 10;

/**
 * AI action to analyze emails and determine if they need a response
 * Filters out marketing/automated emails and identifies those awaiting replies
 */
export const analyzeEmailsForMissedTodos = internalAction({
  args: {
    emails: v.array(
      v.object({
        id: v.string(),
        subject: v.string(),
        bodyPreview: v.string(),
        fromEmail: v.string(),
        fromName: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args): Promise<AnalysisResult[]> => {
    if (args.emails.length === 0) {
      return [];
    }

    const results: AnalysisResult[] = [];

    // Process in batches to avoid rate limits
    for (let i = 0; i < args.emails.length; i += BATCH_SIZE) {
      const batch = args.emails.slice(i, i + BATCH_SIZE);

      // Build prompt with all emails in batch
      const emailsJson = batch.map((e) => ({
        id: e.id,
        subject: e.subject,
        bodyPreview: e.bodyPreview.slice(0, 300), // Limit preview length
        fromEmail: e.fromEmail,
        fromName: e.fromName || null,
      }));

      try {
        const { text } = await generateText({
          model: anthropic("claude-sonnet-4-20250514"),
          prompt: `Analyze these emails and determine which ones need a personal response.

ALWAYS mark needsResponse: FALSE for:
- Newsletters and mailing lists (look for "unsubscribe", "list-unsubscribe", "mailing list" patterns)
- Marketing emails (promotions, sales, product announcements)
- Automated notifications (GitHub, Jira, Slack, Linear, Notion, calendar invites, shipping updates)
- Receipts and order confirmations
- No-reply addresses (noreply@, no-reply@, donotreply@)
- Bulk senders (mailchimp, sendgrid, hubspot, marketo patterns in email)
- Social media notifications
- Account alerts and security notices
- Digest emails or summaries
- Emails with generic greetings like "Dear Customer" or "Hi there"

ONLY mark needsResponse: TRUE when ALL of these are true:
- From a real individual person (not a company or team)
- Contains a direct question or specific request TO the recipient
- Clearly expects a personal reply
- Is a 1:1 conversation, not broadcast to many people

For each email, return a JSON array with objects containing:
- id: the email id
- needsResponse: boolean
- reason: brief explanation (10 words max)

When in doubt, mark as FALSE. Be very conservative.

Emails to analyze:
${JSON.stringify(emailsJson, null, 2)}

Respond with only a valid JSON array, no markdown or explanation.`,
        });

        // Parse response
        let batchResults: AnalysisResult[];
        try {
          batchResults = JSON.parse(text);
        } catch {
          // Try to extract JSON array from response
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            batchResults = JSON.parse(jsonMatch[0]);
          } else {
            console.error("Failed to parse AI response:", text);
            // Default to not needing response for this batch
            batchResults = batch.map((e) => ({
              emailId: e.id,
              needsResponse: false,
              reason: "Failed to analyze",
            }));
          }
        }

        // Normalize results (AI might return emailId or id)
        const normalizedResults = batchResults.map((r: { emailId?: string; id?: string; needsResponse?: boolean; reason?: string }) => ({
          emailId: r.emailId || r.id || "",
          needsResponse: r.needsResponse === true,
          reason: r.reason || "",
        }));

        results.push(...normalizedResults);
      } catch (error) {
        console.error("Error analyzing batch:", error);
        // Add failed results for this batch
        results.push(
          ...batch.map((e) => ({
            emailId: e.id,
            needsResponse: false,
            reason: "Analysis error",
          }))
        );
      }
    }

    return results;
  },
});
