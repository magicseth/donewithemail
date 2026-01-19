import { useState, useCallback, useRef } from "react";
import { useQuery, useAction, useConvexAuth } from "convex/react";
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
  location?: string;
  description?: string;
  // Recurrence rule in RRULE format (for Google Calendar API)
  recurrence?: string;
  // Human-readable description of recurrence (e.g., "Every other Tuesday")
  recurrenceDescription?: string;
  // Set when event has been added to calendar
  calendarEventId?: string;
  calendarEventLink?: string;
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
  isSubscription?: boolean;
  fromName?: string; // Sender name as it appeared in this email's From header
  summary?: string;
  urgencyScore?: number;
  urgencyReason?: string;
  suggestedReply?: string;
  actionRequired?: "reply" | "action" | "fyi" | "none";
  actionDescription?: string;
  quickReplies?: QuickReply[];
  calendarEvent?: CalendarEvent;
  shouldAcceptCalendar?: boolean;
  fromContact?: {
    _id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    relationship?: "vip" | "regular" | "unknown";
  };
}

export function useGmail(sessionStart?: number) {
  const { user, isAuthenticated } = useAuth();
  // Use Convex auth state for query timing (ensures token is ready)
  const { isAuthenticated: convexAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextPageTokenRef = useRef<string | undefined>(undefined);

  // Query for cached untriaged emails - this is INSTANT from Convex
  // Now using getMyUntriagedEmails (authenticated) to only show emails that haven't been triaged
  // If sessionStart is provided, also includes emails triaged after that time
  // Use convexAuthenticated to ensure Convex client has the token ready
  const cachedEmails = useQuery(
    api.emails.getMyUntriagedEmails,
    convexAuthenticated && !convexLoading
      ? { limit: 50, sessionStart }
      : "skip"
  );

  // Actions for syncing with Gmail (only on explicit refresh)
  const fetchEmailsAction = useAction(api.gmailSync.fetchEmails);
  const summarizeAction = useAction(api.summarizeActions.summarizeEmailsByExternalIds);

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
    isSubscription: email.isSubscription,
    summary: email.summary,
    urgencyScore: email.urgencyScore,
    urgencyReason: email.urgencyReason,
    suggestedReply: email.suggestedReply,
    actionRequired: email.actionRequired,
    actionDescription: email.actionDescription,
    quickReplies: email.quickReplies,
    calendarEvent: email.calendarEvent ? {
      ...email.calendarEvent,
      calendarEventId: email.calendarEventId,
      calendarEventLink: email.calendarEventLink,
    } : undefined,
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
