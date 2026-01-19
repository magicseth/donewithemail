import React, { useCallback, memo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import type { BatchEmailPreview } from "../../hooks/useBatchTriage";

// Get initials from name for avatar placeholder
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString();
}

export interface QuickReplyOption {
  label: string;
  body: string;
}

interface BatchEmailRowProps {
  email: BatchEmailPreview;
  isPunted: boolean;
  isSubscription?: boolean;
  /** If true, show quick reply options expanded by default (no Reply button) */
  expandReplyByDefault?: boolean;
  /** If true, this email is currently being recorded for */
  isRecording?: boolean;
  /** Live transcript while recording */
  transcript?: string;
  onPunt: () => void;
  onAccept?: () => void;
  onQuickReply?: (reply: QuickReplyOption) => void;
  /** Called when mic button is pressed down (start recording) */
  onMicPressIn?: () => void;
  /** Called when mic button is released (stop recording) */
  onMicPressOut?: () => void;
  /** Called when send button is tapped after recording */
  onSendTranscript?: () => void;
  onUnsubscribe?: () => void;
  isAccepting?: boolean;
  isUnsubscribing?: boolean;
}

export const BatchEmailRow = memo(function BatchEmailRow({
  email,
  isPunted,
  isSubscription,
  expandReplyByDefault = false,
  isRecording = false,
  transcript,
  onPunt,
  onAccept,
  onQuickReply,
  onMicPressIn,
  onMicPressOut,
  onSendTranscript,
  onUnsubscribe,
  isAccepting,
  isUnsubscribing,
}: BatchEmailRowProps) {
  const [showReplyOptions, setShowReplyOptions] = useState(expandReplyByDefault);

  // Prefer fromName (from email header) over contact name (may be stale for shared addresses)
  const fromName = email.fromName || email.fromContact?.name || email.fromContact?.email || "Unknown";
  const initials = getInitials(fromName);
  const timeAgo = formatTimeAgo(email.receivedAt);

  const hasCalendar = !!email.calendarEvent;
  const hasQuickReplies = email.quickReplies && email.quickReplies.length > 0;

  const handlePress = useCallback(() => {
    router.push(`/email/${email._id}`);
  }, [email._id]);

  const handleReplyToggle = useCallback(() => {
    setShowReplyOptions(prev => !prev);
  }, []);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isPunted && styles.containerPunted,
        isRecording && styles.containerRecording,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Top row: avatar, sender/subject, action buttons */}
      <View style={styles.topRow}>
        {/* Unsubscribe button (for subscriptions only) */}
        {isSubscription && onUnsubscribe && (
          <TouchableOpacity
            style={[styles.unsubButton, isUnsubscribing && styles.buttonDisabled]}
            onPress={(e) => { e.stopPropagation(); onUnsubscribe(); }}
            disabled={isUnsubscribing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isUnsubscribing ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Text style={styles.unsubButtonText}>Unsub</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {email.fromContact?.avatarUrl ? (
            <Image
              source={{ uri: email.fromContact.avatarUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
        </View>

        {/* Sender and subject */}
        <View style={styles.headerContent}>
          {/* Header row: sender + time */}
          <View style={styles.headerRow}>
            <Text style={styles.senderName} numberOfLines={1}>
              {fromName}
            </Text>
            <Text style={styles.timeAgo}>{timeAgo}</Text>
          </View>

          {/* Subject */}
          <Text style={styles.subject} numberOfLines={1}>
            {decodeHtmlEntities(email.subject)}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionButtons}>
          {/* Reply button - only if quick replies or mic available AND not expanded by default */}
          {(hasQuickReplies || onMicPressIn) && !expandReplyByDefault && (
            <TouchableOpacity
              style={[styles.actionButton, styles.replyButton, showReplyOptions && styles.replyButtonActive]}
              onPress={handleReplyToggle}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={[styles.actionButtonText, styles.replyButtonText, showReplyOptions && styles.replyButtonTextActive]}>
                Reply
              </Text>
            </TouchableOpacity>
          )}

          {/* Accept button - only for calendar items */}
          {hasCalendar && onAccept && (
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton, isAccepting && styles.buttonDisabled]}
              onPress={onAccept}
              disabled={isAccepting}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              {isAccepting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.actionButtonText, styles.acceptButtonText]}>Accept</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Save button - always visible, far right */}
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton, isPunted && styles.saveButtonActive]}
            onPress={onPunt}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={[styles.actionButtonText, styles.saveButtonText, isPunted && styles.saveButtonTextActive]}>
              {isPunted ? "Saved" : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary row - spans full width below avatar */}
      <View style={styles.summaryRow}>
        <Text style={styles.summary} numberOfLines={2}>
          {email.summary || decodeHtmlEntities(email.bodyPreview)}
        </Text>
      </View>

      {/* Expanded reply options */}
      {showReplyOptions && (
        <View style={styles.replyOptionsContainer}>
          <View style={styles.replyOptionsRow}>
            {/* Show transcript when recording or have pending transcript */}
            {isRecording || transcript ? (
              <View style={styles.transcriptContainer}>
                <Text style={styles.transcriptText} numberOfLines={2}>
                  {isRecording ? (transcript || "Listening...") : transcript}
                </Text>
              </View>
            ) : (
              /* Quick reply chips - limit to 2 to fit on one line */
              email.quickReplies?.slice(0, 2).map((reply, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.quickReplyChip}
                  onPress={() => onQuickReply?.(reply)}
                >
                  <Text style={styles.quickReplyText} numberOfLines={1}>
                    {reply.label}
                  </Text>
                </TouchableOpacity>
              ))
            )}

            {/* Mic button - always rightmost, press and hold to talk */}
            {onMicPressIn && (
              <Pressable
                style={({ pressed }) => [
                  styles.micButton,
                  isRecording && styles.micButtonRecording,
                  pressed && !isRecording && styles.micButtonPressed,
                ]}
                onPressIn={onMicPressIn}
                onPressOut={onMicPressOut}
                // Large offset so press stays active even when finger moves away
                pressRetentionOffset={{ top: 500, bottom: 500, left: 500, right: 500 }}
              >
                <Text style={styles.micButtonText}>{isRecording ? "🎙️" : "🎤"}</Text>
              </Pressable>
            )}
          </View>

          {/* Send button - shown when we have transcript and not recording */}
          {!isRecording && transcript && onSendTranscript && (
            <TouchableOpacity
              style={styles.sendButton}
              onPress={onSendTranscript}
            >
              <Text style={styles.sendButtonText}>Send Reply</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingVertical: 10,
  },
  containerPunted: {
    backgroundColor: "#EEF2FF",
  },
  containerRecording: {
    backgroundColor: "#FEF3C7",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  unsubButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FEE2E2",
    borderRadius: 4,
    marginRight: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  unsubButtonText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#EF4444",
  },
  avatarContainer: {
    marginRight: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  headerContent: {
    flex: 1,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  senderName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  timeAgo: {
    fontSize: 12,
    color: "#999",
    marginLeft: 8,
  },
  subject: {
    fontSize: 14,
    color: "#1a1a1a",
  },
  summaryRow: {
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  summary: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  replyButton: {
    backgroundColor: "#fff",
    borderColor: "#6366F1",
  },
  replyButtonActive: {
    backgroundColor: "#6366F1",
  },
  replyButtonText: {
    color: "#6366F1",
  },
  replyButtonTextActive: {
    color: "#fff",
  },
  acceptButton: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
  },
  acceptButtonText: {
    color: "#fff",
  },
  saveButton: {
    backgroundColor: "#f5f5f5",
    borderColor: "#ddd",
  },
  saveButtonActive: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  saveButtonText: {
    color: "#666",
  },
  saveButtonTextActive: {
    color: "#fff",
  },
  replyOptionsContainer: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 4,
  },
  replyOptionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickReplyChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "transparent",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#6366F1",
    flexShrink: 1,
    maxWidth: 120,
  },
  quickReplyText: {
    fontSize: 12,
    color: "#6366F1",
    fontWeight: "500",
  },
  transcriptContainer: {
    flex: 1,
    marginRight: 8,
  },
  transcriptText: {
    fontSize: 14,
    color: "#333",
    fontStyle: "italic",
    lineHeight: 20,
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: "auto",
  },
  micButtonRecording: {
    backgroundColor: "#DC2626",
  },
  micButtonPressed: {
    backgroundColor: "#B91C1C",
  },
  micButtonText: {
    fontSize: 16,
  },
  sendButton: {
    marginTop: 10,
    backgroundColor: "#6366F1",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
