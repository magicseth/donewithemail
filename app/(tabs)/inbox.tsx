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
  ViewToken,
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
} from "react-native-reanimated";
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
}

const EmailRow = React.memo(function EmailRow({
  item,
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
    <SwipeableEmailRow
      onSwipeLeft={handleSwipeLeft}
      disabled={isSending || isRecording}
    >
      <TouchableOpacity
        style={[
          styles.emailItem,
          !item.isRead && styles.emailItemUnread,
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
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
  );
});

export default function InboxScreen() {
  // Session start time - emails triaged after this will still be shown
  // Reset when tab is focused to clear triaged items
  const [sessionStart, setSessionStart] = useState(() => Date.now());

  const { emails: gmailEmails, isLoading, isSyncing, isSummarizing, hasMore, syncWithGmail, loadMore, userEmail } = useGmail(sessionStart);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingReplyFor, setSendingReplyFor] = useState<string | null>(null);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [addingCalendarFor, setAddingCalendarFor] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Triage state for optimistic updates (no longer needed for display, but keeps UI responsive)
  const [triagedIds, setTriagedIds] = useState<Set<string>>(new Set());
  const triageEmail = useMutation(api.emails.triageEmail);

  // Track previously visible items for auto-triage
  const previouslyVisibleRef = useRef<Set<string>>(new Set());
  const scrolledPastTopRef = useRef<Set<string>>(new Set());
  const scrollDirectionRef = useRef<"up" | "down" | null>(null);
  const lastScrollOffsetRef = useRef<number>(0);
  const flatListRef = useRef<FlatList>(null);

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
      setTriagedIds(new Set());
      scrolledPastTopRef.current = new Set();
      previouslyVisibleRef.current = new Set();
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

  // Don't filter by triagedIds - the server query handles this via sessionStart
  // Recently triaged items will stay visible until tab switch
  const emails = displayEmails;
  const isRecording = isConnecting || isConnected;

  // Handle swipe left to mark as TODO
  const handleSwipeToTodo = useCallback(async (email: InboxEmail) => {
    // Optimistically update UI
    setTriagedIds((prev) => new Set(prev).add(email._id));

    try {
      await triageEmail({
        emailId: email._id as Id<"emails">,
        action: "reply_needed",
      });
    } catch (error) {
      console.error("Failed to triage email:", error);
      // Revert on error
      setTriagedIds((prev) => {
        const next = new Set(prev);
        next.delete(email._id);
        return next;
      });
    }
  }, [triageEmail]);

  // Handle auto-triage when items scroll off the top
  const handleAutoTriage = useCallback(async (emailId: string) => {
    // Find the email to get its subject for logging
    const email = emails.find(e => e._id === emailId);
    const subject = email?.subject || "Unknown";

    console.log(`[AutoTriage] Called for: "${subject}" (${emailId})`);

    // Skip if already triaged
    if (triagedIds.has(emailId) || scrolledPastTopRef.current.has(emailId)) {
      console.log(`[AutoTriage] Skipping - already triaged: "${subject}"`);
      return;
    }

    // Haptic feedback for auto-triage
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Mark as scrolled past to prevent duplicate calls
    scrolledPastTopRef.current.add(emailId);
    setTriagedIds((prev) => new Set(prev).add(emailId));

    console.log(`[AutoTriage] Triaging to 'done': "${subject}"`);
    try {
      await triageEmail({
        emailId: emailId as Id<"emails">,
        action: "done",
      });
      console.log(`[AutoTriage] Success: "${subject}"`);
    } catch (error) {
      console.error(`[AutoTriage] Failed: "${subject}"`, error);
      // Revert on error
      scrolledPastTopRef.current.delete(emailId);
      setTriagedIds((prev) => {
        const next = new Set(prev);
        next.delete(emailId);
        return next;
      });
    }
  }, [triageEmail, triagedIds, emails]);

  // Track viewable items for auto-triage
  // Lower thresholds to catch fast scrolling
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 10, // Just needs to peek into view
    minimumViewTime: 0, // No minimum time - immediate detection
  }).current;

  // Use ref-based callback to avoid FlatList error about changing onViewableItemsChanged
  const handleAutoTriageRef = useRef(handleAutoTriage);
  handleAutoTriageRef.current = handleAutoTriage;

  // Track the current email IDs for filtering out reactively-removed items
  const emailIdsRef = useRef<Set<string>>(new Set());
  emailIdsRef.current = new Set(emails.map((e) => e._id));

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const currentlyVisible = new Set(viewableItems.map((item) => item.key as string));

    // Find items that were previously visible but are no longer visible
    // AND are still in the data (not reactively removed by Convex)
    const itemsLeft = Array.from(previouslyVisibleRef.current).filter(
      (id) => !currentlyVisible.has(id) && emailIdsRef.current.has(id)
    );

    // If we're scrolling DOWN and items left visibility, they scrolled off the top
    if (scrollDirectionRef.current === "down" && itemsLeft.length > 0) {
      for (const id of itemsLeft) {
        console.log("[Viewability] Item scrolled off top:", id);
        handleAutoTriageRef.current(id);
      }
    }

    // Update the set of visible items
    previouslyVisibleRef.current = currentlyVisible;
  }).current;

  // Track scroll direction
  const handleScroll = useCallback((event: any) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    const previousOffset = lastScrollOffsetRef.current;

    if (currentOffset > previousOffset + 5) {
      scrollDirectionRef.current = "down";
    } else if (currentOffset < previousOffset - 5) {
      scrollDirectionRef.current = "up";
    }
    // Small threshold to avoid noise

    lastScrollOffsetRef.current = currentOffset;
  }, []);

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
  const renderEmailItem = useCallback(({ item }: { item: InboxEmail }) => (
    <EmailRow
      item={item}
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
    />
  ), [handleSwipeToTodo, handleQuickReply, handleMicPressIn, handleMicPressOut, handleAddToCalendar, sendingReplyFor, recordingFor, addingCalendarFor, isRecording, transcript]);

  if (isLoading && emails.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
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

      {/* Swipe hint at top */}
      <View style={styles.swipeHintContainer}>
        <Text style={styles.swipeHintText}>← Swipe left to mark as TODO</Text>
        <Text style={styles.swipeHintSubtext}>Emails mark as done when scrolled off top</Text>
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

      <FlatList
        ref={flatListRef}
        data={emails}
        keyExtractor={(item) => item._id}
        renderItem={renderEmailItem}
        extraData={{ transcript, recordingFor, triagedIds }}
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
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
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
    paddingBottom: 100,
  },
  emailItem: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  emailItemUnread: {
    backgroundColor: "#F8F9FF",
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
