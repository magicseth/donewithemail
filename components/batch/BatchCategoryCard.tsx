import React, { useState, useCallback, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { BatchEmailRow } from "./BatchEmailRow";
import type { BatchEmailPreview, BatchCategory } from "../../hooks/useBatchTriage";

// Category configuration
interface CategoryConfig {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  backgroundColor: string;
}

const CATEGORY_CONFIG: Record<BatchCategory, CategoryConfig> = {
  done: {
    icon: "✓",
    title: "DONE",
    subtitle: "Newsletters, FYIs, receipts",
    color: "#10B981",
    backgroundColor: "#ECFDF5",
  },
  humanWaiting: {
    icon: "👤",
    title: "HUMAN WAITING",
    subtitle: "Someone is waiting for your reply",
    color: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  actionNeeded: {
    icon: "📋",
    title: "ACTION NEEDED",
    subtitle: "Tasks to complete (not replies)",
    color: "#6366F1",
    backgroundColor: "#EEF2FF",
  },
  calendar: {
    icon: "📅",
    title: "ADD TO CALENDAR",
    subtitle: "Meeting invites AI recommends",
    color: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },
  lowConfidence: {
    icon: "⚠️",
    title: "NEEDS REVIEW",
    subtitle: "AI uncertain - check these",
    color: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  pending: {
    icon: "⏳",
    title: "ANALYZING",
    subtitle: "Waiting for AI processing",
    color: "#6B7280",
    backgroundColor: "#F9FAFB",
  },
};

interface BatchCategoryCardProps {
  category: BatchCategory;
  emails: BatchEmailPreview[];
  savedEmails: Set<string>;
  onSaveEmail: (emailId: string) => void;
  onMarkAllDone: () => void;
  onUnsubscribe?: (emailId: string) => void;
  unsubscribingIds?: Set<string>;
  isProcessing?: boolean;
}

export const BatchCategoryCard = memo(function BatchCategoryCard({
  category,
  emails,
  savedEmails,
  onSaveEmail,
  onMarkAllDone,
  onUnsubscribe,
  unsubscribingIds,
  isProcessing,
}: BatchCategoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = CATEGORY_CONFIG[category];

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Count how many are NOT saved (will be marked done)
  const unsavedCount = emails.filter(e => !savedEmails.has(e._id)).length;
  const savedCount = emails.length - unsavedCount;

  // Don't render if category is empty
  if (emails.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: config.backgroundColor }]}>
      {/* Header - always visible */}
      <TouchableOpacity style={styles.header} onPress={handleToggleExpand} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <Text style={[styles.icon, { color: config.color }]}>{config.icon}</Text>
          <View style={styles.headerText}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: config.color }]}>{config.title}</Text>
              <View style={[styles.countBadge, { backgroundColor: config.color }]}>
                <Text style={styles.countText}>{emails.length}</Text>
              </View>
              {savedCount > 0 && (
                <View style={styles.savedBadge}>
                  <Text style={styles.savedBadgeText}>{savedCount} saved</Text>
                </View>
              )}
            </View>
            <Text style={styles.subtitle}>{config.subtitle}</Text>
          </View>
        </View>

        <Text style={[styles.chevron, { color: config.color }]}>
          {isExpanded ? "▲" : "▼"}
        </Text>
      </TouchableOpacity>

      {/* Email list - expanded */}
      {isExpanded && (
        <View style={styles.emailList}>
          {emails.map(email => (
            <BatchEmailRow
              key={email._id}
              email={email}
              isSaved={savedEmails.has(email._id)}
              isSubscription={email.isSubscription}
              onSave={() => onSaveEmail(email._id)}
              onUnsubscribe={onUnsubscribe ? () => onUnsubscribe(email._id) : undefined}
              isUnsubscribing={unsubscribingIds?.has(email._id)}
            />
          ))}

          {/* Mark all as done button */}
          {unsavedCount > 0 && (
            <TouchableOpacity
              style={[styles.markDoneButton, isProcessing && styles.markDoneButtonDisabled]}
              onPress={onMarkAllDone}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.markDoneButtonText}>
                  Mark {unsavedCount} as Done
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* All saved message */}
          {unsavedCount === 0 && (
            <View style={styles.allSavedMessage}>
              <Text style={styles.allSavedText}>All emails saved to TODO</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  icon: {
    fontSize: 18,
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  countBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  savedBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#6366F1",
    borderRadius: 10,
  },
  savedBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  chevron: {
    fontSize: 12,
    marginLeft: 4,
  },
  emailList: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  markDoneButton: {
    backgroundColor: "#10B981",
    marginHorizontal: 12,
    marginVertical: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  markDoneButtonDisabled: {
    opacity: 0.6,
  },
  markDoneButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  allSavedMessage: {
    paddingVertical: 12,
    alignItems: "center",
  },
  allSavedText: {
    fontSize: 13,
    color: "#6366F1",
    fontWeight: "500",
  },
});
