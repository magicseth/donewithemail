import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
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
  pendingTranscriptForId,
  transcript,
}: BatchTriageViewProps) {
  const {
    categories,
    total,
    isLoading,
    puntedEmails,
    togglePuntEmail,
    markCategoryDone,
    acceptCalendar,
    unsubscribe,
    processingCategory,
    acceptingIds,
    unsubscribingIds,
  } = useBatchTriage(userEmail);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

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

  // Handle unsubscribe
  const handleUnsubscribe = useCallback(async (emailId: string) => {
    await unsubscribe(emailId);
    showToast("Unsubscribed", "success");
  }, [unsubscribe, showToast]);

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

        {/* Pending/analyzing emails (if any) */}
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
            unsubscribingIds={unsubscribingIds}
            isProcessing={processingCategory === "pending"}
            recordingForId={recordingForId}
            pendingTranscriptForId={pendingTranscriptForId}
            transcript={transcript}
          />
        )}

        {/* Human waiting category - highest priority */}
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
          unsubscribingIds={unsubscribingIds}
          isProcessing={processingCategory === "humanWaiting"}
          recordingForId={recordingForId}
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
          unsubscribingIds={unsubscribingIds}
          isProcessing={processingCategory === "actionNeeded"}
          recordingForId={recordingForId}
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
          acceptingIds={acceptingIds}
          unsubscribingIds={unsubscribingIds}
          isProcessing={processingCategory === "calendar"}
          recordingForId={recordingForId}
            pendingTranscriptForId={pendingTranscriptForId}
            transcript={transcript}
        />

        {/* Done category */}
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
          unsubscribingIds={unsubscribingIds}
          isProcessing={processingCategory === "done"}
          recordingForId={recordingForId}
            pendingTranscriptForId={pendingTranscriptForId}
            transcript={transcript}
        />

        {/* Low confidence category */}
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
          unsubscribingIds={unsubscribingIds}
          isProcessing={processingCategory === "lowConfidence"}
          recordingForId={recordingForId}
            pendingTranscriptForId={pendingTranscriptForId}
            transcript={transcript}
        />

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

      {/* Toast notification */}
      {toast && (
        <View style={[
          styles.toast,
          toast.type === "success" && styles.toastSuccess,
          toast.type === "error" && styles.toastError,
        ]}>
          <Text style={styles.toastText}>{toast.message}</Text>
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
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "#333",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
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
    textAlign: "center",
  },
});
