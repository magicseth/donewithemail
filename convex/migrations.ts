import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";

export const migrations = new Migrations<DataModel>(components.migrations);

// Migration to move email body content from emails table to emailBodies table
// NOTE: This migration has already been run and completed.
// The legacy fields (bodyFull, bodyHtml, rawPayload) have been removed from the schema.
export const migrateEmailBodies = migrations.define({
  table: "emails",
  migrateOne: async (ctx, email) => {
    // Cast to any to access legacy fields that may still exist in old documents
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacyEmail = email as any;

    // Skip if email has no body content to migrate
    if (!legacyEmail.bodyFull && !legacyEmail.bodyHtml && !legacyEmail.rawPayload) {
      return;
    }

    // Check if body already exists in emailBodies table
    const existingBody = await ctx.db
      .query("emailBodies")
      .withIndex("by_email", (q) => q.eq("emailId", email._id))
      .first();

    if (existingBody) {
      // Already migrated
      return;
    }

    // Create new body record
    await ctx.db.insert("emailBodies", {
      emailId: email._id,
      bodyFull: legacyEmail.bodyFull || "",
      bodyHtml: legacyEmail.bodyHtml,
      rawPayload: legacyEmail.rawPayload,
    });
  },
});

// Runner to execute the email bodies migration
export const runEmailBodiesMigration = migrations.runner(
  internal.migrations.migrateEmailBodies
);

// Generic runner for any migration
export const run = migrations.runner();
