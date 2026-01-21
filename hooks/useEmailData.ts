/**
 * Unified hook for email data - switches between real Gmail and demo mode
 */
import { useMemo } from "react";
import { useGmail, GmailEmail } from "./useGmail";
import { useDemoMode } from "../lib/demoModeContext";

export function useEmailData(sessionStart?: number) {
  const { isDemoMode, demoEmails, demoSummaries, triageEmail } = useDemoMode();
  const gmailData = useGmail(sessionStart);

  // Transform demo emails to match GmailEmail format
  const transformedDemoEmails: GmailEmail[] = useMemo(() => {
    if (!isDemoMode) return [];

    return demoEmails.map((email) => {
      const summary = demoSummaries.find((s) => s.emailId === email._id);
      return {
        _id: email._id,
        externalId: email.externalId,
        threadId: undefined,
        threadCount: undefined,
        subject: email.subject,
        bodyPreview: email.bodyPreview,
        receivedAt: email.receivedAt,
        isRead: email.isRead,
        isSubscription: false,
        fromName: email.fromContact?.name,
        summary: summary?.summary,
        urgencyScore: summary?.urgencyScore,
        urgencyReason: summary?.urgencyReason,
        suggestedReply: undefined,
        actionRequired: summary?.actionRequired,
        actionDescription: summary?.actionDescription,
        quickReplies: summary?.quickReplies,
        calendarEvent: summary?.calendarEvent,
        shouldAcceptCalendar: undefined,
        fromContact: email.fromContact
          ? {
              _id: email.fromContact._id,
              email: email.fromContact.email,
              name: email.fromContact.name,
              avatarUrl: email.fromContact.avatarUrl,
              relationship: email.fromContact.relationship,
            }
          : undefined,
      };
    });
  }, [isDemoMode, demoEmails, demoSummaries]);

  if (isDemoMode) {
    // Filter to only show untriaged emails (matching real behavior)
    const untriagedEmails = transformedDemoEmails.filter(
      (email) => {
        const demoEmail = demoEmails.find((e) => e._id === email._id);
        return demoEmail && !demoEmail.isTriaged;
      }
    );

    return {
      isAuthenticated: true,
      emails: untriagedEmails,
      isLoading: false,
      isSyncing: false,
      isSummarizing: false,
      error: null,
      hasMore: false,
      syncWithGmail: async () => {
        console.log("[Demo] Sync with Gmail (no-op in demo mode)");
      },
      loadMore: async () => {
        console.log("[Demo] Load more (no-op in demo mode)");
      },
      summarizeEmails: async () => {
        console.log("[Demo] Summarize emails (no-op in demo mode)");
      },
      userEmail: "demo@example.com",
      isDemoMode: true,
      triageEmail,
    };
  }

  return {
    ...gmailData,
    isDemoMode: false,
    triageEmail: () => {
      console.log("[EmailData] triageEmail called in non-demo mode (no-op)");
    },
  };
}
