import React, { useCallback, useState, useRef, useEffect, Component, ErrorInfo, ReactNode } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  UIManager,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import { useAction, useQuery, useMutation } from "convex/react";
import { isAuthError, useAuthError } from "../../lib/AuthErrorBoundary";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import {
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  useAnimatedProps,
} from "react-native-reanimated";
import { Dimensions } from "react-native";
import { AskEmailModal } from "../../components/AskEmailModal";
import { useEmailAgent } from "../../hooks/useEmailAgent";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const CENTER_X = SCREEN_WIDTH / 2;

// Error Boundary to catch and display crashes
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Error info:", errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorBoundaryStyles.container}>
          <Text style={errorBoundaryStyles.title}>Something went wrong</Text>
          <Text style={errorBoundaryStyles.errorName}>{this.state.error?.name}</Text>
          <Text style={errorBoundaryStyles.errorMessage}>{this.state.error?.message}</Text>
          <Text style={errorBoundaryStyles.stackTitle}>Stack trace:</Text>
          <ScrollView style={errorBoundaryStyles.stackScroll}>
            <Text style={errorBoundaryStyles.stack}>{this.state.error?.stack}</Text>
          </ScrollView>
          <TouchableOpacity
            style={errorBoundaryStyles.retryButton}
            onPress={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          >
            <Text style={errorBoundaryStyles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorBoundaryStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#DC2626",
    marginBottom: 16,
  },
  errorName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#991B1B",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#7F1D1D",
    marginBottom: 16,
  },
  stackTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#991B1B",
    marginBottom: 8,
  },
  stackScroll: {
    maxHeight: 300,
    backgroundColor: "#FECACA",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  stack: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#7F1D1D",
  },
  retryButton: {
    backgroundColor: "#DC2626",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: "center",
  },
  retryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

// ============================================================================
// TRIAGE SYSTEM DOCUMENTATION
// ============================================================================
//
// OVERVIEW
// --------
// The triage system allows users to quickly process emails by dragging a ball
// toward target buttons. Each email row has its own ball at the top. Only the
// "active" row's ball moves with the user's finger; other rows show static gray balls.
//
// VISUAL LAYOUT
// -------------
//
//   ┌─────────────────────────────────────────────────────────────────┐
//   │  [Unsub]      [Done]       [Reply]      [Mic]    ← Fixed targets│
//   │   -100          0           +80         +160     ← X positions  │
//   ├─────────────────────────────────────────────────────────────────┤
//   │  ●──────────────────────────────────────────────  ← Active row  │
//   │  (ball moves left/right with finger drag)          ball moves   │
//   │                                                                 │
//   │  From: Alice                                                    │
//   │  Subject: Meeting tomorrow                                      │
//   │  Preview text...                                                │
//   ├─────────────────────────────────────────────────────────────────┤
//   │  ○                                               ← Next row     │
//   │  (static gray ball, centered)                      ball static  │
//   │                                                                 │
//   │  From: Bob                                                      │
//   │  ...                                                            │
//   └─────────────────────────────────────────────────────────────────┘
//
// COMPONENTS
// ----------
// 1. TriageOverlay - Renders fixed target buttons at top of screen (Done, Reply, etc.)
// 2. RowBall - Rendered inside each email row, shows ball state for that row
// 3. AnimatedRowWrapper - Wraps each row, handles background highlighting
// 4. TriageContext - React context providing shared triage state to all components
//
// STATE (TriageState)
// -------------------
// Primary state (set by gesture handlers):
//   - scrollY: Current scroll position of the list
//   - fingerX: Current X position of user's finger
//   - startX: X position where current drag started
//   - activeIndex: Which row (0-indexed) is currently being triaged
//   - isProcessing: Lock to prevent multiple simultaneous triggers
//   - lastTriggeredTarget: Which target was last triggered (prevents re-trigger)
//
// Derived/computed state:
//   - topRowIndex: Same as activeIndex (which row is "active")
//   - ballX: Computed ball X position = CENTER_X + (fingerX - startX) * multiplier
//   - ballY: Computed ball Y position based on activeIndex and scroll
//   - proximities: Map of target ID -> proximity value (0-1) for visual feedback
//   - activeTarget: Which target the ball is currently touching (or null)
//   - closestTarget: Nearest target with proximity > 0 (for ball color)
//
// TRIGGER FLOW
// ------------
// 1. User drags finger horizontally
// 2. fingerX updates, causing ballX to update (for active row only)
// 3. activeTarget computed based on ball position vs target positions
// 4. When activeTarget !== null AND activeTarget !== lastTriggeredTarget:
//    a. Set isProcessing = true (prevent cascade)
//    b. Set lastTriggeredTarget = activeTarget (prevent re-trigger)
//    c. Call handleTargetActivation(rowIndex, targetId)
// 5. Handler processes the action (done, reply, mic, unsubscribe)
// 6. Handler resets ball to center (startX = fingerX)
// 7. Handler sets lastTriggeredTarget = "done" (ball lands at center = done target)
// 8. Handler sets isProcessing = false
// 9. User must move ball away from "done" target before triggering again
//
// TARGET ACTIONS
// --------------
// - "done": Mark email as triaged (done), move to next row
// - "reply": Mark email as reply_needed, move to next row
// - "mic": Start voice recording for this email (ball stays at mic)
// - "unsubscribe": Attempt to unsubscribe, mark as done, move to next row
//
// PREVENTING CASCADE TRIGGERS
// ---------------------------
// Problem: After triggering "reply", ball resets to center where "done" is.
// Without protection, "done" would immediately trigger.
//
// Solution: lastTriggeredTarget tracks what was just triggered.
// - After any action, we set lastTriggeredTarget = "done" (ball's new position)
// - Trigger only fires when activeTarget !== lastTriggeredTarget
// - lastTriggeredTarget clears when a NEW drag starts (touch down)
// - This allows each drag gesture to have fresh detection
//
// ADDING A NEW TARGET
// -------------------
// 1. Add entry to TARGETS array with: id, position, radii, colors, icon, label
// 2. Add handler case in handleTargetActivation() if needed
// 3. That's it! The system automatically handles rendering and detection.
//
// ============================================================================

// Triage UI configuration - all positioning driven from these values
const TRIAGE_CONFIG = {
  // Estimated height of each email row
  rowHeight: 140,
  // Height of header elements above the list (swipe hint ~34 + search ~52)
  headerOffset: 86,
  // Padding at top of list (gives runway before first email)
  get listTopPadding() { return this.rowHeight; },
  // Ball size
  ballSize: 32,
  // How much the ball moves relative to finger movement
  ballTravelMultiplier: 1.5,
};

// Module-level email storage - NOT captured by worklet serialization
// This is updated by the component and read by handlers called via runOnJS
let moduleEmails: InboxEmail[] = [];

import { api } from "../../convex/_generated/api";
import { useGmail, GmailEmail, QuickReply, CalendarEvent } from "../../hooks/useGmail";
import { useVoiceRecording } from "../../hooks/useDailyVoice";
import { Id } from "../../convex/_generated/dataModel";
import { BatchTriageView } from "../../components/batch";

// New triage module
import {
  TriageProvider,
  useTriageContext,
  TriageOverlay as NewTriageOverlay,
  TriageRowWrapper,
  TRIAGE_TARGETS as NEW_TARGETS,
  type TriageTargetId,
  type TriageableEmail,
  type TriageControlRef,
} from "../../components/triage";

// Sound feedback for mic actions
const useMicSounds = () => {
  const webStartAudioRef = useRef<HTMLAudioElement | null>(null);
  const webStopAudioRef = useRef<HTMLAudioElement | null>(null);

  // Use expo-audio players for native
  const startPlayer = useAudioPlayer(
    Platform.OS !== "web" ? require("../../assets/sounds/micopen.wav") : null
  );
  const stopPlayer = useAudioPlayer(
    Platform.OS !== "web" ? require("../../assets/sounds/micclose.wav") : null
  );

  useEffect(() => {
    // Preload web audio only
    if (Platform.OS === "web") {
      webStartAudioRef.current = new window.Audio(require("../../assets/sounds/micopen.wav"));
      webStartAudioRef.current.load();
      webStopAudioRef.current = new window.Audio(require("../../assets/sounds/micclose.wav"));
      webStopAudioRef.current.load();
    }
  }, []);

  const playStartSound = useCallback(async () => {
    if (Platform.OS === "web") {
      try {
        if (webStartAudioRef.current) {
          webStartAudioRef.current.currentTime = 0;
          webStartAudioRef.current.play();
        }
      } catch (e) {
        console.log("Web audio error:", e);
      }
      return;
    }

    try {
      // Play sound + haptic feedback
      startPlayer.seekTo(0);
      startPlayer.play();
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      console.log("Sound/haptic error:", e);
    }
  }, [startPlayer]);

  const playStopSound = useCallback(async () => {
    if (Platform.OS === "web") {
      try {
        if (webStopAudioRef.current) {
          webStopAudioRef.current.currentTime = 0;
          webStopAudioRef.current.play();
        }
      } catch (e) {
        console.log("Web audio error:", e);
      }
      return;
    }

    try {
      // Play sound + haptic feedback
      stopPlayer.seekTo(0);
      stopPlayer.play();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.log("Sound/haptic error:", e);
    }
  }, [stopPlayer]);

  return { playStartSound, playStopSound };
};

// Cross-platform alert that works on web too
function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface InboxEmail {
  _id: string;
  subject: string;
  bodyPreview: string;
  receivedAt: number;
  isRead: boolean;
  urgencyScore?: number;
  summary?: string;
  quickReplies?: QuickReply[];
  calendarEvent?: CalendarEvent;
  shouldAcceptCalendar?: boolean;
  threadCount?: number;
  isSubscription?: boolean;
  fromName?: string; // Sender name as it appeared in this email
  fromContact?: {
    _id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
  } | null;
}

function toInboxEmail(email: GmailEmail): InboxEmail {
  return {
    _id: email._id,
    subject: email.subject,
    bodyPreview: email.bodyPreview,
    receivedAt: email.receivedAt,
    isRead: email.isRead,
    urgencyScore: email.urgencyScore,
    summary: email.summary,
    quickReplies: email.quickReplies,
    calendarEvent: email.calendarEvent,
    shouldAcceptCalendar: email.shouldAcceptCalendar,
    threadCount: email.threadCount,
    isSubscription: email.isSubscription,
    fromName: email.fromName, // Sender name from this specific email
    fromContact: email.fromContact ? {
      _id: email.fromContact._id,
      email: email.fromContact.email,
      name: email.fromContact.name,
      avatarUrl: email.fromContact.avatarUrl,
    } : null,
  };
}

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

// Format event time for display
function formatEventTime(startTime?: string, endTime?: string): string {
  if (!startTime) return "";

  // If it's a relative time string, just display it
  if (!startTime.match(/^\d{4}-\d{2}-\d{2}/)) {
    return startTime + (endTime && !endTime.match(/^\d{4}-\d{2}-\d{2}/) ? ` - ${endTime}` : "");
  }

  try {
    const start = new Date(startTime);
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    };
    let result = start.toLocaleString(undefined, options);

    if (endTime) {
      const end = new Date(endTime);
      // If same day, just show end time
      if (start.toDateString() === end.toDateString()) {
        result += ` - ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
      }
    }

    return result;
  } catch {
    return startTime;
  }
}

// Reply review state
interface ReplyDraft {
  email: InboxEmail;
  body: string;
  subject: string;
}

// Separate component for transcript display to avoid re-rendering entire list
const TranscriptPreview = React.memo(function TranscriptPreview({ transcript }: { transcript: string }) {
  console.log("[TranscriptPreview] rendering with:", transcript);
  return (
    <View style={transcriptStyles.container}>
      <Text style={transcriptStyles.text}>
        {transcript || "Listening..."}
      </Text>
    </View>
  );
});

const transcriptStyles = StyleSheet.create({
  container: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
  },
  text: {
    fontSize: 13,
    color: "#92400E",
    fontStyle: "italic",
  },
});


// Memoized email row component for FlatList performance
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

const EmailRow = React.memo(function EmailRow({
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
              {triageAction === "done" ? "✓" : "↩"}
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
                <Text style={styles.calendarIcon}>{item.calendarEvent.recurrenceDescription ? "🔄" : "📅"}</Text>
                <Text style={styles.calendarTitle} numberOfLines={1}>
                  {decodeHtmlEntities(item.calendarEvent.title)}
                </Text>
                {item.calendarEvent.calendarEventId ? (
                  <View style={styles.addedBadge}>
                    <Text style={styles.addedBadgeText}>✓</Text>
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
                {item.calendarEvent.location ? " · " + decodeHtmlEntities(item.calendarEvent.location) : ""}
                {item.calendarEvent.recurrenceDescription ? " · " + item.calendarEvent.recurrenceDescription : ""}
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

// ============================================================================
// TRIAGE LIST WRAPPER - Uses new context for gesture/scroll handling
// ============================================================================
interface TriageListWrapperProps {
  flatListRef: React.RefObject<FlatList | null>;
  emails: InboxEmail[];
  renderItem: ({ item, index }: { item: InboxEmail; index: number }) => React.ReactElement;
  extraData: any;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  searchQuery: string;
  isSyncing: boolean;
  isSummarizing: boolean;
  onTouchEnd?: () => void;
}

const TriageListWrapper = React.memo(function TriageListWrapper({
  flatListRef,
  emails,
  renderItem,
  extraData,
  refreshing,
  onRefresh,
  onEndReached,
  searchQuery,
  isSyncing,
  isSummarizing,
  onTouchEnd,
}: TriageListWrapperProps) {
  const triage = useTriageContext();

  // Update scroll position in new context
  const handleScroll = useCallback((event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    triage.setScrollY(y);
  }, [triage]);

  // Track first visible item - handles varying row heights correctly
  const handleViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    // Find the first visible item
    const firstVisible = viewableItems.find(item => item.index !== null);
    if (firstVisible && firstVisible.index !== null) {
      triage.setActiveIndex(firstVisible.index);
    }
  }, [triage]);

  // Viewability config - item is "viewable" when 50% visible
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 0,
  }).current;

  // Handle touch end - reset phase to idle
  const handleTouchEnd = useCallback(() => {
    if (triage.phase.value === "dragging") {
      triage.phase.value = "idle";
    }
    onTouchEnd?.();
  }, [triage.phase, onTouchEnd]);

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={(e) => {
        // Capture phase - fires before scroll takes over
        const x = e.nativeEvent.pageX;
        triage.fingerX.value = x;
        triage.startX.value = x;
        // Start dragging phase
        if (triage.phase.value === "idle") {
          triage.phase.value = "dragging";
        }
        return false; // Don't claim responder - let scroll work
      }}
      onMoveShouldSetResponderCapture={(e) => {
        // Capture phase for moves - fires at full frequency!
        triage.fingerX.value = e.nativeEvent.pageX;
        return false; // Don't claim responder - let scroll work
      }}
    >
      <Animated.View
        style={{ flex: 1 }}
        onTouchEnd={handleTouchEnd}
      >
        <FlatList
            ref={flatListRef}
            data={emails}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            extraData={extraData}
            contentContainerStyle={styles.listContent}
            refreshControl={
              Platform.OS !== "web" ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#6366F1"
                />
              ) : undefined
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>{searchQuery ? "🔍" : "📭"}</Text>
                <Text style={styles.emptyText}>
                  {searchQuery ? "No results found" : "No emails yet"}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery
                    ? `No emails matching "${searchQuery}"`
                    : Platform.OS === "web"
                      ? "Click refresh to sync"
                      : "Pull down to sync"}
                </Text>
              </View>
            }
            ListFooterComponent={
              isSyncing || isSummarizing ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Text style={styles.loadingMoreText}>
                    {isSyncing ? "Syncing..." : "Summarizing with AI..."}
                  </Text>
                </View>
              ) : null
            }
          />
      </Animated.View>
    </View>
  );
});

// Inbox mode type
type InboxMode = "swipe" | "batch";

export default function InboxScreen() {
  // ============================================================================
  // AUTH ERROR HANDLING
  // ============================================================================
  const { reportAuthError } = useAuthError();

  // ============================================================================
  // INBOX MODE STATE
  // ============================================================================
  const [inboxMode, setInboxMode] = useState<InboxMode>("swipe");

  // ============================================================================
  // ASK MY EMAIL AGENT
  // ============================================================================
  const { isOpen: isAskEmailOpen, open: openAskEmail, close: closeAskEmail } = useEmailAgent();

  // ============================================================================
  // EMAIL & SESSION STATE
  // ============================================================================
  const [sessionStart, setSessionStart] = useState(() => Date.now());
  const { emails: gmailEmails, isLoading, isSyncing, isSummarizing, hasMore, syncWithGmail, loadMore, userEmail } = useGmail(sessionStart);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingReplyFor, setSendingReplyFor] = useState<string | null>(null);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [pendingTranscriptFor, setPendingTranscriptFor] = useState<string | null>(null);
  const [addingCalendarFor, setAddingCalendarFor] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Toast state for non-blocking notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Triage state for optimistic updates - maps email ID to action taken
  const [triagedEmails, setTriagedEmails] = useState<Map<string, "done" | "reply_needed">>(new Map());
  const triageEmail = useMutation(api.emails.triageMyEmail);

  // Refs for triage logic
  const flatListRef = useRef<FlatList>(null);
  const triageInProgressRef = useRef<Set<string>>(new Set());
  const componentIdRef = useRef(Math.random().toString(36).slice(2, 8));
  const triageRef = useRef<TriageControlRef>(null);

  // Debug: Log when component mounts and when gmailEmails changes
  useEffect(() => {
    console.log(`[Triage:Mount] Component ${componentIdRef.current} mounted`);
    return () => console.log(`[Triage:Unmount] Component ${componentIdRef.current} unmounted`);
  }, []);

  useEffect(() => {
    console.log(`[Triage:EmailsEffect] Component ${componentIdRef.current}: gmailEmails.length=${gmailEmails.length}, isLoading=${isLoading}`);
  }, [gmailEmails, isLoading]);

  // Track if this is the initial mount to avoid resetting on first focus
  const isInitialMount = useRef(true);

  // Reset session when tab is focused (but not on initial mount)
  useFocusEffect(
    useCallback(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        console.log("[Inbox] Initial mount, keeping sessionStart:", sessionStart);
        return;
      }

      const newSessionStart = Date.now();
      console.log("[Inbox] Tab RE-focused, resetting sessionStart to:", newSessionStart);
      // Reset session start to "now" - this will filter out previously triaged items
      setSessionStart(newSessionStart);
      // Clear local triage tracking
      setTriagedEmails(new Map());
      triageInProgressRef.current = new Set();
      // Reset triage context
      triageRef.current?.reset();
      // Scroll to top
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, [])
  );

  // Search query with debounce effect
  const searchResults = useQuery(
    api.emails.searchMyEmails,
    searchQuery.trim().length > 0
      ? { searchQuery: searchQuery.trim() }
      : "skip"
  );

  const {
    startRecording,
    stopRecording,
    cancelRecording,
    transcript,
    isConnecting,
    isConnected,
  } = useVoiceRecording();

  const { playStartSound, playStopSound } = useMicSounds();

  // Unsubscribe action and subscriptions query
  const batchUnsubscribeAction = useAction(api.subscriptions.batchUnsubscribeMy);
  const subscriptions = useQuery(
    api.subscriptionsHelpers.getSubscriptions,
    userEmail ? { userEmail } : "skip"
  );

  // Calendar action - needed for Accept (done with calendar event)
  const addToCalendarAction = useAction(api.calendar.addToCalendar);

  // ============================================================================
  // TRIAGE HANDLER - For use with TriageProvider
  // Returns false to prevent auto-advance (used for mic recording)
  // ============================================================================
  const handleTriage = useCallback(async (
    email: TriageableEmail,
    targetId: TriageTargetId,
    _index: number
  ): Promise<boolean> => {
    console.log(`[NewTriage] targetId=${targetId}, email="${email.subject}"`);

    // --- MIC TARGET: Start recording, don't advance ---
    if (targetId === "mic") {
      console.log(`[NewTriage:Mic] Starting recording for: ${email._id}`);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setRecordingFor(email._id);
      // Sound plays via useEffect when isConnected becomes true
      startRecording();
      return false; // Don't advance - ball stays at mic
    }

    // --- UNSUBSCRIBE TARGET ---
    if (targetId === "unsubscribe") {
      if (!email.isSubscription) {
        console.log(`[NewTriage:Unsub] Skipping - not a subscription`);
        return false; // Don't advance for non-subscriptions
      }

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Find and call unsubscribe
      const senderEmail = email.fromContact?.email;
      const subscription = senderEmail && subscriptions?.find(s => s.senderEmail === senderEmail);

      if (subscription) {
        batchUnsubscribeAction({
          subscriptionIds: [subscription._id as any],
        }).then(result => {
          if (result.completed.length > 0) {
            showToast(`Unsubscribed from ${senderEmail}`, "success");
          } else if (result.manualRequired.length > 0) {
            showToast("Manual unsubscribe required - check email", "info");
          } else {
            showToast("Unsubscribe failed", "error");
          }
        }).catch(err => {
          console.error(`[NewTriage:Unsub] Error:`, err);
          showToast("Failed to unsubscribe", "error");
        });
      } else {
        showToast("No unsubscribe option available", "info");
      }

      // Mark as done and advance
      if (!triageInProgressRef.current.has(email._id) && !triagedEmails.has(email._id)) {
        triageInProgressRef.current.add(email._id);
        setTriagedEmails(prev => new Map(prev).set(email._id, "done"));
        triageEmail({ emailId: email._id as Id<"emails">, action: "done" })
          .finally(() => triageInProgressRef.current.delete(email._id));
      }
      return true; // Advance to next
    }

    // --- DONE / ACCEPT / REPLY TARGETS ---
    // Skip if already triaged
    if (triageInProgressRef.current.has(email._id) || triagedEmails.has(email._id)) {
      console.log(`[NewTriage] Already triaged: ${email._id}`);
      return false; // Don't advance
    }

    // "accept" is treated as "done" for triage purposes
    const action: "done" | "reply_needed" =
      (targetId === "done" || targetId === "accept") ? "done" : "reply_needed";
    triageInProgressRef.current.add(email._id);

    // Haptic feedback
    if (Platform.OS !== "web") {
      if (targetId === "done" || targetId === "accept") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }

    // If "accept" target, add calendar event
    if (targetId === "accept" && email.calendarEvent && userEmail) {
      const event = email.calendarEvent as CalendarEvent;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";

      console.log(`[NewTriage:Accept] Adding calendar event: ${event.title}`);
      addToCalendarAction({
        userEmail,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        description: event.description,
        timezone,
        emailId: email._id as any,
        recurrence: event.recurrence,
      }).then((result) => {
        showToast(`Added "${event.title}" to calendar`, "success");
        // Open the calendar link on web
        if (Platform.OS === "web" && result.htmlLink) {
          window.open(result.htmlLink, "_blank");
        }
      }).catch((err) => {
        console.error(`[NewTriage:Accept] Calendar error:`, err);
        showToast("Failed to add to calendar", "error");
      });
    }

    // Optimistic update
    setTriagedEmails(prev => new Map(prev).set(email._id, action));

    try {
      await triageEmail({ emailId: email._id as Id<"emails">, action });
      console.log(`[NewTriage] Success: "${email.subject}" -> ${action}`);
    } catch (error) {
      console.error(`[NewTriage] Failed:`, error);
      // Check for auth errors and report them
      if (error instanceof Error && isAuthError(error)) {
        reportAuthError(error);
      }
      // Revert on error
      setTriagedEmails(prev => {
        const next = new Map(prev);
        next.delete(email._id);
        return next;
      });
    } finally {
      triageInProgressRef.current.delete(email._id);
    }

    return true; // Advance to next
  }, [
    triageEmail,
    triagedEmails,
    playStartSound,
    startRecording,
    subscriptions,
    batchUnsubscribeAction,
    userEmail,
    showToast,
    addToCalendarAction,
    reportAuthError,
  ]);

  const sendEmailAction = useAction(api.gmailSend.sendReply);

  // Use search results when searching, otherwise use regular emails
  // Filter out locally triaged emails for optimistic updates
  const displayEmails = searchQuery.trim().length > 0 && searchResults
    ? searchResults.map((email): InboxEmail => ({
        _id: email._id,
        subject: email.subject,
        bodyPreview: email.bodyPreview,
        receivedAt: email.receivedAt,
        isRead: email.isRead,
        urgencyScore: email.urgencyScore,
        summary: email.summary,
        quickReplies: email.quickReplies as QuickReply[] | undefined,
        calendarEvent: email.calendarEvent as CalendarEvent | undefined,
        shouldAcceptCalendar: email.shouldAcceptCalendar,
        isSubscription: email.isSubscription,
        fromName: email.fromName,
        fromContact: email.fromContact ? {
          _id: email.fromContact._id,
          email: email.fromContact.email,
          name: email.fromContact.name,
          avatarUrl: email.fromContact.avatarUrl,
        } : null,
      }))
    : gmailEmails.map(toInboxEmail);

  // Keep triaged items visible - user scrolls past them naturally
  const emails = displayEmails;
  // Update module-level emails (not captured by worklet serialization)
  moduleEmails = emails;
  console.log(`[Triage:RefSync] Setting moduleEmails, length=${emails.length}`);

  const isRecording = isConnecting || isConnected;

  // Use ref to avoid stale closure in gesture handler
  const recordingForRef = useRef<string | null>(null);
  recordingForRef.current = recordingFor;

  // Async handler for stopping recording
  const handleTouchEndWhileRecordingAsync = useCallback(async () => {
    console.log("[Triage:TouchEnd] async handler, recordingFor:", recordingForRef.current);
    if (!recordingForRef.current) return;

    // Find the email being recorded for
    const email = moduleEmails.find(e => e._id === recordingForRef.current);
    if (!email) {
      console.log("[Triage:TouchEnd] email not found, cancelling");
      cancelRecording();
      setRecordingFor(null);
      return;
    }

    console.log("[Triage:TouchEnd] stopping recording for:", email.subject);
    playStopSound();
    const finalTranscript = await stopRecording();
    setRecordingFor(null);

    console.log("[Triage:TouchEnd] final transcript:", finalTranscript);
    if (!finalTranscript.trim()) {
      showAlert("No speech detected", "Please try recording again.");
      return;
    }

    if (!email.fromContact?.email) {
      showAlert("Error", "Cannot determine recipient email address.");
      return;
    }

    const subject = email.subject.startsWith("Re:")
      ? email.subject
      : `Re: ${email.subject}`;

    // Show review modal
    setReplyDraft({ email, body: finalTranscript, subject });
  }, [stopRecording, cancelRecording, playStopSound]);

  // Sync wrapper for runOnJS (async functions can cause issues)
  const handleTouchEndWhileRecording = useCallback(() => {
    console.log("[Triage:TouchEnd] sync wrapper called, recordingFor:", recordingForRef.current);
    handleTouchEndWhileRecordingAsync();
  }, [handleTouchEndWhileRecordingAsync]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncWithGmail();
    setRefreshing(false);
  }, [syncWithGmail]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isSyncing) {
      loadMore();
    }
  }, [hasMore, isSyncing, loadMore]);

  const handleQuickReply = useCallback((email: InboxEmail, reply: QuickReply) => {
    if (!email.fromContact?.email) {
      showAlert("Error", "Cannot determine recipient email address.");
      return;
    }

    const subject = email.subject.startsWith("Re:")
      ? email.subject
      : `Re: ${email.subject}`;

    // Show review modal
    setReplyDraft({ email, body: reply.body, subject });
  }, []);

  const handleAddToCalendar = useCallback(async (email: InboxEmail, event: CalendarEvent) => {
    if (!userEmail) {
      showAlert("Error", "Not signed in");
      return;
    }

    // Get client timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";

    setAddingCalendarFor(email._id);
    try {
      const result = await addToCalendarAction({
        userEmail,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        description: event.description,
        timezone,
        emailId: email._id as any, // Pass email ID to track added events
        recurrence: event.recurrence,
      });
      // Open the calendar link on web
      if (Platform.OS === "web" && result.htmlLink) {
        window.open(result.htmlLink, "_blank");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add event";
      showAlert("Error", message);
      console.error("Failed to add to calendar:", err);
    } finally {
      setAddingCalendarFor(null);
    }
  }, [userEmail, addToCalendarAction]);

  const handleSendReply = useCallback(async () => {
    if (!replyDraft || !userEmail) return;

    const emailId = replyDraft.email._id;
    setSendingReplyFor(emailId);

    try {
      await sendEmailAction({
        userEmail,
        to: replyDraft.email.fromContact!.email,
        subject: replyDraft.subject,
        body: replyDraft.body,
        inReplyTo: emailId,
      });
      // Close modal first, then show success
      setReplyDraft(null);
      setSendingReplyFor(null);

      // Brief success feedback
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      setSendingReplyFor(null);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      showAlert("Error", `Failed to send reply: ${errorMessage}`);
      console.error("Failed to send reply:", err);
    }
  }, [replyDraft, userEmail, sendEmailAction]);

  // ============================================================================
  // BATCH MODE HANDLERS
  // ============================================================================

  // Handle quick reply from batch mode - needs to look up email from batch data
  const handleBatchQuickReply = useCallback((emailId: string, reply: { label: string; body: string }) => {
    // Find the email in gmail emails
    const email = gmailEmails.find(e => e._id === emailId);
    if (!email) {
      showAlert("Error", "Email not found");
      return;
    }
    if (!email.fromContact?.email) {
      showAlert("Error", "Cannot determine recipient email address.");
      return;
    }

    const subject = email.subject.startsWith("Re:")
      ? email.subject
      : `Re: ${email.subject}`;

    // Show review modal
    setReplyDraft({ email, body: reply.body, subject });
  }, [gmailEmails]);

  // Play mic open sound when deepgram actually connects and starts streaming
  useEffect(() => {
    if (isConnected && recordingFor) {
      playStartSound();
    }
  }, [isConnected, recordingFor, playStartSound]);

  // Handle mic press in from batch mode - start recording
  const handleBatchMicPressIn = useCallback((emailId: string) => {
    // If recording for a different email, cancel that first
    if (recordingFor && recordingFor !== emailId) {
      cancelRecording();
      setRecordingFor(null);
      setPendingTranscriptFor(null);
    }

    // Clear any pending transcript from a different email
    if (pendingTranscriptFor && pendingTranscriptFor !== emailId) {
      setPendingTranscriptFor(null);
    }

    // Start recording for this email (sound plays when isConnected becomes true)
    setRecordingFor(emailId);
    setPendingTranscriptFor(null); // Clear pending while recording
    startRecording();
  }, [recordingFor, pendingTranscriptFor, startRecording, cancelRecording]);

  // Handle mic press out from batch mode - stop recording
  const handleBatchMicPressOut = useCallback(async (emailId: string) => {
    if (recordingFor !== emailId) return;

    // Play stop sound immediately on touch up (before async operations)
    playStopSound();
    setRecordingFor(null);

    // Capture current transcript before stopping (stopRecording may return stale data)
    const currentTranscript = transcript;
    const finalTranscript = await stopRecording();

    // Use whichever transcript has content - prefer finalTranscript but fallback to current
    const actualTranscript = (finalTranscript && finalTranscript.trim())
      ? finalTranscript.trim()
      : (currentTranscript && currentTranscript.trim())
        ? currentTranscript.trim()
        : null;

    if (actualTranscript) {
      // Keep the transcript pending for this email
      setPendingTranscriptFor(emailId);
    } else {
      showToast("No speech detected", "error");
      setPendingTranscriptFor(null);
    }
  }, [recordingFor, transcript, stopRecording, playStopSound, showToast]);

  // Handle send transcript from batch mode - create draft and show modal
  const handleBatchSendTranscript = useCallback((emailId: string) => {
    const email = gmailEmails.find(e => e._id === emailId);
    if (!email) {
      showAlert("Error", "Email not found");
      return;
    }

    if (!transcript || !transcript.trim()) {
      showToast("No transcript to send", "error");
      return;
    }

    const subject = email.subject.startsWith("Re:")
      ? email.subject
      : `Re: ${email.subject}`;

    setReplyDraft({ email, body: transcript.trim(), subject });
    setPendingTranscriptFor(null); // Clear pending after creating draft
  }, [gmailEmails, transcript, showToast]);

  // Memoized render function using EmailRow component
  const renderEmailItem = useCallback(({ item, index }: { item: InboxEmail; index: number }) => (
    <EmailRow
      item={item}
      index={index}
      onQuickReply={handleQuickReply}
      onAddToCalendar={handleAddToCalendar}
      sendingReplyFor={sendingReplyFor}
      recordingFor={recordingFor}
      addingCalendarFor={addingCalendarFor}
      isRecording={isRecording}
      transcript={transcript}
      isTriaged={triagedEmails.has(item._id)}
      triageAction={triagedEmails.get(item._id)}
    />
  ), [handleQuickReply, handleAddToCalendar, sendingReplyFor, recordingFor, addingCalendarFor, isRecording, transcript, triagedEmails]);

  if (isLoading && emails.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
    <TriageProvider emails={emails} onTriage={handleTriage} triageRef={triageRef}>
      <GestureHandlerRootView style={styles.container}>
        {/* Header with refresh button on web */}
        {Platform.OS === "web" && (
          <Stack.Screen
            options={{
              headerRight: () => (
                <TouchableOpacity
                  style={[styles.headerRefreshButton, (refreshing || isSyncing) && styles.headerRefreshButtonDisabled]}
                  onPress={handleRefresh}
                  disabled={refreshing || isSyncing}
                >
                  {refreshing || isSyncing ? (
                    <ActivityIndicator size="small" color="#6366F1" />
                  ) : (
                    <Text style={styles.headerRefreshButtonText}>Refresh</Text>
                  )}
                </TouchableOpacity>
              ),
            }}
          />
        )}

        {/* Triage overlay - targets at top of screen (only in swipe mode) */}
        {inboxMode === "swipe" && <NewTriageOverlay />}

      {/* Mode toggle and Ask button */}
      <View style={styles.modeToggleContainer}>
        <TouchableOpacity
          style={[styles.modeToggleButton, inboxMode === "swipe" && styles.modeToggleButtonActive]}
          onPress={() => setInboxMode("swipe")}
        >
          <Text style={[styles.modeToggleText, inboxMode === "swipe" && styles.modeToggleTextActive]}>
            Swipe
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeToggleButton, inboxMode === "batch" && styles.modeToggleButtonActive]}
          onPress={() => setInboxMode("batch")}
        >
          <Text style={[styles.modeToggleText, inboxMode === "batch" && styles.modeToggleTextActive]}>
            AI Batch
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.askEmailButton}
          onPress={openAskEmail}
        >
          <Text style={styles.askEmailButtonText}>Ask</Text>
        </TouchableOpacity>
      </View>

      {/* Ask My Email Modal */}
      <AskEmailModal visible={isAskEmailOpen} onClose={closeAskEmail} />

      {/* Swipe hint at top - only show in swipe mode */}
      {inboxMode === "swipe" && (
      <View style={styles.swipeHintContainer}>
        <Text style={styles.swipeHintText}>Drag ball → Done, Reply, or Mic • Swipe left for TODO</Text>
      </View>
      )}

      {/* Swipe mode content */}
      {inboxMode === "swipe" ? (
        <>
          {/* Search bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search emails..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.searchClearButton}
                onPress={() => setSearchQuery("")}
              >
                <Text style={styles.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Email List - uses new triage context for gestures */}
          <TriageListWrapper
            flatListRef={flatListRef}
            emails={emails}
            renderItem={renderEmailItem}
            extraData={{ transcript, recordingFor, triagedEmails }}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onEndReached={handleLoadMore}
            searchQuery={searchQuery}
            isSyncing={isSyncing}
            isSummarizing={isSummarizing}
            onTouchEnd={handleTouchEndWhileRecording}
          />
        </>
      ) : (
        /* Batch mode content */
        <BatchTriageView
          userEmail={userEmail}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onQuickReply={handleBatchQuickReply}
          onMicPressIn={handleBatchMicPressIn}
          onMicPressOut={handleBatchMicPressOut}
          onSendTranscript={handleBatchSendTranscript}
          recordingForId={recordingFor}
          pendingTranscriptForId={pendingTranscriptFor}
          transcript={transcript}
        />
      )}

      {/* Compose FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push("/compose")}>
        <Text style={styles.fabIcon}>✏️</Text>
      </TouchableOpacity>

      {/* Reply Review Modal */}
      <Modal
        visible={replyDraft !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setReplyDraft(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setReplyDraft(null)}
                style={styles.modalCancelButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Review Reply</Text>
              <TouchableOpacity
                onPress={handleSendReply}
                disabled={sendingReplyFor !== null}
                style={styles.modalSendButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {sendingReplyFor ? (
                  <ActivityIndicator size="small" color="#6366F1" />
                ) : (
                  <Text style={styles.modalSend}>Send</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.modalRecipient}>
              <Text style={styles.modalRecipientLabel}>To:</Text>
              <Text style={styles.modalRecipientValue}>
                {replyDraft?.email.fromContact?.name || replyDraft?.email.fromContact?.email}
              </Text>
            </View>

            <View style={styles.modalSubject}>
              <Text style={styles.modalSubjectLabel}>Subject:</Text>
              <Text style={styles.modalSubjectValue} numberOfLines={1}>
                {replyDraft?.subject}
              </Text>
            </View>

            <TextInput
              style={styles.modalBodyInput}
              value={replyDraft?.body || ""}
              onChangeText={(text) =>
                setReplyDraft((prev) => prev ? { ...prev, body: text } : null)
              }
              multiline
              placeholder="Write your reply..."
              autoFocus
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Toast notification */}
      {toast && (
        <View
          pointerEvents="none"
          style={[
            styles.toast,
            toast.type === "success" && styles.toastSuccess,
            toast.type === "error" && styles.toastError,
          ]}
        >
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
      </GestureHandlerRootView>
    </TriageProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modeToggleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F8F9FF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EAFF",
    gap: 8,
  },
  modeToggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#E8EAFF",
  },
  modeToggleButtonActive: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  modeToggleText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
  },
  modeToggleTextActive: {
    color: "#fff",
  },
  askEmailButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#10B981",
    marginLeft: 8,
  },
  askEmailButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  swipeHintContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F8F9FF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EAFF",
  },
  swipeHintText: {
    fontSize: 13,
    color: "#6366F1",
    fontWeight: "500",
  },
  swipeHintSubtext: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  searchInput: {
    flex: 1,
    height: 36,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#333",
  },
  searchClearButton: {
    marginLeft: 8,
    padding: 4,
  },
  searchClearText: {
    fontSize: 16,
    color: "#999",
  },
  headerRefreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  headerRefreshButtonDisabled: {
    opacity: 0.6,
  },
  headerRefreshButtonText: {
    color: "#6366F1",
    fontSize: 15,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingTop: TRIAGE_CONFIG.listTopPadding,
    paddingBottom: 800,
  },
  emailItem: {
    flexDirection: "column",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    minHeight: TRIAGE_CONFIG.rowHeight, // Minimum height for triage ball, but can grow
    // Background controlled by AnimatedRowWrapper
  },
  emailItemCompact: {
    minHeight: 90, // Reduced height for rows without quick replies or calendar
  },
  emailTopRow: {
    flexDirection: "row",
  },
  emailItemUnread: {
    // Unread indicated by bold text, not background (wrapper controls background)
  },
  emailItemTriaged: {
    opacity: 0.5,
  },
  emailItemRecording: {
    minHeight: TRIAGE_CONFIG.rowHeight,
    backgroundColor: "#FEF3C7", // Light yellow to indicate recording
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444", // Red border
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
  emptyState: {
    alignItems: "center",
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  loadingMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 14,
    color: "#666",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabIcon: {
    fontSize: 24,
  },
  // Calendar styles - two row display
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
    marginLeft: 20, // Align with title (after icon)
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  modalCancelButton: {
    padding: 8,
    marginLeft: -8,
  },
  modalCancel: {
    fontSize: 16,
    color: "#666",
  },
  modalSendButton: {
    padding: 8,
    marginRight: -8,
  },
  modalSend: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6366F1",
  },
  modalRecipient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalRecipientLabel: {
    fontSize: 15,
    color: "#666",
    width: 60,
  },
  modalRecipientValue: {
    fontSize: 15,
    color: "#1a1a1a",
    flex: 1,
  },
  modalSubject: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalSubjectLabel: {
    fontSize: 15,
    color: "#666",
    width: 60,
  },
  modalSubjectValue: {
    fontSize: 15,
    color: "#1a1a1a",
    flex: 1,
  },
  modalBodyInput: {
    flex: 1,
    fontSize: 16,
    color: "#1a1a1a",
    padding: 16,
    textAlignVertical: "top",
    minHeight: 150,
  },
  toast: {
    position: "absolute",
    bottom: 100,
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
