import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { BatchCategoryCard } from "./BatchCategoryCard";
import { QuickReplyOption } from "./BatchEmailRow";
import { useBatchTriage, BatchCategory } from "../../hooks/useBatchTriage";

interface BatchTriageViewProps {
  userEmail: string | undefined;
  onRefresh?: () => void;
  refreshing?: boolean;
  onQuickReply?: (emailId: string, reply: QuickReplyOption) => void;
  onMicPressIn?: (emailId: string) => void;
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
  // Disable scrolling while recording to prevent accidental release
  const isRecording = !!recordingForId;
  const {
    categories,
    total,
    isLoading,
    puntedEmails,
    togglePuntEmail,
    markCategoryDone,
    acceptCalendar,
    unsubscribe,
    untriage,
    clearSenderCache,
    processingCategory,
    acceptingIds,
    unsubscribingIds,
  } = useBatchTriage(userEmail);

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
  } | null>(null);
  const toastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info", undoEmailId?: string) => {
    // Clear existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type, undoEmailId });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const handleUndo = useCallback(async () => {
    if (toast?.undoEmailId) {
      // Clear timeout and toast immediately
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      setToast(null);
      try {
        await untriage(toast.undoEmailId);
      } catch (err) {
        showToast("Failed to undo", "error");
      }
    }
  }, [toast?.undoEmailId, untriage, showToast]);

  // Handle mark category done
  const handleMarkCategoryDone = useCallback(async (category: BatchCategory) => {
    const result = await markCategoryDone(category);

    if (result.errors.length > 0) {
      console.error("Batch triage errors:", result.errors);
      showToast(`${result.triaged} processed, ${result.errors.length} errors`, "error");
    } else if (result.triaged > 0) {
      showToast(`${result.triaged} emails processed`, "success");
    }
  }, [markCategoryDone, showToast]);

  // Handle accept calendar
  const handleAcceptCalendar = useCallback(async (emailId: string) => {
    try {
      await acceptCalendar(emailId);
      showToast("Added to calendar", "success");
    } catch (err) {
      showToast("Failed to add to calendar", "error");
    }
  }, [acceptCalendar, showToast]);

  // Handle unsubscribe - shows toast with undo option
  const handleUnsubscribe = useCallback(async (emailId: string) => {
    await unsubscribe(emailId);
    showToast("Unsubscribed", "success", emailId);
  }, [unsubscribe, showToast]);

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

  return (
    <View style={styles.container}>
      {/* Scrollable categories */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={!isRecording}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6366F1"
            />
          ) : undefined
        }
      >
        {/* Header stats */}
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>
            {total} emails to review
            {puntedEmails.size > 0 && ` • ${puntedEmails.size} saved to TODO`}
          </Text>
        </View>

        {/* FYI category (was "Done") - newsletters, receipts, etc. */}
        <BatchCategoryCard
          category="done"
          emails={categories.done}
          puntedEmails={puntedEmails}
          onPuntEmail={togglePuntEmail}
          onMarkAllDone={() => handleMarkCategoryDone("done")}
          onQuickReply={onQuickReply}
          onMicPressIn={onMicPressIn}
          onMicPressOut={onMicPressOut}
          onSendTranscript={onSendTranscript}
          onUnsubscribe={handleUnsubscribe}
          onNeedsReplyPress={handleNeedsReplyPress}
          unsubscribingIds={unsubscribingIds}
          isProcessing={processingCategory === "done"}
          recordingForId={recordingForId}
          isRecordingConnected={isRecordingConnected}
          pendingTranscriptForId={pendingTranscriptForId}
          transcript={transcript}
        />

        {/* Needs Review category (low confidence) */}
        <BatchCategoryCard
          category="lowConfidence"
          emails={categories.lowConfidence}
          puntedEmails={puntedEmails}
          onPuntEmail={togglePuntEmail}
          onMarkAllDone={() => handleMarkCategoryDone("lowConfidence")}
          onQuickReply={onQuickReply}
          onMicPressIn={onMicPressIn}
          onMicPressOut={onMicPressOut}
          onSendTranscript={onSendTranscript}
          onUnsubscribe={handleUnsubscribe}
          onNeedsReplyPress={handleNeedsReplyPress}
          unsubscribingIds={unsubscribingIds}
          isProcessing={processingCategory === "lowConfidence"}
          recordingForId={recordingForId}
          isRecordingConnected={isRecordingConnected}
          pendingTranscriptForId={pendingTranscriptForId}
          transcript={transcript}
        />

        {/* Action needed category */}
        <BatchCategoryCard
          category="actionNeeded"
          emails={categories.actionNeeded}
          puntedEmails={puntedEmails}
          onPuntEmail={togglePuntEmail}
          onMarkAllDone={() => handleMarkCategoryDone("actionNeeded")}
          onQuickReply={onQuickReply}
          onMicPressIn={onMicPressIn}
          onMicPressOut={onMicPressOut}
          onSendTranscript={onSendTranscript}
          onUnsubscribe={handleUnsubscribe}
          onNeedsReplyPress={handleNeedsReplyPress}
          unsubscribingIds={unsubscribingIds}
          isProcessing={processingCategory === "actionNeeded"}
          recordingForId={recordingForId}
          isRecordingConnected={isRecordingConnected}
          pendingTranscriptForId={pendingTranscriptForId}
          transcript={transcript}
        />

        {/* Human waiting category - emails requiring reply */}
        <BatchCategoryCard
          category="humanWaiting"
          emails={categories.humanWaiting}
          puntedEmails={puntedEmails}
          onPuntEmail={togglePuntEmail}
          onMarkAllDone={() => handleMarkCategoryDone("humanWaiting")}
          onQuickReply={onQuickReply}
          onMicPressIn={onMicPressIn}
          onMicPressOut={onMicPressOut}
          onSendTranscript={onSendTranscript}
          onUnsubscribe={handleUnsubscribe}
          onNeedsReplyPress={handleNeedsReplyPress}
          unsubscribingIds={unsubscribingIds}
          isProcessing={processingCategory === "humanWaiting"}
          recordingForId={recordingForId}
          isRecordingConnected={isRecordingConnected}
          pendingTranscriptForId={pendingTranscriptForId}
          transcript={transcript}
        />

        {/* Calendar category */}
        <BatchCategoryCard
          category="calendar"
          emails={categories.calendar}
          puntedEmails={puntedEmails}
          onPuntEmail={togglePuntEmail}
          onMarkAllDone={() => handleMarkCategoryDone("calendar")}
          onAcceptCalendar={handleAcceptCalendar}
          onQuickReply={onQuickReply}
          onMicPressIn={onMicPressIn}
          onMicPressOut={onMicPressOut}
          onSendTranscript={onSendTranscript}
          onUnsubscribe={handleUnsubscribe}
          onNeedsReplyPress={handleNeedsReplyPress}
          acceptingIds={acceptingIds}
          unsubscribingIds={unsubscribingIds}
          isProcessing={processingCategory === "calendar"}
          recordingForId={recordingForId}
          isRecordingConnected={isRecordingConnected}
          pendingTranscriptForId={pendingTranscriptForId}
          transcript={transcript}
        />

        {/* Pending/analyzing emails (if any) - shown at bottom */}
        {categories.pending.length > 0 && (
          <BatchCategoryCard
            category="pending"
            emails={categories.pending}
            puntedEmails={puntedEmails}
            onPuntEmail={togglePuntEmail}
            onMarkAllDone={() => handleMarkCategoryDone("pending")}
            onQuickReply={onQuickReply}
            onMicPressIn={onMicPressIn}
            onMicPressOut={onMicPressOut}
            onSendTranscript={onSendTranscript}
            onUnsubscribe={handleUnsubscribe}
            onNeedsReplyPress={handleNeedsReplyPress}
            unsubscribingIds={unsubscribingIds}
            isProcessing={processingCategory === "pending"}
            recordingForId={recordingForId}
            isRecordingConnected={isRecordingConnected}
            pendingTranscriptForId={pendingTranscriptForId}
            transcript={transcript}
          />
        )}

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

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
          toast.type === "success" && styles.toastSuccess,
          toast.type === "error" && styles.toastError,
        ]}>
          <Text style={styles.toastText}>{toast.message}</Text>
          {toast.undoEmailId && (
            <TouchableOpacity style={styles.undoButton} onPress={handleUndo}>
              <Text style={styles.undoButtonText}>Undo</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
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
    top: 60,
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
