"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";

// Initialize Anthropic provider
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Summarize a single email
export const summarizeEmail = action({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args): Promise<{
    summary: string;
    urgencyScore: number;
    urgencyReason: string;
    suggestedReply?: string;
  } | null> => {
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
      };
    }

    // Build prompt
    const emailContent = `
From: ${email.fromName || email.fromEmail || "Unknown"}
Subject: ${email.subject}

${email.bodyPreview || email.bodyFull}
`.trim();

    // Call Anthropic via AI SDK
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: `Analyze this email and provide a JSON response with the following fields:
- summary: A concise 1-2 sentence summary
- urgencyScore: A number 0-100 (0-20 low, 21-50 normal, 51-80 important, 81-100 urgent)
- urgencyReason: Brief explanation of the urgency score
- suggestedReply: Optional brief reply if one is needed, or null

Email:
${emailContent}

Respond with only valid JSON, no markdown or explanation.`,
    });

    // Parse response
    let result;
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

    // Save to database
    await ctx.runMutation(internal.summarize.updateEmailSummary, {
      emailId: args.emailId,
      summary: result.summary || "",
      urgencyScore: result.urgencyScore || 0,
      urgencyReason: result.urgencyReason || "",
      suggestedReply: result.suggestedReply || undefined,
    });

    return result;
  },
});

// Summarize emails by external IDs (for Gmail emails)
export const summarizeByExternalIds = action({
  args: {
    externalIds: v.array(v.string()),
    userEmail: v.string(),
  },
  handler: async (ctx, args): Promise<Array<{
    externalId: string;
    success: boolean;
    result?: {
      summary: string;
      urgencyScore: number;
      urgencyReason: string;
      suggestedReply?: string;
    };
    error?: string;
  }>> => {
    const results: Array<{
      externalId: string;
      success: boolean;
      result?: {
        summary: string;
        urgencyScore: number;
        urgencyReason: string;
        suggestedReply?: string;
      };
      error?: string;
    }> = [];

    for (const externalId of args.externalIds) {
      try {
        // Find email by external ID
        const email = await ctx.runQuery(internal.summarize.getEmailByExternalId, {
          externalId,
        });

        if (!email) {
          results.push({ externalId, success: false, error: "Email not found in DB" });
          continue;
        }

        // Skip if already summarized
        if (email.aiProcessedAt) {
          results.push({
            externalId,
            success: true,
            result: {
              summary: email.summary || "",
              urgencyScore: email.urgencyScore || 0,
              urgencyReason: email.urgencyReason || "",
              suggestedReply: email.suggestedReply,
            },
          });
          continue;
        }

        // Build prompt
        const emailContent = `
From: Unknown
Subject: ${email.subject}

${email.bodyPreview || email.bodyFull}
`.trim();

        // Call Anthropic via AI SDK
        const { text } = await generateText({
          model: anthropic("claude-sonnet-4-20250514"),
          prompt: `Analyze this email and provide a JSON response with the following fields:
- summary: A concise 1-2 sentence summary
- urgencyScore: A number 0-100 (0-20 low, 21-50 normal, 51-80 important, 81-100 urgent)
- urgencyReason: Brief explanation of the urgency score
- suggestedReply: Optional brief reply if one is needed, or null

Email:
${emailContent}

Respond with only valid JSON, no markdown or explanation.`,
        });

        // Parse response
        let result;
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

        // Save to database
        await ctx.runMutation(internal.summarize.updateEmailSummary, {
          emailId: email._id,
          summary: result.summary || "",
          urgencyScore: result.urgencyScore || 0,
          urgencyReason: result.urgencyReason || "",
          suggestedReply: result.suggestedReply || undefined,
        });

        results.push({ externalId, success: true, result });
      } catch (error) {
        results.push({
          externalId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  },
});
