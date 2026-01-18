import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

interface AISummaryProps {
  summary: string;
  urgencyScore?: number;
  urgencyReason?: string;
  suggestedReply?: string;
  compact?: boolean;
  onUseReply?: () => void;
}

export function AISummary({
  summary,
  urgencyScore,
  urgencyReason,
  suggestedReply,
  compact = false,
  onUseReply,
}: AISummaryProps) {
  const [expanded, setExpanded] = useState(!compact);

  const urgencyLabel = getUrgencyLabel(urgencyScore);
  const urgencyColor = getUrgencyColor(urgencyScore);

  if (compact && !expanded) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={() => setExpanded(true)}
      >
        <View style={styles.aiIcon}>
          <Text style={styles.aiIconText}>AI</Text>
        </View>
        <Text style={styles.compactSummary} numberOfLines={2}>
          {summary}
        </Text>
        {urgencyScore !== undefined && (
          <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor }]}>
            <Text style={styles.urgencyBadgeText}>{urgencyScore}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.aiIcon}>
          <Text style={styles.aiIconText}>AI</Text>
        </View>
        <Text style={styles.headerText}>AI Summary</Text>
        {compact && (
          <TouchableOpacity onPress={() => setExpanded(false)}>
            <Text style={styles.collapseText}>Collapse</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.summaryText}>{summary}</Text>

      {urgencyScore !== undefined && (
        <View style={styles.urgencyContainer}>
          <View style={styles.urgencyHeader}>
            <Text style={styles.urgencyLabel}>Urgency: </Text>
            <View style={[styles.urgencyPill, { backgroundColor: urgencyColor }]}>
              <Text style={styles.urgencyPillText}>
                {urgencyLabel} ({urgencyScore})
              </Text>
            </View>
          </View>
          {urgencyReason && (
            <Text style={styles.urgencyReason}>{urgencyReason}</Text>
          )}
        </View>
      )}

      {suggestedReply && (
        <View style={styles.replyContainer}>
          <Text style={styles.replyLabel}>Suggested Reply:</Text>
          <View style={styles.replyBox}>
            <Text style={styles.replyText}>{suggestedReply}</Text>
          </View>
          {onUseReply && (
            <TouchableOpacity style={styles.useReplyButton} onPress={onUseReply}>
              <Text style={styles.useReplyButtonText}>Use This Reply</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function getUrgencyLabel(score?: number): string {
  if (score === undefined) return "";
  if (score >= 80) return "Urgent";
  if (score >= 50) return "Important";
  if (score >= 20) return "Normal";
  return "Low";
}

function getUrgencyColor(score?: number): string {
  if (score === undefined) return "#888";
  if (score >= 80) return "#FF4444";
  if (score >= 50) return "#FFAA00";
  if (score >= 20) return "#44AA44";
  return "#888888";
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F8F9FF",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#E0E4FF",
  },
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FF",
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#E0E4FF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  aiIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  aiIconText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  headerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#6366F1",
  },
  collapseText: {
    fontSize: 14,
    color: "#666",
  },
  compactSummary: {
    flex: 1,
    fontSize: 14,
    color: "#444",
    marginRight: 8,
  },
  summaryText: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
  },
  urgencyContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E4FF",
  },
  urgencyHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  urgencyLabel: {
    fontSize: 14,
    color: "#666",
  },
  urgencyPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyPillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  urgencyReason: {
    fontSize: 14,
    color: "#666",
    marginTop: 6,
    fontStyle: "italic",
  },
  urgencyBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  urgencyBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  replyContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E4FF",
  },
  replyLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  replyBox: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  replyText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  useReplyButton: {
    marginTop: 10,
    backgroundColor: "#6366F1",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  useReplyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
