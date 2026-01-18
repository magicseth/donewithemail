import { useState, useCallback } from "react";
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
}

export function useGmail() {
  const { user, isAuthenticated } = useAuth();
  const [emails, setEmails] = useState<GmailEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Action to fetch emails from server
  const fetchEmailsAction = useAction(api.gmailSync.fetchEmails);

  const fetchEmails = useCallback(
    async (maxResults = 20) => {
      if (!isAuthenticated || !user?.email) {
        setError("Not authenticated");
        return [];
      }

      setIsLoading(true);
      setError(null);

      try {
        // Fetch emails using stored tokens
        const result = await fetchEmailsAction({
          userEmail: user.email,
          maxResults,
        });
        setEmails(result);
        return result;
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
    [isAuthenticated, user?.email, fetchEmailsAction]
  );

  const refetch = useCallback(() => {
    return fetchEmails();
  }, [fetchEmails]);

  return {
    isAuthenticated,
    emails,
    isLoading,
    error,
    fetchEmails,
    refetch,
    userEmail: user?.email,
    userId: user?.id,
  };
}
