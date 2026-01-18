import { useState, useCallback, useRef, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "../lib/authContext";

export interface GmailEmail {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  receivedAt: number;
  isRead: boolean;
  labels: string[];
  from: {
    name: string;
    email: string;
  };
  // AI-generated fields
  summary?: string;
  urgencyScore?: number;
  urgencyReason?: string;
  suggestedReply?: string;
}

export function useGmail() {
  const { user, isAuthenticated } = useAuth();
  const [emails, setEmails] = useState<GmailEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const nextPageTokenRef = useRef<string | undefined>(undefined);

  // Action to fetch emails from server
  const fetchEmailsAction = useAction(api.gmailSync.fetchEmails);
  const summarizeAction = useAction(api.summarizeActions.summarizeByExternalIds);

  // Trigger summarization for emails
  const summarizeEmails = useCallback(
    async (emailIds: string[]) => {
      if (!isAuthenticated || !user?.email || emailIds.length === 0) return;

      console.log("Starting summarization for", emailIds.length, "emails");
      setIsSummarizing(true);
      try {
        const results = await summarizeAction({
          externalIds: emailIds,
          userEmail: user.email,
        });
        console.log("Summarization results:", results);

        // Update emails with summaries
        setEmails((prev) =>
          prev.map((email) => {
            const result = results.find(
              (r: any) => r.externalId === email.id && r.success
            );
            if (result?.result) {
              return {
                ...email,
                summary: result.result.summary,
                urgencyScore: result.result.urgencyScore,
                urgencyReason: result.result.urgencyReason,
                suggestedReply: result.result.suggestedReply,
              };
            }
            return email;
          })
        );
      } catch (e) {
        console.error("Failed to summarize emails:", e);
        // Log full error details
        if (e instanceof Error) {
          console.error("Error details:", e.message, e.stack);
        }
      } finally {
        setIsSummarizing(false);
      }
    },
    [isAuthenticated, user?.email, summarizeAction]
  );

  const fetchEmails = useCallback(
    async (maxResults = 50) => {
      if (!isAuthenticated || !user?.email) {
        setError("Not authenticated");
        return [];
      }

      setIsLoading(true);
      setError(null);

      try {
        // Fetch emails using stored tokens (first page)
        const result = await fetchEmailsAction({
          userEmail: user.email,
          maxResults,
        });
        setEmails(result.emails);
        nextPageTokenRef.current = result.nextPageToken;
        setHasMore(!!result.nextPageToken);

        // Trigger summarization for new emails (in background)
        const emailIds = result.emails.map((e: any) => e.id);
        summarizeEmails(emailIds);

        return result.emails;
      } catch (e) {
        const errorMessage =
          e instanceof Error ? e.message : "Failed to fetch emails";
        setError(errorMessage);
        console.error("Failed to fetch emails:", e);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, user?.email, fetchEmailsAction, summarizeEmails]
  );

  const loadMore = useCallback(
    async (maxResults = 50) => {
      if (!isAuthenticated || !user?.email || !hasMore || isLoadingMore) {
        return [];
      }

      if (!nextPageTokenRef.current) {
        setHasMore(false);
        return [];
      }

      setIsLoadingMore(true);

      try {
        const result = await fetchEmailsAction({
          userEmail: user.email,
          maxResults,
          pageToken: nextPageTokenRef.current,
        });

        // Append new emails to existing list
        setEmails((prev) => [...prev, ...result.emails]);
        nextPageTokenRef.current = result.nextPageToken;
        setHasMore(!!result.nextPageToken);

        // Trigger summarization for new emails
        const emailIds = result.emails.map((e: any) => e.id);
        summarizeEmails(emailIds);

        return result.emails;
      } catch (e) {
        console.error("Failed to load more emails:", e);
        return [];
      } finally {
        setIsLoadingMore(false);
      }
    },
    [isAuthenticated, user?.email, hasMore, isLoadingMore, fetchEmailsAction, summarizeEmails]
  );

  const refetch = useCallback(() => {
    nextPageTokenRef.current = undefined;
    setHasMore(true);
    return fetchEmails();
  }, [fetchEmails]);

  return {
    isAuthenticated,
    emails,
    isLoading,
    isLoadingMore,
    isSummarizing,
    error,
    hasMore,
    fetchEmails,
    loadMore,
    refetch,
    summarizeEmails,
    userEmail: user?.email,
    userId: user?.id,
  };
}
