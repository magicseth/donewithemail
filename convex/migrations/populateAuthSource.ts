/**
 * Migration to populate authSource field on existing gmailAccounts.
 *
 * Run with: npx convex run migrations/populateAuthSource:run
 *
 * Logic:
 * - If account has workosRefreshToken -> authSource: "workos"
 * - If account has refreshToken only -> authSource: "gmail_oauth"
 * - Default for accounts without any refresh token: "workos" (can use user's workosRefreshToken)
 *
 * Also migrates user tokens to gmailAccounts for users who have gmailAccessToken
 * but no gmailAccount entry yet.
 */

import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "../_generated/api";
import { DataModel } from "../_generated/dataModel";
import { encryptedPii } from "../pii";

// Initialize migrations with DataModel for type safety
export const migrations = new Migrations<DataModel>(components.migrations);

// Export the runner for CLI usage
export const run = migrations.runner();

// Helper to check if a value is encrypted (Convex encrypted PII uses 'c' field for ciphertext)
function isEncrypted(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "c" in value &&
    typeof (value as { c: unknown }).c === "string"
  );
}

// ============================================================================
// GMAIL ACCOUNTS TABLE - Populate authSource
// ============================================================================
export const populateGmailAccountAuthSource = migrations.define({
  table: "gmailAccounts",
  migrateOne: async (ctx, account) => {
    // Skip if already has authSource
    if (account.authSource) {
      return;
    }

    // Determine authSource based on available refresh tokens
    let authSource: "workos" | "gmail_oauth";

    if (account.workosRefreshToken && isEncrypted(account.workosRefreshToken)) {
      // Has encrypted WorkOS refresh token -> workos auth
      authSource = "workos";
    } else if (account.refreshToken && isEncrypted(account.refreshToken)) {
      // Has encrypted Google refresh token but no WorkOS -> gmail_oauth
      authSource = "gmail_oauth";
    } else {
      // Default to workos - the user's workosRefreshToken can be used
      // This handles accounts created before we stored workosRefreshToken on gmailAccount
      authSource = "workos";
    }

    await ctx.db.patch(account._id, {
      authSource,
    });

    console.log(`[Migration] Set authSource="${authSource}" for account ${account.email}`);
  },
});

// ============================================================================
// USERS TABLE - Create gmailAccounts for users with legacy tokens
// ============================================================================
export const migrateUserTokensToGmailAccounts = migrations.define({
  table: "users",
  migrateOne: async (ctx, user) => {
    // Skip if user has no gmailAccessToken
    if (!user.gmailAccessToken || !isEncrypted(user.gmailAccessToken)) {
      return;
    }

    // Check if user already has a gmailAccount for their PRIMARY email (user.email)
    // This is the account created from WorkOS sign-in
    const existingAccountForUserEmail = await ctx.db
      .query("gmailAccounts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", user._id).eq("email", user.email)
      )
      .first();

    if (existingAccountForUserEmail) {
      // Account for user's email already exists - ensure it has workosRefreshToken
      if (!existingAccountForUserEmail.workosRefreshToken && user.workosRefreshToken && isEncrypted(user.workosRefreshToken)) {
        await ctx.db.patch(existingAccountForUserEmail._id, {
          workosRefreshToken: user.workosRefreshToken,
          authSource: "workos",
        });
        console.log(`[Migration] Added workosRefreshToken to existing account ${user.email}`);
      }
      return;
    }

    // No gmailAccount exists for user's email - create one
    // Note: user may have OTHER gmailAccounts (linked accounts), but we still need
    // to create the primary account for their sign-in email
    const otherAccounts = await ctx.db
      .query("gmailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // The primary account from WorkOS sign-in should be isPrimary: true
    // If other accounts exist, update them to not be primary
    for (const other of otherAccounts) {
      if (other.isPrimary) {
        await ctx.db.patch(other._id, { isPrimary: false });
      }
    }

    const accountId = await ctx.db.insert("gmailAccounts", {
      userId: user._id,
      email: user.email,
      accessToken: user.gmailAccessToken, // Already encrypted
      refreshToken: user.gmailRefreshToken, // Already encrypted (may be undefined)
      tokenExpiresAt: user.gmailTokenExpiresAt ?? Date.now() + 3600 * 1000,
      workosRefreshToken: user.workosRefreshToken, // Already encrypted (may be undefined)
      authSource: "workos", // Legacy tokens came via WorkOS sign-in
      isPrimary: true, // This is the primary account from sign-in
      createdAt: Date.now(),
    });

    console.log(`[Migration] Created gmailAccount ${accountId} for user ${user.email}`);
  },
});
