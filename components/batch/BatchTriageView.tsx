import React, { useCallback, useState, useEffect, useRef, forwardRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  LayoutChangeEvent,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BatchCategoryCard } from "./BatchCategoryCard";
import { QuickReplyOption } from "./BatchEmailRow";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { useBatchTriageData } from "../../hooks/useBatchTriageData";
import { BatchCategory } from "../../hooks/useBatchTriage";

// Web-specific scrollable container that actually scrolls
const WebScrollView = forwardRef<HTMLDivElement, {
  style?: object | (object | false | null | undefined)[];
  contentContainerStyle?: object;
  children: React.ReactNode;
  hidden?: boolean;
}>(
  ({ style, contentContainerStyle, children, hidden }, ref) => {
    if (Platform.OS !== "web") {
      return null;
    }

    // Flatten style array, filtering out falsy values
    const flatStyle = Array.isArray(style)
      ? style.filter((s): s is object => Boolean(s)).reduce((acc, s) => ({ ...acc, ...s }), {})
      : (style || {});

    return (
      <div
        ref={ref}
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          ...flatStyle,
          // Apply hidden styles if needed
          ...(hidden && {
            position: "absolute" as const,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0,
            pointerEvents: "none" as const,
            zIndex: -1,
          }),
        }}
      >
        <div style={contentContainerStyle}>
          {children}
        </div>
      </div>
    );
  }
);

/** Email data passed to voice handlers to avoid lookup issues */
export interface VoiceEmailData {
  _id: string;
  subject: string;
  fromContact?: {
    _id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
  } | null;
}

interface BatchTriageViewProps {
  userEmail: string | undefined;
  sessionStart?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
  onQuickReply?: (emailId: string, reply: QuickReplyOption) => void;
  /** Pass email data directly to avoid lookup issues when email gets triaged during recording */
  onMicPressIn?: (emailId: string, email: VoiceEmailData) => void;
  onMicPressOut?: (emailId: string) => void;
  onSendTranscript?: (emailId: string) => void;
  /** ID of email currently being recorded for */
  recordingForId?: string | null;
  /** Whether deepgram is connected and streaming */
  isRecordingConnected?: boolean;
  /** ID of email that has a pending transcript to send */
  pendingTranscriptForId?: string | null;
  /** Live transcript while recording or pending */
  transcript?: string;
}

export function BatchTriageView({
  userEmail,
  sessionStart,
  onRefresh,
  refreshing = false,
  onQuickReply,
  onMicPressIn,
  onMicPressOut,
  onSendTranscript,
  recordingForId,
  isRecordingConnected = false,
  pendingTranscriptForId,
  transcript,
}: BatchTriageViewProps) {
  // Get safe area insets for toast positioning
  const insets = useSafeAreaInsets();

  // Disable scrolling while recording to prevent accidental release
  const isRecording = !!recordingForId;
  const {
    categories,
    total,
    isLoading,
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
  } = useBatchTriageData(userEmail, sessionStart);

  // Only one category can be expanded at a time
  const [expandedCategory, setExpandedCategory] = useState<BatchCategory | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const categoryYPositions = useRef<Map<BatchCategory, number>>(new Map());

  // Celebration state
  const [celebration, setCelebration] = useState<{ visible: boolean; count: number }>({
    visible: false,
    count: 0,
  });

  // Handle category expand/collapse - only one at a time
  const handleToggleExpand = useCallback((category: BatchCategory) => {
    setExpandedCategory(prev => {
      if (prev === category) {
        // Collapsing current category
        return null;
      }
      // Expanding new category - scroll to it
      const yPos = categoryYPositions.current.get(category);
      if (yPos !== undefined && scrollViewRef.current) {
        // Small delay to let the collapse animation start
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: yPos - 10, animated: true });
        }, 50);
      }
      return category;
    });
  }, []);

  // Track category positions for scrolling
  const handleCategoryLayout = useCallback((category: BatchCategory, event: LayoutChangeEvent) => {
    categoryYPositions.current.set(category, event.nativeEvent.layout.y);
  }, []);

  // Collapse expanded category if it becomes empty
  useEffect(() => {
    if (expandedCategory) {
      const emailsMap: Record<BatchCategory, typeof categories.done> = {
        done: categories.done,
        lowConfidence: categories.lowConfidence,
        actionNeeded: categories.actionNeeded,
        humanWaiting: categories.humanWaiting,
        calendar: categories.calendar,
        pending: categories.pending,
      };
      const expandedEmails = emailsMap[expandedCategory];
      if (!expandedEmails || expandedEmails.length === 0) {
        setExpandedCategory(null);
      }
    }
  }, [expandedCategory, categories]);

  // Clear sender cache when component unmounts (switching to swipe mode or leaving tab)
  useEffect(() => {
    return () => {
      clearSenderCache();
    };
  }, [clearSenderCache]);

  // Toast state with optional undo action
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    undoEmailId?: string;
    undoEmailIds?: string[];
  } | null>(null);
  const toastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info", undoEmailId?: string, undoEmailIds?: string[]) => {
    // Clear existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type, undoEmailId, undoEmailIds });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const handleUndo = useCallback(async () => {
    // Clear timeout and toast immediately
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast(null);

    try {
      if (toast?.undoEmailIds && toast.undoEmailIds.length > 0) {
        // Batch undo
        await batchUntriage(toast.undoEmailIds);
      } else if (toast?.undoEmailId) {
        // Single undo
        await untriage(toast.undoEmailId);
      }
    } catch (err) {
      showToast("Failed to undo", "error");
    }
  }, [toast?.undoEmailId, toast?.undoEmailIds, untriage, batchUntriage, showToast]);

  // Handle mark category done
  const handleMarkCategoryDone = useCallback(async (category: BatchCategory) => {
    const result = await markCategoryDone(category);

    if (result.errors.length > 0) {
      console.error("Batch triage errors:", result.errors);
      showToast(`${result.triaged} processed, ${result.errors.length} errors`, "error");
    } else if (result.triaged > 0) {
      // Show celebration animation with undo option
      setCelebration({ visible: true, count: result.triaged });
      // Show toast with undo button
      showToast(
        `${result.triaged} email${result.triaged !== 1 ? "s" : ""} marked as done`,
        "success",
        undefined,
        result.emailIds
      );
      // Close the expanded section and return to overview
      setExpandedCategory(null);
    }
  }, [markCategoryDone, showToast]);

  // Handle celebration complete
  const handleCelebrationComplete = useCallback(() => {
    setCelebration({ visible: false, count: 0 });
  }, []);

  // Handle accept calendar
  const handleAcceptCalendar = useCallback(async (emailId: string) => {
    // Find the email to get the event title
    const allEmails = [
      ...categories.done,
      ...categories.humanWaiting,
      ...categories.actionNeeded,
      ...categories.calendar,
      ...categories.lowConfidence,
      ...categories.pending,
    ];
    const email = allEmails.find(e => e._id === emailId);
    const eventTitle = email?.calendarEvent?.title || email?.fromName || "Event";

    try {
      await acceptCalendar(emailId);
      showToast(`Appointment "${eventTitle}" added to calendar`, "success", emailId);
    } catch (err) {
      showToast("Failed to add to calendar", "error");
    }
  }, [categories, acceptCalendar, showToast]);

  // Handle unsubscribe - shows toast with undo option
  const handleUnsubscribe = useCallback(async (emailId: string) => {
    await unsubscribe(emailId);
    showToast("Unsubscribed", "success", emailId);
  }, [unsubscribe, showToast]);

  // Handle mark single email as done
  const handleMarkEmailDone = useCallback(async (emailId: string) => {
    try {
      await markEmailDone(emailId);
      showToast("Marked as done", "success", emailId);
    } catch (err) {
      showToast("Failed to mark done", "error");
    }
  }, [markEmailDone, showToast]);

  // Handle mark all emails from a sender as done
  const handleMarkSenderDone = useCallback(async (senderEmail: string) => {
    if (!expandedCategory) return;

    // Find all emails from this sender in the expanded category
    const categoryEmails = expandedCategory ? (() => {
      const map: Record<BatchCategory, typeof categories.done> = {
        done: categories.done,
        lowConfidence: categories.lowConfidence,
        actionNeeded: categories.actionNeeded,
        humanWaiting: categories.humanWaiting,
        calendar: categories.calendar,
        pending: categories.pending,
      };
      return map[expandedCategory];
    })() : [];

    const senderEmails = categoryEmails.filter(
      e => (e.fromContact?.email || "unknown") === senderEmail
    );

    // Mark all as not punted (so they get triaged as done)
    for (const email of senderEmails) {
      if (puntedEmails.has(email._id)) {
        togglePuntEmail(email._id);
      }
    }

    // Then trigger category done (this will triage all unpunted)
    showToast(`${senderEmails.length} emails marked done`, "success");
  }, [expandedCategory, categories, puntedEmails, togglePuntEmail, showToast]);

  // Handle toggle flag on all emails from a sender
  const handleToggleSenderFlag = useCallback((senderEmail: string) => {
    if (!expandedCategory) return;

    // Find all emails from this sender in the expanded category
    const categoryEmails = (() => {
      const map: Record<BatchCategory, typeof categories.done> = {
        done: categories.done,
        lowConfidence: categories.lowConfidence,
        actionNeeded: categories.actionNeeded,
        humanWaiting: categories.humanWaiting,
        calendar: categories.calendar,
        pending: categories.pending,
      };
      return map[expandedCategory];
    })();

    const senderEmails = categoryEmails.filter(
      e => (e.fromContact?.email || "unknown") === senderEmail
    );

    // Check if all are already flagged
    const allFlagged = senderEmails.every(e => puntedEmails.has(e._id) || e.isInTodo);

    // Toggle all: if all flagged, unflag all; otherwise flag all
    for (const email of senderEmails) {
      const isFlagged = puntedEmails.has(email._id) || email.isInTodo;
      if (allFlagged && isFlagged && !email.isInTodo) {
        togglePuntEmail(email._id); // Unflag
      } else if (!allFlagged && !isFlagged) {
        togglePuntEmail(email._id); // Flag
      }
    }

    showToast(allFlagged ? "Unflagged all" : "Flagged all", "info");
  }, [expandedCategory, categories, puntedEmails, togglePuntEmail, showToast]);

  // Handle needs reply toggle - toggles TODO state and shows toast
  const handleNeedsReplyPress = useCallback(async (emailId: string) => {
    // Find the email to check if it's already in TODO
    const allEmails = [
      ...categories.done,
      ...categories.humanWaiting,
      ...categories.actionNeeded,
      ...categories.calendar,
      ...categories.lowConfidence,
      ...categories.pending,
    ];
    const email = allEmails.find(e => e._id === emailId);

    if (email?.isInTodo) {
      // Email is already triaged as reply_needed - untriage it
      try {
        await untriage(emailId);
        showToast("Removed from list", "success");
      } catch (err) {
        showToast("Failed to remove", "error");
      }
    } else {
      // Email not yet triaged - toggle local punted state
      const wasPunted = puntedEmails.has(emailId);
      togglePuntEmail(emailId);
      if (!wasPunted) {
        showToast("Added to the list!", "success");
      }
    }
  }, [categories, puntedEmails, togglePuntEmail, untriage, showToast]);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading emails...</Text>
      </View>
    );
  }

  // Empty state
  if (total === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📭</Text>
        <Text style={styles.emptyTitle}>Inbox Zero!</Text>
        <Text style={styles.emptySubtitle}>No emails to triage</Text>
      </View>
    );
  }

  // Check if any emails are still pending AI processing
  const hasPendingEmails = categories.pending.length > 0;

  // Helper to get emails for expanded category
  const getExpandedCategoryData = () => {
    if (!expandedCategory) return null;
    const emailsMap: Record<BatchCategory, typeof categories.done> = {
      done: categories.done,
      lowConfidence: categories.lowConfidence,
      actionNeeded: categories.actionNeeded,
      humanWaiting: categories.humanWaiting,
      calendar: categories.calendar,
      pending: categories.pending,
    };
    return emailsMap[expandedCategory];
  };

  const expandedEmails = getExpandedCategoryData();

  // Shared content for the category list (used by both web and native scroll containers)
  const categoryListContent = (
    <>
      {/* Header stats */}
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>
          {total} emails to review
          {puntedEmails.size > 0 && ` • ${puntedEmails.size} saved to TODO`}
        </Text>
      </View>

      {/* FYI category (was "Done") - newsletters, receipts, etc. */}
      <View onLayout={(e) => handleCategoryLayout("done", e)}>
        <BatchCategoryCard
          category="done"
          emails={categories.done}
          puntedEmails={puntedEmails}
          onPuntEmail={togglePuntEmail}
          onMarkAllDone={() => handleMarkCategoryDone("done")}
          onMarkSenderDone={handleMarkSenderDone}
          onToggleSenderFlag={handleToggleSenderFlag}
          onUnsubscribe={handleUnsubscribe}
          unsubscribingIds={unsubscribingIds}
          isExpanded={false}
          onToggleExpand={() => handleToggleExpand("done")}
        />
      </View>

      {/* Needs Review category (low confidence) */}
      <View onLayout={(e) => handleCategoryLayout("lowConfidence", e)}>
        <BatchCategoryCard
          category="lowConfidence"
          emails={categories.lowConfidence}
          puntedEmails={puntedEmails}
          onPuntEmail={togglePuntEmail}
          onMarkAllDone={() => handleMarkCategoryDone("lowConfidence")}
          onMarkSenderDone={handleMarkSenderDone}
          onToggleSenderFlag={handleToggleSenderFlag}
          onUnsubscribe={handleUnsubscribe}
          unsubscribingIds={unsubscribingIds}
          isExpanded={false}
          onToggleExpand={() => handleToggleExpand("lowConfidence")}
        />
      </View>

      {/* Action needed category */}
      <View onLayout={(e) => handleCategoryLayout("actionNeeded", e)}>
        <BatchCategoryCard
          category="actionNeeded"
          emails={categories.actionNeeded}
          puntedEmails={puntedEmails}
          onPuntEmail={togglePuntEmail}
          onMarkAllDone={() => handleMarkCategoryDone("actionNeeded")}
          onMarkSenderDone={handleMarkSenderDone}
          onToggleSenderFlag={handleToggleSenderFlag}
          onUnsubscribe={handleUnsubscribe}
          unsubscribingIds={unsubscribingIds}
          isExpanded={false}
          onToggleExpand={() => handleToggleExpand("actionNeeded")}
        />
      </View>

      {/* Human waiting category - emails requiring reply */}
      <View onLayout={(e) => handleCategoryLayout("humanWaiting", e)}>
        <BatchCategoryCard
          category="humanWaiting"
          emails={categories.humanWaiting}
          puntedEmails={puntedEmails}
          onPuntEmail={togglePuntEmail}
          onMarkAllDone={() => handleMarkCategoryDone("humanWaiting")}
          onMarkSenderDone={handleMarkSenderDone}
          onToggleSenderFlag={handleToggleSenderFlag}
          onUnsubscribe={handleUnsubscribe}
          unsubscribingIds={unsubscribingIds}
          isExpanded={false}
          onToggleExpand={() => handleToggleExpand("humanWaiting")}
        />
      </View>

      {/* Calendar category */}
      <View onLayout={(e) => handleCategoryLayout("calendar", e)}>
        <BatchCategoryCard
          category="calendar"
          emails={categories.calendar}
          puntedEmails={puntedEmails}
          onPuntEmail={togglePuntEmail}
          onMarkAllDone={() => handleMarkCategoryDone("calendar")}
          onMarkSenderDone={handleMarkSenderDone}
          onToggleSenderFlag={handleToggleSenderFlag}
          onUnsubscribe={handleUnsubscribe}
          unsubscribingIds={unsubscribingIds}
          isExpanded={false}
          onToggleExpand={() => handleToggleExpand("calendar")}
        />
      </View>

      {/* Pending/analyzing emails (if any) - shown at bottom */}
      {categories.pending.length > 0 && (
        <View onLayout={(e) => handleCategoryLayout("pending", e)}>
          <BatchCategoryCard
            category="pending"
            emails={categories.pending}
            puntedEmails={puntedEmails}
            onPuntEmail={togglePuntEmail}
            onMarkAllDone={() => handleMarkCategoryDone("pending")}
            onMarkSenderDone={handleMarkSenderDone}
            onToggleSenderFlag={handleToggleSenderFlag}
            onUnsubscribe={handleUnsubscribe}
            unsubscribingIds={unsubscribingIds}
            isExpanded={false}
            onToggleExpand={() => handleToggleExpand("pending")}
          />
        </View>
      )}

      {/* Bottom spacing */}
      <View style={styles.bottomSpacer} />
    </>
  );

  return (
    <View style={styles.container}>
      {/* When a category is expanded on native, render it outside ScrollView */}
      {expandedCategory && expandedEmails && (
        <View style={styles.expandedContainer}>
          <BatchCategoryCard
            category={expandedCategory}
            emails={expandedEmails}
            puntedEmails={puntedEmails}
            onPuntEmail={togglePuntEmail}
            onMarkEmailDone={handleMarkEmailDone}
            onMarkAllDone={() => handleMarkCategoryDone(expandedCategory)}
            onMarkSenderDone={handleMarkSenderDone}
            onToggleSenderFlag={handleToggleSenderFlag}
            onAcceptCalendar={handleAcceptCalendar}
            onQuickReply={onQuickReply}
            onMicPressIn={onMicPressIn}
            onMicPressOut={onMicPressOut}
            onSendTranscript={onSendTranscript}
            onUnsubscribe={handleUnsubscribe}
            onNeedsReplyPress={handleNeedsReplyPress}
            acceptingIds={acceptingIds}
            unsubscribingIds={unsubscribingIds}
            isProcessing={processingCategory === expandedCategory}
            recordingForId={recordingForId}
            isRecordingConnected={isRecordingConnected}
            pendingTranscriptForId={pendingTranscriptForId}
            transcript={transcript}
            isExpanded={true}
            onToggleExpand={() => handleToggleExpand(expandedCategory)}
          />
        </View>
      )}

      {/* Scrollable categories - hidden when one is expanded */}
      {Platform.OS === "web" ? (
        <WebScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          hidden={!!expandedCategory}
        >
          {categoryListContent}
        </WebScrollView>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={[styles.scrollView, expandedCategory && styles.hidden]}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={!isRecording && expandedCategory === null}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
            ) : undefined
          }
        >
          {categoryListContent}
        </ScrollView>
      )}

      {/* Pending warning */}
      {hasPendingEmails && (
        <View style={styles.pendingWarningContainer}>
          <Text style={styles.pendingWarning}>
            Some emails still analyzing...
          </Text>
        </View>
      )}

      {/* Toast notification at top with optional undo */}
      {toast && (
        <View style={[
          styles.toast,
          { top: insets.top + 10 },
          toast.type === "success" && styles.toastSuccess,
          toast.type === "error" && styles.toastError,
        ]}>
          <Text style={styles.toastText}>{toast.message}</Text>
          {(toast.undoEmailId || (toast.undoEmailIds && toast.undoEmailIds.length > 0)) && (
            <TouchableOpacity style={styles.undoButton} onPress={handleUndo}>
              <Text style={styles.undoButtonText}>Undo</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Celebration overlay */}
      <CelebrationOverlay
        count={celebration.count}
        visible={celebration.visible}
        onComplete={handleCelebrationComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 12,
  },
  hidden: {
    display: "none",
  },
  expandedContainer: {
    flex: 1,
  },
  statsRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statsText: {
    fontSize: 13,
    color: "#666",
  },
  bottomSpacer: {
    height: 40,
  },
  pendingWarningContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#FFFBEB",
    borderTopWidth: 1,
    borderTopColor: "#FDE68A",
  },
  pendingWarning: {
    textAlign: "center",
    fontSize: 12,
    color: "#F59E0B",
  },
  toast: {
    position: "absolute",
    top: 10,
    left: 20,
    right: 20,
    backgroundColor: "#333",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  toastSuccess: {
    backgroundColor: "#10B981",
  },
  toastError: {
    backgroundColor: "#EF4444",
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  undoButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
  },
  undoButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
