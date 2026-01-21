import { EncryptedPII, EncryptedField, piiField } from "@convex-dev/encrypted-pii";
import { components } from "./_generated/api";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";

export const encryptedPii = new EncryptedPII(components.encryptedPii);

// Re-export EncryptedField type for use in other files
export type { EncryptedField };

/**
 * Get a PII helper for a user. This fetches/creates the user's encryption key.
 * Must be called from a mutation context.
 */
export async function getPiiForUser(ctx: MutationCtx, userId: Id<"users">) {
  return encryptedPii.forUser(ctx, userId);
}

/**
 * Get a PII helper for a user in query context (read-only).
 * Returns null if the user doesn't have an encryption key yet.
 * Use this in queries; the key must already exist (created during writes).
 */
export async function getPiiForUserQuery(ctx: QueryCtx, userId: Id<"users">) {
  return encryptedPii.forUserQuery(ctx, userId);
}

// =============================================================================
// QUERY-CONTEXT HELPERS (for use in queries - read-only, requires existing key)
// =============================================================================

/**
 * Decrypt a string in query context. Returns null if no key exists or field is null.
 */
export async function decryptStringQuery(
  ctx: QueryCtx,
  userId: Id<"users">,
  field: EncryptedField | null | undefined
): Promise<string | null> {
  if (field === null || field === undefined) return null;
  const pii = await encryptedPii.forUserQuery(ctx, userId);
  if (!pii) return null; // No key exists yet
  return pii.decrypt(field);
}

/**
 * Decrypt a JSON object in query context. Returns null if no key exists or field is null.
 */
export async function decryptJsonQuery<T>(
  ctx: QueryCtx,
  userId: Id<"users">,
  field: EncryptedField | null | undefined
): Promise<T | null> {
  if (field === null || field === undefined) return null;
  const pii = await encryptedPii.forUserQuery(ctx, userId);
  if (!pii) return null;
  const json = await pii.decrypt(field);
  if (json === null) return null;
  return JSON.parse(json) as T;
}

/**
 * Decrypt multiple fields in query context. Returns nulls if no key exists.
 */
export async function decryptManyQuery(
  ctx: QueryCtx,
  userId: Id<"users">,
  fields: Record<string, EncryptedField | null | undefined>
): Promise<Record<string, string | null>> {
  const pii = await encryptedPii.forUserQuery(ctx, userId);
  if (!pii) {
    // Return nulls for all fields if no key exists
    const result: Record<string, string | null> = {};
    for (const key of Object.keys(fields)) {
      result[key] = null;
    }
    return result;
  }
  return pii.decryptMany(fields);
}

/**
 * Encrypt a string value. Returns null if the value is null/undefined.
 */
export async function encryptString(
  ctx: MutationCtx,
  userId: Id<"users">,
  value: string | null | undefined
): Promise<EncryptedField | undefined> {
  if (value === null || value === undefined) return undefined;
  const pii = await encryptedPii.forUser(ctx, userId);
  return pii.encrypt(value);
}

/**
 * Decrypt an encrypted field. Returns null if the field is null/undefined.
 */
export async function decryptString(
  ctx: MutationCtx,
  userId: Id<"users">,
  field: EncryptedField | null | undefined
): Promise<string | null> {
  if (field === null || field === undefined) return null;
  const pii = await encryptedPii.forUser(ctx, userId);
  return pii.decrypt(field);
}

/**
 * Encrypt a JSON object as a string.
 */
export async function encryptJson<T>(
  ctx: MutationCtx,
  userId: Id<"users">,
  value: T | null | undefined
): Promise<EncryptedField | undefined> {
  if (value === null || value === undefined) return undefined;
  const pii = await encryptedPii.forUser(ctx, userId);
  return pii.encrypt(JSON.stringify(value));
}

/**
 * Decrypt a JSON object from an encrypted field.
 */
export async function decryptJson<T>(
  ctx: MutationCtx,
  userId: Id<"users">,
  field: EncryptedField | null | undefined
): Promise<T | null> {
  if (field === null || field === undefined) return null;
  const pii = await encryptedPii.forUser(ctx, userId);
  const json = await pii.decrypt(field);
  if (json === null) return null;
  return JSON.parse(json) as T;
}

/**
 * Decrypt multiple fields at once. More efficient than calling decrypt multiple times.
 */
export async function decryptMany(
  ctx: MutationCtx,
  userId: Id<"users">,
  fields: Record<string, EncryptedField | null | undefined>
): Promise<Record<string, string | null>> {
  const pii = await encryptedPii.forUser(ctx, userId);
  return pii.decryptMany(fields);
}

/**
 * Helper to encrypt all PII fields for an email.
 */
export async function encryptEmailFields(
  ctx: MutationCtx,
  userId: Id<"users">,
  data: {
    subject: string;
    bodyPreview: string;
    fromName?: string | null;
  }
): Promise<{
  subject: EncryptedField;
  bodyPreview: EncryptedField;
  fromName?: EncryptedField;
}> {
  const pii = await encryptedPii.forUser(ctx, userId);
  return {
    subject: await pii.encrypt(data.subject),
    bodyPreview: await pii.encrypt(data.bodyPreview),
    fromName: data.fromName ? await pii.encrypt(data.fromName) : undefined,
  };
}

/**
 * Helper to decrypt all PII fields for an email.
 */
export async function decryptEmailFields(
  ctx: MutationCtx,
  userId: Id<"users">,
  data: {
    subject: EncryptedField;
    bodyPreview: EncryptedField;
    fromName?: EncryptedField | null;
  }
): Promise<{
  subject: string | null;
  bodyPreview: string | null;
  fromName: string | null;
}> {
  const pii = await encryptedPii.forUser(ctx, userId);
  const decrypted = await pii.decryptMany({
    subject: data.subject,
    bodyPreview: data.bodyPreview,
    fromName: data.fromName ?? undefined,
  });
  return {
    subject: decrypted.subject,
    bodyPreview: decrypted.bodyPreview,
    fromName: decrypted.fromName,
  };
}

/**
 * Helper to encrypt email body fields.
 */
export async function encryptEmailBodyFields(
  ctx: MutationCtx,
  userId: Id<"users">,
  data: {
    bodyFull: string;
    bodyHtml?: string | null;
    rawPayload?: string | null;
  }
): Promise<{
  bodyFull: EncryptedField;
  bodyHtml?: EncryptedField;
  rawPayload?: EncryptedField;
}> {
  const pii = await encryptedPii.forUser(ctx, userId);
  return {
    bodyFull: await pii.encrypt(data.bodyFull),
    bodyHtml: data.bodyHtml ? await pii.encrypt(data.bodyHtml) : undefined,
    rawPayload: data.rawPayload ? await pii.encrypt(data.rawPayload) : undefined,
  };
}

/**
 * Helper to decrypt email body fields.
 */
export async function decryptEmailBodyFields(
  ctx: MutationCtx,
  userId: Id<"users">,
  data: {
    bodyFull: EncryptedField;
    bodyHtml?: EncryptedField | null;
    rawPayload?: EncryptedField | null;
  }
): Promise<{
  bodyFull: string | null;
  bodyHtml: string | null;
  rawPayload: string | null;
}> {
  const pii = await encryptedPii.forUser(ctx, userId);
  const decrypted = await pii.decryptMany({
    bodyFull: data.bodyFull,
    bodyHtml: data.bodyHtml ?? undefined,
    rawPayload: data.rawPayload ?? undefined,
  });
  return {
    bodyFull: decrypted.bodyFull,
    bodyHtml: decrypted.bodyHtml,
    rawPayload: decrypted.rawPayload,
  };
}

/**
 * Helper to encrypt contact name.
 */
export async function encryptContactName(
  ctx: MutationCtx,
  userId: Id<"users">,
  name: string | null | undefined
): Promise<EncryptedField | undefined> {
  return encryptString(ctx, userId, name);
}

/**
 * Helper to decrypt contact name.
 */
export async function decryptContactName(
  ctx: MutationCtx,
  userId: Id<"users">,
  name: EncryptedField | null | undefined
): Promise<string | null> {
  return decryptString(ctx, userId, name);
}

// =============================================================================
// MIGRATION HELPERS
// =============================================================================

/**
 * Schema validator for PII fields during migration.
 * Accepts both the old plain string format and the new encrypted format.
 * Use this temporarily while running migrations, then switch back to piiField().
 */
export function piiFieldMigrating() {
  return v.union(
    // New encrypted format
    piiField(),
    // Old string format
    v.string(),
    // Old object/array format (for JSON fields like facts, calendarEvent, etc.)
    v.any()
  );
}

// Re-export piiField for convenience
export { piiField };
