import { useState, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useAction, useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

// Types for batch triage
export type BatchCategory = "done" | "humanWaiting" | "actionNeeded" | "calendar" | "lowConfidence" | "pending";

export interface QuickReplyOption {
  label: string;
  body: string;
}

export interface BatchEmailPreview {
  _id: string;
  subject: string;
  bodyPreview: string;
  receivedAt: number;
  summary?: string;
  urgencyScore?: number;
  actionRequired?: "reply" | "action" | "fyi" | "none";
  quickReplies?: QuickReplyOption[];
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
  /** True if this email is already triaged as reply_needed (in TODO list) */
  isInTodo?: boolean;
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

  // Punted emails (will go to TODO instead of done)
  puntedEmails: Set<string>;

  // Actions
  togglePuntEmail: (emailId: string) => void;
  markCategoryDone: (category: BatchCategory) => Promise<{ triaged: number; errors: string[] }>;
  markEmailDone: (emailId: string) => Promise<void>;
  acceptCalendar: (emailId: string) => Promise<void>;
  unsubscribe: (emailId: string) => Promise<void>;
  untriage: (emailId: string) => Promise<void>;
  /** Clear the sender timestamp cache - call when leaving the view */
  clearSenderCache: () => void;

  // Processing state
  processingCategory: BatchCategory | null;
  acceptingIds: Set<string>;
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
  const untriageMutation = useMutation(api.emails.untriagedMyEmail);
  const batchCalendarAction = useAction(api.calendar.batchAddToCalendar);

  // Local state
  const [puntedEmails, setPuntedEmails] = useState<Set<string>>(new Set());
  const [processingCategory, setProcessingCategory] = useState<BatchCategory | null>(null);
  const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());
  const [unsubscribingIds, setUnsubscribingIds] = useState<Set<string>>(new Set());

  // Cache for sender timestamps - prevents order from jumping during triage
  // Key: sender identifier (name/email), Value: most recent timestamp from that sender
  const senderTimestampCache = useRef<Map<string, number>>(new Map());

  // Helper to get sender identifier
  const getSenderKey = useCallback((email: BatchEmailPreview): string => {
    return (email.fromName || email.fromContact?.name || email.fromContact?.email || "unknown").toLowerCase();
  }, []);

  // Build sender timestamp cache from all emails (only when cache is empty)
  const buildSenderCache = useCallback((allEmails: BatchEmailPreview[]) => {
    if (senderTimestampCache.current.size > 0) {
      // Cache already built, don't rebuild to prevent order jumping
      return;
    }
    for (const email of allEmails) {
      const senderKey = getSenderKey(email);
      const existingTimestamp = senderTimestampCache.current.get(senderKey);
      if (!existingTimestamp || email.receivedAt > existingTimestamp) {
        senderTimestampCache.current.set(senderKey, email.receivedAt);
      }
    }
  }, [getSenderKey]);

  // Clear sender cache - call when leaving the view or switching tabs
  const clearSenderCache = useCallback(() => {
    senderTimestampCache.current.clear();
  }, []);

  // Sort emails by sender's cached timestamp (most recent sender first), then group same sender together
  const sortBySender = useCallback((emails: BatchEmailPreview[]) => {
    return [...emails].sort((a, b) => {
      const keyA = getSenderKey(a);
      const keyB = getSenderKey(b);

      // Get cached timestamps (fall back to email timestamp if not in cache)
      const timestampA = senderTimestampCache.current.get(keyA) ?? a.receivedAt;
      const timestampB = senderTimestampCache.current.get(keyB) ?? b.receivedAt;

      // Primary sort: by sender's most recent email timestamp (descending - most recent first)
      if (keyA !== keyB) {
        return timestampB - timestampA;
      }

      // Secondary sort: for same sender, by individual email receivedAt (newer first)
      return b.receivedAt - a.receivedAt;
    });
  }, [getSenderKey]);

  // Categories data sorted by sender
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

    // Build sender cache from all emails (only if cache is empty)
    const allEmails = [
      ...batchPreview.done,
      ...batchPreview.humanWaiting,
      ...batchPreview.actionNeeded,
      ...batchPreview.calendar,
      ...batchPreview.lowConfidence,
      ...batchPreview.pending,
    ];
    buildSenderCache(allEmails);

    return {
      done: sortBySender(batchPreview.done),
      humanWaiting: sortBySender(batchPreview.humanWaiting),
      actionNeeded: sortBySender(batchPreview.actionNeeded),
      calendar: sortBySender(batchPreview.calendar),
      lowConfidence: sortBySender(batchPreview.lowConfidence),
      pending: batchPreview.pending, // Don't sort pending - keep processing order
    };
  }, [batchPreview, sortBySender, buildSenderCache]);

  // Toggle punt state for an email
  const togglePuntEmail = useCallback((emailId: string) => {
    setPuntedEmails(prev => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  }, []);

  // Mark all unpunted emails in a category as done
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

      // Split into punted (go to TODO) and unpunted (mark done)
      // Exclude isInTodo emails - they're already triaged as reply_needed
      const toPunt = emailsInCategory.filter((e: any) => puntedEmails.has(e._id) && !e.isInTodo);
      const toDone = emailsInCategory.filter((e: any) => !puntedEmails.has(e._id) && !e.isInTodo);

      // Build triage actions
      const triageActions: Array<{
        emailId: Id<"emails">;
        action: "done" | "reply_needed";
      }> = [];

      // Punted emails -> reply_needed (TODO)
      for (const email of toPunt) {
        triageActions.push({
          emailId: email._id as Id<"emails">,
          action: "reply_needed",
        });
      }

      // Unpunted emails -> done
      for (const email of toDone) {
        triageActions.push({
          emailId: email._id as Id<"emails">,
          action: "done",
        });
      }

      // For calendar category, also add events to calendar (for unpunted only)
      if (category === "calendar") {
        const calendarEmailIds = toDone
          .filter((e: any) => e.calendarEvent)
          .map((e: any) => e._id as Id<"emails">);

        if (calendarEmailIds.length > 0) {
          try {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
            const calendarResult = await batchCalendarAction({
              userEmail,
              emailIds: calendarEmailIds,
              timezone,
            });
            if (calendarResult.errors.length > 0) {
              errors.push(...calendarResult.errors.map((e: any) => `Calendar: ${e.error}`));
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

      // Clear punted state for processed emails
      setPuntedEmails(prev => {
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
  }, [userEmail, categoriesData, puntedEmails, batchCalendarAction, batchTriageMutation]);

  // Accept a single calendar event
  const acceptCalendar = useCallback(async (emailId: string) => {
    if (!userEmail) return;

    setAcceptingIds(prev => new Set(prev).add(emailId));

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";

      // Add to calendar
      await batchCalendarAction({
        userEmail,
        emailIds: [emailId as Id<"emails">],
        timezone,
      });

      // Mark as done
      await batchTriageMutation({
        triageActions: [{
          emailId: emailId as Id<"emails">,
          action: "done",
        }],
      });
    } finally {
      setAcceptingIds(prev => {
        const next = new Set(prev);
        next.delete(emailId);
        return next;
      });
    }
  }, [userEmail, batchCalendarAction, batchTriageMutation]);

  // Unsubscribe from a mailing list - marks only THIS email as done
  // (User may have multiple emails from same sender to different recipients)
  const unsubscribe = useCallback(async (emailId: string) => {
    setUnsubscribingIds(prev => new Set(prev).add(emailId));

    try {
      // Just triage this one email - don't auto-triage all from sender
      // This lets user unsubscribe from each email individually
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
  }, [batchTriageMutation]);

  // Mark a single email as done
  const markEmailDone = useCallback(async (emailId: string) => {
    await batchTriageMutation({
      triageActions: [{
        emailId: emailId as Id<"emails">,
        action: "done",
      }],
    });
  }, [batchTriageMutation]);

  // Untriage an email (undo triage action)
  const untriage = useCallback(async (emailId: string) => {
    await untriageMutation({ emailId: emailId as Id<"emails"> });
  }, [untriageMutation]);

  return {
    categories: categoriesData,
    total: batchPreview?.total ?? 0,
    // Loading if: auth is loading, OR (authenticated but no data yet)
    isLoading: authLoading || (!batchPreview && isAuthenticated),
    puntedEmails,
    togglePuntEmail,
    markCategoryDone,
    markEmailDone,
    acceptCalendar,
    unsubscribe,
    untriage,
    clearSenderCache,
    processingCategory,
    acceptingIds,
    unsubscribingIds,
  };
}
