import { useState, useCallback, useRef } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "../lib/authContext";

export interface QuickReply {
  label: string;
  body: string;
}

export interface CalendarEvent {
  title: string;
  startTime?: string;
  endTime?: string;
  description?: string;
}

export interface GmailEmail {
  _id: string;
  externalId: string;
  threadId?: string;
  threadCount?: number;
  subject: string;
  bodyPreview: string;
  receivedAt: number;
  isRead: boolean;
  summary?: string;
  urgencyScore?: number;
  urgencyReason?: string;
  suggestedReply?: string;
  actionRequired?: "reply" | "action" | "fyi" | "none";
  actionDescription?: string;
  quickReplies?: QuickReply[];
  calendarEvent?: CalendarEvent;
  fromContact?: {
    _id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    relationship?: "vip" | "regular" | "unknown";
  };
}

export function useGmail() {
  const { user, isAuthenticated } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextPageTokenRef = useRef<string | undefined>(undefined);

  // Query for cached emails - this is INSTANT from Convex
  const cachedEmails = useQuery(
    api.emails.getInboxByEmail,
    isAuthenticated && user?.email ? { email: user.email, limit: 50 } : "skip"
  );

  // Actions for syncing with Gmail (only on explicit refresh)
  const fetchEmailsAction = useAction(api.gmailSync.fetchEmails);
  const summarizeAction = useAction(api.summarizeActions.summarizeByExternalIds);

  // Trigger summarization for emails that need it
  const summarizeEmails = useCallback(
    async (emailIds: string[]) => {
      if (!isAuthenticated || !user?.email || emailIds.length === 0) return;

      console.log("Starting summarization for", emailIds.length, "emails");
      setIsSummarizing(true);
      try {
        await summarizeAction({
          externalIds: emailIds,
          userEmail: user.email,
        });
        // No need to update state - useQuery will auto-update when DB changes
      } catch (e) {
        console.error("Failed to summarize emails:", e);
      } finally {
        setIsSummarizing(false);
      }
    },
    [isAuthenticated, user?.email, summarizeAction]
  );

  // Sync with Gmail - only called on explicit refresh
  const syncWithGmail = useCallback(
    async (maxResults = 15) => {
      if (!isAuthenticated || !user?.email) {
        setError("Not authenticated");
        return;
      }

      setIsSyncing(true);
      setError(null);

      try {
        const result = await fetchEmailsAction({
          userEmail: user.email,
          maxResults,
        });
        nextPageTokenRef.current = result.nextPageToken;

        // Summarize emails that don't have summaries yet
        const emailsNeedingSummary = result.emails.filter((e: any) => !e.summary);
        if (emailsNeedingSummary.length > 0) {
          const emailIds = emailsNeedingSummary.map((e: any) => e.id);
          console.log(`Summarizing ${emailIds.length} emails`);
          summarizeEmails(emailIds);
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Failed to sync";
        setError(errorMessage);
        console.error("Failed to sync with Gmail:", e);
      } finally {
        setIsSyncing(false);
      }
    },
    [isAuthenticated, user?.email, fetchEmailsAction, summarizeEmails]
  );

  // Load more from Gmail
  const loadMore = useCallback(
    async (maxResults = 50) => {
      if (!isAuthenticated || !user?.email || !nextPageTokenRef.current) {
        return;
      }

      setIsSyncing(true);

      try {
        const result = await fetchEmailsAction({
          userEmail: user.email,
          maxResults,
          pageToken: nextPageTokenRef.current,
        });
        nextPageTokenRef.current = result.nextPageToken;

        // Summarize new emails
        const emailsNeedingSummary = result.emails.filter((e: any) => !e.summary);
        if (emailsNeedingSummary.length > 0) {
          summarizeEmails(emailsNeedingSummary.map((e: any) => e.id));
        }
      } catch (e) {
        console.error("Failed to load more emails:", e);
      } finally {
        setIsSyncing(false);
      }
    },
    [isAuthenticated, user?.email, fetchEmailsAction, summarizeEmails]
  );

  // Transform cached emails to match expected format
  const emails: GmailEmail[] = (cachedEmails || []).map((email: any) => ({
    _id: email._id,
    externalId: email.externalId,
    threadId: email.threadId,
    threadCount: email.threadCount,
    subject: email.subject,
    bodyPreview: email.bodyPreview,
    receivedAt: email.receivedAt,
    isRead: email.isRead,
    summary: email.summary,
    urgencyScore: email.urgencyScore,
    urgencyReason: email.urgencyReason,
    suggestedReply: email.suggestedReply,
    actionRequired: email.actionRequired,
    actionDescription: email.actionDescription,
    quickReplies: email.quickReplies,
    calendarEvent: email.calendarEvent,
    fromContact: email.fromContact,
  }));

  return {
    isAuthenticated,
    emails,
    isLoading: cachedEmails === undefined, // Loading from Convex cache
    isSyncing, // Syncing with Gmail
    isSummarizing,
    error,
    hasMore: !!nextPageTokenRef.current,
    syncWithGmail, // Call this on pull-to-refresh
    loadMore,
    summarizeEmails,
    userEmail: user?.email,
  };
}
