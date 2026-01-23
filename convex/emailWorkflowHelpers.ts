import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { encryptedPii } from "./pii";

// Generate fallback avatar URL from name/email using UI Avatars service
function getFallbackAvatarUrl(name: string | undefined, email: string): string {
  const displayName = name || email.split("@")[0];
  const encoded = encodeURIComponent(displayName);
  const colors = ["6366F1", "8B5CF6", "EC4899", "F59E0B", "10B981", "3B82F6", "EF4444"];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash) + email.charCodeAt(i);
    hash = hash & hash;
  }
  const colorIndex = Math.abs(hash) % colors.length;
  const bgColor = colors[colorIndex];
  return `https://ui-avatars.com/api/?name=${encoded}&background=${bgColor}&color=fff&size=200&bold=true`;
}

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
      senderAvatarUrl?: string;
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

      // Get PII helper for decryption
      const pii = await encryptedPii.forUserQuery(ctx, email.userId);

      // Decrypt subject and contact name
      let subject = "";
      let contactName: string | undefined;
      if (pii) {
        subject = await pii.decrypt(email.subject) ?? "";
        if (contact?.name) {
          contactName = await pii.decrypt(contact.name) ?? undefined;
        }
      }

      // Get fresh avatar URL - Convex storage URLs expire, so regenerate from storageId
      let avatarUrl: string | undefined;
      if (contact?.avatarStorageId) {
        // Get fresh URL from storage (these are signed URLs that expire)
        avatarUrl = await ctx.storage.getUrl(contact.avatarStorageId) ?? undefined;
        console.log(`[EmailWorkflowHelpers] Got fresh storage URL for ${contact.email}: ${avatarUrl ? "success" : "failed"}`);
      }
      // Fallback to cached URL if no storage ID
      if (!avatarUrl && contact?.avatarUrl) {
        avatarUrl = contact.avatarUrl;
        console.log(`[EmailWorkflowHelpers] Using cached avatarUrl for ${contact.email}: ${avatarUrl}`);
      }
      // Final fallback to generated avatar
      if (!avatarUrl && contact?.email) {
        avatarUrl = getFallbackAvatarUrl(contactName, contact.email);
        console.log(`[EmailWorkflowHelpers] Generated fallback avatar for ${contact.email}: ${avatarUrl}`);
      }

      console.log(`[EmailWorkflowHelpers] Contact for email "${subject}": name=${contactName}, email=${contact?.email}, storageId=${contact?.avatarStorageId || "none"}, finalAvatarUrl=${avatarUrl || "none"}`);

      // Track the most urgent
      if (!mostUrgent || summary.urgencyScore > mostUrgent.urgencyScore) {
        mostUrgent = {
          emailId: email._id,
          subject,
          senderName: contactName || contact?.email,
          senderAvatarUrl: avatarUrl,
          urgencyScore: summary.urgencyScore,
        };
      }
    }

    return mostUrgent;
  },
});

// Filter out subscription/newsletter/marketing emails from a list of external IDs
export const filterOutSubscriptions = internalQuery({
  args: { externalIds: v.array(v.string()) },
  handler: async (ctx, args): Promise<string[]> => {
    const nonSubscriptionIds: string[] = [];
    for (const externalId of args.externalIds) {
      const email = await ctx.db
        .query("emails")
        .withIndex("by_external_id", (q) =>
          q.eq("externalId", externalId).eq("provider", "gmail")
        )
        .first();

      if (!email) continue;

      // Skip if marked as subscription (has List-Unsubscribe header)
      if (email.isSubscription) {
        console.log(`[Filter] Skipping subscription: ${email.subject}`);
        continue;
      }

      // Get the AI summary for this email
      const summary = await ctx.db
        .query("emailSummaries")
        .withIndex("by_email", (q) => q.eq("emailId", email._id))
        .first();

      // Skip if AI classified as marketing email (promotional, newsletters, automated, etc.)
      // Type assertion needed until generated types are regenerated with `convex dev`
      if ((summary as { isMarketing?: boolean } | null)?.isMarketing === true) {
        console.log(`[Filter] Skipping marketing email: ${email.subject}`);
        continue;
      }

      // Skip if AI determined it's FYI/none (newsletters, marketing, etc.)
      if (summary?.actionRequired === "fyi" || summary?.actionRequired === "none") {
        console.log(`[Filter] Skipping FYI/none email: ${email.subject}`);
        continue;
      }

      // Skip if urgency score is very low (likely marketing that slipped through)
      if (summary?.urgencyScore !== undefined && summary.urgencyScore < 40) {
        console.log(`[Filter] Skipping low urgency (${summary.urgencyScore}): ${email.subject}`);
        continue;
      }

      nonSubscriptionIds.push(externalId);
    }
    return nonSubscriptionIds;
  },
});
