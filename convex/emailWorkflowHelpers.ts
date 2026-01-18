import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Get details of the most urgent email from a list of external IDs
export const getMostUrgentEmailDetails = internalQuery({
  args: {
    externalIds: v.array(v.string()),
    threshold: v.number(),
  },
  handler: async (ctx, args) => {
    let mostUrgent: {
      emailId: Id<"emails">;
      subject: string;
      senderName?: string;
      urgencyScore: number;
    } | null = null;

    for (const externalId of args.externalIds) {
      // Find the email
      const email = await ctx.db
        .query("emails")
        .withIndex("by_external_id", (q) =>
          q.eq("externalId", externalId).eq("provider", "gmail")
        )
        .first();

      if (!email) continue;

      // Get its summary
      const summary = await ctx.db
        .query("emailSummaries")
        .withIndex("by_email", (q) => q.eq("emailId", email._id))
        .first();

      if (!summary || summary.urgencyScore < args.threshold) continue;

      // Get sender info
      const contact = await ctx.db.get(email.from);

      // Track the most urgent
      if (!mostUrgent || summary.urgencyScore > mostUrgent.urgencyScore) {
        mostUrgent = {
          emailId: email._id,
          subject: email.subject,
          senderName: contact?.name || contact?.email,
          urgencyScore: summary.urgencyScore,
        };
      }
    }

    return mostUrgent;
  },
});
