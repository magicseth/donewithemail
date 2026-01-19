import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useCallback } from "react";

/**
 * Hook for fetching untriaged emails for the feed view (authenticated)
 */
export function useUntriagedEmails() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  // Skip query until Convex auth is ready
  return useQuery(
    api.emails.getMyUntriagedEmails,
    isAuthenticated && !isLoading ? { limit: 20 } : "skip"
  );
}

/**
 * Hook for fetching TODO emails (reply_needed) (authenticated)
 */
export function useTodoEmails() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  // Skip query until Convex auth is ready
  return useQuery(
    api.emails.getMyTodoEmails,
    isAuthenticated && !isLoading ? { limit: 50 } : "skip"
  );
}

/**
 * Hook for fetching a single email by Convex ID (authenticated)
 */
export function useEmail(emailId: Id<"emails"> | undefined) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return useQuery(
    api.emails.getMyEmail,
    emailId && isAuthenticated && !isLoading ? { emailId } : "skip"
  );
}

/**
 * Hook for fetching all emails in a thread (authenticated)
 */
export function useThreadEmails(emailId: Id<"emails"> | undefined) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return useQuery(
    api.emails.getMyThreadEmails,
    emailId && isAuthenticated && !isLoading ? { emailId } : "skip"
  );
}

/**
 * Hook for email triage actions (authenticated)
 */
export function useTriageEmail() {
  const triageMutation = useMutation(api.emails.triageMyEmail);

  const triageEmail = useCallback(
    async (
      emailId: Id<"emails">,
      action: "done" | "reply_needed" | "delegated"
    ) => {
      return triageMutation({ emailId, action });
    },
    [triageMutation]
  );

  return { triageEmail };
}

/**
 * Hook for marking email as read (authenticated)
 */
export function useMarkAsRead() {
  const markAsReadMutation = useMutation(api.emails.markMyEmailAsRead);

  const markAsRead = useCallback(
    async (emailId: Id<"emails">) => {
      return markAsReadMutation({ emailId });
    },
    [markAsReadMutation]
  );

  return { markAsRead };
}

/**
 * Hook for searching emails (authenticated)
 */
export function useSearchEmails() {
  // Note: This returns a mutation-like function that can be called with search query
  // For actual search results, use useQuery with api.emails.searchMyEmails
  return {
    searchEmails: async (searchQuery: string, limit?: number) => {
      // This is a placeholder - actual implementation would use the query
      return [];
    },
  };
}

/**
 * Combined hook for email actions (authenticated)
 */
export function useEmailActions() {
  const { triageEmail } = useTriageEmail();
  const { markAsRead } = useMarkAsRead();

  return {
    triageEmail,
    markAsRead,
    // Convenience methods for swipe actions
    archiveEmail: (emailId: Id<"emails">) => triageEmail(emailId, "done"),
    markReplyNeeded: (emailId: Id<"emails">) => triageEmail(emailId, "reply_needed"),
    delegateEmail: (emailId: Id<"emails">) => triageEmail(emailId, "delegated"),
  };
}
