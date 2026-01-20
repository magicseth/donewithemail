import React, { useCallback, memo, useState, useRef, useEffect } from "react";
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
  Switch,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import type { BatchEmailPreview } from "../../hooks/useBatchTriage";

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
  /** Delay in ms before switch animates to "Done" state. Used for cascade effect. */
  switchAnimationDelay?: number;
  /** If true, trigger the switch animation (used for scroll-into-view) */
  triggerSwitchAnimation?: boolean;
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
  /** Called when "Needs Reply" button is tapped - toggles TODO state */
  onNeedsReplyPress?: () => void;
  isAccepting?: boolean;
  isUnsubscribing?: boolean;
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
  onAccept,
  onQuickReply,
  onMicPressIn,
  onMicPressOut,
  onSendTranscript,
  onUnsubscribe,
  onNeedsReplyPress,
  isAccepting,
  isUnsubscribing,
}: BatchEmailRowProps) {
  const [showReplyOptions, setShowReplyOptions] = useState(expandReplyByDefault);
  const [showPreview, setShowPreview] = useState(false);

  // Animation state: starts as "TODO" (false), animates to "Done" (true) after delay
  // This creates the visual effect of switches flipping to "Done"
  const [hasAnimatedToDone, setHasAnimatedToDone] = useState(false);
  const hasUserInteracted = useRef(false);

  // Trigger animation when component becomes visible (via triggerSwitchAnimation prop)
  useEffect(() => {
    // Don't animate if user has manually interacted or if already punted
    if (hasUserInteracted.current || isPunted) {
      setHasAnimatedToDone(true); // Skip animation, go directly to actual state
      return;
    }

    if (triggerSwitchAnimation && !hasAnimatedToDone) {
      const timer = setTimeout(() => {
        setHasAnimatedToDone(true);
      }, switchAnimationDelay);
      return () => clearTimeout(timer);
    }
  }, [triggerSwitchAnimation, switchAnimationDelay, hasAnimatedToDone, isPunted]);

  // The visual switch value: false during animation, then follows actual state
  const switchValue = hasAnimatedToDone ? !isPunted : false;
  const switchLabel = hasAnimatedToDone
    ? (isPunted ? "Reply" : "Done")
    : "Todo";

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

  const hasCalendar = !!email.calendarEvent;
  const hasQuickReplies = email.quickReplies && email.quickReplies.length > 0;

  const handlePress = useCallback(() => {
    router.push(`/email/${email._id}`);
  }, [email._id]);

  const handleReplyToggle = useCallback(() => {
    setShowReplyOptions(prev => !prev);
  }, []);

  const handleLongPress = useCallback(() => {
    setShowPreview(true);
  }, []);

  // We don't dismiss on press out of the row - only when finger lifts from overlay
  const handleOverlayPressOut = useCallback(() => {
    setShowPreview(false);
  }, []);

  return (
    <>
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
      {/* Top row: avatar, sender/subject, action buttons */}
      <View style={styles.topRow}>
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
          {/* Done switch - animates from TODO to Done on load, OFF = needs reply/TODO */}
          {onNeedsReplyPress && (
            <View style={styles.doneSwitchContainer}>
              <Switch
                value={switchValue}
                onValueChange={(isDone) => {
                  hasUserInteracted.current = true;
                  setHasAnimatedToDone(true); // Ensure we're past animation state
                  if (isDone) {
                    // Switched to ON (Done) - remove from TODO and hide replies
                    onNeedsReplyPress();
                    setShowReplyOptions(false);
                  } else {
                    // Switched to OFF (Needs Reply) - add to TODO and show replies
                    onNeedsReplyPress();
                    setShowReplyOptions(true);
                  }
                }}
                trackColor={{ false: "#6366F1", true: "#10B981" }}
                thumbColor="#fff"
                ios_backgroundColor="#6366F1"
              />
              <Text style={[
                styles.doneSwitchLabel,
                !hasAnimatedToDone && styles.doneSwitchLabelTodo,
                hasAnimatedToDone && isPunted && styles.doneSwitchLabelActive
              ]}>
                {switchLabel}
              </Text>
            </View>
          )}

          {/* Reply expansion toggle - only if quick replies or mic available AND not expanded by default */}
          {(hasQuickReplies || onMicPressIn) && !expandReplyByDefault && !onNeedsReplyPress && (
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

        </View>
      </View>

      {/* Summary row with optional unsubscribe button */}
      <View style={styles.summaryRow}>
        <Text style={[styles.summary, isSubscription && onUnsubscribe && styles.summaryWithUnsub]} numberOfLines={2}>
          {email.summary || decodeHtmlEntities(email.bodyPreview)}
        </Text>
        {/* Unsubscribe button (for subscriptions only) - positioned right of summary */}
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
              <Text style={styles.unsubButtonText}>Unsubscribe</Text>
            )}
          </TouchableOpacity>
        )}
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
      {showReplyOptions && (
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

  // For functions, only check if defined status changed (not reference)
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
  summaryWithUnsub: {
    marginRight: 8,
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
  unsubButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#EF4444",
    alignSelf: "flex-start",
  },
  unsubButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EF4444",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  doneSwitchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  doneSwitchLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  doneSwitchLabelTodo: {
    color: "#6366F1",
  },
  doneSwitchLabelActive: {
    color: "#6366F1",
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
