import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useCallback } from "react";
import { isAuthError, useAuthError } from "../lib/AuthErrorBoundary";
import { usePushNotifications } from "./usePushNotifications";

/**
 * Wraps a mutation call to detect and report auth errors
 */
function withAuthErrorHandling<T>(
  mutationFn: () => Promise<T>,
  reportAuthError: (error: Error) => void
): Promise<T> {
  return mutationFn().catch((error) => {
    if (error instanceof Error && isAuthError(error)) {
      console.log("[useEmails] Auth error detected in mutation:", error.message);
      reportAuthError(error);
    }
    throw error; // Re-throw so caller can handle
  });
}

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
 * Automatically reports auth errors to the error handler
 * Dismisses push notifications after triaging
 */
export function useTriageEmail() {
  const triageMutation = useMutation(api.emails.triageMyEmail);
  const { reportAuthError } = useAuthError();
  const { dismissNotificationForEmail } = usePushNotifications();

  const triageEmail = useCallback(
    async (
      emailId: Id<"emails">,
      action: "done" | "reply_needed" | "delegated"
    ) => {
      const result = await withAuthErrorHandling(
        () => triageMutation({ emailId, action }),
        reportAuthError
      );

      // Dismiss notification for this specific email after triaging
      await dismissNotificationForEmail(emailId);

      return result;
    },
    [triageMutation, reportAuthError, dismissNotificationForEmail]
  );

  return { triageEmail };
}

/**
 * Hook for marking email as read (authenticated)
 * Automatically reports auth errors to the error handler
 */
export function useMarkAsRead() {
  const markAsReadMutation = useMutation(api.emails.markMyEmailAsRead);
  const { reportAuthError } = useAuthError();

  const markAsRead = useCallback(
    async (emailId: Id<"emails">) => {
      return withAuthErrorHandling(
        () => markAsReadMutation({ emailId }),
        reportAuthError
      );
    },
    [markAsReadMutation, reportAuthError]
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
