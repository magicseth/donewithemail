import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useCallback } from "react";

/**
 * Hook for fetching untriaged emails for the feed view
 */
export function useUntriagedEmails(userId: Id<"users"> | undefined) {
  return useQuery(
    api.emails.getUntriagedEmails,
    userId ? { userId, limit: 20 } : "skip"
  );
}

/**
 * Hook for fetching inbox emails
 */
export function useInboxEmails(userId: Id<"users"> | undefined) {
  return useQuery(
    api.emails.getInboxEmails,
    userId ? { userId, limit: 50 } : "skip"
  );
}

/**
 * Hook for fetching a single email by Convex ID
 */
export function useEmail(emailId: Id<"emails"> | undefined) {
  return useQuery(
    api.emails.getEmail,
    emailId ? { emailId } : "skip"
  );
}

/**
 * Hook for fetching a single email by external ID (Gmail ID)
 */
export function useEmailByExternalId(externalId: string | undefined) {
  return useQuery(
    api.emails.getEmailByExternalId,
    externalId ? { externalId, provider: "gmail" } : "skip"
  );
}

/**
 * Hook for fetching emails from a specific contact
 */
export function useEmailsByContact(contactId: Id<"contacts"> | undefined) {
  return useQuery(
    api.emails.getEmailsByContact,
    contactId ? { contactId, limit: 50 } : "skip"
  );
}

/**
 * Hook for email triage actions
 */
export function useTriageEmail() {
  const triageMutation = useMutation(api.emails.triageEmail);

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
 * Hook for marking email as read
 */
export function useMarkAsRead() {
  const markAsReadMutation = useMutation(api.emails.markAsRead);

  const markAsRead = useCallback(
    async (emailId: Id<"emails">) => {
      return markAsReadMutation({ emailId });
    },
    [markAsReadMutation]
  );

  return { markAsRead };
}

/**
 * Hook for triaging by external ID (Gmail ID)
 */
export function useTriageByExternalId() {
  const triageMutation = useMutation(api.emails.triageEmailByExternalId);

  const triageByExternalId = useCallback(
    async (
      externalId: string,
      action: "done" | "reply_needed" | "delegated"
    ) => {
      return triageMutation({ externalId, action });
    },
    [triageMutation]
  );

  return { triageByExternalId };
}

/**
 * Combined hook for email actions
 */
export function useEmailActions() {
  const { triageEmail } = useTriageEmail();
  const { triageByExternalId } = useTriageByExternalId();
  const { markAsRead } = useMarkAsRead();

  return {
    triageEmail,
    triageByExternalId,
    markAsRead,
    // Convenience methods for swipe actions
    archiveEmail: (emailId: Id<"emails">) => triageEmail(emailId, "done"),
    markReplyNeeded: (emailId: Id<"emails">) => triageEmail(emailId, "reply_needed"),
    delegateEmail: (emailId: Id<"emails">) => triageEmail(emailId, "delegated"),
    // External ID versions
    archiveByExternalId: (externalId: string) => triageByExternalId(externalId, "done"),
    markReplyNeededByExternalId: (externalId: string) => triageByExternalId(externalId, "reply_needed"),
  };
}
