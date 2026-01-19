import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useAction, useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

// Types for batch triage
export type BatchCategory = "done" | "humanWaiting" | "actionNeeded" | "calendar" | "lowConfidence" | "pending";

export interface BatchEmailPreview {
  _id: string;
  subject: string;
  bodyPreview: string;
  receivedAt: number;
  summary?: string;
  urgencyScore?: number;
  actionRequired?: "reply" | "action" | "fyi" | "none";
  calendarEvent?: {
    title: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    description?: string;
    recurrence?: string;
    recurrenceDescription?: string;
  };
  shouldAcceptCalendar?: boolean;
  isSubscription?: boolean;
  fromName?: string;
  fromContact?: {
    _id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
  } | null;
  aiProcessedAt?: number;
}

export interface BatchTriageResult {
  // Data
  categories: {
    done: BatchEmailPreview[];
    humanWaiting: BatchEmailPreview[];
    actionNeeded: BatchEmailPreview[];
    calendar: BatchEmailPreview[];
    lowConfidence: BatchEmailPreview[];
    pending: BatchEmailPreview[];
  };
  total: number;
  isLoading: boolean;

  // Saved emails (will go to TODO instead of done)
  savedEmails: Set<string>;

  // Actions
  toggleSaveEmail: (emailId: string) => void;
  markCategoryDone: (category: BatchCategory) => Promise<{ triaged: number; errors: string[] }>;
  unsubscribe: (emailId: string) => Promise<void>;

  // Processing state
  processingCategory: BatchCategory | null;
  unsubscribingIds: Set<string>;
}

export function useBatchTriage(userEmail: string | undefined): BatchTriageResult {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  // Query for batch triage preview
  const batchPreview = useQuery(
    api.emails.getMyBatchTriagePreview,
    isAuthenticated && !authLoading ? {} : "skip"
  );

  // Mutations and actions
  const batchTriageMutation = useMutation(api.emails.batchTriageMyEmails);
  const batchCalendarAction = useAction(api.calendar.batchAddToCalendar);
  const batchUnsubscribeAction = useAction(api.subscriptions.batchUnsubscribeMy);

  // Local state
  const [savedEmails, setSavedEmails] = useState<Set<string>>(new Set());
  const [processingCategory, setProcessingCategory] = useState<BatchCategory | null>(null);
  const [unsubscribingIds, setUnsubscribingIds] = useState<Set<string>>(new Set());

  // Categories data
  const categoriesData = useMemo(() => {
    if (!batchPreview) {
      return {
        done: [],
        humanWaiting: [],
        actionNeeded: [],
        calendar: [],
        lowConfidence: [],
        pending: [],
      };
    }
    return batchPreview;
  }, [batchPreview]);

  // Toggle save state for an email
  const toggleSaveEmail = useCallback((emailId: string) => {
    setSavedEmails(prev => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  }, []);

  // Mark all unsaved emails in a category as done
  const markCategoryDone = useCallback(async (category: BatchCategory): Promise<{
    triaged: number;
    errors: string[];
  }> => {
    if (!userEmail) {
      return { triaged: 0, errors: ["Not signed in"] };
    }

    setProcessingCategory(category);
    const errors: string[] = [];
    let triaged = 0;

    try {
      // Get emails in this category
      const emailsInCategory = categoriesData[category];

      // Split into saved (go to TODO) and unsaved (mark done)
      const toSave = emailsInCategory.filter(e => savedEmails.has(e._id));
      const toDone = emailsInCategory.filter(e => !savedEmails.has(e._id));

      // Build triage actions
      const triageActions: Array<{
        emailId: Id<"emails">;
        action: "done" | "reply_needed";
      }> = [];

      // Saved emails -> reply_needed (TODO)
      for (const email of toSave) {
        triageActions.push({
          emailId: email._id as Id<"emails">,
          action: "reply_needed",
        });
      }

      // Unsaved emails -> done
      for (const email of toDone) {
        triageActions.push({
          emailId: email._id as Id<"emails">,
          action: "done",
        });
      }

      // For calendar category, also add events to calendar (for unsaved only)
      if (category === "calendar") {
        const calendarEmailIds = toDone
          .filter(e => e.calendarEvent)
          .map(e => e._id as Id<"emails">);

        if (calendarEmailIds.length > 0) {
          try {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
            const calendarResult = await batchCalendarAction({
              userEmail,
              emailIds: calendarEmailIds,
              timezone,
            });
            if (calendarResult.errors.length > 0) {
              errors.push(...calendarResult.errors.map(e => `Calendar: ${e.error}`));
            }
          } catch (err) {
            errors.push(`Calendar batch failed: ${err instanceof Error ? err.message : "Unknown error"}`);
          }
        }
      }

      // Process triage actions
      if (triageActions.length > 0) {
        try {
          const triageResult = await batchTriageMutation({ triageActions });
          triaged = triageResult.triaged;
          if (triageResult.errors.length > 0) {
            errors.push(...triageResult.errors);
          }
        } catch (err) {
          errors.push(`Triage failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }

      // Clear saved state for processed emails
      setSavedEmails(prev => {
        const next = new Set(prev);
        for (const email of emailsInCategory) {
          next.delete(email._id);
        }
        return next;
      });

    } finally {
      setProcessingCategory(null);
    }

    return { triaged, errors };
  }, [userEmail, categoriesData, savedEmails, batchCalendarAction, batchTriageMutation]);

  // Unsubscribe from a mailing list
  const unsubscribe = useCallback(async (emailId: string) => {
    // Find the email to get sender info
    const allEmails = [
      ...categoriesData.done,
      ...categoriesData.humanWaiting,
      ...categoriesData.actionNeeded,
      ...categoriesData.calendar,
      ...categoriesData.lowConfidence,
      ...categoriesData.pending,
    ];
    const email = allEmails.find(e => e._id === emailId);
    if (!email?.fromContact?.email) return;

    setUnsubscribingIds(prev => new Set(prev).add(emailId));

    try {
      // We need to find the subscription by sender email
      // For now, we'll just mark the email as done since we don't have subscription IDs here
      // The actual unsubscribe should be done via the subscriptions API
      await batchTriageMutation({
        triageActions: [{
          emailId: emailId as Id<"emails">,
          action: "done",
        }],
      });
    } finally {
      setUnsubscribingIds(prev => {
        const next = new Set(prev);
        next.delete(emailId);
        return next;
      });
    }
  }, [categoriesData, batchTriageMutation]);

  return {
    categories: categoriesData,
    total: batchPreview?.total ?? 0,
    isLoading: !batchPreview && isAuthenticated && !authLoading,
    savedEmails,
    toggleSaveEmail,
    markCategoryDone,
    unsubscribe,
    processingCategory,
    unsubscribingIds,
  };
}
