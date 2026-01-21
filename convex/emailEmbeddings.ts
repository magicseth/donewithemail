"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import OpenAI from "openai";
import { Id } from "./_generated/dataModel";
import { costs } from "./costs";

// Generate embedding for an email after it's been summarized
export const generateEmbedding = internalAction({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    // Get email with summary
    const email = await ctx.runQuery(internal.summarize.getEmailForSummary, {
      emailId: args.emailId,
    });

    if (!email) {
      console.log(`[Embeddings] Email not found: ${args.emailId}`);
      return;
    }

    if (!email.summary) {
      console.log(`[Embeddings] No summary for email: ${args.emailId}`);
      return;
    }

    // Build text to embed: subject + summary + sender info
    const textToEmbed = [
      email.subject,
      email.summary,
      email.fromName ? `From: ${email.fromName}` : null,
      email.fromEmail ? `<${email.fromEmail}>` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // Generate embedding using OpenAI
    const openai = new OpenAI();
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: textToEmbed,
    });

    const embedding = response.data[0].embedding;
    const tokensUsed = response.usage?.total_tokens ?? 0;

    // Track embedding cost
    try {
      await costs.addAICost(ctx, {
        messageId: `embedding-${args.emailId}`,
        userId: email.userId,
        threadId: email.threadId || args.emailId,
        usage: {
          promptTokens: tokensUsed,
          completionTokens: 0,
          totalTokens: tokensUsed,
        },
        modelId: "text-embedding-3-small",
        providerId: "openai",
      });
    } catch (e) {
      console.error("[Embeddings] Failed to track cost:", e);
    }

    // Save embedding to emailSummaries
    await ctx.runMutation(internal.emailEmbeddingsHelpers.saveEmbedding, {
      emailId: args.emailId,
      embedding,
    });

    console.log(`[Embeddings] Generated embedding for email: ${args.emailId} (${tokensUsed} tokens)`);
  },
});

// Search for similar emails using vector search
export const searchSimilarEmails = internalAction({
  args: {
    query: v.string(),
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<{
    emailId: Id<"emails">;
    subject: string;
    summary: string;
    fromName: string | null;
    fromEmail: string | null;
    receivedAt: number;
    score: number;
  }>> => {
    console.log(`[SearchSimilarEmails] Query: "${args.query}", userId: ${args.userId}`);
    const limit = args.limit ?? 5;

    // Generate embedding for the query
    console.log(`[SearchSimilarEmails] Generating embedding...`);
    const openai = new OpenAI();
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: args.query,
    });
    const queryEmbedding = response.data[0].embedding;
    const tokensUsed = response.usage?.total_tokens ?? 0;
    console.log(`[SearchSimilarEmails] Embedding generated, dimensions: ${queryEmbedding.length}`);

    // Track search embedding cost
    try {
      await costs.addAICost(ctx, {
        messageId: `search-embedding-${Date.now()}`,
        userId: args.userId,
        threadId: `search-${args.userId}`,
        usage: {
          promptTokens: tokensUsed,
          completionTokens: 0,
          totalTokens: tokensUsed,
        },
        modelId: "text-embedding-3-small",
        providerId: "openai",
      });
    } catch (e) {
      console.error("[SearchSimilarEmails] Failed to track cost:", e);
    }

    // Vector search on emailSummaries
    console.log(`[SearchSimilarEmails] Running vector search...`);
    const results = await ctx.vectorSearch("emailSummaries", "by_embedding", {
      vector: queryEmbedding,
      limit: limit * 2, // Get more to filter by user
    });
    console.log(`[SearchSimilarEmails] Vector search returned ${results.length} results`);

    // Filter results by userId and get full email details
    const filteredResults: Array<{
      emailId: Id<"emails">;
      subject: string;
      summary: string;
      fromName: string | null;
      fromEmail: string | null;
      receivedAt: number;
      score: number;
    }> = [];

    for (const result of results) {
      if (filteredResults.length >= limit) break;

      const summary = await ctx.runQuery(internal.emailEmbeddingsHelpers.getSummaryById, {
        summaryId: result._id,
      });
      if (!summary) continue;

      const email = await ctx.runQuery(internal.emailEmbeddingsHelpers.getEmailById, {
        emailId: summary.emailId,
      });
      if (!email || email.userId !== args.userId) continue;

      // Get contact info
      const contact = await ctx.runQuery(internal.emailEmbeddingsHelpers.getContactById, {
        contactId: email.from,
      });

      filteredResults.push({
        emailId: email._id,
        subject: email.subject,
        summary: summary.summary ?? "",
        fromName: contact?.name ?? null,
        fromEmail: contact?.email ?? null,
        receivedAt: email.receivedAt,
        score: result._score,
      });
    }

    return filteredResults;
  },
});

// Batch generate embeddings for all emails that have summaries but no embeddings
export const backfillEmbeddings = internalAction({
  args: { userId: v.id("users"), batchSize: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ processed: number }> => {
    const batchSize = args.batchSize ?? 50;

    // Get email IDs that need embeddings
    const emailIds: Id<"emails">[] = await ctx.runQuery(internal.emailEmbeddingsHelpers.getEmailsNeedingEmbeddings, {
      userId: args.userId,
      limit: batchSize,
    });

    console.log(`[Embeddings] Backfilling ${emailIds.length} emails for user ${args.userId}`);

    // Process in parallel (with some throttling)
    const PARALLEL_LIMIT = 5;
    for (let i = 0; i < emailIds.length; i += PARALLEL_LIMIT) {
      const batch = emailIds.slice(i, i + PARALLEL_LIMIT);
      await Promise.all(
        batch.map((emailId: Id<"emails">) =>
          ctx.runAction(internal.emailEmbeddings.generateEmbedding, { emailId })
        )
      );
    }

    return { processed: emailIds.length };
  },
});
