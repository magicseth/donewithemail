/**
 * Wrapper for useBatchTriage that supports demo mode
 */
import { useMemo, useState, useCallback } from "react";
import { useBatchTriage, BatchCategory, BatchEmailPreview, BatchTriageResult } from "./useBatchTriage";
import { useDemoMode } from "../lib/demoModeContext";

export function useBatchTriageData(userEmail: string | undefined, sessionStart?: number): BatchTriageResult {
  const { isDemoMode, demoEmails, demoSummaries, triageEmail } = useDemoMode();
  const realBatchTriage = useBatchTriage(userEmail, sessionStart);

  // Local state for demo mode
  const [puntedEmails, setPuntedEmails] = useState<Set<string>>(new Set());
  const [processingCategory, setProcessingCategory] = useState<BatchCategory | null>(null);
  const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());
  const [unsubscribingIds, setUnsubscribingIds] = useState<Set<string>>(new Set());

  // Convert demo emails to batch preview format
  // Punted emails should appear in humanWaiting regardless of their original category
  const demoCategories = useMemo(() => {
    if (!isDemoMode) {
      return {
        done: [],
        humanWaiting: [],
        actionNeeded: [],
        calendar: [],
        lowConfidence: [],
        pending: [],
      };
    }

    const categories = {
      done: [] as BatchEmailPreview[],
      humanWaiting: [] as BatchEmailPreview[],
      actionNeeded: [] as BatchEmailPreview[],
      calendar: [] as BatchEmailPreview[],
      lowConfidence: [] as BatchEmailPreview[],
      pending: [] as BatchEmailPreview[],
    };

    // Only process untriaged emails
    const untriagedEmails = demoEmails.filter((email) => !email.isTriaged);

    untriagedEmails.forEach((email) => {
      const summary = demoSummaries.find((s) => s.emailId === email._id);

      const preview: BatchEmailPreview = {
        _id: email._id,
        subject: email.subject,
        bodyPreview: email.bodyPreview,
        receivedAt: email.receivedAt,
        summary: summary?.summary,
        urgencyScore: summary?.urgencyScore,
        actionRequired: summary?.actionRequired,
        quickReplies: summary?.quickReplies,
        calendarEvent: summary?.calendarEvent,
        shouldAcceptCalendar: false,
        isSubscription: false,
        fromName: email.fromContact?.name,
        fromContact: email.fromContact
          ? {
              _id: email.fromContact._id,
              email: email.fromContact.email,
              name: email.fromContact.name,
              avatarUrl: email.fromContact.avatarUrl,
            }
          : null,
        aiProcessedAt: Date.now(),
        isInTodo: false,
      };

      // If email is punted, it goes to humanWaiting regardless of AI categorization
      if (puntedEmails.has(email._id)) {
        categories.humanWaiting.push(preview);
        return;
      }

      // Categorize based on AI summary
      if (!summary) {
        categories.pending.push(preview);
      } else if (summary.calendarEvent) {
        categories.calendar.push(preview);
      } else if (summary.actionRequired === "reply") {
        categories.humanWaiting.push(preview);
      } else if (summary.actionRequired === "action") {
        categories.actionNeeded.push(preview);
      } else if (summary.urgencyScore < 40) {
        categories.done.push(preview);
      } else {
        categories.lowConfidence.push(preview);
      }
    });

    return categories;
  }, [isDemoMode, demoEmails, demoSummaries, puntedEmails]);

  const togglePuntEmail = useCallback((emailId: string) => {
    setPuntedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  }, []);

  const markCategoryDone = useCallback(
    async (category: BatchCategory) => {
      if (!isDemoMode) {
        return { triaged: 0, errors: [], emailIds: [] };
      }

      setProcessingCategory(category);
      const categoryEmails = demoCategories[category];

      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      let triagedCount = 0;
      const triagedEmailIds: string[] = [];
      categoryEmails.forEach((email) => {
        const action = puntedEmails.has(email._id) ? "reply_needed" : "done";
        triageEmail(email._id, action);
        triagedCount++;
        triagedEmailIds.push(email._id);
      });

      setProcessingCategory(null);
      return { triaged: triagedCount, errors: [], emailIds: triagedEmailIds };
    },
    [isDemoMode, demoCategories, puntedEmails, triageEmail]
  );

  const acceptCalendar = useCallback(
    async (emailId: string) => {
      if (!isDemoMode) return;

      setAcceptingIds((prev) => new Set(prev).add(emailId));

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      triageEmail(emailId, "done");
      setAcceptingIds((prev) => {
        const next = new Set(prev);
        next.delete(emailId);
        return next;
      });
    },
    [isDemoMode, triageEmail]
  );

  const unsubscribe = useCallback(
    async (emailId: string) => {
      if (!isDemoMode) return;

      setUnsubscribingIds((prev) => new Set(prev).add(emailId));

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      triageEmail(emailId, "done");
      setUnsubscribingIds((prev) => {
        const next = new Set(prev);
        next.delete(emailId);
        return next;
      });
    },
    [isDemoMode, triageEmail]
  );

  const untriage = useCallback(
    async (emailId: string) => {
      // In demo mode, we don't have a proper untriage function
      // Just remove from punted set if it's there
      if (isDemoMode) {
        setPuntedEmails((prev) => {
          const next = new Set(prev);
          next.delete(emailId);
          return next;
        });
      }
    },
    [isDemoMode]
  );

  const markEmailDone = useCallback(
    async (emailId: string) => {
      if (!isDemoMode) return;

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      triageEmail(emailId, "done");
    },
    [isDemoMode, triageEmail]
  );

  const clearSenderCache = useCallback(() => {
    // No-op in demo mode
  }, []);

  const batchUntriage = useCallback(
    async (emailIds: string[]) => {
      // In demo mode, we don't have proper untriage - just no-op
      if (isDemoMode) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    },
    [isDemoMode]
  );

  if (isDemoMode) {
    const total = Object.values(demoCategories).reduce((sum, arr) => sum + arr.length, 0);

    return {
      categories: demoCategories,
      total,
      isLoading: false,
      puntedEmails,
      togglePuntEmail,
      markCategoryDone,
      markEmailDone,
      acceptCalendar,
      unsubscribe,
      untriage,
      batchUntriage,
      clearSenderCache,
      processingCategory,
      acceptingIds,
      unsubscribingIds,
    };
  }

  return realBatchTriage;
}
