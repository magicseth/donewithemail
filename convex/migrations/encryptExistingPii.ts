/**
 * Migration to encrypt all existing PII fields in the database.
 *
 * Run with: npx convex run migrations/encryptExistingPii:run
 *
 * This handles all tables with PII fields using the official Convex migrations component.
 */

import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { encryptedPii } from "../pii";

// Initialize migrations with DataModel for type safety
export const migrations = new Migrations<DataModel>(components.migrations);

// Export the runner for CLI usage
export const run = migrations.runner();

// Helper to check if a value is already encrypted
function isEncrypted(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "ciphertext" in value &&
    typeof (value as { ciphertext: unknown }).ciphertext === "string"
  );
}

// ============================================================================
// EMAILS TABLE
// Fields: subject, bodyPreview, fromName
// ============================================================================
export const encryptEmails = migrations.define({
  table: "emails",
  migrateOne: async (ctx, email) => {
    // Skip if already encrypted
    if (isEncrypted(email.subject)) {
      return;
    }

    const pii = await encryptedPii.forUser(ctx, email.userId);

    const updates: Record<string, unknown> = {};

    // Use typeof to handle empty strings (which are falsy but still need encryption)
    if (typeof email.subject === "string") {
      updates.subject = await pii.encrypt(email.subject);
    }
    if (typeof email.bodyPreview === "string") {
      updates.bodyPreview = await pii.encrypt(email.bodyPreview);
    }
    if (typeof email.fromName === "string") {
      updates.fromName = await pii.encrypt(email.fromName);
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(email._id, updates as any);
    }
  },
});

// ============================================================================
// EMAIL BODIES TABLE
// Fields: bodyFull, bodyHtml, rawPayload
// ============================================================================
export const encryptEmailBodies = migrations.define({
  table: "emailBodies",
  batchSize: 50, // Smaller batch - bodies are large
  migrateOne: async (ctx, body) => {
    if (isEncrypted(body.bodyFull)) {
      return;
    }

    // Get userId from the email
    const email = await ctx.db.get(body.emailId);
    if (!email) return;

    const pii = await encryptedPii.forUser(ctx, email.userId);

    const updates: Record<string, unknown> = {};

    if (typeof body.bodyFull === "string") {
      updates.bodyFull = await pii.encrypt(body.bodyFull);
    }
    if (typeof body.bodyHtml === "string") {
      updates.bodyHtml = await pii.encrypt(body.bodyHtml);
    }
    if (typeof body.rawPayload === "string") {
      updates.rawPayload = await pii.encrypt(body.rawPayload);
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(body._id, updates as any);
    }
  },
});

// ============================================================================
// EMAIL SUMMARIES TABLE
// Fields: summary, urgencyReason, suggestedReply, actionDescription,
//         quickReplies, calendarEvent, deadlineDescription
// ============================================================================
export const encryptEmailSummaries = migrations.define({
  table: "emailSummaries",
  migrateOne: async (ctx, summary) => {
    if (isEncrypted(summary.summary)) {
      return;
    }

    const email = await ctx.db.get(summary.emailId);
    if (!email) return;

    const pii = await encryptedPii.forUser(ctx, email.userId);

    const updates: Record<string, unknown> = {};

    if (typeof summary.summary === "string") {
      updates.summary = await pii.encrypt(summary.summary);
    }
    if (typeof summary.urgencyReason === "string") {
      updates.urgencyReason = await pii.encrypt(summary.urgencyReason);
    }
    if (typeof summary.suggestedReply === "string") {
      updates.suggestedReply = await pii.encrypt(summary.suggestedReply);
    }
    if (typeof summary.actionDescription === "string") {
      updates.actionDescription = await pii.encrypt(summary.actionDescription);
    }
    if (summary.quickReplies !== undefined && !isEncrypted(summary.quickReplies)) {
      // JSON fields - stringify if object, otherwise encrypt as-is
      const value = typeof summary.quickReplies === "object"
        ? JSON.stringify(summary.quickReplies)
        : String(summary.quickReplies);
      updates.quickReplies = await pii.encrypt(value);
    }
    if (summary.calendarEvent !== undefined && !isEncrypted(summary.calendarEvent)) {
      const value = typeof summary.calendarEvent === "object"
        ? JSON.stringify(summary.calendarEvent)
        : String(summary.calendarEvent);
      updates.calendarEvent = await pii.encrypt(value);
    }
    if (typeof summary.deadlineDescription === "string") {
      updates.deadlineDescription = await pii.encrypt(summary.deadlineDescription);
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(summary._id, updates as any);
    }
  },
});

// ============================================================================
// CONTACTS TABLE
// Fields: name, relationshipSummary, facts, writingStyle
// ============================================================================
export const encryptContacts = migrations.define({
  table: "contacts",
  migrateOne: async (ctx, contact) => {
    // Check if already migrated - look for any encrypted field
    if (isEncrypted(contact.name) || isEncrypted(contact.relationshipSummary) ||
        isEncrypted(contact.facts) || isEncrypted(contact.writingStyle)) {
      return;
    }

    const pii = await encryptedPii.forUser(ctx, contact.userId);

    const updates: Record<string, unknown> = {};

    if (typeof contact.name === "string") {
      updates.name = await pii.encrypt(contact.name);
    }
    if (typeof contact.relationshipSummary === "string") {
      updates.relationshipSummary = await pii.encrypt(contact.relationshipSummary);
    }
    if (contact.facts !== undefined && !isEncrypted(contact.facts)) {
      const value = typeof contact.facts === "object"
        ? JSON.stringify(contact.facts)
        : String(contact.facts);
      updates.facts = await pii.encrypt(value);
    }
    if (contact.writingStyle !== undefined && !isEncrypted(contact.writingStyle)) {
      const value = typeof contact.writingStyle === "object"
        ? JSON.stringify(contact.writingStyle)
        : String(contact.writingStyle);
      updates.writingStyle = await pii.encrypt(value);
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(contact._id, updates as any);
    }
  },
});

// ============================================================================
// USERS TABLE
// Fields: name, workosRefreshToken, gmailAccessToken, gmailRefreshToken, connectedProviders
// ============================================================================
export const encryptUsers = migrations.define({
  table: "users",
  migrateOne: async (ctx, user) => {
    // Check if already migrated
    if (isEncrypted(user.name) || isEncrypted(user.gmailAccessToken) ||
        isEncrypted(user.gmailRefreshToken) || isEncrypted(user.connectedProviders)) {
      return;
    }

    const pii = await encryptedPii.forUser(ctx, user._id);

    const updates: Record<string, unknown> = {};

    if (typeof user.name === "string") {
      updates.name = await pii.encrypt(user.name);
    }
    if (typeof user.workosRefreshToken === "string") {
      updates.workosRefreshToken = await pii.encrypt(user.workosRefreshToken);
    }
    if (typeof user.gmailAccessToken === "string") {
      updates.gmailAccessToken = await pii.encrypt(user.gmailAccessToken);
    }
    if (typeof user.gmailRefreshToken === "string") {
      updates.gmailRefreshToken = await pii.encrypt(user.gmailRefreshToken);
    }
    if (user.connectedProviders !== undefined && !isEncrypted(user.connectedProviders)) {
      const value = typeof user.connectedProviders === "object"
        ? JSON.stringify(user.connectedProviders)
        : String(user.connectedProviders);
      updates.connectedProviders = await pii.encrypt(value);
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(user._id, updates as any);
    }
  },
});

// ============================================================================
// SUBSCRIPTIONS TABLE
// Fields: senderName, mostRecentSubject
// ============================================================================
export const encryptSubscriptions = migrations.define({
  table: "subscriptions",
  migrateOne: async (ctx, sub) => {
    if (isEncrypted(sub.senderName) || isEncrypted(sub.mostRecentSubject)) {
      return;
    }

    const pii = await encryptedPii.forUser(ctx, sub.userId);

    const updates: Record<string, unknown> = {};

    if (typeof sub.senderName === "string") {
      updates.senderName = await pii.encrypt(sub.senderName);
    }
    if (typeof sub.mostRecentSubject === "string") {
      updates.mostRecentSubject = await pii.encrypt(sub.mostRecentSubject);
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(sub._id, updates as any);
    }
  },
});

// ============================================================================
// FEATURE REQUESTS TABLE
// Fields: transcript, progressMessage, error, claudeOutput, debugLogs
// ============================================================================
export const encryptFeatureRequests = migrations.define({
  table: "featureRequests",
  migrateOne: async (ctx, req) => {
    if (isEncrypted(req.transcript)) {
      return;
    }

    const pii = await encryptedPii.forUser(ctx, req.userId);

    const updates: Record<string, unknown> = {};

    if (typeof req.transcript === "string") {
      updates.transcript = await pii.encrypt(req.transcript);
    }
    if (typeof req.progressMessage === "string") {
      updates.progressMessage = await pii.encrypt(req.progressMessage);
    }
    if (typeof req.error === "string") {
      updates.error = await pii.encrypt(req.error);
    }
    if (typeof req.claudeOutput === "string") {
      updates.claudeOutput = await pii.encrypt(req.claudeOutput);
    }
    if (typeof req.debugLogs === "string") {
      updates.debugLogs = await pii.encrypt(req.debugLogs);
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(req._id, updates as any);
    }
  },
});
