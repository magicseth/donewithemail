import { v } from "convex/values";
import { workflow } from "./workflow";
import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Type for email data passed to AI analysis
interface EmailForAnalysis {
  id: string;
  subject: string;
  bodyPreview: string;
  fromEmail: string;
  fromName?: string;
}

/**
 * Workflow to find missed TODOs in the last 2 weeks of emails
 *
 * Steps:
 * 1. Get recent untriaged emails
 * 2. Filter out emails from self
 * 3. Use AI to analyze which need response
 * 4. Check if user has replied to those threads
 * 5. Mark unreplied emails as reply_needed
 * 6. Send notification with results
 */
export const findMissedTodos = workflow.define({
  args: {
    userId: v.id("users"),
    userEmail: v.string(),
  },
  returns: v.object({
    scanned: v.number(),
    found: v.number(),
  }),
  handler: async (step, args): Promise<{ scanned: number; found: number }> => {
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

    // Step 1: Get recent untriaged emails
    const emails = await step.runQuery(
      internal.missedTodosHelpers.getRecentUntriagedEmails,
      { userId: args.userId, sinceTimestamp: twoWeeksAgo }
    );

    console.log(`Found ${emails.length} untriaged emails from last 2 weeks`);

    if (emails.length === 0) {
      return { scanned: 0, found: 0 };
    }

    // Step 2: Filter out emails from self
    const userEmailLower = args.userEmail.toLowerCase();
    const fromOthers = emails.filter(
      (e) => e.fromEmail.toLowerCase() !== userEmailLower
    );

    console.log(`${fromOthers.length} emails are from others`);

    if (fromOthers.length === 0) {
      return { scanned: emails.length, found: 0 };
    }

    // Step 3: Batch AI analysis (needs response + real person)
    const emailsForAnalysis: EmailForAnalysis[] = fromOthers.map((e) => ({
      id: e._id,
      subject: e.subject,
      bodyPreview: e.bodyPreview,
      fromEmail: e.fromEmail,
      fromName: e.fromName,
    }));

    const analysisResults = await step.runAction(
      internal.missedTodosWorkflow.analyzeEmailsForMissedTodos,
      { emails: emailsForAnalysis }
    );

    const needsResponse = analysisResults.filter((r) => r.needsResponse);
    console.log(`${needsResponse.length} emails identified as needing response`);

    // Step 4: For emails that need response, check if replied
    let foundCount = 0;
    for (const result of needsResponse) {
      const email = fromOthers.find((e) => e._id === result.emailId);

      if (!email) continue;

      // Check if user has likely replied to this thread
      let hasReplied = false;
      if (email.threadId) {
        hasReplied = await step.runQuery(
          internal.missedTodosHelpers.hasUserRepliedToThread,
          {
            userId: args.userId,
            threadId: email.threadId,
            userEmail: args.userEmail,
            emailTimestamp: email.receivedAt,
            originalSenderEmail: email.fromEmail,
          }
        );
      }

      // If no reply, mark as reply_needed
      if (!hasReplied) {
        await step.runMutation(internal.missedTodosHelpers.markAsReplyNeeded, {
          emailId: result.emailId as Id<"emails">,
        });
        foundCount++;
        console.log(`Marked as reply_needed: "${email.subject}"`);
      }
    }

    // Step 5: Send notification with results
    if (foundCount > 0) {
      await step.runMutation(internal.notifications.sendMissedTodosNotification, {
        userId: args.userId,
        foundCount,
      });
    }

    return { scanned: emails.length, found: foundCount };
  },
});

/**
 * Client-callable mutation to start the missed todos search workflow
 * Takes user email as parameter (matches pattern used by other queries)
 */
export const startMissedTodosSearchByEmail = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args): Promise<{ workflowId: string }> => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const workflowId: string = await workflow.start(
      ctx,
      internal.missedTodos.findMissedTodos,
      {
        userId: user._id,
        userEmail: user.email,
      }
    );

    return { workflowId };
  },
});
