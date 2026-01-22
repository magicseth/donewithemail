/**
 * Seed script to populate initial changelog entries.
 * Run this manually from the Convex dashboard or during deployment.
 */

import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if we already have changelogs
    const existing = await ctx.db.query("changelogs").first();
    if (existing) {
      console.log("Changelogs already seeded, skipping");
      return { message: "Changelogs already exist" };
    }

    // Add some sample changelog entries
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    await ctx.db.insert("changelogs", {
      version: "1.0.0",
      title: "Welcome to Sayless!",
      description: "Your AI-powered email triage app is ready. Swipe through emails with TikTok-style gestures, get AI summaries, and never miss important messages.",
      type: "feature",
      createdAt: oneWeekAgo,
      publishedAt: oneWeekAgo,
    });

    await ctx.db.insert("changelogs", {
      version: "1.0.1",
      title: "Email Attachments",
      description: "You can now view email attachments directly in the app. Tap on any attachment to preview PDFs, images, and other files.",
      type: "feature",
      createdAt: now,
      publishedAt: now,
    });

    await ctx.db.insert("changelogs", {
      version: "1.0.1",
      title: "Batch Email Triage",
      description: "Added AI-powered batch triage for your inbox. Let AI automatically categorize multiple emails at once.",
      type: "feature",
      createdAt: now,
      publishedAt: now,
    });

    await ctx.db.insert("changelogs", {
      version: "1.0.1",
      title: "Improved Email Flag Persistence",
      description: "Fixed an issue where email flags weren't persisting correctly in the FYI section.",
      type: "bugfix",
      createdAt: now,
      publishedAt: now,
    });

    return { message: "Changelogs seeded successfully" };
  },
});
