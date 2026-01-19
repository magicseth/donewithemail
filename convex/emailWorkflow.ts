import { v } from "convex/values";
import { workflow } from "./workflow";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

// Threshold for high priority emails (urgencyScore >= this value triggers notification)
const HIGH_PRIORITY_THRESHOLD = 70;

// Workflow to process new emails and send notification only if high priority
export const processNewEmails = workflow.define({
  args: {
    userId: v.id("users"),
    userEmail: v.string(),
    externalIds: v.array(v.string()),
  },
  returns: v.object({
    stored: v.number(),
    summarized: v.number(),
    highPriorityCount: v.number(),
    notificationSent: v.boolean(),
  }),
  handler: async (step, args): Promise<{ stored: number; summarized: number; highPriorityCount: number; notificationSent: boolean }> => {
    // Step 1: Fetch and store emails from Gmail
    const fetchResult = await step.runAction(
      internal.gmailSync.fetchAndStoreEmailsByIds,
      {
        userEmail: args.userEmail,
        messageIds: args.externalIds,
      }
    );

    console.log(`Fetched ${fetchResult.stored.length} emails, ${fetchResult.failed.length} failed`);

    // If no emails were stored successfully, return early
    if (fetchResult.stored.length === 0) {
      return {
        stored: 0,
        summarized: 0,
        highPriorityCount: 0,
        notificationSent: false,
      };
    }

    // Step 2: Summarize all stored emails
    const summarizeResults = await step.runAction(
      internal.summarizeActions.summarizeByExternalIds,
      {
        externalIds: fetchResult.stored,
        userEmail: args.userEmail,
      }
    );

    // Step 3: Check if any email is high priority
    const highPriorityExternalIds: string[] = [];
    let highestUrgency = 0;

    for (const result of summarizeResults) {
      if (result.success && result.result) {
        const urgency = result.result.urgencyScore;
        if (urgency >= HIGH_PRIORITY_THRESHOLD) {
          highPriorityExternalIds.push(result.externalId);
          if (urgency > highestUrgency) {
            highestUrgency = urgency;
          }
        }
      }
    }

    // Filter out subscription/newsletter emails from notifications
    let filteredExternalIds = highPriorityExternalIds;
    if (highPriorityExternalIds.length > 0) {
      filteredExternalIds = await step.runQuery(
        internal.emailWorkflowHelpers.filterOutSubscriptions,
        { externalIds: highPriorityExternalIds }
      );
    }

    const highPriorityCount = filteredExternalIds.length;

    // Step 4: Send notification only if there are high priority non-subscription emails
    if (highPriorityCount > 0) {
      // Get details of the most urgent email for the notification
      const emailDetails = await step.runQuery(
        internal.emailWorkflowHelpers.getMostUrgentEmailDetails,
        {
          externalIds: filteredExternalIds,
          threshold: HIGH_PRIORITY_THRESHOLD,
        }
      );

      await step.runMutation(internal.notifications.sendHighPriorityNotification, {
        userId: args.userId,
        highPriorityCount,
        totalCount: fetchResult.stored.length,
        mostUrgentSubject: emailDetails?.subject,
        mostUrgentSender: emailDetails?.senderName,
        mostUrgentSenderAvatar: emailDetails?.senderAvatarUrl,
        mostUrgentEmailId: emailDetails?.emailId,
        urgencyScore: emailDetails?.urgencyScore || highestUrgency,
      });
    }

    return {
      stored: fetchResult.stored.length,
      summarized: summarizeResults.length,
      highPriorityCount,
      notificationSent: highPriorityCount > 0,
    };
  },
});

// Internal mutation to start the workflow (called from emailSync action)
export const startEmailProcessing = internalMutation({
  args: {
    userId: v.id("users"),
    userEmail: v.string(),
    externalIds: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<{ workflowId: string }> => {
    const workflowId: string = await workflow.start(
      ctx,
      internal.emailWorkflow.processNewEmails,
      {
        userId: args.userId,
        userEmail: args.userEmail,
        externalIds: args.externalIds,
      }
    );
    return { workflowId };
  },
});
