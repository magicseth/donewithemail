import { useState, useCallback, useEffect } from "react";
import { useQuery, useAction, useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "../lib/authContext";

// Module-level cache persists across component mounts/unmounts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cache stores raw Convex query results
let lastEmailsCache: any[] | null = null;

// Module-level flag to prevent multiple simultaneous auth refresh attempts
let isRefreshingAuth = false;
let lastRefreshAttempt = 0;

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

// Track next page token at module level too
let nextPageToken: string | undefined = undefined;

export function useGmail(sessionStart?: number) {
  const { user, isAuthenticated, refreshAccessToken } = useAuth();
  // Use Convex auth state for query timing (ensures token is ready)
  const { isAuthenticated: convexAuthenticated, isLoading: convexLoading } = useConvexAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect auth mismatch: local auth says yes, but Convex says no
  // This can happen when the token exists locally but Convex hasn't synced yet
  // Use module-level variables to coordinate across all useGmail instances
  useEffect(() => {
    const now = Date.now();
    // Only attempt refresh if:
    // - Local auth says authenticated but Convex doesn't
    // - Not already refreshing
    // - At least 5 seconds since last attempt (prevent rapid looping)
    if (
      isAuthenticated &&
      !convexAuthenticated &&
      !convexLoading &&
      !isRefreshingAuth &&
      now - lastRefreshAttempt > 5000
    ) {
      console.log("[useGmail] Auth mismatch detected - triggering token refresh");
      isRefreshingAuth = true;
      lastRefreshAttempt = now;
      refreshAccessToken().finally(() => {
        isRefreshingAuth = false;
      });
    }
  }, [isAuthenticated, convexAuthenticated, convexLoading, refreshAccessToken]);

  // Only query when Convex is authenticated (token is synced to server)
  const shouldQuery = convexAuthenticated && !convexLoading;

  // Query for cached untriaged emails - this is INSTANT from Convex
  // Now using getMyUntriagedEmails (authenticated) to only show emails that haven't been triaged
  // If sessionStart is provided, also includes emails triaged after that time
  const cachedEmails = useQuery(
    api.emails.getMyUntriagedEmails,
    shouldQuery
      ? { limit: 200, sessionStart }
      : "skip"
  );

  // Update module-level cache when we get fresh data
  if (cachedEmails !== undefined) {
    lastEmailsCache = cachedEmails;
  }

  // Use fresh data if available, otherwise show stale data from module cache
  const emailsToUse = cachedEmails ?? lastEmailsCache;

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
        nextPageToken = result.nextPageToken;

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
      if (!isAuthenticated || !user?.email || !nextPageToken) {
        return;
      }

      setIsSyncing(true);

      try {
        const result = await fetchEmailsAction({
          userEmail: user.email,
          maxResults,
          pageToken: nextPageToken,
        });
        nextPageToken = result.nextPageToken;

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

  // Transform emails to match expected format (use stale data if fresh not ready)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex query types don't match interface exactly
  const emails: GmailEmail[] = (emailsToUse || []).map((email: any) => ({
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

  // Debug logging
  if (cachedEmails === undefined && shouldQuery) {
    console.log("[useGmail] Query returned undefined despite shouldQuery=true");
  } else if (!shouldQuery) {
    console.log("[useGmail] Query skipped", { isAuthenticated, convexAuthenticated, convexLoading });
  }

  return {
    isAuthenticated,
    emails,
    // Only show loading if we have NO data (fresh or stale) AND auth is still loading
    // If auth failed but we have stale data, show that instead of spinner
    isLoading: emails.length === 0 && cachedEmails === undefined && (convexLoading || !convexAuthenticated),
    isSyncing, // Syncing with Gmail
    isSummarizing,
    error,
    hasMore: !!nextPageToken,
    syncWithGmail, // Call this on pull-to-refresh
    loadMore,
    summarizeEmails,
    userEmail: user?.email,
  };
}
