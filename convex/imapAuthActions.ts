"use node";

/**
 * IMAP authentication actions - Node.js runtime actions for IMAP connection testing
 */
import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * Test IMAP connection with provided credentials
 */
export const testImapConnection = action({
  args: {
    email: v.string(),
    password: v.string(),
    host: v.string(),
    port: v.number(),
    tls: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const imapSimple = await import("imap-simple").catch((err) => {
      console.error("[IMAP] Failed to load imap-simple:", err);
      throw new Error("IMAP functionality is not available in this environment");
    });

    try {
      const config = {
        imap: {
          user: args.email,
          password: args.password,
          host: args.host,
          port: args.port,
          tls: args.tls ?? true,
          authTimeout: 10000,
        },
      };

      // Try to connect
      const connection = await imapSimple.default.connect(config);

      // If successful, close and return success
      connection.end();

      return { success: true, message: "Connection successful" };
    } catch (error: any) {
      console.error("[IMAP Test] Connection failed:", error);
      return {
        success: false,
        message: error.message || "Failed to connect to IMAP server",
      };
    }
  },
});
