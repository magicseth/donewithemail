import React, { useCallback, useState, useRef, useEffect } from "react";
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
} from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import { useAction, useQuery, useMutation } from "convex/react";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  MouseButton,
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
  useDerivedValue,
  useAnimatedReaction,
  SharedValue,
} from "react-native-reanimated";
import { Dimensions } from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const CENTER_X = SCREEN_WIDTH / 2;

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
  // Hit zone boundaries (distance from center where activation triggers)
  hitZoneStart: 80,  // Ball enters "near" zone
  hitZoneActivate: 120, // Ball activates target
};

// ============================================================================
// TRIAGE CONTEXT - Single source of truth for all triage animation state
// ============================================================================

interface TriageState {
  scrollY: SharedValue<number>;
  fingerX: SharedValue<number>;
  startX: SharedValue<number>;
  // Active triage index - which row the ball is pointing at
  activeIndex: SharedValue<number>;
  // Lock to prevent cascading triggers
  isProcessing: SharedValue<boolean>;
  // Require ball to return to center before next activation
  needsReset: SharedValue<boolean>;
  // Computed: which row index is at the triage line (0-indexed)
  topRowIndex: { readonly value: number };
  // Computed: ball's X position
  ballX: { readonly value: number };
  // Computed: proximity to left target (0-1)
  leftProximity: { readonly value: number };
  // Computed: proximity to right target (0-1)
  rightProximity: { readonly value: number };
  // Computed: is ball activated (at either target)
  isActivated: { readonly value: boolean };
  // Computed: current direction (0=done, 1=reply)
  direction: { readonly value: number };
}

const TriageContext = React.createContext<TriageState | null>(null);

function useTriageState(): TriageState {
  const ctx = React.useContext(TriageContext);
  if (!ctx) throw new Error("useTriageState must be used within TriageProvider");
  return ctx;
}

// Hook to create all triage state - used once in InboxScreen
function useCreateTriageState(): TriageState {
  const { ballTravelMultiplier, hitZoneStart, hitZoneActivate } = TRIAGE_CONFIG;

  // Primary state (set by event handlers)
  const scrollY = useSharedValue(0);
  const fingerX = useSharedValue(CENTER_X);
  const startX = useSharedValue(CENTER_X);

  // Active triage index - increments when ball hits target
  const activeIndex = useSharedValue(0);

  // Lock to prevent cascading triggers
  const isProcessing = useSharedValue(false);

  // Require ball to return to center before next activation
  const needsReset = useSharedValue(false);

  // topRowIndex is now just the activeIndex (not derived from scroll)
  const topRowIndex = useDerivedValue(() => activeIndex.value);

  const ballX = useDerivedValue(() => {
    const delta = fingerX.value - startX.value;
    return Math.max(20, Math.min(SCREEN_WIDTH - 20, CENTER_X + delta * ballTravelMultiplier));
  });

  // Zone-based proximity: how far from center (0 = center, 1 = at activation zone)
  const leftProximity = useDerivedValue(() => {
    const distFromCenter = CENTER_X - ballX.value; // positive when ball is left of center
    if (distFromCenter <= 0) return 0; // ball is right of center
    return Math.min(1, distFromCenter / hitZoneStart);
  });

  const rightProximity = useDerivedValue(() => {
    const distFromCenter = ballX.value - CENTER_X; // positive when ball is right of center
    if (distFromCenter <= 0) return 0; // ball is left of center
    return Math.min(1, distFromCenter / hitZoneStart);
  });

  // Activation: ball has moved far enough from center
  const isActivated = useDerivedValue(() => {
    const distFromCenter = Math.abs(ballX.value - CENTER_X);
    return distFromCenter >= hitZoneActivate;
  });

  // Direction based on which side of center the ball is
  const direction = useDerivedValue(() => {
    // 0 = done (left), 1 = reply (right)
    return ballX.value > CENTER_X ? 1 : 0;
  });

  return {
    scrollY,
    fingerX,
    startX,
    activeIndex,
    isProcessing,
    needsReset,
    topRowIndex,
    ballX,
    leftProximity,
    rightProximity,
    isActivated,
    direction,
  };
}
import { api } from "../../convex/_generated/api";
import { useGmail, GmailEmail, QuickReply, CalendarEvent } from "../../hooks/useGmail";
import { useVoiceRecording } from "../../hooks/useDailyVoice";
import { Id } from "../../convex/_generated/dataModel";

// Sound feedback for mic actions
const useMicSounds = () => {
  const startSoundRef = useRef<Audio.Sound | null>(null);
  const stopSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    // Preload sounds - using system-like tones
    const loadSounds = async () => {
      if (Platform.OS === "web") return;

      try {
        // We'll use haptics + a simple notification-style feedback
        // Since we don't have custom sound files, we rely on haptics for native
      } catch (e) {
        console.log("Sound loading skipped:", e);
      }
    };
    loadSounds();

    return () => {
      startSoundRef.current?.unloadAsync();
      stopSoundRef.current?.unloadAsync();
    };
  }, []);

  const playStartSound = useCallback(async () => {
    if (Platform.OS === "web") return;

    try {
      // Strong haptic feedback for recording start
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      console.log("Haptic feedback error:", e);
    }
  }, []);

  const playStopSound = useCallback(async () => {
    if (Platform.OS === "web") return;

    try {
      // Double tap haptic for recording stop
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.log("Haptic feedback error:", e);
    }
  }, []);

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
  threadCount?: number;
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
    threadCount: email.threadCount,
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

// Swipe threshold for TODO action
const SWIPE_THRESHOLD = 100;

// ============================================================================
// TRIAGE OVERLAY - Ball and targets, uses context for all state
// ============================================================================

const TriageOverlay = React.memo(function TriageOverlay() {
  const triage = useTriageState();
  const { rowHeight, headerOffset, listTopPadding, ballSize, hitZoneActivate } = TRIAGE_CONFIG;

  // Target positions based on hit zones
  const TARGET_LEFT_X = CENTER_X - hitZoneActivate;
  const TARGET_RIGHT_X = CENTER_X + hitZoneActivate;

  // Ball position and scale
  const ballStyle = useAnimatedStyle(() => {
    const halfBall = ballSize / 2;

    // Calculate ball Y to track the top of the active row
    const activeIdx = triage.activeIndex.value;
    const rowContentY = listTopPadding + (activeIdx * rowHeight);
    const ballY = headerOffset + rowContentY - triage.scrollY.value;

    const isNear = triage.leftProximity.value > 0.5 || triage.rightProximity.value > 0.5;

    return {
      transform: [
        { translateX: triage.ballX.value - halfBall },
        { translateY: ballY - halfBall },
        { scale: isNear ? 1.2 : 1 },
      ],
    };
  });

  // Ball color based on proximity
  const ballColorStyle = useAnimatedStyle(() => {
    if (triage.leftProximity.value > 0.5) {
      return { backgroundColor: "#10B981" }; // Green for Done
    } else if (triage.rightProximity.value > 0.5) {
      return { backgroundColor: "#6366F1" }; // Purple for Reply
    }
    return { backgroundColor: "#9CA3AF" }; // Grey neutral
  });

  // Left target (Done)
  const leftTargetStyle = useAnimatedStyle(() => {
    const scale = 1 + triage.leftProximity.value * 0.4;
    return { transform: [{ scale: withSpring(scale) }] };
  });

  const leftTargetBgStyle = useAnimatedStyle(() => {
    const isActive = triage.isActivated.value && triage.direction.value === 0;
    return {
      backgroundColor: isActive
        ? "#10B981"
        : `rgba(16, 185, 129, ${0.3 + triage.leftProximity.value * 0.7})`,
    };
  });

  // Right target (Reply)
  const rightTargetStyle = useAnimatedStyle(() => {
    const scale = 1 + triage.rightProximity.value * 0.4;
    return { transform: [{ scale: withSpring(scale) }] };
  });

  const rightTargetBgStyle = useAnimatedStyle(() => {
    const isActive = triage.isActivated.value && triage.direction.value === 1;
    return {
      backgroundColor: isActive
        ? "#6366F1"
        : `rgba(99, 102, 241, ${0.3 + triage.rightProximity.value * 0.7})`,
    };
  });

  // Target Y position (fixed, near top)
  const targetY = 30;

  return (
    <View style={triageStyles.overlay} pointerEvents="none">
      {/* Left target - Done */}
      <Animated.View style={[triageStyles.targetContainer, { top: targetY, left: TARGET_LEFT_X - 45 }, leftTargetStyle]}>
        <Animated.View style={[triageStyles.targetBg, leftTargetBgStyle]}>
          <Text style={triageStyles.targetIcon}>✓</Text>
          <Text style={triageStyles.targetText}>Done</Text>
        </Animated.View>
      </Animated.View>

      {/* Right target - Reply */}
      <Animated.View style={[triageStyles.targetContainer, { top: targetY, left: TARGET_RIGHT_X - 35 }, rightTargetStyle]}>
        <Animated.View style={[triageStyles.targetBg, rightTargetBgStyle]}>
          <Text style={triageStyles.targetIcon}>↩</Text>
          <Text style={triageStyles.targetText}>Reply</Text>
        </Animated.View>
      </Animated.View>

      {/* Ball */}
      <Animated.View style={[triageStyles.ball, ballStyle]}>
        <Animated.View style={[triageStyles.ballInner, ballColorStyle]} />
      </Animated.View>
    </View>
  );
});

const triageStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  targetContainer: {
    position: "absolute",
    alignItems: "center",
  },
  targetBg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  targetIcon: {
    fontSize: 14,
    color: "#fff",
  },
  targetText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  ball: {
    position: "absolute",
    left: 0,
    top: 0,
    width: TRIAGE_CONFIG.ballSize,
    height: TRIAGE_CONFIG.ballSize,
    borderRadius: TRIAGE_CONFIG.ballSize / 2,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  ballInner: {
    width: TRIAGE_CONFIG.ballSize - 8,
    height: TRIAGE_CONFIG.ballSize - 8,
    borderRadius: (TRIAGE_CONFIG.ballSize - 8) / 2,
  },
});

// ============================================================================
// ANIMATED ROW WRAPPER - Handles triage highlighting with no re-renders
// ============================================================================

interface AnimatedRowWrapperProps {
  index: number;
  children: React.ReactNode;
}

const AnimatedRowWrapper = React.memo(function AnimatedRowWrapper({ index, children }: AnimatedRowWrapperProps) {
  const triage = useTriageState();

  // Animated style for the row background
  const rowStyle = useAnimatedStyle(() => {
    const isTopRow = triage.topRowIndex.value === index;
    const isNextRow = triage.topRowIndex.value === index - 1;

    if (isTopRow) {
      // At triage line - check if activated
      const isActivated = triage.isActivated.value;
      const direction = triage.direction.value; // 0 = done, 1 = reply

      if (isActivated) {
        // Activated - show action color
        if (direction === 0) {
          return { backgroundColor: "#ECFDF5", borderLeftWidth: 4, borderLeftColor: "#10B981" };
        } else {
          return { backgroundColor: "#EEF2FF", borderLeftWidth: 4, borderLeftColor: "#6366F1" };
        }
      } else {
        // Pending - grey
        return { backgroundColor: "#F3F4F6", borderLeftWidth: 4, borderLeftColor: "#9CA3AF" };
      }
    } else if (isNextRow) {
      // Next row - subtle grey
      return { backgroundColor: "#F9FAFB", borderLeftWidth: 4, borderLeftColor: "#E5E7EB" };
    }

    // Default - white background
    return { backgroundColor: "#FFFFFF", borderLeftWidth: 0, borderLeftColor: "transparent" };
  });

  return (
    <Animated.View style={rowStyle}>
      {children}
    </Animated.View>
  );
});

// Swipeable email row component - memoized for performance
interface SwipeableEmailRowProps {
  children: React.ReactNode;
  onSwipeLeft: () => void;
  disabled?: boolean;
}

const SwipeableEmailRow = React.memo(function SwipeableEmailRow({
  children,
  onSwipeLeft,
  disabled
}: SwipeableEmailRowProps) {
  const translateX = useSharedValue(0);
  const onSwipeLeftRef = useRef(onSwipeLeft);
  onSwipeLeftRef.current = onSwipeLeft;

  const handleSwipeComplete = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onSwipeLeftRef.current();
  }, []);

  const panGesture = Gesture.Pan()
    .enableTrackpadTwoFingerGesture(true)
    .mouseButton(MouseButton.LEFT)
    .minDistance(10)
    .enabled(!disabled)
    .activeOffsetX([-20, -10]) // Only activate when swiping left (negative X)
    .failOffsetY([-10, 10]) // Fail if vertical movement detected first
    .failOffsetX([10, 10000]) // Fail if swiping right
    .onUpdate((event) => {
      // Only allow swiping left (negative values)
      if (event.translationX < 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      const swipedLeft = event.translationX < -SWIPE_THRESHOLD ||
        (event.translationX < -50 && event.velocityX < -500);

      if (swipedLeft) {
        translateX.value = withTiming(-400, { duration: 200 }, () => {
          runOnJS(handleSwipeComplete)();
        });
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const todoIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <View style={swipeRowStyles.container}>
      {/* Background indicator */}
      <Animated.View style={[swipeRowStyles.todoIndicator, todoIndicatorStyle]}>
        <Text style={swipeRowStyles.todoIndicatorText}>TODO</Text>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const swipeRowStyles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
  },
  todoIndicator: {
    position: "absolute",
    right: 20,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 20,
  },
  todoIndicatorText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F59E0B",
    letterSpacing: 1,
  },
});

// Memoized email row component for FlatList performance
interface EmailRowProps {
  item: InboxEmail;
  index: number;
  onSwipeToTodo: (email: InboxEmail) => void;
  onQuickReply: (email: InboxEmail, reply: QuickReply) => void;
  onMicPressIn: (emailId: string) => void;
  onMicPressOut: (email: InboxEmail) => void;
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
  onSwipeToTodo,
  onQuickReply,
  onMicPressIn,
  onMicPressOut,
  onAddToCalendar,
  sendingReplyFor,
  recordingFor,
  addingCalendarFor,
  isRecording,
  transcript,
  isTriaged,
  triageAction,
}: EmailRowProps) {
  const fromName = item.fromContact?.name || item.fromContact?.email || "Unknown";
  const initials = getInitials(fromName);
  const timeAgo = formatTimeAgo(item.receivedAt);
  const isSending = sendingReplyFor === item._id;
  const isRecordingThis = recordingFor === item._id;

  const handleSwipeLeft = useCallback(() => {
    onSwipeToTodo(item);
  }, [item, onSwipeToTodo]);

  const handlePress = useCallback(() => {
    router.push(`/email/${item._id}`);
  }, [item._id]);

  const handleMicIn = useCallback(() => {
    onMicPressIn(item._id);
  }, [item._id, onMicPressIn]);

  const handleMicOut = useCallback(() => {
    onMicPressOut(item);
  }, [item, onMicPressOut]);

  return (
    <AnimatedRowWrapper index={index}>
      <SwipeableEmailRow
        onSwipeLeft={handleSwipeLeft}
        disabled={isSending || isRecording || isTriaged}
      >
        <TouchableOpacity
          style={[
            styles.emailItem,
            !item.isRead && styles.emailItemUnread,
            isTriaged && styles.emailItemTriaged,
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

        {/* Avatar */}
        <View style={[styles.avatarContainer, isTriaged && styles.triagedContent]}>
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

        <View style={[styles.emailContent, isTriaged && styles.triagedContent]}>
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

          {/* Summary or preview */}
          <Text style={styles.preview} numberOfLines={2}>
            {item.summary || decodeHtmlEntities(item.bodyPreview)}
          </Text>

          {/* Calendar event detected */}
          {item.calendarEvent && (
            <View style={styles.calendarRow}>
              <View style={styles.calendarInfo}>
                <Text style={styles.calendarIcon}>📅</Text>
                <View style={styles.calendarDetails}>
                  <Text style={styles.calendarTitle} numberOfLines={1}>
                    {decodeHtmlEntities(item.calendarEvent.title)}
                  </Text>
                  {item.calendarEvent.startTime && (
                    <Text style={styles.calendarTime} numberOfLines={1}>
                      {formatEventTime(item.calendarEvent.startTime, item.calendarEvent.endTime)}
                    </Text>
                  )}
                  {item.calendarEvent.location && (
                    <Text style={styles.calendarLocation} numberOfLines={1}>
                      📍 {decodeHtmlEntities(item.calendarEvent.location)}
                    </Text>
                  )}
                </View>
              </View>
              {item.calendarEvent.calendarEventId ? (
                <View style={styles.addedBadge}>
                  <Text style={styles.addedBadgeText}>✓ Added</Text>
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
          )}

          {/* Quick reply chips with mic button */}
          <View style={styles.quickReplyRow}>
            {item.quickReplies && item.quickReplies.slice(0, 3).map((reply, idx) => (
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

            {/* Mic button - always visible */}
            <TouchableOpacity
              style={[
                styles.micButton,
                isRecordingThis && styles.micButtonRecording,
              ]}
              onPressIn={handleMicIn}
              onPressOut={handleMicOut}
              disabled={isSending || (isRecording && !isRecordingThis)}
              activeOpacity={0.7}
            >
              <Text style={styles.micIcon}>
                {isRecordingThis ? "🔴" : "🎤"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Show recording status */}
          {isRecordingThis && <TranscriptPreview transcript={transcript} />}
        </View>

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
      </SwipeableEmailRow>
    </AnimatedRowWrapper>
  );
});

export default function InboxScreen() {
  // ============================================================================
  // TRIAGE STATE - Single source of truth via context
  // ============================================================================
  const triageState = useCreateTriageState();

  // ============================================================================
  // EMAIL & SESSION STATE
  // ============================================================================
  const [sessionStart, setSessionStart] = useState(() => Date.now());
  const { emails: gmailEmails, isLoading, isSyncing, isSummarizing, hasMore, syncWithGmail, loadMore, userEmail } = useGmail(sessionStart);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingReplyFor, setSendingReplyFor] = useState<string | null>(null);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [addingCalendarFor, setAddingCalendarFor] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Triage state for optimistic updates - maps email ID to action taken
  const [triagedEmails, setTriagedEmails] = useState<Map<string, "done" | "reply_needed">>(new Map());
  const triageEmail = useMutation(api.emails.triageEmail);

  // Refs for triage logic
  const flatListRef = useRef<FlatList>(null);
  const emailsRef = useRef<InboxEmail[]>([]);
  const triageInProgressRef = useRef<Set<string>>(new Set());

  // Triage handler - called when ball touches target
  const handleTriageAtIndex = useCallback(async (index: number, direction: number) => {
    const emails = emailsRef.current;
    if (index < 0 || index >= emails.length) return;

    const email = emails[index];
    if (!email || triageInProgressRef.current.has(email._id) || triagedEmails.has(email._id)) {
      return;
    }

    const action: "done" | "reply_needed" = direction === 0 ? "done" : "reply_needed";
    console.log(`[Triage] Ball hit target - ${action}: "${email.subject}"`);

    // Mark as in progress
    triageInProgressRef.current.add(email._id);

    // Haptic feedback
    if (Platform.OS !== "web") {
      if (action === "done") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }

    // Optimistic update
    setTriagedEmails(prev => new Map(prev).set(email._id, action));

    // Move to next row
    triageState.activeIndex.value = triageState.activeIndex.value + 1;

    // Reset ball to center by setting startX to current fingerX
    // This makes delta = 0, so ballX = CENTER_X
    triageState.startX.value = triageState.fingerX.value;

    // Clear processing lock (needsReset stays true until ball returns to center)
    triageState.isProcessing.value = false;

    try {
      await triageEmail({
        emailId: email._id as Id<"emails">,
        action,
      });
      console.log(`[Triage] Success: "${email.subject}" -> ${action}`);
    } catch (error) {
      console.error(`[Triage] Failed: "${email.subject}"`, error);
      // Revert on error
      setTriagedEmails(prev => {
        const next = new Map(prev);
        next.delete(email._id);
        return next;
      });
    } finally {
      triageInProgressRef.current.delete(email._id);
    }
  }, [triageEmail, triagedEmails]);

  // Watch for ball returning to center - clear the reset lock
  useAnimatedReaction(
    () => triageState.ballX.value,
    (ballX) => {
      // If we need a reset and ball is back near center, allow next activation
      if (triageState.needsReset.value) {
        const distFromCenter = Math.abs(ballX - CENTER_X);
        if (distFromCenter < 30) {
          triageState.needsReset.value = false;
        }
      }
    }
  );

  // Watch for ball activation and trigger triage
  useAnimatedReaction(
    () => ({
      isActivated: triageState.isActivated.value,
      isProcessing: triageState.isProcessing.value,
      needsReset: triageState.needsReset.value,
      topRowIndex: triageState.topRowIndex.value,
      direction: triageState.direction.value,
    }),
    (current, previous) => {
      // Trigger when:
      // - Ball is in activation zone
      // - Not already processing
      // - Ball has returned to center since last triage (needsReset is false)
      // - This is a new activation (wasn't activated before)
      if (
        current.isActivated &&
        !current.isProcessing &&
        !current.needsReset &&
        (!previous || !previous.isActivated)
      ) {
        // Set locks immediately in worklet to prevent cascade
        triageState.isProcessing.value = true;
        triageState.needsReset.value = true;
        runOnJS(handleTriageAtIndex)(current.topRowIndex, current.direction);
      }
    }
  );

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
      // Reset triage state
      triageState.activeIndex.value = 0;
      triageState.isProcessing.value = false;
      triageState.needsReset.value = false;
      // Scroll to top
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, [])
  );

  // Search query with debounce effect
  const searchResults = useQuery(
    api.emails.searchEmails,
    searchQuery.trim().length > 0 && userEmail
      ? { email: userEmail, searchQuery: searchQuery.trim() }
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

  const sendEmailAction = useAction(api.gmailSend.sendReply);
  const addToCalendarAction = useAction(api.calendar.addToCalendar);

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
  // Keep ref in sync for animation callbacks
  emailsRef.current = emails;
  const isRecording = isConnecting || isConnected;

  // Handle swipe left to mark as TODO
  const handleSwipeToTodo = useCallback(async (email: InboxEmail) => {
    // Optimistically update UI
    setTriagedEmails((prev) => new Map(prev).set(email._id, "reply_needed"));

    try {
      await triageEmail({
        emailId: email._id as Id<"emails">,
        action: "reply_needed",
      });
    } catch (error) {
      console.error("Failed to triage email:", error);
      // Revert on error
      setTriagedEmails((prev) => {
        const next = new Map(prev);
        next.delete(email._id);
        return next;
      });
    }
  }, [triageEmail]);

  // Track scroll position for ball Y calculation
  const handleScroll = useCallback((event: any) => {
    triageState.scrollY.value = event.nativeEvent.contentOffset.y;
  }, [triageState.scrollY]);

  // On web, use native DOM events for full-frequency pointer tracking
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handlePointerDown = (e: PointerEvent) => {
      triageState.startX.value = e.clientX;
      triageState.fingerX.value = e.clientX;
    };

    const handlePointerMove = (e: PointerEvent) => {
      // Only track if pointer is down (buttons > 0 means pressed)
      if (e.buttons === 0) return;
      triageState.fingerX.value = e.clientX;
    };

    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('pointermove', handlePointerMove, { capture: true });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
    };
  }, [triageState.fingerX, triageState.startX]);

  // Native: use gesture handler for touch tracking
  const trackingGesture = Gesture.Manual()
    .onTouchesDown((e) => {
      'worklet';
      if (Platform.OS === 'web') return; // Handled by DOM events
      if (e.allTouches.length > 0) {
        const touch = e.allTouches[0];
        triageState.startX.value = touch.absoluteX;
        triageState.fingerX.value = touch.absoluteX;
      }
    })
    .onTouchesMove((e) => {
      'worklet';
      if (Platform.OS === 'web') return; // Handled by DOM events
      if (e.allTouches.length > 0) {
        const touch = e.allTouches[0];
        triageState.fingerX.value = touch.absoluteX;
      }
    });

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

  const handleMicPressIn = useCallback(async (emailId: string) => {
    setRecordingFor(emailId);
    playStartSound();
    await startRecording();
  }, [startRecording, playStartSound]);

  const handleMicPressOut = useCallback(async (email: InboxEmail) => {
    if (!recordingFor) {
      cancelRecording();
      setRecordingFor(null);
      return;
    }

    playStopSound();
    const finalTranscript = await stopRecording();
    setRecordingFor(null);

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
  }, [recordingFor, stopRecording, cancelRecording, playStopSound]);

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

  // Memoized render function using EmailRow component
  const renderEmailItem = useCallback(({ item, index }: { item: InboxEmail; index: number }) => (
    <EmailRow
      item={item}
      index={index}
      onSwipeToTodo={handleSwipeToTodo}
      onQuickReply={handleQuickReply}
      onMicPressIn={handleMicPressIn}
      onMicPressOut={handleMicPressOut}
      onAddToCalendar={handleAddToCalendar}
      sendingReplyFor={sendingReplyFor}
      recordingFor={recordingFor}
      addingCalendarFor={addingCalendarFor}
      isRecording={isRecording}
      transcript={transcript}
      isTriaged={triagedEmails.has(item._id)}
      triageAction={triagedEmails.get(item._id)}
    />
  ), [handleSwipeToTodo, handleQuickReply, handleMicPressIn, handleMicPressOut, handleAddToCalendar, sendingReplyFor, recordingFor, addingCalendarFor, isRecording, transcript, triagedEmails]);

  if (isLoading && emails.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <TriageContext.Provider value={triageState}>
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

        {/* Triage overlay - ball moves toward targets */}
        <TriageOverlay />

      {/* Swipe hint at top */}
      <View style={styles.swipeHintContainer}>
        <Text style={styles.swipeHintText}>Drag ball to target • Swipe left for TODO</Text>
      </View>

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

      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={(e) => {
          // Capture phase - fires before scroll takes over
          const x = e.nativeEvent.pageX;
          triageState.startX.value = x;
          triageState.fingerX.value = x;
          return false; // Don't claim responder - let scroll work
        }}
        onMoveShouldSetResponderCapture={(e) => {
          // Capture phase for moves - fires at full frequency!
          triageState.fingerX.value = e.nativeEvent.pageX;
          return false; // Don't claim responder - let scroll work
        }}
      >
        <GestureDetector gesture={trackingGesture}>
          <Animated.View style={{ flex: 1 }}>
            <FlatList
            ref={flatListRef}
            data={emails}
            keyExtractor={(item) => item._id}
            renderItem={renderEmailItem}
            extraData={{ transcript, recordingFor, triagedEmails }}
            getItemLayout={(_, index) => ({
              length: TRIAGE_CONFIG.rowHeight,
              offset: TRIAGE_CONFIG.listTopPadding + index * TRIAGE_CONFIG.rowHeight,
              index,
            })}
          contentContainerStyle={styles.listContent}
          refreshControl={
            Platform.OS !== "web" ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#6366F1"
              />
            ) : undefined
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          onScroll={handleScroll}
          scrollEventThrottle={16}
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
        </GestureDetector>
      </View>

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
              <TouchableOpacity onPress={() => setReplyDraft(null)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Review Reply</Text>
              <TouchableOpacity
                onPress={handleSendReply}
                disabled={sendingReplyFor !== null}
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
      </GestureHandlerRootView>
    </TriageContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
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
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    height: TRIAGE_CONFIG.rowHeight,
    overflow: "hidden",
    // Background controlled by AnimatedRowWrapper
  },
  emailItemUnread: {
    // Unread indicated by bold text, not background (wrapper controls background)
  },
  emailItemTriaged: {
    opacity: 0.5,
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
  micButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: "auto",
  },
  micButtonRecording: {
    backgroundColor: "#FEE2E2",
  },
  micIcon: {
    fontSize: 16,
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
  // Calendar styles
  calendarRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  calendarInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  calendarIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  calendarDetails: {
    flex: 1,
    gap: 2,
  },
  calendarTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#78350F",
  },
  calendarTime: {
    fontSize: 12,
    color: "#92400E",
  },
  calendarLocation: {
    fontSize: 11,
    color: "#A16207",
  },
  addCalendarButton: {
    backgroundColor: "#F59E0B",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  addCalendarButtonDisabled: {
    opacity: 0.6,
  },
  addCalendarButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  addedBadge: {
    backgroundColor: "#10B981",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
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
  modalCancel: {
    fontSize: 16,
    color: "#666",
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
});
