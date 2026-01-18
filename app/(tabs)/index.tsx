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
// - lastTriggeredTarget clears when ball leaves all targets (activeTarget = null)
// - This allows user to move ball away and come back to trigger again
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

// ============================================================================
// TARGET SYSTEM - Flexible multi-target configuration
// ============================================================================

interface Target {
  id: string;                    // Unique identifier (e.g., "done", "reply", "mic")
  position: number;              // X position relative to CENTER_X (negative = left)
  activationRadius: number;      // Distance from position where activation occurs
  proximityRadius: number;       // Distance where visual feedback starts
  color: string;                 // Target color when active
  bgColor: string;               // Background tint for row highlight
  icon: string;                  // Display icon
  label: string;                 // Display label
}

// Debug logging helper
const DEBUG_TRIAGE = true;
const logTriage = (tag: string, data: any) => {
  if (DEBUG_TRIAGE) {
    console.log(`[Triage:${tag}]`, JSON.stringify(data, null, 2));
  }
};

// Module-level logging function for worklets
const logActiveTargetCalc = (ball: number, targetId: string, targetX: number, distance: number, radius: number) => {
  console.log(`[Triage:ActiveCalc] ball=${ball.toFixed(0)}, checking ${targetId}: targetX=${targetX}, distance=${distance.toFixed(0)}, radius=${radius}, hit=${distance <= radius}`);
};

// Track minimum distances during a drag session
let minDistances: Record<string, number> = { done: 999, reply: 999, mic: 999 };
const logMinDistance = (targetId: string, distance: number) => {
  if (distance < minDistances[targetId]) {
    minDistances[targetId] = distance;
    console.log(`[Triage:MinDist] NEW MIN for ${targetId}: ${distance.toFixed(0)}px (radius=30)`);
  }
};
const resetMinDistances = () => {
  console.log(`[Triage:MinDist] RESET - Previous mins: done=${minDistances.done.toFixed(0)}, reply=${minDistances.reply.toFixed(0)}, mic=${minDistances.mic.toFixed(0)}`);
  minDistances = { done: 999, reply: 999, mic: 999 };
};

// Log screen dimensions and center
if (DEBUG_TRIAGE) {
  console.log(`[Triage:Init] SCREEN_WIDTH=${SCREEN_WIDTH}, CENTER_X=${CENTER_X}`);
}

// Targets positioned relative to CENTER_X
// Negative = left of center, Positive = right of center
const TARGETS: Target[] = [
  {
    id: "unsubscribe",
    position: -100,          // Left of center
    activationRadius: 30,
    proximityRadius: 50,
    color: "#F59E0B",        // Amber/orange
    bgColor: "#FFFBEB",
    icon: "🚫",
    label: "Unsub",
  },
  {
    id: "done",
    position: 0,             // Center
    activationRadius: 30,    // Activates when ball within 30px
    proximityRadius: 50,     // Glow starts at 50px
    color: "#10B981",
    bgColor: "#ECFDF5",
    icon: "✓",
    label: "Done",
  },
  {
    id: "reply",
    position: 80,            // 80px right of center
    activationRadius: 30,
    proximityRadius: 50,
    color: "#6366F1",
    bgColor: "#EEF2FF",
    icon: "↩",
    label: "Reply",
  },
  {
    id: "mic",
    position: 160,           // 160px right of center
    activationRadius: 30,
    proximityRadius: 50,
    color: "#EF4444",
    bgColor: "#FEF2F2",
    icon: "🎤",
    label: "Mic",
  },
];

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
  // Track what target was last triggered (to prevent re-triggering same target)
  lastTriggeredTarget: SharedValue<string | null>;
  // Computed: which row index is at the triage line (0-indexed)
  topRowIndex: { readonly value: number };
  // Computed: ball's X position
  ballX: { readonly value: number };
  // Computed: ball's Y position
  ballY: { readonly value: number };
  // Computed: proximity (0-1) for each target
  proximities: { readonly value: Record<string, number> };
  // Computed: which target the ball is currently touching (null if none)
  activeTarget: { readonly value: string | null };
  // Computed: closest target with proximity info (for ball color)
  closestTarget: { readonly value: { id: string; proximity: number } | null };
}

const TriageContext = React.createContext<TriageState | null>(null);

function useTriageState(): TriageState {
  const ctx = React.useContext(TriageContext);
  if (!ctx) throw new Error("useTriageState must be used within TriageProvider");
  return ctx;
}

// Hook to create all triage state - used once in InboxScreen
function useCreateTriageState(): TriageState {
  const { ballTravelMultiplier } = TRIAGE_CONFIG;

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

  // Track what target was last triggered (to prevent re-triggering same target)
  const lastTriggeredTarget = useSharedValue<string | null>(null);

  // topRowIndex is now just the activeIndex (not derived from scroll)
  const topRowIndex = useDerivedValue(() => activeIndex.value);

  const ballX = useDerivedValue(() => {
    const delta = fingerX.value - startX.value;
    const result = Math.max(20, Math.min(SCREEN_WIDTH - 20, CENTER_X + delta * ballTravelMultiplier));
    return result;
  });

  // Ball Y position (matches the ball rendering formula)
  const { rowHeight, headerOffset, listTopPadding, ballSize } = TRIAGE_CONFIG;
  const TARGET_Y = 30; // Fixed Y position of targets at top

  const ballY = useDerivedValue(() => {
    const halfBall = ballSize / 2;
    const activeIdx = activeIndex.value;
    const rowContentY = listTopPadding + (activeIdx * rowHeight);
    return headerOffset + rowContentY - scrollY.value;
  });

  // Helper to calculate 2D distance between ball and target
  const getDistance2D = (bx: number, by: number, tx: number, ty: number) => {
    'worklet';
    const dx = bx - tx;
    const dy = by - ty;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Proximity map: returns proximity (0-1) for each target using 2D distance
  const proximities = useDerivedValue(() => {
    const bx = ballX.value;
    const by = ballY.value;
    const result: Record<string, number> = {};

    for (const target of TARGETS) {
      const targetX = CENTER_X + target.position;
      const targetYCenter = TARGET_Y + 20; // Approximate center of target button
      const distance = getDistance2D(bx, by, targetX, targetYCenter);

      if (distance > target.proximityRadius) {
        result[target.id] = 0;
      } else {
        // Scale from 0 (at edge) to 1 (at center)
        result[target.id] = 1 - (distance / target.proximityRadius);
      }
    }
    return result;
  });

  // Active target: which target is the ball currently touching (if any) - uses 2D distance
  const activeTarget = useDerivedValue(() => {
    const bx = ballX.value;
    const by = ballY.value;

    for (const target of TARGETS) {
      const targetX = CENTER_X + target.position;
      const targetYCenter = TARGET_Y + 20; // Approximate center of target button
      const distance = getDistance2D(bx, by, targetX, targetYCenter);

      if (distance <= target.activationRadius) {
        return target.id;
      }
    }
    return null; // Not at any target
  });

  // Closest target: for ball color feedback - uses 2D distance
  const closestTarget = useDerivedValue(() => {
    const bx = ballX.value;
    const by = ballY.value;
    let closest: { id: string; proximity: number } | null = null;

    for (const target of TARGETS) {
      const targetX = CENTER_X + target.position;
      const targetYCenter = TARGET_Y + 20; // Approximate center of target button
      const distance = getDistance2D(bx, by, targetX, targetYCenter);
      const proximity = 1 - Math.min(1, distance / target.proximityRadius);

      if (proximity > 0 && (!closest || proximity > closest.proximity)) {
        closest = { id: target.id, proximity };
      }
    }
    return closest;
  });

  return {
    scrollY,
    fingerX,
    startX,
    activeIndex,
    isProcessing,
    needsReset,
    lastTriggeredTarget,
    topRowIndex,
    ballX,
    ballY,
    proximities,
    activeTarget,
    closestTarget,
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

// Swipe threshold for TODO action
const SWIPE_THRESHOLD = 100;

// ============================================================================
// TRIAGE OVERLAY - Ball and targets, uses context for all state
// ============================================================================

// Individual target component - memoized for performance
interface TargetViewProps {
  target: Target;
}

const TargetView = React.memo(function TargetView({ target }: TargetViewProps) {
  const triage = useTriageState();
  const targetX = CENTER_X + target.position;

  // Use shared value for centering offset - updates without re-render
  const centerOffset = useSharedValue(0);

  // Log target position on mount
  React.useEffect(() => {
    console.log(`[Triage:TargetPos] ${target.id}: position=${target.position}, targetX=${targetX}, CENTER_X=${CENTER_X}`);
  }, [target.id, target.position, targetX]);

  // Ref for measuring absolute position
  const containerRef = React.useRef<any>(null);

  const handleLayout = React.useCallback((event: any) => {
    const { width } = event.nativeEvent.layout;
    // Update the centering offset to shift left by half the width
    centerOffset.value = -width / 2;
    console.log(`[Triage:TargetLayout] ${target.id}: width=${width}, centerOffset=${-width / 2}`);

    // Verify absolute position after transform applies
    setTimeout(() => {
      containerRef.current?.measureInWindow?.((absX: number, absY: number, absW: number, absH: number) => {
        if (absX != null) {
          const visualCenterX = absX + absW / 2;
          console.log(`[Triage:TargetVerify] ${target.id}: visualCenterX=${visualCenterX.toFixed(0)}, expectedCenterX=${targetX}, diff=${(visualCenterX - targetX).toFixed(0)}`);
        }
      });
    }, 100);
  }, [target.id, centerOffset, targetX]);

  // Container X position - centered at targetX via transform
  const containerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: centerOffset.value }],
    };
  });

  // Target scale based on proximity
  const targetStyle = useAnimatedStyle(() => {
    const proximity = triage.proximities.value[target.id] || 0;
    const scale = 1 + proximity * 0.4;
    return {
      transform: [{ scale: withSpring(scale) }],
    };
  });

  // Target background color based on activation state
  const targetBgStyle = useAnimatedStyle(() => {
    const proximity = triage.proximities.value[target.id] || 0;
    const isActive = triage.activeTarget.value === target.id;

    if (isActive) {
      return { backgroundColor: target.color };
    }

    // Compute opacity (30% base + up to 70% based on proximity)
    const opacity = Math.round(30 + proximity * 70) / 100;

    // Parse hex color and apply opacity
    const r = parseInt(target.color.slice(1, 3), 16);
    const g = parseInt(target.color.slice(3, 5), 16);
    const b = parseInt(target.color.slice(5, 7), 16);

    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})`,
    };
  });

  // Fixed Y position at top
  const targetY = 30;

  return (
    <Animated.View
      ref={containerRef}
      style={[
        triageStyles.targetContainer,
        { top: targetY, left: targetX },
        containerStyle,
      ]}
      onLayout={handleLayout}
      collapsable={false}
    >
      <Animated.View style={[targetStyle]}>
        <Animated.View style={[triageStyles.targetBg, targetBgStyle]}>
          <Text style={triageStyles.targetIcon}>{target.icon}</Text>
          <Text style={triageStyles.targetText}>{target.label}</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
});

const TriageOverlay = React.memo(function TriageOverlay() {
  const { rowHeight, headerOffset, listTopPadding, ballSize } = TRIAGE_CONFIG;
  const overlayRef = React.useRef<any>(null);

  // Log config on mount
  React.useEffect(() => {
    console.log(`[Triage:Config] rowHeight=${rowHeight}, headerOffset=${headerOffset}, listTopPadding=${listTopPadding}, ballSize=${ballSize}`);
  }, [rowHeight, headerOffset, listTopPadding, ballSize]);

  // Log overlay absolute position
  const handleOverlayLayout = React.useCallback(() => {
    if (overlayRef.current) {
      overlayRef.current.measureInWindow((x: number, y: number, w: number, h: number) => {
        console.log(`[Triage:OverlayAbsolute] screenX=${x?.toFixed(0)}, screenY=${y?.toFixed(0)}, width=${w?.toFixed(0)}, height=${h?.toFixed(0)}`);
      });
    }
  }, []);

  return (
    <View ref={overlayRef} style={triageStyles.overlay} pointerEvents="none" onLayout={handleOverlayLayout} collapsable={false}>
      {/* Render all targets dynamically - ball is now rendered in each row */}
      {TARGETS.map(target => (
        <TargetView key={target.id} target={target} />
      ))}
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
    // Container left edge is at targetX (detection point)
    // Child uses translateX(-width/2) to center visually at that point
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
});

// ============================================================================
// ANIMATED ROW WRAPPER - Handles triage highlighting with no re-renders
// ============================================================================

// RowBall - Rendered inside each row, only moves when this row is active
const RowBall = React.memo(function RowBall({ index }: { index: number }) {
  const triage = useTriageState();
  const { ballSize } = TRIAGE_CONFIG;
  const halfBall = ballSize / 2;

  // Ball position - only moves if this row is the active row
  const ballPositionStyle = useAnimatedStyle(() => {
    const isActive = triage.activeIndex.value === index;
    const ballX = isActive ? triage.ballX.value : CENTER_X;

    return {
      transform: [
        { translateX: ballX - halfBall },
      ],
    };
  });

  // Ball color - changes based on proximity to targets (only when active)
  const ballColorStyle = useAnimatedStyle(() => {
    const isActive = triage.activeIndex.value === index;

    if (!isActive) {
      return { backgroundColor: "#D1D5DB" }; // Grey for inactive rows
    }

    const closest = triage.closestTarget.value;
    if (closest && closest.proximity > 0.5) {
      const target = TARGETS.find(t => t.id === closest.id);
      if (target) {
        return { backgroundColor: target.color };
      }
    }
    return { backgroundColor: "#9CA3AF" }; // Neutral grey when active but not near target
  });

  // Scale up when near a target (only for active row)
  const ballScaleStyle = useAnimatedStyle(() => {
    const isActive = triage.activeIndex.value === index;
    if (!isActive) {
      return { transform: [{ scale: 0.8 }] }; // Smaller for inactive rows
    }

    const closest = triage.closestTarget.value;
    const isNear = closest !== null && closest.proximity > 0.5;
    return { transform: [{ scale: isNear ? 1.2 : 1 }] };
  });

  return (
    <Animated.View style={[rowBallStyles.ballContainer, ballPositionStyle]}>
      <Animated.View style={[rowBallStyles.ball, ballScaleStyle]}>
        <Animated.View style={[rowBallStyles.ballInner, ballColorStyle]} />
      </Animated.View>
    </Animated.View>
  );
});

const rowBallStyles = StyleSheet.create({
  ballContainer: {
    position: "absolute",
    top: 4,
    left: 0,
    zIndex: 100,
  },
  ball: {
    width: TRIAGE_CONFIG.ballSize,
    height: TRIAGE_CONFIG.ballSize,
    borderRadius: TRIAGE_CONFIG.ballSize / 2,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  ballInner: {
    width: TRIAGE_CONFIG.ballSize - 8,
    height: TRIAGE_CONFIG.ballSize - 8,
    borderRadius: (TRIAGE_CONFIG.ballSize - 8) / 2,
  },
});

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
      const activeTargetId = triage.activeTarget.value;

      if (activeTargetId !== null) {
        // Ball is at a target - find the target and use its colors
        const target = TARGETS.find(t => t.id === activeTargetId);
        if (target) {
          return {
            backgroundColor: target.bgColor,
            borderLeftWidth: 4,
            borderLeftColor: target.color,
          };
        }
      }
      // Not at any target - show pending grey
      return { backgroundColor: "#F3F4F6", borderLeftWidth: 4, borderLeftColor: "#9CA3AF" };
    } else if (isNextRow) {
      // Next row - subtle grey
      return { backgroundColor: "#F9FAFB", borderLeftWidth: 4, borderLeftColor: "#E5E7EB" };
    }

    // Default - white background
    return { backgroundColor: "#FFFFFF", borderLeftWidth: 0, borderLeftColor: "transparent" };
  });

  return (
    <Animated.View style={[rowStyle, { position: "relative" }]}>
      <RowBall index={index} />
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

  // Debug logging for recording state
  if (isRecordingThis) {
    console.log(`[EmailRow] ${item._id} isRecordingThis=true, transcript="${transcript}"`);
  }

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

  // Unsubscribe action and subscriptions query - needed for handleTargetActivation
  const batchUnsubscribeAction = useAction(api.subscriptions.batchUnsubscribe);
  const subscriptions = useQuery(
    api.subscriptionsHelpers.getSubscriptions,
    userEmail ? { userEmail } : "skip"
  );

  // Triage handler - called when ball touches target
  const handleTargetActivation = useCallback(async (index: number, targetId: string) => {
    const emails = emailsRef.current;
    if (index < 0 || index >= emails.length) return;

    const email = emails[index];
    const target = TARGETS.find(t => t.id === targetId);

    if (!email || !target) {
      triageState.isProcessing.value = false;
      return;
    }

    console.log(`[Triage] Ball hit target - ${targetId}: "${email.subject}"`);

    // Handle based on target type
    if (targetId === "mic") {
      // Mic target - start voice recording
      console.log(`[Triage:Mic] Starting recording for email: ${email._id}`);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Start recording for this email
      setRecordingFor(email._id);
      console.log(`[Triage:Mic] recordingFor set to: ${email._id}`);
      playStartSound();
      startRecording();

      // Don't reset ball - keep it at mic target while recording
      triageState.isProcessing.value = false;
      return;
    }

    // Handle unsubscribe
    if (targetId === "unsubscribe") {
      console.log(`[Triage:Unsub] Unsubscribe for email: ${email._id}, sender: ${email.fromContact?.email}`);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Find subscription for this sender
      const senderEmail = email.fromContact?.email;
      const subscription = senderEmail && subscriptions?.find(s => s.senderEmail === senderEmail);

      if (subscription && userEmail) {
        // Call unsubscribe action
        batchUnsubscribeAction({
          userEmail,
          subscriptionIds: [subscription._id as any], // Cast needed for Id type
        }).then(result => {
          console.log(`[Triage:Unsub] Result:`, result);
          if (result.completed.length > 0) {
            showAlert("Unsubscribed", `Successfully unsubscribed from ${senderEmail}`);
          } else if (result.manualRequired.length > 0) {
            showAlert("Manual action required", `Please visit the unsubscribe link to complete: ${result.manualRequired[0].url}`);
          } else {
            showAlert("Unsubscribe failed", "Could not unsubscribe automatically");
          }
        }).catch(err => {
          console.error(`[Triage:Unsub] Error:`, err);
          showAlert("Error", "Failed to unsubscribe");
        });
      } else {
        console.log(`[Triage:Unsub] No subscription found for ${senderEmail}`);
        showAlert("No subscription", "This email doesn't have an unsubscribe option");
      }

      // Mark as done regardless
      if (!triageInProgressRef.current.has(email._id) && !triagedEmails.has(email._id)) {
        triageInProgressRef.current.add(email._id);
        setTriagedEmails(prev => new Map(prev).set(email._id, "done"));
        triageEmail({ emailId: email._id as Id<"emails">, action: "done" });
        // Move to next row since we triaged this one
        triageState.activeIndex.value = triageState.activeIndex.value + 1;
      }

      // Reset ball to center - set lastTriggeredTarget to "done" since ball lands at center
      // where the "done" target is, preventing immediate re-trigger
      triageState.startX.value = triageState.fingerX.value;
      triageState.lastTriggeredTarget.value = "done";
      triageState.isProcessing.value = false;
      return;
    }

    // Check if already triaged
    if (triageInProgressRef.current.has(email._id) || triagedEmails.has(email._id)) {
      triageState.lastTriggeredTarget.value = "done"; // Ball at center = done target
      triageState.isProcessing.value = false;
      return;
    }

    // Map target to triage action
    const action: "done" | "reply_needed" = targetId === "done" ? "done" : "reply_needed";

    // Mark as in progress
    triageInProgressRef.current.add(email._id);

    // Haptic feedback
    if (Platform.OS !== "web") {
      if (targetId === "done") {
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

    // Set lastTriggeredTarget to "done" since ball lands at center where "done" target is
    // This prevents immediately triggering "done" after any other action
    triageState.lastTriggeredTarget.value = "done";
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
  }, [triageEmail, triagedEmails, playStartSound, startRecording, triageState, subscriptions, batchUnsubscribeAction, userEmail]);

  // Log ball position periodically for debugging
  const lastLogTimeShared = useSharedValue(0);
  const logPosition = useCallback((ballX: number, fingerX: number, startX: number, scrollY: number, activeTarget: string | null, closestTargetId: string | null) => {
    console.log(`[Triage:Position] ballX=${ballX.toFixed(0)}, fingerX=${fingerX.toFixed(0)}, startX=${startX.toFixed(0)}, scrollY=${scrollY.toFixed(0)}, activeTarget=${activeTarget}, closestTarget=${closestTargetId || 'none'}`);
  }, []);
  useAnimatedReaction(
    () => ({
      ballX: triageState.ballX.value,
      fingerX: triageState.fingerX.value,
      startX: triageState.startX.value,
      scrollY: triageState.scrollY.value,
      activeTarget: triageState.activeTarget.value,
      closestTarget: triageState.closestTarget.value,
    }),
    (current) => {
      const now = Date.now();
      // Log every 500ms to avoid spam
      if (now - lastLogTimeShared.value > 500) {
        lastLogTimeShared.value = now;
        runOnJS(logPosition)(current.ballX, current.fingerX, current.startX, current.scrollY, current.activeTarget, current.closestTarget?.id ?? null);
      }
    }
  );

  // Logging helpers for worklets
  const logActiveTarget = useCallback((from: string | null, to: string | null, isProcessing: boolean, needsReset: boolean) => {
    console.log(`[Triage:ActiveTarget] changed from ${from ?? 'null'} to ${to}, isProcessing=${isProcessing}, needsReset=${needsReset}`);
  }, []);
  const logTrigger = useCallback((target: string, row: number, ballX: number, scrollY: number) => {
    const targetConfig = TARGETS.find(t => t.id === target);
    const targetX = targetConfig ? CENTER_X + targetConfig.position : 0;
    const { rowHeight, headerOffset, listTopPadding, ballSize } = TRIAGE_CONFIG;
    const halfBall = ballSize / 2;
    // Ball visual position = transform applied to (0,0)
    const ballVisualX = ballX - halfBall; // left edge of ball
    const ballCenterX = ballX; // center of ball
    const ballVisualY = headerOffset + listTopPadding + (row * rowHeight) - scrollY - halfBall;
    console.log(`[Triage:Trigger] target=${target}, row=${row}`);
    console.log(`[Triage:Trigger] Ball: centerX=${ballCenterX.toFixed(0)}, visualLeftEdge=${ballVisualX.toFixed(0)}, visualY=${ballVisualY.toFixed(0)}`);
    console.log(`[Triage:Trigger] Target: expectedCenterX=${targetX}, distance=${Math.abs(ballX - targetX).toFixed(0)}`);
  }, []);

  // Watch for ball activation and trigger triage
  useAnimatedReaction(
    () => ({
      activeTarget: triageState.activeTarget.value,
      isProcessing: triageState.isProcessing.value,
      needsReset: triageState.needsReset.value,
      lastTriggeredTarget: triageState.lastTriggeredTarget.value,
      topRowIndex: triageState.topRowIndex.value,
      ballX: triageState.ballX.value,
      scrollY: triageState.scrollY.value,
    }),
    (current, previous) => {
      // Log state changes
      if (current.activeTarget !== (previous?.activeTarget ?? null)) {
        runOnJS(logActiveTarget)(previous?.activeTarget ?? null, current.activeTarget, current.isProcessing, current.needsReset);
      }

      // Clear lastTriggeredTarget when ball leaves a target (allows re-triggering after moving away)
      if (current.activeTarget === null && current.lastTriggeredTarget !== null) {
        triageState.lastTriggeredTarget.value = null;
      }

      // Trigger when:
      // - Ball is at a target (activeTarget !== null)
      // - Not already processing
      // - Not the same target we just triggered (prevents double-trigger)
      if (
        current.activeTarget !== null &&
        !current.isProcessing &&
        current.activeTarget !== current.lastTriggeredTarget
      ) {
        runOnJS(logTrigger)(current.activeTarget, current.topRowIndex, current.ballX, current.scrollY);
        // Set locks immediately in worklet to prevent cascade
        triageState.isProcessing.value = true;
        triageState.lastTriggeredTarget.value = current.activeTarget;
        runOnJS(handleTargetActivation)(current.topRowIndex, current.activeTarget);
      }
    }
  );

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
    const y = event.nativeEvent.contentOffset.y;
    triageState.scrollY.value = y;
    // Log scroll occasionally
    if (Math.floor(y / 50) !== Math.floor(triageState.scrollY.value / 50)) {
      console.log(`[Triage:Scroll] y=${y.toFixed(0)}`);
    }
  }, [triageState.scrollY]);

  // Use ref to avoid stale closure in gesture handler
  const recordingForRef = useRef<string | null>(null);
  recordingForRef.current = recordingFor;

  // Async handler for stopping recording
  const handleTouchEndWhileRecordingAsync = useCallback(async () => {
    console.log("[Triage:TouchEnd] async handler, recordingFor:", recordingForRef.current);
    if (!recordingForRef.current) return;

    // Find the email being recorded for
    const email = emailsRef.current.find(e => e._id === recordingForRef.current);
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

  // Handle native touch end event (for stopping recording)
  const handleNativeTouchEnd = useCallback(() => {
    console.log("[Triage:NativeTouchEnd] touch ended");
    handleTouchEndWhileRecording();
  }, [handleTouchEndWhileRecording]);

  // On web, use native DOM events for full-frequency pointer tracking
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let lastLogTime = 0;

    const handlePointerDown = (e: PointerEvent) => {
      console.log(`[Triage:PointerDown] clientX=${e.clientX}, clientY=${e.clientY}`);
      triageState.startX.value = e.clientX;
      triageState.fingerX.value = e.clientX;
    };

    const handlePointerMove = (e: PointerEvent) => {
      // Only track if pointer is down (buttons > 0 means pressed)
      if (e.buttons === 0) return;
      triageState.fingerX.value = e.clientX;
      // Log occasionally
      const now = Date.now();
      if (now - lastLogTime > 200) {
        lastLogTime = now;
        console.log(`[Triage:PointerMove] clientX=${e.clientX}`);
      }
    };

    const handlePointerUp = () => {
      // Stop recording if active when pointer lifts
      handleTouchEndWhileRecording();
    };

    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('pointermove', handlePointerMove, { capture: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
    };
  }, [triageState.fingerX, triageState.startX, handleTouchEndWhileRecording]);

  // Native: use gesture handler for touch tracking
  const logTouchDown = useCallback((x: number, y: number) => {
    console.log(`[Triage:TouchDown] absoluteX=${x}, absoluteY=${y}`);
  }, []);

  // Manual gesture for tracking touches (cannot use onTouchesUp/onTouchesCancelled - causes crash)
  const trackingGesture = Gesture.Manual()
    .onTouchesDown((e) => {
      'worklet';
      if (Platform.OS === 'web') return; // Handled by DOM events
      if (e.allTouches.length > 0) {
        const touch = e.allTouches[0];
        runOnJS(logTouchDown)(touch.absoluteX, touch.absoluteY);
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
    <ErrorBoundary>
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
        <Text style={styles.swipeHintText}>Drag ball → Done, Reply, or Mic • Swipe left for TODO</Text>
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
          <Animated.View
            style={{ flex: 1 }}
            onTouchEnd={handleNativeTouchEnd}
          >
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
    </ErrorBoundary>
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
