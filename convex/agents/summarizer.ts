import { Agent } from "@convex-dev/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { components } from "../_generated/api";

/**
 * Email Summarizer Agent
 *
 * Processes incoming emails to generate:
 * - A concise 1-2 sentence summary
 * - Key action items (if any)
 * - Urgency score (0-100) with reasoning
 * - Suggested reply (if action needed)
 */
export const summarizerAgent = new Agent(components.agent, {
  name: "summarizer",
  languageModel: anthropic("claude-sonnet-4-20250514"),
  instructions: `You are an email summarization assistant. Your job is to analyze emails and provide:

1. **Summary**: A concise 1-2 sentence summary of the email's main point.

2. **Action Items**: List any specific action items or requests. If none, say "No action items."

3. **Urgency Score**: A number from 0-100 indicating urgency, where:
   - 0-20: Low priority, can wait
   - 21-50: Normal priority, address within a few days
   - 51-80: Important, address within 24 hours
   - 81-100: Urgent, requires immediate attention

4. **Urgency Reason**: A brief explanation of why you assigned this urgency score.

5. **Suggested Reply** (optional): If a reply is needed, draft a brief, professional response.

Guidelines:
- Be concise and direct
- Focus on actionable information
- Consider sender context when assessing urgency
- Preserve important details like dates, amounts, and names
- When suggesting replies, match the tone of the original email

Output your analysis as structured JSON.`,
});

/**
 * Type for summarizer output
 */
export interface EmailSummaryResult {
  summary: string;
  actionItems: string[];
  urgencyScore: number;
  urgencyReason: string;
  suggestedReply?: string;
}
