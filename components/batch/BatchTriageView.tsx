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
import { useBatchTriage, BatchCategory } from "../../hooks/useBatchTriage";

interface BatchTriageViewProps {
  userEmail: string | undefined;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function BatchTriageView({ userEmail, onRefresh, refreshing = false }: BatchTriageViewProps) {
  const {
    categories,
    total,
    isLoading,
    savedEmails,
    toggleSaveEmail,
    markCategoryDone,
    unsubscribe,
    processingCategory,
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
            {savedEmails.size > 0 && ` • ${savedEmails.size} saved to TODO`}
          </Text>
        </View>

        {/* Pending/analyzing emails (if any) */}
        {categories.pending.length > 0 && (
          <BatchCategoryCard
            category="pending"
            emails={categories.pending}
            savedEmails={savedEmails}
            onSaveEmail={toggleSaveEmail}
            onMarkAllDone={() => handleMarkCategoryDone("pending")}
            onUnsubscribe={handleUnsubscribe}
            unsubscribingIds={unsubscribingIds}
            isProcessing={processingCategory === "pending"}
          />
        )}

        {/* Human waiting category - highest priority */}
        <BatchCategoryCard
          category="humanWaiting"
          emails={categories.humanWaiting}
          savedEmails={savedEmails}
          onSaveEmail={toggleSaveEmail}
          onMarkAllDone={() => handleMarkCategoryDone("humanWaiting")}
          onUnsubscribe={handleUnsubscribe}
          unsubscribingIds={unsubscribingIds}
          isProcessing={processingCategory === "humanWaiting"}
        />

        {/* Action needed category */}
        <BatchCategoryCard
          category="actionNeeded"
          emails={categories.actionNeeded}
          savedEmails={savedEmails}
          onSaveEmail={toggleSaveEmail}
          onMarkAllDone={() => handleMarkCategoryDone("actionNeeded")}
          onUnsubscribe={handleUnsubscribe}
          unsubscribingIds={unsubscribingIds}
          isProcessing={processingCategory === "actionNeeded"}
        />

        {/* Calendar category */}
        <BatchCategoryCard
          category="calendar"
          emails={categories.calendar}
          savedEmails={savedEmails}
          onSaveEmail={toggleSaveEmail}
          onMarkAllDone={() => handleMarkCategoryDone("calendar")}
          onUnsubscribe={handleUnsubscribe}
          unsubscribingIds={unsubscribingIds}
          isProcessing={processingCategory === "calendar"}
        />

        {/* Done category */}
        <BatchCategoryCard
          category="done"
          emails={categories.done}
          savedEmails={savedEmails}
          onSaveEmail={toggleSaveEmail}
          onMarkAllDone={() => handleMarkCategoryDone("done")}
          onUnsubscribe={handleUnsubscribe}
          unsubscribingIds={unsubscribingIds}
          isProcessing={processingCategory === "done"}
        />

        {/* Low confidence category */}
        <BatchCategoryCard
          category="lowConfidence"
          emails={categories.lowConfidence}
          savedEmails={savedEmails}
          onSaveEmail={toggleSaveEmail}
          onMarkAllDone={() => handleMarkCategoryDone("lowConfidence")}
          onUnsubscribe={handleUnsubscribe}
          unsubscribingIds={unsubscribingIds}
          isProcessing={processingCategory === "lowConfidence"}
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
