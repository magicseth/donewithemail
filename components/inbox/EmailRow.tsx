/**
 * EmailRow component - memoized email row for FlatList performance.
 */
import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { router } from "expo-router";
import type { QuickReply, CalendarEvent } from "../../hooks/useGmail";
import { TriageRowWrapper } from "../triage";
import type { InboxEmail } from "./types";
import { TRIAGE_CONFIG } from "./types";
import {
  getInitials,
  decodeHtmlEntities,
  formatTimeAgo,
  formatEventTime,
} from "./utils";

// Transcript preview component
const TranscriptPreview = React.memo(function TranscriptPreview({ transcript }: { transcript: string }) {
  console.log("[TranscriptPreview] rendering with:", transcript);
  return (
    <View style={styles.transcriptContainer}>
      <Text style={styles.transcriptText}>
        {transcript || "Listening..."}
      </Text>
    </View>
  );
});

interface EmailRowProps {
  item: InboxEmail;
  index: number;
  onQuickReply: (email: InboxEmail, reply: QuickReply) => void;
  onAddToCalendar: (email: InboxEmail, event: CalendarEvent) => void;
  sendingReplyFor: string | null;
  recordingFor: string | null;
  addingCalendarFor: string | null;
  isRecording: boolean;
  transcript: string;
  isTriaged: boolean;
  triageAction?: "done" | "reply_needed";
}

export const EmailRow = React.memo(function EmailRow({
  item,
  index,
  onQuickReply,
  onAddToCalendar,
  sendingReplyFor,
  recordingFor,
  addingCalendarFor,
  isRecording,
  transcript,
  isTriaged,
  triageAction,
}: EmailRowProps) {
  // Prefer fromName (from email header) over contact name (may be stale for shared addresses)
  const fromName = item.fromName || item.fromContact?.name || item.fromContact?.email || "Unknown";
  const initials = getInitials(fromName);
  const timeAgo = formatTimeAgo(item.receivedAt);
  const isSending = sendingReplyFor === item._id;
  const isRecordingThis = recordingFor === item._id;

  // Debug logging for recording state
  if (isRecordingThis) {
    console.log(`[EmailRow] ${item._id} isRecordingThis=true, transcript="${transcript}"`);
  }

  const handlePress = useCallback(() => {
    router.push(`/email/${item._id}`);
  }, [item._id]);

  // Determine if this is a compact row (no quick replies and no calendar)
  const hasQuickReplies = item.quickReplies && item.quickReplies.length > 0;
  const hasCalendar = !!item.calendarEvent;
  const isCompact = !hasQuickReplies && !hasCalendar;

  return (
    <TriageRowWrapper index={index}>
      <TouchableOpacity
          style={[
            styles.emailItem,
            isCompact && styles.emailItemCompact,
            !item.isRead && styles.emailItemUnread,
            isTriaged && styles.emailItemTriaged,
            isRecordingThis && styles.emailItemRecording,
            isRecordingThis && { height: 220 }, // Expand height when recording to fit transcript
          ]}
          onPress={handlePress}
          activeOpacity={0.7}
          disabled={isTriaged}
        >

        {/* Triaged badge */}
        {isTriaged && (
          <View style={[
            styles.triagedBadge,
            triageAction === "done" ? styles.triagedBadgeDone : styles.triagedBadgeReply,
          ]}>
            <Text style={styles.triagedBadgeText}>
              {triageAction === "done" ? "\u2713" : "\u21a9"}
            </Text>
          </View>
        )}

        {/* Top row: Avatar + Header */}
        <View style={[styles.emailTopRow, isTriaged && styles.triagedContent]}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {item.fromContact?.avatarUrl ? (
              <Image
                source={{ uri: item.fromContact.avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
          </View>

          <View style={styles.emailContent}>
            {/* Header row */}
            <View style={styles.emailHeader}>
              <View style={styles.senderRow}>
                <Text style={[styles.senderName, !item.isRead && styles.textBold]} numberOfLines={1}>
                  {fromName}
                </Text>
                {item.threadCount && item.threadCount > 1 && (
                  <View style={styles.threadBadge}>
                    <Text style={styles.threadBadgeText}>{item.threadCount}</Text>
                  </View>
                )}
                <Text style={styles.timeAgo}>{timeAgo}</Text>
              </View>

              <Text style={[styles.subject, !item.isRead && styles.textBold]} numberOfLines={1}>
                {decodeHtmlEntities(item.subject)}
              </Text>
            </View>
          </View>
        </View>

        {/* Full-width summary */}
        <Text style={[styles.preview, styles.previewFullWidth, isTriaged && styles.triagedContent]} numberOfLines={2}>
          {item.summary || decodeHtmlEntities(item.bodyPreview)}
        </Text>

        {/* Calendar event - full width, two rows */}
        {item.calendarEvent && (
          <View style={[styles.calendarRow, isTriaged && styles.triagedContent]}>
            <View style={styles.calendarContent}>
              <View style={styles.calendarTitleRow}>
                <Text style={styles.calendarIcon}>{item.calendarEvent.recurrenceDescription ? "\uD83D\uDD04" : "\uD83D\uDCC5"}</Text>
                <Text style={styles.calendarTitle} numberOfLines={1}>
                  {decodeHtmlEntities(item.calendarEvent.title)}
                </Text>
                {item.calendarEvent.calendarEventId ? (
                  <View style={styles.addedBadge}>
                    <Text style={styles.addedBadgeText}>{"\u2713"}</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.addCalendarButton,
                      addingCalendarFor === item._id && styles.addCalendarButtonDisabled,
                    ]}
                    onPress={() => onAddToCalendar(item, item.calendarEvent!)}
                    disabled={addingCalendarFor === item._id}
                  >
                    {addingCalendarFor === item._id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.addCalendarButtonText}>Add</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.calendarDetails} numberOfLines={1}>
                {item.calendarEvent.startTime ? formatEventTime(item.calendarEvent.startTime, item.calendarEvent.endTime) : "Time TBD"}
                {item.calendarEvent.location ? " \u00b7 " + decodeHtmlEntities(item.calendarEvent.location) : ""}
                {item.calendarEvent.recurrenceDescription ? " \u00b7 " + item.calendarEvent.recurrenceDescription : ""}
              </Text>
            </View>
          </View>
        )}

          {/* Quick reply chips - only render if there are quick replies */}
        {item.quickReplies && item.quickReplies.length > 0 && (
          <View style={styles.quickReplyRow}>
            {item.quickReplies.slice(0, 3).map((reply, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.quickReplyChip,
                  idx === 0 && styles.quickReplyChipPrimary,
                  isSending && styles.quickReplyChipDisabled,
                ]}
                onPress={() => onQuickReply(item, reply)}
                disabled={isSending || isRecording}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color={idx === 0 ? "#fff" : "#6366F1"} />
                ) : (
                  <Text
                    style={[
                      styles.quickReplyText,
                      idx === 0 && styles.quickReplyTextPrimary,
                    ]}
                    numberOfLines={1}
                  >
                    {reply.label}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Show recording status */}
        {isRecordingThis && <TranscriptPreview transcript={transcript} />}

        {/* Urgency indicator */}
        {item.urgencyScore !== undefined && item.urgencyScore >= 50 && (
          <View
            style={[
              styles.urgencyIndicator,
              { backgroundColor: item.urgencyScore >= 80 ? "#FF4444" : "#FFAA00" },
            ]}
          />
        )}
      </TouchableOpacity>
    </TriageRowWrapper>
  );
});

const styles = StyleSheet.create({
  emailItem: {
    flexDirection: "column",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    minHeight: TRIAGE_CONFIG.rowHeight,
  },
  emailItemCompact: {
    minHeight: 90,
  },
  emailTopRow: {
    flexDirection: "row",
  },
  emailItemUnread: {
    // Unread indicated by bold text, not background
  },
  emailItemTriaged: {
    opacity: 0.5,
  },
  emailItemRecording: {
    minHeight: TRIAGE_CONFIG.rowHeight,
    backgroundColor: "#FEF3C7",
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
  },
  triagedContent: {
    opacity: 0.6,
  },
  triagedBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  triagedBadgeDone: {
    backgroundColor: "#10B981",
  },
  triagedBadgeReply: {
    backgroundColor: "#6366F1",
  },
  triagedBadgeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emailContent: {
    flex: 1,
  },
  emailHeader: {
    marginBottom: 6,
  },
  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  senderName: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
  timeAgo: {
    fontSize: 13,
    color: "#999",
    marginLeft: 8,
  },
  threadBadge: {
    backgroundColor: "#E8EAFF",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  threadBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6366F1",
  },
  subject: {
    fontSize: 15,
    color: "#1a1a1a",
  },
  textBold: {
    fontWeight: "600",
  },
  preview: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginTop: 4,
  },
  previewFullWidth: {
    marginTop: 6,
  },
  quickReplyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  quickReplyChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  quickReplyChipPrimary: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  quickReplyChipDisabled: {
    opacity: 0.5,
  },
  quickReplyText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#333",
  },
  quickReplyTextPrimary: {
    color: "#fff",
  },
  urgencyIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  calendarRow: {
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  calendarContent: {
    flex: 1,
  },
  calendarTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  calendarIcon: {
    fontSize: 14,
  },
  calendarTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#78350F",
  },
  calendarDetails: {
    fontSize: 13,
    color: "#92400E",
    marginTop: 4,
    marginLeft: 20,
  },
  addCalendarButton: {
    backgroundColor: "#F59E0B",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  addCalendarButtonDisabled: {
    opacity: 0.6,
  },
  addCalendarButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  addedBadge: {
    backgroundColor: "#10B981",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  addedBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  transcriptContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
  },
  transcriptText: {
    fontSize: 13,
    color: "#92400E",
    fontStyle: "italic",
  },
});
