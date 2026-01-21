import React, { useCallback, memo, useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Image,
  ActivityIndicator,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
} from "react-native";
import Animated, { FadeOut, SlideOutLeft, Layout } from "react-native-reanimated";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import type { BatchEmailPreview } from "../../hooks/useBatchTriage";
import { replaceDatePlaceholders } from "../../lib/datePlaceholders";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

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

// Strip HTML tags and decode entities for plain text display
function stripHtml(html: string): string {
  if (!html) return html;
  return html
    // Remove style and script tags with their content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    // Replace <br> and block elements with newlines
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    // Remove all other HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode HTML entities
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Collapse multiple newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

// Animated dots for "processing" indicator
function PulsingDots() {
  const [dots, setDots] = useState("...");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "." : prev + ".");
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return <Text style={{ color: "#6366F1", fontWeight: "600" }}>{dots}</Text>;
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
  /** Whether deepgram is connected and streaming */
  isRecordingConnected?: boolean;
  /** Live transcript while recording */
  transcript?: string;
  /** Delay in ms before checkmark animates in. Used for cascade effect. */
  switchAnimationDelay?: number;
  /** If true, trigger the animation (used for scroll-into-view) */
  triggerSwitchAnimation?: boolean;
  /** Toggle flag state (keep/needs review) */
  onPunt: () => void;
  /** Mark this email as done immediately */
  onMarkDone?: () => void;
  onAccept?: () => void;
  onQuickReply?: (reply: QuickReplyOption) => void;
  /** Called when mic button is pressed down (start recording) */
  onMicPressIn?: () => void;
  /** Called when mic button is released (stop recording) */
  onMicPressOut?: () => void;
  /** Called when send button is tapped after recording */
  onSendTranscript?: () => void;
  onUnsubscribe?: () => void;
  /** @deprecated Use onPunt and onMarkDone instead */
  onNeedsReplyPress?: () => void;
  isAccepting?: boolean;
  isUnsubscribing?: boolean;
  /** Compact mode - hides avatar/sender, used when grouped by sender */
  compact?: boolean;
}

export const BatchEmailRow = memo(function BatchEmailRow({
  email,
  isPunted,
  isSubscription,
  expandReplyByDefault = false,
  isRecording = false,
  isRecordingConnected = false,
  transcript,
  switchAnimationDelay = 0,
  triggerSwitchAnimation = true,
  onPunt,
  onMarkDone,
  onAccept,
  onQuickReply,
  onMicPressIn,
  onMicPressOut,
  onSendTranscript,
  onUnsubscribe,
  onNeedsReplyPress,
  isAccepting,
  isUnsubscribing,
  compact = false,
}: BatchEmailRowProps) {
  const [showPreview, setShowPreview] = useState(false);

  // Animation state for checkmark appearance
  const [hasAnimated, setHasAnimated] = useState(false);

  // Trigger animation when component becomes visible
  useEffect(() => {
    if (isPunted) {
      setHasAnimated(true); // Skip animation for flagged items
      return;
    }

    if (triggerSwitchAnimation && !hasAnimated) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
      }, switchAnimationDelay);
      return () => clearTimeout(timer);
    }
  }, [triggerSwitchAnimation, switchAnimationDelay, hasAnimated, isPunted]);

  // Track mic press state for native responder system
  const micPressActive = useRef(false);

  // Fetch full body only when preview is shown
  const emailBody = useQuery(
    api.emails.getMyEmailBody,
    showPreview ? { emailId: email._id as Id<"emails"> } : "skip"
  );

  // Prefer fromName (from email header) over contact name (may be stale for shared addresses)
  const fromName = email.fromName || email.fromContact?.name || email.fromContact?.email || "Unknown";
  const initials = getInitials(fromName);
  const timeAgo = formatTimeAgo(email.receivedAt);

  // Replace date placeholders with relative dates
  const displaySummary = useMemo(() => {
    const text = email.summary || decodeHtmlEntities(email.bodyPreview);
    return replaceDatePlaceholders(text);
  }, [email.summary, email.bodyPreview]);

  const hasCalendar = !!email.calendarEvent;

  const handlePress = useCallback(() => {
    router.push(`/email/${email._id}`);
  }, [email._id]);

  const handleLongPress = useCallback(() => {
    setShowPreview(true);
  }, []);

  // We don't dismiss on press out of the row - only when finger lifts from overlay
  const handleOverlayPressOut = useCallback(() => {
    setShowPreview(false);
  }, []);

  return (
    <>
    <Animated.View
      layout={Layout.duration(200)}
      exiting={Platform.OS !== "web" ? SlideOutLeft.duration(200) : undefined}
    >
    <Pressable
      style={({ pressed }) => [
        styles.container,
        isPunted && styles.containerPunted,
        isRecording && styles.containerRecording,
        pressed && !showPreview && styles.containerPressed,
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={400}
    >
      {/* Top row: avatar (unless compact), sender/subject, action buttons */}
      <View style={styles.topRow}>
        {/* Avatar - hidden in compact mode */}
        {!compact && (
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
        )}

        {/* Sender and subject - in compact mode, show subject + time only */}
        <View style={styles.headerContent}>
          {!compact ? (
            <>
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
            </>
          ) : (
            /* Compact: subject + time on one row */
            <View style={styles.headerRow}>
              <Text style={[styles.subject, { flex: 1 }]} numberOfLines={1}>
                {decodeHtmlEntities(email.subject)}
              </Text>
              <Text style={styles.timeAgo}>{timeAgo}</Text>
            </View>
          )}
        </View>

        {/* Action buttons - stop (unsubscribe), checkmark (done), flag (keep/needs review) */}
        <View style={styles.actionButtons}>
          {/* Checkmark - mark as done (gray until clicked) */}
          {onMarkDone && hasAnimated && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onMarkDone}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.checkmarkIconGray}>✓</Text>
            </TouchableOpacity>
          )}

          {/* Flag - toggle keep/needs review */}
          <TouchableOpacity
            style={[styles.iconButton, isPunted && styles.iconButtonActive]}
            onPress={onPunt}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.flagIcon, isPunted && styles.flagIconActive]}>
              {isPunted ? "🚩" : "⚑"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary row */}
      <View style={styles.summaryRow}>
        <Text style={styles.summary} numberOfLines={2}>
          {displaySummary}
        </Text>
      </View>

      {/* Calendar event details with add button */}
      {hasCalendar && email.calendarEvent && (
        <View style={styles.calendarEventContainer}>
          <View style={styles.calendarEventContent}>
            <Text style={styles.calendarEventTitle}>
              📅 {email.calendarEvent.title}
            </Text>
            {email.calendarEvent.startTime && (
              <Text style={styles.calendarEventTime}>
                {new Date(email.calendarEvent.startTime).toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                {email.calendarEvent.endTime && (
                  ` - ${new Date(email.calendarEvent.endTime).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`
                )}
              </Text>
            )}
            {email.calendarEvent.location && (
              <Text style={styles.calendarEventLocation} numberOfLines={1}>
                📍 {email.calendarEvent.location}
              </Text>
            )}
          </View>
          {onAccept && (
            <TouchableOpacity
              style={[styles.calendarAddButton, isAccepting && styles.calendarAddButtonAccepted]}
              onPress={onAccept}
              disabled={isAccepting}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isAccepting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.calendarAddButtonText}>+</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Expanded reply options */}
      {expandReplyByDefault && (
        <View style={styles.replyOptionsContainer}>
          <View style={styles.replyOptionsRow}>
            {/* Show transcript when recording or have pending transcript */}
            {isRecording || transcript ? (
              <View style={styles.transcriptContainer}>
                <Text style={styles.transcriptText} numberOfLines={2}>
                  {isRecording
                    ? (transcript ? <>{transcript}<PulsingDots /></> : <PulsingDots />)
                    : transcript}
                </Text>
              </View>
            ) : (
              /* Quick reply chips - limit to 2 to fit on one line */
              (Array.isArray(email.quickReplies) ? email.quickReplies.slice(0, 2) : []).map((reply, idx) => (
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
            {/* Using native responder system instead of Pressable to avoid re-render issues */}
            {onMicPressIn && (
              <View
                style={[
                  styles.micButton,
                  isRecording && styles.micButtonRecording,
                ]}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={() => {
                  console.log(`[Responder] onResponderGrant for ${email._id}`);
                  micPressActive.current = true;
                  onMicPressIn?.();
                }}
                onResponderRelease={() => {
                  console.log(`[Responder] onResponderRelease for ${email._id}, active=${micPressActive.current}`);
                  if (micPressActive.current) {
                    micPressActive.current = false;
                    onMicPressOut?.();
                  }
                }}
                onResponderTerminate={() => {
                  // Another responder took over (e.g., scroll) - treat as release
                  console.log(`[Responder] onResponderTerminate for ${email._id}, active=${micPressActive.current}`);
                  if (micPressActive.current) {
                    micPressActive.current = false;
                    onMicPressOut?.();
                  }
                }}
                onResponderTerminationRequest={() => {
                  // Don't give up responder while recording
                  console.log(`[Responder] onResponderTerminationRequest - denying`);
                  return false;
                }}
              >
                <Text style={styles.micButtonText}>{isRecording ? "🎙️" : "🎤"}</Text>
              </View>
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
    </Pressable>
    </Animated.View>

    {/* Full email preview modal - shown on long press, dismisses on any touch up */}
    <Modal
      visible={showPreview}
      transparent
      animationType="fade"
      onRequestClose={() => setShowPreview(false)}
    >
      <View
        style={styles.previewOverlay}
        onTouchEnd={handleOverlayPressOut}
      >
        <View style={styles.previewCard} onStartShouldSetResponder={() => true}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewSender}>{fromName}</Text>
            <Text style={styles.previewTime}>{timeAgo}</Text>
          </View>
          <Text style={styles.previewSubject}>{decodeHtmlEntities(email.subject)}</Text>
          {emailBody === undefined ? (
            <View style={styles.previewLoaderContainer}>
              <ActivityIndicator size="small" color="#6366F1" />
            </View>
          ) : Platform.OS === "web" ? (
            <div
              style={{
                width: "100%",
                maxHeight: SCREEN_HEIGHT * 0.6,
                overflow: "auto",
                fontSize: 14,
                lineHeight: 1.5,
                color: "#333",
              }}
              dangerouslySetInnerHTML={{
                __html: (emailBody?.bodyHtml || emailBody?.bodyFull || email.bodyPreview)
                  .replace(/(\r?\n\s*){3,}/g, '\n\n')
                  .replace(/<br\s*\/?>\s*(<br\s*\/?>)+/gi, '<br>')
              }}
            />
          ) : (
            <ScrollView style={styles.previewBody} showsVerticalScrollIndicator>
              <Text style={styles.previewBodyText}>
                {stripHtml(emailBody?.bodyHtml || emailBody?.bodyFull || email.bodyPreview)}
              </Text>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders during recording
  // Only compare non-function props and whether functions are defined
  // This prevents re-renders when parent passes new function references

  // Always re-render if recording state changes
  if (prevProps.isRecording !== nextProps.isRecording) return false;
  if (prevProps.isRecordingConnected !== nextProps.isRecordingConnected) return false;
  if (prevProps.transcript !== nextProps.transcript) return false;

  // Check data props
  if (prevProps.email._id !== nextProps.email._id) return false;
  if (prevProps.email.subject !== nextProps.email.subject) return false;
  if (prevProps.email.fromName !== nextProps.email.fromName) return false;
  if (prevProps.email.summary !== nextProps.email.summary) return false;
  if (prevProps.isPunted !== nextProps.isPunted) return false;
  if (prevProps.isSubscription !== nextProps.isSubscription) return false;
  if (prevProps.expandReplyByDefault !== nextProps.expandReplyByDefault) return false;
  if (prevProps.isAccepting !== nextProps.isAccepting) return false;
  if (prevProps.isUnsubscribing !== nextProps.isUnsubscribing) return false;
  if (prevProps.switchAnimationDelay !== nextProps.switchAnimationDelay) return false;
  if (prevProps.triggerSwitchAnimation !== nextProps.triggerSwitchAnimation) return false;
  if (prevProps.compact !== nextProps.compact) return false;

  // For functions, only check if defined status changed (not reference)
  if (!!prevProps.onMarkDone !== !!nextProps.onMarkDone) return false;
  if (!!prevProps.onAccept !== !!nextProps.onAccept) return false;
  if (!!prevProps.onQuickReply !== !!nextProps.onQuickReply) return false;
  if (!!prevProps.onMicPressIn !== !!nextProps.onMicPressIn) return false;
  if (!!prevProps.onMicPressOut !== !!nextProps.onMicPressOut) return false;
  if (!!prevProps.onSendTranscript !== !!nextProps.onSendTranscript) return false;
  if (!!prevProps.onUnsubscribe !== !!nextProps.onUnsubscribe) return false;
  if (!!prevProps.onNeedsReplyPress !== !!nextProps.onNeedsReplyPress) return false;

  // Props are equal, don't re-render
  return true;
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
  buttonDisabled: {
    opacity: 0.6,
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
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  summary: {
    flex: 1,
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  calendarEventContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 8,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
  },
  calendarEventContent: {
    flex: 1,
  },
  calendarEventTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#B45309",
  },
  calendarEventTime: {
    fontSize: 12,
    color: "#92400E",
    marginTop: 2,
  },
  calendarEventLocation: {
    fontSize: 12,
    color: "#92400E",
    marginTop: 2,
  },
  calendarAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F59E0B",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  calendarAddButtonAccepted: {
    backgroundColor: "#10B981",
  },
  calendarAddButtonText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#fff",
    lineHeight: 28,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  iconButtonActive: {
    backgroundColor: "#FEF3C7",
  },
  flagIcon: {
    fontSize: 16,
    color: "#9CA3AF",
  },
  flagIconActive: {
    color: "#F59E0B",
  },
  checkmarkIconGray: {
    fontSize: 18,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  stopIcon: {
    fontSize: 18,
    fontWeight: "700",
  },
  stopIconGray: {
    color: "#9CA3AF",
  },
  iconButtonDisabled: {
    opacity: 0.5,
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
  containerPressed: {
    opacity: 0.7,
  },
  // Preview modal styles
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  previewCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxHeight: SCREEN_HEIGHT * 0.7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  previewSender: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  previewTime: {
    fontSize: 14,
    color: "#999",
  },
  previewSubject: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  previewLoaderContainer: {
    minHeight: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  previewBody: {
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  previewBodyText: {
    fontSize: 15,
    color: "#444",
    lineHeight: 22,
  },
});
