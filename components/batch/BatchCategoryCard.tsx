import React, { useState, useCallback, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { BatchEmailRow, QuickReplyOption } from "./BatchEmailRow";
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
    icon: "📬",
    title: "FYI",
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
  puntedEmails: Set<string>;
  onPuntEmail: (emailId: string) => void;
  onMarkAllDone: () => void;
  onAcceptCalendar?: (emailId: string) => void;
  onQuickReply?: (emailId: string, reply: QuickReplyOption) => void;
  onMicPressIn?: (emailId: string) => void;
  onMicPressOut?: (emailId: string) => void;
  onSendTranscript?: (emailId: string) => void;
  onUnsubscribe?: (emailId: string) => void;
  onNeedsReplyPress?: (emailId: string) => void;
  acceptingIds?: Set<string>;
  unsubscribingIds?: Set<string>;
  isProcessing?: boolean;
  /** ID of email currently being recorded for */
  recordingForId?: string | null;
  /** Whether deepgram is connected and streaming */
  isRecordingConnected?: boolean;
  /** ID of email that has a pending transcript to send */
  pendingTranscriptForId?: string | null;
  /** Live transcript while recording or pending */
  transcript?: string;
}

export const BatchCategoryCard = memo(function BatchCategoryCard({
  category,
  emails,
  puntedEmails,
  onPuntEmail,
  onMarkAllDone,
  onAcceptCalendar,
  onQuickReply,
  onMicPressIn,
  onMicPressOut,
  onSendTranscript,
  onUnsubscribe,
  onNeedsReplyPress,
  acceptingIds,
  unsubscribingIds,
  isProcessing,
  recordingForId,
  isRecordingConnected,
  pendingTranscriptForId,
  transcript,
}: BatchCategoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Track if this is the first time expanding (for animation trigger)
  const [hasExpandedOnce, setHasExpandedOnce] = useState(false);
  const config = CATEGORY_CONFIG[category];

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => {
      if (!prev && !hasExpandedOnce) {
        setHasExpandedOnce(true);
      }
      return !prev;
    });
  }, [hasExpandedOnce]);

  // Count how many are NOT punted (will be marked done)
  // Include isInTodo emails as "punted" since they're already in TODO
  const unpuntedCount = emails.filter(e => !puntedEmails.has(e._id) && !e.isInTodo).length;
  const puntedCount = emails.length - unpuntedCount;

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
              {puntedCount > 0 && (
                <View style={styles.savedBadge}>
                  <Text style={styles.savedBadgeText}>{puntedCount} saved</Text>
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
          {emails.map((email, index) => (
            <BatchEmailRow
              key={email._id}
              email={email}
              isPunted={puntedEmails.has(email._id) || !!email.isInTodo}
              isSubscription={email.isSubscription}
              expandReplyByDefault={category === "humanWaiting"}
              isRecording={recordingForId === email._id}
              isRecordingConnected={isRecordingConnected}
              transcript={(recordingForId === email._id || pendingTranscriptForId === email._id) ? transcript : undefined}
              switchAnimationDelay={index * 100}
              triggerSwitchAnimation={isExpanded}
              onPunt={() => onPuntEmail(email._id)}
              onAccept={onAcceptCalendar ? () => onAcceptCalendar(email._id) : undefined}
              onQuickReply={onQuickReply ? (reply) => onQuickReply(email._id, reply) : undefined}
              onMicPressIn={onMicPressIn ? () => onMicPressIn(email._id) : undefined}
              onMicPressOut={onMicPressOut ? () => onMicPressOut(email._id) : undefined}
              onSendTranscript={onSendTranscript ? () => onSendTranscript(email._id) : undefined}
              onUnsubscribe={onUnsubscribe ? () => onUnsubscribe(email._id) : undefined}
              onNeedsReplyPress={onNeedsReplyPress ? () => onNeedsReplyPress(email._id) : undefined}
              isAccepting={acceptingIds?.has(email._id)}
              isUnsubscribing={unsubscribingIds?.has(email._id)}
            />
          ))}

          {/* Mark all as done button */}
          {unpuntedCount > 0 && (
            <TouchableOpacity
              style={[styles.markDoneButton, isProcessing && styles.markDoneButtonDisabled]}
              onPress={onMarkAllDone}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.markDoneButtonText}>
                  Done with {unpuntedCount} emails
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* All saved message */}
          {unpuntedCount === 0 && (
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
