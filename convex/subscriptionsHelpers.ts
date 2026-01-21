import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { encryptedPii } from "./pii";

// Determine the best unsubscribe method based on available options
export function determineUnsubscribeMethod(
  listUnsubscribe: string | undefined,
  listUnsubscribePost: boolean | undefined
): "http_post" | "http_get" | "mailto" | "none" {
  if (!listUnsubscribe) return "none";

  // Parse to find HTTP and mailto URLs
  const result: { httpUrl?: string; mailtoUrl?: string } = {};
  const matches = listUnsubscribe.matchAll(/<([^>]+)>/g);
  for (const match of matches) {
    const url = match[1];
    if (url.startsWith("http://") || url.startsWith("https://")) {
      result.httpUrl = url;
    } else if (url.startsWith("mailto:")) {
      result.mailtoUrl = url;
    }
  }

  // If we have HTTP URL and List-Unsubscribe-Post header, use one-click POST
  if (result.httpUrl && listUnsubscribePost) {
    return "http_post";
  }

  // If we have mailto, prefer that (more reliable than HTTP GET)
  if (result.mailtoUrl) {
    return "mailto";
  }

  // If we only have HTTP URL without POST support, it needs manual confirmation
  if (result.httpUrl) {
    return "http_get";
  }

  return "none";
}

// Internal mutation to upsert a subscription when an email with List-Unsubscribe is synced
export const upsertSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    listUnsubscribe: v.optional(v.string()),
    listUnsubscribePost: v.optional(v.boolean()),
    emailId: v.id("emails"),
    receivedAt: v.number(),
    subject: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Extract domain from sender email
    const domain = args.senderEmail.split("@")[1] || "";

    // Get PII helper for encrypting sender name and subject
    const pii = await encryptedPii.forUser(ctx, args.userId);

    // Check if subscription already exists
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_sender", (q) =>
        q.eq("userId", args.userId).eq("senderEmail", args.senderEmail)
      )
      .first();

    const unsubscribeMethod = determineUnsubscribeMethod(
      args.listUnsubscribe,
      args.listUnsubscribePost
    );

    if (existing) {
      // Update existing subscription
      const updates: Record<string, unknown> = {
        emailCount: existing.emailCount + 1,
        lastEmailAt: Math.max(existing.lastEmailAt, args.receivedAt),
      };

      // Update most recent email info if this is newer
      if (args.receivedAt > existing.lastEmailAt) {
        updates.mostRecentEmailId = args.emailId;
        if (args.subject) {
          updates.mostRecentSubject = await pii.encrypt(args.subject);
        }
      }

      // Update unsubscribe info if we have better data now
      if (args.listUnsubscribe && (!existing.listUnsubscribe || unsubscribeMethod !== "none")) {
        updates.listUnsubscribe = args.listUnsubscribe;
        updates.listUnsubscribePost = args.listUnsubscribePost;
        updates.unsubscribeMethod = unsubscribeMethod;
      }

      // Update sender name if provided and we don't have one (encrypt it)
      if (args.senderName && !existing.senderName) {
        updates.senderName = await pii.encrypt(args.senderName);
      }

      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    // Encrypt PII fields for new subscription
    const encryptedSenderName = args.senderName
      ? await pii.encrypt(args.senderName)
      : undefined;
    const encryptedSubject = args.subject
      ? await pii.encrypt(args.subject)
      : undefined;

    // Create new subscription
    const subscriptionId = await ctx.db.insert("subscriptions", {
      userId: args.userId,
      senderEmail: args.senderEmail,
      senderDomain: domain,
      senderName: encryptedSenderName,
      listUnsubscribe: args.listUnsubscribe,
      listUnsubscribePost: args.listUnsubscribePost,
      unsubscribeMethod,
      emailCount: 1,
      firstEmailAt: args.receivedAt,
      lastEmailAt: args.receivedAt,
      unsubscribeStatus: "subscribed",
      mostRecentEmailId: args.emailId,
      mostRecentSubject: encryptedSubject,
    });

    return subscriptionId;
  },
});

// Query to get all subscriptions for a user (for the UI)
export const getSubscriptions = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    // Get user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) return [];

    // Get all subscriptions sorted by last email date
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_last_email", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, user._id);

    // Decrypt PII fields for each subscription
    const decryptedSubscriptions = await Promise.all(
      subscriptions.map(async (sub) => {
        let senderName: string | undefined;
        let mostRecentSubject: string | undefined;

        if (pii) {
          if (sub.senderName) {
            senderName = await pii.decrypt(sub.senderName) ?? undefined;
          }
          if (sub.mostRecentSubject) {
            mostRecentSubject = await pii.decrypt(sub.mostRecentSubject) ?? undefined;
          }
        }

        return {
          _id: sub._id,
          _creationTime: sub._creationTime,
          userId: sub.userId,
          senderEmail: sub.senderEmail,
          senderDomain: sub.senderDomain,
          senderName,
          listUnsubscribe: sub.listUnsubscribe,
          listUnsubscribePost: sub.listUnsubscribePost,
          unsubscribeMethod: sub.unsubscribeMethod,
          emailCount: sub.emailCount,
          firstEmailAt: sub.firstEmailAt,
          lastEmailAt: sub.lastEmailAt,
          unsubscribeStatus: sub.unsubscribeStatus,
          unsubscribedAt: sub.unsubscribedAt,
          mostRecentEmailId: sub.mostRecentEmailId,
          mostRecentSubject,
        };
      })
    );

    return decryptedSubscriptions;
  },
});

// Internal mutation to update subscription status
export const updateStatus = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    status: v.union(
      v.literal("subscribed"),
      v.literal("pending"),
      v.literal("processing"),
      v.literal("unsubscribed"),
      v.literal("failed"),
      v.literal("manual_required")
    ),
    unsubscribedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const updates: Partial<Doc<"subscriptions">> = {
      unsubscribeStatus: args.status,
    };
    if (args.unsubscribedAt) {
      updates.unsubscribedAt = args.unsubscribedAt;
    }
    await ctx.db.patch(args.subscriptionId, updates);
  },
});

// Internal query to get user by email (with decrypted tokens)
export const getUserByEmailInternal = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) return null;

    // Decrypt tokens
    const pii = await encryptedPii.forUserQuery(ctx, user._id);
    let gmailAccessToken: string | undefined;
    let gmailRefreshToken: string | undefined;

    if (pii) {
      if (user.gmailAccessToken) {
        gmailAccessToken = (await pii.decrypt(user.gmailAccessToken)) ?? undefined;
      }
      if (user.gmailRefreshToken) {
        gmailRefreshToken = (await pii.decrypt(user.gmailRefreshToken)) ?? undefined;
      }
    }

    return {
      _id: user._id,
      email: user.email,
      gmailAccessToken,
      gmailRefreshToken,
      gmailTokenExpiresAt: user.gmailTokenExpiresAt,
    };
  },
});

// Internal query to get user by WorkOS ID (with decrypted tokens)
export const getUserByWorkosId = internalQuery({
  args: { workosId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
      .first();

    if (!user) return null;

    // Decrypt tokens
    const pii = await encryptedPii.forUserQuery(ctx, user._id);
    let gmailAccessToken: string | undefined;
    let gmailRefreshToken: string | undefined;

    if (pii) {
      if (user.gmailAccessToken) {
        gmailAccessToken = (await pii.decrypt(user.gmailAccessToken)) ?? undefined;
      }
      if (user.gmailRefreshToken) {
        gmailRefreshToken = (await pii.decrypt(user.gmailRefreshToken)) ?? undefined;
      }
    }

    return {
      _id: user._id,
      email: user.email,
      gmailAccessToken,
      gmailRefreshToken,
      gmailTokenExpiresAt: user.gmailTokenExpiresAt,
    };
  },
});

// Internal query to get user by ID (with decrypted tokens)
export const getUserByIdInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Decrypt tokens
    const pii = await encryptedPii.forUserQuery(ctx, user._id);
    let gmailAccessToken: string | undefined;
    let gmailRefreshToken: string | undefined;

    if (pii) {
      if (user.gmailAccessToken) {
        gmailAccessToken = (await pii.decrypt(user.gmailAccessToken)) ?? undefined;
      }
      if (user.gmailRefreshToken) {
        gmailRefreshToken = (await pii.decrypt(user.gmailRefreshToken)) ?? undefined;
      }
    }

    return {
      _id: user._id,
      email: user.email,
      gmailAccessToken,
      gmailRefreshToken,
      gmailTokenExpiresAt: user.gmailTokenExpiresAt,
    };
  },
});

// Internal query to get subscription by ID
export const getSubscriptionById = internalQuery({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.subscriptionId);
  },
});

// Internal query to get emails that haven't been checked for subscriptions
export const getEmailsWithoutSubscriptionCheck = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get emails that haven't been processed yet (isSubscription is undefined)
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Filter to those without subscription check
    const filtered = emails.filter((e) => e.isSubscription === undefined);

    // Decrypt subject for each email
    const pii = await encryptedPii.forUserQuery(ctx, args.userId);

    return Promise.all(
      filtered.map(async (e) => {
        let subject = "";
        if (pii && e.subject) {
          subject = (await pii.decrypt(e.subject)) ?? "";
        }
        return {
          _id: e._id,
          externalId: e.externalId,
          from: e.from,
          receivedAt: e.receivedAt,
          listUnsubscribe: e.listUnsubscribe,
          isSubscription: e.isSubscription,
          subject,
        };
      })
    );
  },
});

// Internal mutation to update email with subscription headers
export const updateEmailSubscriptionHeaders = internalMutation({
  args: {
    emailId: v.id("emails"),
    listUnsubscribe: v.optional(v.string()),
    listUnsubscribePost: v.optional(v.boolean()),
    isSubscription: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailId, {
      listUnsubscribe: args.listUnsubscribe,
      listUnsubscribePost: args.listUnsubscribePost,
      isSubscription: args.isSubscription,
    });
  },
});

// Internal query to get contact by ID (with decrypted name)
export const getContactById = internalQuery({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return null;

    // Decrypt name
    const pii = await encryptedPii.forUserQuery(ctx, contact.userId);
    let name: string | undefined;
    if (pii && contact.name) {
      name = (await pii.decrypt(contact.name)) ?? undefined;
    }

    return {
      email: contact.email,
      name,
    };
  },
});

// Mutation to delete subscription records for a user (part of reset)
export const deleteSubscriptions = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const sub of subscriptions) {
      await ctx.db.delete(sub._id);
    }

    return { deleted: subscriptions.length };
  },
});

// Mutation to reset subscription flags on a batch of emails
export const resetEmailSubscriptionFlags = internalMutation({
  args: {
    emailIds: v.array(v.id("emails")),
  },
  handler: async (ctx, args) => {
    let reset = 0;
    for (const emailId of args.emailIds) {
      const email = await ctx.db.get(emailId);
      if (email) {
        await ctx.db.patch(emailId, {
          isSubscription: undefined,
          listUnsubscribe: undefined,
          listUnsubscribePost: undefined,
        });
        reset++;
      }
    }
    return { reset };
  },
});

// Query to get all email IDs for a user (for force rescan)
export const getEmailIdsForReset = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return emails.map((e) => e._id);
  },
});

// Mark all untriaged emails from a sender as done (used when unsubscribing)
export const triageEmailsFromSender = internalMutation({
  args: {
    userId: v.id("users"),
    senderEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the contact by email
    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.senderEmail)
      )
      .first();

    if (!contact) {
      console.log(`[TriageSender] No contact found for ${args.senderEmail}`);
      return { triaged: 0 };
    }

    // Get all untriaged emails from this sender
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_from", (q) => q.eq("from", contact._id))
      .collect();

    // Filter to untriaged only
    const untriagedEmails = emails.filter(
      (e) => e.userId === args.userId && !e.isTriaged
    );

    // Mark all as done
    let triaged = 0;
    for (const email of untriagedEmails) {
      await ctx.db.patch(email._id, {
        isTriaged: true,
        triageAction: "done",
        triagedAt: Date.now(),
      });
      triaged++;
    }

    console.log(`[TriageSender] Marked ${triaged} emails from ${args.senderEmail} as done`);
    return { triaged };
  },
});
