/**
 * IMAP authentication - Store and manage IMAP credentials
 */
import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { encryptedPii } from "./pii";
import { ConnectedProvider } from "./schema";

/**
 * Store IMAP credentials for a user
 */
export const storeImapCredentials = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    host: v.string(),
    port: v.number(),
    tls: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) {
      throw new Error("Not authenticated");
    }

    // Find user by identity
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get PII helper for encryption
    const pii = await encryptedPii.forUser(ctx, user._id);

    // Decrypt existing providers or start with empty array
    let providers: ConnectedProvider[] = [];
    if (user.connectedProviders) {
      const decrypted = await pii.decrypt(user.connectedProviders);
      if (decrypted) {
        providers = JSON.parse(decrypted);
      }
    }

    // Check if IMAP provider with this email already exists
    const existingIndex = providers.findIndex(
      (p) => p.provider === "imap" && p.email === args.email
    );

    // Create new IMAP provider entry
    const newProvider: ConnectedProvider = {
      provider: "imap",
      email: args.email,
      imapHost: args.host,
      imapPort: args.port,
      imapPassword: args.password, // Will be encrypted with the whole object
      imapTls: args.tls ?? true,
    };

    if (existingIndex >= 0) {
      // Update existing
      providers[existingIndex] = newProvider;
    } else {
      // Add new
      providers.push(newProvider);
    }

    // Encrypt and store
    const encrypted = await pii.encrypt(JSON.stringify(providers));
    await ctx.db.patch(user._id, {
      connectedProviders: encrypted,
    });

    return { success: true, email: args.email };
  },
});

/**
 * Remove IMAP credentials for a specific email
 */
export const removeImapAccount = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Get authenticated user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) {
      throw new Error("Not authenticated");
    }

    // Find user by identity
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get PII helper for decryption
    const pii = await encryptedPii.forUser(ctx, user._id);

    // Decrypt existing providers
    if (!user.connectedProviders) {
      return { success: true }; // Nothing to remove
    }

    const decrypted = await pii.decrypt(user.connectedProviders);
    if (!decrypted) {
      return { success: true }; // Nothing to remove
    }
    let providers: ConnectedProvider[] = JSON.parse(decrypted);

    // Filter out the IMAP provider with this email
    providers = providers.filter(
      (p) => !(p.provider === "imap" && p.email === args.email)
    );

    // Encrypt and store
    const encrypted = await pii.encrypt(JSON.stringify(providers));
    await ctx.db.patch(user._id, {
      connectedProviders: encrypted,
    });

    return { success: true };
  },
});

/**
 * List connected IMAP accounts (returns only non-sensitive info)
 */
export const listImapAccounts = mutation({
  args: {},
  handler: async (ctx) => {
    // Get authenticated user ID
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.email) {
      // Not authenticated yet - return empty array instead of throwing
      // This can happen during app startup before Convex auth is fully initialized
      return [];
    }

    // Find user by identity
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!user || !user.connectedProviders) {
      return [];
    }

    // Get PII helper for decryption
    const pii = await encryptedPii.forUser(ctx, user._id);

    // Decrypt providers
    const decrypted = await pii.decrypt(user.connectedProviders);
    if (!decrypted) {
      return [];
    }
    const providers: ConnectedProvider[] = JSON.parse(decrypted);

    // Return only IMAP accounts with non-sensitive info
    return providers
      .filter((p) => p.provider === "imap")
      .map((p) => ({
        email: p.email,
        host: p.imapHost,
        port: p.imapPort,
        tls: p.imapTls,
      }));
  },
});

/**
 * Internal mutation to update connected providers (used by sync actions)
 */
export const updateConnectedProviders = internalMutation({
  args: {
    userId: v.id("users"),
    connectedProviders: v.any(), // Encrypted PII field
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      connectedProviders: args.connectedProviders as any,
    });
  },
});
