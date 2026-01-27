import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { authedQuery, authedMutation } from "./functions";
import { encryptedPii, EncryptedField } from "./pii";
import { ContactFact, WritingStyle, Commitment } from "./schema";

// =============================================================================
// Internal Functions (used by email sync)
// =============================================================================

/**
 * Upsert a contact (create or update) - used by email sync
 */
export const upsertContact = mutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email)
      )
      .first();

    const now = Date.now();

    // Get PII helper for encrypting name
    const pii = await encryptedPii.forUser(ctx, args.userId);

    if (existing) {
      // Only update name if provided and encrypt it
      let encryptedName: EncryptedField | undefined;
      if (args.name) {
        encryptedName = await pii.encrypt(args.name);
      }

      await ctx.db.patch(existing._id, {
        name: encryptedName ?? existing.name,
        avatarUrl: args.avatarUrl ?? existing.avatarUrl,
        emailCount: existing.emailCount + 1,
        lastEmailAt: now,
      });

      return { contactId: existing._id, isNew: false };
    }

    // Encrypt name for new contact
    const encryptedName = args.name ? await pii.encrypt(args.name) : undefined;

    // Create new contact
    const contactId = await ctx.db.insert("contacts", {
      userId: args.userId,
      email: args.email,
      name: encryptedName,
      avatarUrl: args.avatarUrl,
      emailCount: 1,
      lastEmailAt: now,
      relationship: "unknown",
    });

    return { contactId, isNew: true };
  },
});

// =============================================================================
// Authenticated endpoints (require valid JWT)
// =============================================================================

// Helper type for decrypted contact
interface DecryptedContact {
  _id: string;
  userId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  emailCount: number;
  lastEmailAt: number;
  relationship?: "vip" | "regular" | "unknown";
  relationshipSummary?: string;
  facts?: ContactFact[];
  writingStyle?: WritingStyle;
  commitments?: Commitment[];
}

/**
 * Search contacts for autocomplete (lightweight version)
 * Returns email, name, and avatarUrl only
 */
export const searchMyContacts = authedQuery({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<{ email: string; name?: string; avatarUrl?: string }>> => {
    const limit = args.limit ?? 10;
    const queryLower = args.query.toLowerCase();

    // If query is empty, return recent contacts
    if (!queryLower) {
      const recentContacts = await ctx.db
        .query("contacts")
        .withIndex("by_user_last_email", (q) => q.eq("userId", ctx.userId))
        .order("desc")
        .take(limit);

      const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);

      return Promise.all(
        recentContacts.map(async (contact) => {
          let name: string | undefined;
          if (pii && contact.name) {
            name = await pii.decrypt(contact.name) ?? undefined;
          }
          return {
            email: contact.email,
            name,
            avatarUrl: contact.avatarUrl,
          };
        })
      );
    }

    // Get contacts and filter by email prefix (email is unencrypted)
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect();

    // Filter by email containing the query
    const matchingContacts = contacts
      .filter((c) => c.email.toLowerCase().includes(queryLower))
      .slice(0, limit);

    const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);

    return Promise.all(
      matchingContacts.map(async (contact) => {
        let name: string | undefined;
        if (pii && contact.name) {
          name = await pii.decrypt(contact.name) ?? undefined;
        }
        return {
          email: contact.email,
          name,
          avatarUrl: contact.avatarUrl,
        };
      })
    );
  },
});

/**
 * Get a contact by ID for the current user (with ownership check)
 */
export const getMyContact = authedQuery({
  args: {
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args): Promise<DecryptedContact | null> => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return null;

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);

    // Decrypt PII fields
    let name: string | undefined;
    let relationshipSummary: string | undefined;
    let facts: ContactFact[] | undefined;
    let writingStyle: WritingStyle | undefined;
    let commitments: Commitment[] | undefined;

    if (pii) {
      if (contact.name) {
        name = await pii.decrypt(contact.name) ?? undefined;
      }
      if (contact.relationshipSummary) {
        relationshipSummary = await pii.decrypt(contact.relationshipSummary) ?? undefined;
      }
      if (contact.facts) {
        const factsJson = await pii.decrypt(contact.facts);
        if (factsJson) facts = JSON.parse(factsJson);
      }
      if (contact.writingStyle) {
        const wsJson = await pii.decrypt(contact.writingStyle);
        if (wsJson) writingStyle = JSON.parse(wsJson);
      }
      if (contact.commitments) {
        const commitmentsJson = await pii.decrypt(contact.commitments);
        if (commitmentsJson) commitments = JSON.parse(commitmentsJson);
      }
    }

    return {
      _id: contact._id,
      userId: contact.userId,
      email: contact.email,
      name,
      avatarUrl: contact.avatarUrl,
      emailCount: contact.emailCount,
      lastEmailAt: contact.lastEmailAt,
      relationship: contact.relationship,
      relationshipSummary,
      facts,
      writingStyle,
      commitments,
    };
  },
});

/**
 * Get contact by email address for the current user
 */
export const getMyContactByEmail = authedQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args): Promise<DecryptedContact | null> => {
    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", ctx.userId).eq("email", args.email)
      )
      .first();

    if (!contact) return null;

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);

    // Decrypt PII fields
    let name: string | undefined;
    let relationshipSummary: string | undefined;
    let facts: ContactFact[] | undefined;
    let writingStyle: WritingStyle | undefined;
    let commitments: Commitment[] | undefined;

    if (pii) {
      if (contact.name) {
        name = await pii.decrypt(contact.name) ?? undefined;
      }
      if (contact.relationshipSummary) {
        relationshipSummary = await pii.decrypt(contact.relationshipSummary) ?? undefined;
      }
      if (contact.facts) {
        const factsJson = await pii.decrypt(contact.facts);
        if (factsJson) facts = JSON.parse(factsJson);
      }
      if (contact.writingStyle) {
        const wsJson = await pii.decrypt(contact.writingStyle);
        if (wsJson) writingStyle = JSON.parse(wsJson);
      }
      if (contact.commitments) {
        const commitmentsJson = await pii.decrypt(contact.commitments);
        if (commitmentsJson) commitments = JSON.parse(commitmentsJson);
      }
    }

    return {
      _id: contact._id,
      userId: contact.userId,
      email: contact.email,
      name,
      avatarUrl: contact.avatarUrl,
      emailCount: contact.emailCount,
      lastEmailAt: contact.lastEmailAt,
      relationship: contact.relationship,
      relationshipSummary,
      facts,
      writingStyle,
      commitments,
    };
  },
});

/**
 * Get all contacts for the current user, sorted by last email
 */
export const getMyContacts = authedQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<DecryptedContact[]> => {
    const limit = args.limit ?? 100;

    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user_last_email", (q) => q.eq("userId", ctx.userId))
      .order("desc")
      .take(limit);

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);

    // Decrypt all contacts
    return Promise.all(
      contacts.map(async (contact) => {
        let name: string | undefined;
        let relationshipSummary: string | undefined;
        let facts: ContactFact[] | undefined;
        let writingStyle: WritingStyle | undefined;
        let commitments: Commitment[] | undefined;

        if (pii) {
          if (contact.name) {
            name = await pii.decrypt(contact.name) ?? undefined;
          }
          if (contact.relationshipSummary) {
            relationshipSummary = await pii.decrypt(contact.relationshipSummary) ?? undefined;
          }
          if (contact.facts) {
            const factsJson = await pii.decrypt(contact.facts);
            if (factsJson) facts = JSON.parse(factsJson);
          }
          if (contact.writingStyle) {
            const wsJson = await pii.decrypt(contact.writingStyle);
            if (wsJson) writingStyle = JSON.parse(wsJson);
          }
          if (contact.commitments) {
            const commitmentsJson = await pii.decrypt(contact.commitments);
            if (commitmentsJson) commitments = JSON.parse(commitmentsJson);
          }
        }

        return {
          _id: contact._id,
          userId: contact.userId,
          email: contact.email,
          name,
          avatarUrl: contact.avatarUrl,
          emailCount: contact.emailCount,
          lastEmailAt: contact.lastEmailAt,
          relationship: contact.relationship,
          relationshipSummary,
          facts,
          writingStyle,
          commitments,
        };
      })
    );
  },
});

/**
 * Get VIP contacts for the current user
 */
export const getMyVIPContacts = authedQuery({
  args: {},
  handler: async (ctx): Promise<DecryptedContact[]> => {
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect();

    const vipContacts = contacts.filter((c) => c.relationship === "vip");

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);

    // Decrypt all contacts
    return Promise.all(
      vipContacts.map(async (contact) => {
        let name: string | undefined;
        let relationshipSummary: string | undefined;
        let facts: ContactFact[] | undefined;
        let writingStyle: WritingStyle | undefined;
        let commitments: Commitment[] | undefined;

        if (pii) {
          if (contact.name) {
            name = await pii.decrypt(contact.name) ?? undefined;
          }
          if (contact.relationshipSummary) {
            relationshipSummary = await pii.decrypt(contact.relationshipSummary) ?? undefined;
          }
          if (contact.facts) {
            const factsJson = await pii.decrypt(contact.facts);
            if (factsJson) facts = JSON.parse(factsJson);
          }
          if (contact.writingStyle) {
            const wsJson = await pii.decrypt(contact.writingStyle);
            if (wsJson) writingStyle = JSON.parse(wsJson);
          }
          if (contact.commitments) {
            const commitmentsJson = await pii.decrypt(contact.commitments);
            if (commitmentsJson) commitments = JSON.parse(commitmentsJson);
          }
        }

        return {
          _id: contact._id,
          userId: contact.userId,
          email: contact.email,
          name,
          avatarUrl: contact.avatarUrl,
          emailCount: contact.emailCount,
          lastEmailAt: contact.lastEmailAt,
          relationship: contact.relationship,
          relationshipSummary,
          facts,
          writingStyle,
          commitments,
        };
      })
    );
  },
});

/**
 * Update contact relationship for the current user
 */
export const updateMyContactRelationship = authedMutation({
  args: {
    contactId: v.id("contacts"),
    relationship: v.union(
      v.literal("vip"),
      v.literal("regular"),
      v.literal("unknown")
    ),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    await ctx.db.patch(args.contactId, {
      relationship: args.relationship,
    });

    return { success: true };
  },
});

/**
 * Update contact relationship summary for the current user
 */
export const updateMyContactRelationshipSummary = authedMutation({
  args: {
    contactId: v.id("contacts"),
    relationshipSummary: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    // Encrypt the relationship summary
    const pii = await encryptedPii.forUser(ctx, ctx.userId);
    const encryptedSummary = await pii.encrypt(args.relationshipSummary);

    await ctx.db.patch(args.contactId, {
      relationshipSummary: encryptedSummary,
    });

    return { success: true };
  },
});

/**
 * Add a fact to a contact's dossier
 */
export const addFact = authedMutation({
  args: {
    contactId: v.id("contacts"),
    text: v.string(),
    source: v.union(v.literal("manual"), v.literal("ai")),
    sourceEmailId: v.optional(v.id("emails")),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    // Get PII helper for encryption/decryption
    const pii = await encryptedPii.forUser(ctx, ctx.userId);

    // Decrypt existing facts
    let existingFacts: ContactFact[] = [];
    if (contact.facts) {
      const factsJson = await pii.decrypt(contact.facts);
      if (factsJson) existingFacts = JSON.parse(factsJson);
    }

    const newFact: ContactFact = {
      id: crypto.randomUUID(),
      text: args.text,
      source: args.source,
      createdAt: Date.now(),
      sourceEmailId: args.sourceEmailId,
    };

    // Encrypt updated facts array
    const updatedFacts = [...existingFacts, newFact];
    const encryptedFacts = await pii.encrypt(JSON.stringify(updatedFacts));

    await ctx.db.patch(args.contactId, {
      facts: encryptedFacts,
    });

    return { success: true, factId: newFact.id };
  },
});

/**
 * Update an existing fact in a contact's dossier
 */
export const updateFact = authedMutation({
  args: {
    contactId: v.id("contacts"),
    factId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    // Get PII helper for encryption/decryption
    const pii = await encryptedPii.forUser(ctx, ctx.userId);

    // Decrypt existing facts
    let facts: ContactFact[] = [];
    if (contact.facts) {
      const factsJson = await pii.decrypt(contact.facts);
      if (factsJson) facts = JSON.parse(factsJson);
    }

    const factIndex = facts.findIndex((f) => f.id === args.factId);
    if (factIndex === -1) {
      throw new Error("Fact not found");
    }

    const updatedFacts = [...facts];
    updatedFacts[factIndex] = {
      ...updatedFacts[factIndex],
      text: args.text,
    };

    // Encrypt updated facts array
    const encryptedFacts = await pii.encrypt(JSON.stringify(updatedFacts));

    await ctx.db.patch(args.contactId, {
      facts: encryptedFacts,
    });

    return { success: true };
  },
});

/**
 * Delete a fact from a contact's dossier
 */
export const deleteFact = authedMutation({
  args: {
    contactId: v.id("contacts"),
    factId: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    // Get PII helper for encryption/decryption
    const pii = await encryptedPii.forUser(ctx, ctx.userId);

    // Decrypt existing facts
    let facts: ContactFact[] = [];
    if (contact.facts) {
      const factsJson = await pii.decrypt(contact.facts);
      if (factsJson) facts = JSON.parse(factsJson);
    }

    const updatedFacts = facts.filter((f) => f.id !== args.factId);

    // Encrypt updated facts array
    const encryptedFacts = await pii.encrypt(JSON.stringify(updatedFacts));

    await ctx.db.patch(args.contactId, {
      facts: encryptedFacts,
    });

    return { success: true };
  },
});

// Type for decrypted email preview in stats
interface DecryptedEmailPreview {
  _id: string;
  subject: string;
  bodyPreview: string;
  receivedAt: number;
  isRead: boolean;
  urgencyScore?: number;
}

/**
 * Get contact statistics for the current user
 */
export const getMyContactStats = authedQuery({
  args: {
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return null;

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);

    // Decrypt contact fields
    let name: string | undefined;
    let relationshipSummary: string | undefined;
    let facts: ContactFact[] | undefined;
    let writingStyle: WritingStyle | undefined;
    let commitments: Commitment[] | undefined;

    if (pii) {
      if (contact.name) {
        name = await pii.decrypt(contact.name) ?? undefined;
      }
      if (contact.relationshipSummary) {
        relationshipSummary = await pii.decrypt(contact.relationshipSummary) ?? undefined;
      }
      if (contact.facts) {
        const factsJson = await pii.decrypt(contact.facts);
        if (factsJson) facts = JSON.parse(factsJson);
      }
      if (contact.writingStyle) {
        const wsJson = await pii.decrypt(contact.writingStyle);
        if (wsJson) writingStyle = JSON.parse(wsJson);
      }
      if (contact.commitments) {
        const commitmentsJson = await pii.decrypt(contact.commitments);
        if (commitmentsJson) commitments = JSON.parse(commitmentsJson);
      }
    }

    const decryptedContact: DecryptedContact = {
      _id: contact._id,
      userId: contact.userId,
      email: contact.email,
      name,
      avatarUrl: contact.avatarUrl,
      emailCount: contact.emailCount,
      lastEmailAt: contact.lastEmailAt,
      relationship: contact.relationship,
      relationshipSummary,
      facts,
      writingStyle,
      commitments,
    };

    // Get email count and recent emails
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_from", (q) => q.eq("from", args.contactId))
      .order("desc")
      .take(10);

    // Fetch summaries for all emails to calculate urgent count
    const emailsWithSummaries: DecryptedEmailPreview[] = await Promise.all(
      emails.map(async (email) => {
        const summaryData = await ctx.db
          .query("emailSummaries")
          .withIndex("by_email", (q) => q.eq("emailId", email._id))
          .first();

        // Decrypt email fields
        let subject = "";
        let bodyPreview = "";
        if (pii) {
          const decrypted = await pii.decryptMany({
            subject: email.subject,
            bodyPreview: email.bodyPreview,
          });
          subject = decrypted.subject ?? "";
          bodyPreview = decrypted.bodyPreview ?? "";
        }

        return {
          _id: email._id,
          subject,
          bodyPreview,
          receivedAt: email.receivedAt,
          isRead: email.isRead,
          urgencyScore: summaryData?.urgencyScore,
        };
      })
    );

    const urgentCount = emailsWithSummaries.filter((e) => (e.urgencyScore ?? 0) > 80).length;
    const replyNeededCount = emails.filter((e) => e.triageAction === "reply_needed").length;

    return {
      contact: decryptedContact,
      recentEmails: emailsWithSummaries,
      stats: {
        totalEmails: contact.emailCount,
        urgentEmails: urgentCount,
        replyNeeded: replyNeededCount,
      },
    };
  },
});

/**
 * Get contact statistics by email address for the current user
 */
export const getMyContactStatsByEmail = authedQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the contact by email for the current user only
    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", ctx.userId).eq("email", args.email)
      )
      .first();

    if (!contact) return null;

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);

    // Decrypt contact fields
    let name: string | undefined;
    let relationshipSummary: string | undefined;
    let facts: ContactFact[] | undefined;
    let writingStyle: WritingStyle | undefined;
    let commitments: Commitment[] | undefined;

    if (pii) {
      if (contact.name) {
        name = await pii.decrypt(contact.name) ?? undefined;
      }
      if (contact.relationshipSummary) {
        relationshipSummary = await pii.decrypt(contact.relationshipSummary) ?? undefined;
      }
      if (contact.facts) {
        const factsJson = await pii.decrypt(contact.facts);
        if (factsJson) facts = JSON.parse(factsJson);
      }
      if (contact.writingStyle) {
        const wsJson = await pii.decrypt(contact.writingStyle);
        if (wsJson) writingStyle = JSON.parse(wsJson);
      }
      if (contact.commitments) {
        const commitmentsJson = await pii.decrypt(contact.commitments);
        if (commitmentsJson) commitments = JSON.parse(commitmentsJson);
      }
    }

    const decryptedContact: DecryptedContact = {
      _id: contact._id,
      userId: contact.userId,
      email: contact.email,
      name,
      avatarUrl: contact.avatarUrl,
      emailCount: contact.emailCount,
      lastEmailAt: contact.lastEmailAt,
      relationship: contact.relationship,
      relationshipSummary,
      facts,
      writingStyle,
      commitments,
    };

    // Get email count and recent emails
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_from", (q) => q.eq("from", contact._id))
      .order("desc")
      .take(10);

    // Fetch summaries for all emails to calculate urgent count
    const emailsWithSummaries: DecryptedEmailPreview[] = await Promise.all(
      emails.map(async (email) => {
        const summaryData = await ctx.db
          .query("emailSummaries")
          .withIndex("by_email", (q) => q.eq("emailId", email._id))
          .first();

        // Decrypt email fields
        let subject = "";
        let bodyPreview = "";
        if (pii) {
          const decrypted = await pii.decryptMany({
            subject: email.subject,
            bodyPreview: email.bodyPreview,
          });
          subject = decrypted.subject ?? "";
          bodyPreview = decrypted.bodyPreview ?? "";
        }

        return {
          _id: email._id,
          subject,
          bodyPreview,
          receivedAt: email.receivedAt,
          isRead: email.isRead,
          urgencyScore: summaryData?.urgencyScore,
        };
      })
    );

    const urgentCount = emailsWithSummaries.filter((e) => (e.urgencyScore ?? 0) > 80).length;
    const replyNeededCount = emails.filter((e) => e.triageAction === "reply_needed").length;

    return {
      contact: decryptedContact,
      recentEmails: emailsWithSummaries,
      stats: {
        totalEmails: contact.emailCount,
        urgentEmails: urgentCount,
        replyNeeded: replyNeededCount,
      },
    };
  },
});

// =============================================================================
// Commitment Management (Mutual asks and promises between user and contact)
// =============================================================================

/**
 * Add a commitment to a contact
 */
export const addCommitment = authedMutation({
  args: {
    contactId: v.id("contacts"),
    text: v.string(),
    direction: v.union(v.literal("from_contact"), v.literal("to_contact")),
    source: v.union(v.literal("manual"), v.literal("ai")),
    sourceEmailId: v.optional(v.id("emails")),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    // Get PII helper for encryption/decryption
    const pii = await encryptedPii.forUser(ctx, ctx.userId);

    // Decrypt existing commitments
    let existingCommitments: Commitment[] = [];
    if (contact.commitments) {
      const commitmentsJson = await pii.decrypt(contact.commitments);
      if (commitmentsJson) existingCommitments = JSON.parse(commitmentsJson);
    }

    const newCommitment: Commitment = {
      id: crypto.randomUUID(),
      text: args.text,
      direction: args.direction,
      status: "pending",
      createdAt: Date.now(),
      source: args.source,
      sourceEmailId: args.sourceEmailId,
    };

    // Encrypt updated commitments array
    const updatedCommitments = [...existingCommitments, newCommitment];
    const encryptedCommitments = await pii.encrypt(JSON.stringify(updatedCommitments));

    await ctx.db.patch(args.contactId, {
      commitments: encryptedCommitments,
    });

    return { success: true, commitmentId: newCommitment.id };
  },
});

/**
 * Update a commitment's status (mark as completed or reopen)
 */
export const updateCommitmentStatus = authedMutation({
  args: {
    contactId: v.id("contacts"),
    commitmentId: v.string(),
    status: v.union(v.literal("pending"), v.literal("completed")),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    // Get PII helper for encryption/decryption
    const pii = await encryptedPii.forUser(ctx, ctx.userId);

    // Decrypt existing commitments
    let commitments: Commitment[] = [];
    if (contact.commitments) {
      const commitmentsJson = await pii.decrypt(contact.commitments);
      if (commitmentsJson) commitments = JSON.parse(commitmentsJson);
    }

    const commitmentIndex = commitments.findIndex((c) => c.id === args.commitmentId);
    if (commitmentIndex === -1) {
      throw new Error("Commitment not found");
    }

    const updatedCommitments = [...commitments];
    updatedCommitments[commitmentIndex] = {
      ...updatedCommitments[commitmentIndex],
      status: args.status,
      completedAt: args.status === "completed" ? Date.now() : undefined,
    };

    // Encrypt updated commitments array
    const encryptedCommitments = await pii.encrypt(JSON.stringify(updatedCommitments));

    await ctx.db.patch(args.contactId, {
      commitments: encryptedCommitments,
    });

    return { success: true };
  },
});

/**
 * Update a commitment's text
 */
export const updateCommitment = authedMutation({
  args: {
    contactId: v.id("contacts"),
    commitmentId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    // Get PII helper for encryption/decryption
    const pii = await encryptedPii.forUser(ctx, ctx.userId);

    // Decrypt existing commitments
    let commitments: Commitment[] = [];
    if (contact.commitments) {
      const commitmentsJson = await pii.decrypt(contact.commitments);
      if (commitmentsJson) commitments = JSON.parse(commitmentsJson);
    }

    const commitmentIndex = commitments.findIndex((c) => c.id === args.commitmentId);
    if (commitmentIndex === -1) {
      throw new Error("Commitment not found");
    }

    const updatedCommitments = [...commitments];
    updatedCommitments[commitmentIndex] = {
      ...updatedCommitments[commitmentIndex],
      text: args.text,
    };

    // Encrypt updated commitments array
    const encryptedCommitments = await pii.encrypt(JSON.stringify(updatedCommitments));

    await ctx.db.patch(args.contactId, {
      commitments: encryptedCommitments,
    });

    return { success: true };
  },
});

/**
 * Delete a commitment from a contact
 */
export const deleteCommitment = authedMutation({
  args: {
    contactId: v.id("contacts"),
    commitmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Verify ownership
    if (contact.userId !== ctx.userId) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    // Get PII helper for encryption/decryption
    const pii = await encryptedPii.forUser(ctx, ctx.userId);

    // Decrypt existing commitments
    let commitments: Commitment[] = [];
    if (contact.commitments) {
      const commitmentsJson = await pii.decrypt(contact.commitments);
      if (commitmentsJson) commitments = JSON.parse(commitmentsJson);
    }

    const updatedCommitments = commitments.filter((c) => c.id !== args.commitmentId);

    // Encrypt updated commitments array
    const encryptedCommitments = await pii.encrypt(JSON.stringify(updatedCommitments));

    await ctx.db.patch(args.contactId, {
      commitments: encryptedCommitments,
    });

    return { success: true };
  },
});

// =============================================================================
// Friend Reconnection Suggestions
// =============================================================================

// Helper type for reconnect suggestion
interface ReconnectSuggestion {
  _id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  lastEmailAt: number;
  daysSinceContact: number;
  emailCount: number;
}

/**
 * Get a friend to reconnect with - someone you haven't talked to in a while
 * Prioritizes contacts with more emails (stronger relationship) who haven't been contacted recently
 */
export const getFriendToReconnect = authedQuery({
  args: {
    minDaysAgo: v.optional(v.number()), // Minimum days since last contact (default: 30)
    minEmailCount: v.optional(v.number()), // Minimum email count to be considered a "friend" (default: 3)
  },
  handler: async (ctx, args): Promise<ReconnectSuggestion | null> => {
    const minDaysAgo = args.minDaysAgo ?? 30;
    const minEmailCount = args.minEmailCount ?? 3;
    const now = Date.now();
    const cutoffTime = now - minDaysAgo * 24 * 60 * 60 * 1000;

    // Get contacts ordered by lastEmailAt ascending (oldest first)
    // We'll fetch more than needed and filter
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user_last_email", (q) => q.eq("userId", ctx.userId))
      .order("asc")
      .take(50);

    // Filter to find good reconnection candidates
    const candidates = contacts.filter((contact) => {
      // Must have enough emails to be considered a friend
      if (contact.emailCount < minEmailCount) return false;

      // Must not have been contacted recently
      if (contact.lastEmailAt > cutoffTime) return false;

      // Exclude automated/noreply addresses
      const emailLower = contact.email.toLowerCase();
      if (
        emailLower.includes("noreply") ||
        emailLower.includes("no-reply") ||
        emailLower.includes("donotreply") ||
        emailLower.includes("notifications") ||
        emailLower.includes("updates@") ||
        emailLower.includes("newsletter") ||
        emailLower.includes("support@") ||
        emailLower.includes("info@") ||
        emailLower.includes("hello@") ||
        emailLower.includes("team@")
      ) {
        return false;
      }

      return true;
    });

    if (candidates.length === 0) return null;

    // Sort by email count descending to prioritize stronger relationships
    candidates.sort((a, b) => b.emailCount - a.emailCount);

    // Pick the top candidate (most emails exchanged, but hasn't been contacted recently)
    const contact = candidates[0];

    // Get PII helper for decryption
    const pii = await encryptedPii.forUserQuery(ctx, ctx.userId);

    // Decrypt name
    let name: string | undefined;
    if (pii && contact.name) {
      name = (await pii.decrypt(contact.name)) ?? undefined;
    }

    const daysSinceContact = Math.floor(
      (now - contact.lastEmailAt) / (24 * 60 * 60 * 1000)
    );

    return {
      _id: contact._id,
      email: contact.email,
      name,
      avatarUrl: contact.avatarUrl,
      lastEmailAt: contact.lastEmailAt,
      daysSinceContact,
      emailCount: contact.emailCount,
    };
  },
});
