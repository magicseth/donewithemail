/**
 * Custom authenticated query/mutation/action builders.
 *
 * These wrap the standard Convex functions to:
 * 1. Require authentication (valid JWT from WorkOS)
 * 2. Look up the user from the JWT's subject claim
 * 3. Inject the user into the context for easy access
 * 4. Sandbox all data access to that user
 *
 * Usage:
 *   import { authedQuery, authedMutation, authedAction } from "./functions";
 *
 *   export const getMyEmails = authedQuery({
 *     args: { limit: v.optional(v.number()) },
 *     handler: async (ctx, args) => {
 *       // ctx.user is the authenticated user
 *       // ctx.userId is the user's Convex ID
 *       return await ctx.db
 *         .query("emails")
 *         .withIndex("by_user", q => q.eq("userId", ctx.userId))
 *         .take(args.limit ?? 50);
 *     },
 *   });
 */

import {
  customQuery,
  customMutation,
  customAction,
} from "convex-helpers/server/customFunctions";
import {
  query,
  mutation,
  action,
  QueryCtx,
  MutationCtx,
  ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

// =============================================================================
// Types
// =============================================================================

/** User document from the database */
type User = Doc<"users">;

/** Extended context with authenticated user */
export interface AuthedQueryCtx extends QueryCtx {
  user: User;
  userId: Id<"users">;
}

export interface AuthedMutationCtx extends MutationCtx {
  user: User;
  userId: Id<"users">;
}

export interface AuthedActionCtx extends ActionCtx {
  user: User;
  userId: Id<"users">;
}

// =============================================================================
// Auth Helper
// =============================================================================

/**
 * Get the authenticated user from the context.
 * Throws if not authenticated or user not found.
 */
async function getAuthedUser(
  ctx: QueryCtx | MutationCtx
): Promise<{ user: User; userId: Id<"users"> }> {
  // Get the identity from the JWT
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Unauthorized: No valid authentication token");
  }

  // The subject claim contains the WorkOS user ID
  const workosId = identity.subject;

  if (!workosId) {
    throw new Error("Unauthorized: Invalid token - missing subject");
  }

  // Look up the user by WorkOS ID
  const user = await ctx.db
    .query("users")
    .withIndex("by_workos_id", (q) => q.eq("workosId", workosId))
    .first();

  if (!user) {
    // Try looking up by email as fallback (for tokens that use email as subject)
    const email = identity.email;
    if (email) {
      const userByEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

      if (userByEmail) {
        return { user: userByEmail, userId: userByEmail._id };
      }
    }

    throw new Error("Unauthorized: User not found in database");
  }

  return { user, userId: user._id };
}

/**
 * Get the authenticated user for actions (uses runQuery internally).
 */
async function getAuthedUserForAction(
  ctx: ActionCtx
): Promise<{ user: User; userId: Id<"users"> }> {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Unauthorized: No valid authentication token");
  }

  const workosId = identity.subject;
  const email = identity.email;

  if (!workosId && !email) {
    throw new Error("Unauthorized: Invalid token - missing subject and email");
  }

  // For actions, we need to run a query to get the user
  // We'll use the internal getUserForAuth query
  const user = await ctx.runQuery(internal.users.getUserForAuth, {
    workosId,
    email,
  });

  if (!user) {
    throw new Error("Unauthorized: User not found in database");
  }

  return { user, userId: user._id };
}

// =============================================================================
// Custom Function Builders
// =============================================================================

/**
 * Authenticated query - requires valid JWT and injects user into context.
 */
export const authedQuery = customQuery(query, {
  args: {},
  input: async (ctx, _args) => {
    const { user, userId } = await getAuthedUser(ctx);
    return {
      ctx: { ...ctx, user, userId },
      args: {},
    };
  },
});

/**
 * Authenticated mutation - requires valid JWT and injects user into context.
 */
export const authedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx, _args) => {
    const { user, userId } = await getAuthedUser(ctx);
    return {
      ctx: { ...ctx, user, userId },
      args: {},
    };
  },
});

/**
 * Authenticated action - requires valid JWT and injects user into context.
 *
 * Note: Actions can't directly access the database, so we store the user info
 * for use in the handler. The handler should use runQuery/runMutation for
 * database access with proper userId filtering.
 */
export const authedAction = customAction(action, {
  args: {},
  input: async (ctx, _args) => {
    // For actions, we validate auth but can't inject db context
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Unauthorized: No valid authentication token");
    }

    // Store identity info in context for the action to use
    const workosId = identity.subject;
    const email = identity.email;

    return {
      ctx: {
        ...ctx,
        // Actions need to look up user themselves if needed
        authInfo: { workosId, email },
      },
      args: {},
    };
  },
});

// =============================================================================
// Re-exports for convenience
// =============================================================================

// Re-export the standard functions for internal/unauthenticated use
export {
  query,
  mutation,
  action,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
