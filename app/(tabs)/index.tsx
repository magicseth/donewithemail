/**
 * Inbox Screen - Main email triage interface.
 *
 * Components extracted to ./inbox/:
 * - types.ts: InboxEmail, ReplyDraft, TRIAGE_CONFIG
 * - utils.ts: toInboxEmail, getInitials, decodeHtmlEntities, formatTimeAgo, formatEventTime, showAlert
 * - ErrorBoundary.tsx: Error boundary component
 * - EmailRow.tsx: Memoized email row component
 * - TriageListWrapper.tsx: FlatList wrapper with triage gestures
 * - styles.ts: Shared styles
 */
import React, { useCallback, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  UIManager,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import { useAction, useQuery, useMutation } from "convex/react";
import { isAuthError, useAuthError } from "../../lib/AuthErrorBoundary";
import { useAuth } from "../../lib/authContext";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Dimensions } from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CENTER_X = SCREEN_WIDTH / 2;

import { api } from "../../convex/_generated/api";
import { useGmail, GmailEmail, QuickReply, CalendarEvent } from "../../hooks/useGmail";
import { useVoiceRecording } from "../../hooks/useDailyVoice";
import { Id } from "../../convex/_generated/dataModel";
import { BatchTriageView } from "../../components/batch";

// Triage module
import {
  TriageProvider,
  TriageOverlay as NewTriageOverlay,
  type TriageTargetId,
  type TriageableEmail,
  type TriageControlRef,
} from "../../components/triage";

// Extracted inbox modules
import {
  InboxEmail,
  ReplyDraft,
  InboxMode,
  TRIAGE_CONFIG,
  toInboxEmail,
  showAlert,
  ErrorBoundary,
  EmailRow,
  TriageListWrapper,
  inboxStyles as styles,
} from "./inbox";

// Module-level email storage - NOT captured by worklet serialization
// This is updated by the component and read by handlers called via runOnJS
let moduleEmails: InboxEmail[] = [];

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
      // On native, only use haptic feedback - playing audio interrupts LiveAudioStream recording
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      console.log("Haptic error:", e);
    }
  }, []);

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

export default function InboxScreen() {
  // ============================================================================
  // AUTH ERROR HANDLING
  // ============================================================================
  const { reportAuthError } = useAuthError();
  const { refreshAccessToken, signIn } = useAuth();

  // ============================================================================
  // INBOX MODE STATE
  // ============================================================================
  const [inboxMode, setInboxMode] = useState<InboxMode>("batch");

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

  // Handle mic press in from batch mode - start recording
  const handleBatchMicPressIn = useCallback((emailId: string) => {
    console.log(`[Mic] handleBatchMicPressIn called for ${emailId}, recordingFor=${recordingFor}`);

    // Already recording for this email - ignore duplicate
    if (recordingFor === emailId) {
      console.log(`[Mic] Already recording for this email - ignoring duplicate`);
      return;
    }

    // If recording for a different email, cancel that first
    if (recordingFor && recordingFor !== emailId) {
      console.log(`[Mic] Switching from ${recordingFor} to ${emailId}`);
      cancelRecording();
      setRecordingFor(null);
      setPendingTranscriptFor(null);
    }

    // Clear any pending transcript from a different email
    if (pendingTranscriptFor && pendingTranscriptFor !== emailId) {
      setPendingTranscriptFor(null);
    }

    // Start recording for this email (sound plays when isConnected becomes true)
    console.log(`[Mic] Starting recording for ${emailId}`);
    setRecordingFor(emailId);
    setPendingTranscriptFor(null); // Clear pending while recording
    startRecording();
  }, [recordingFor, pendingTranscriptFor, startRecording, cancelRecording]);

  // Handle mic press out from batch mode - stop recording
  const handleBatchMicPressOut = useCallback(async (emailId: string) => {
    console.log(`[Mic] handleBatchMicPressOut called for ${emailId}, recordingFor=${recordingFor}`);
    if (recordingFor !== emailId) {
      console.log(`[Mic] Ignoring - not recording for this email`);
      return;
    }

    // Play stop sound immediately on touch up (before async operations)
    console.log(`[Mic] Stopping recording for ${emailId}`);
    playStopSound();

    // Set pending immediately so transcript stays visible during processing
    setPendingTranscriptFor(emailId);
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

    if (!actualTranscript) {
      showToast("No speech detected", "error");
      setPendingTranscriptFor(null);
    }
    // If we have a transcript, pendingTranscriptFor is already set
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
        <TouchableOpacity
          style={{ backgroundColor: "#6366F1", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 20 }}
          onPress={refreshAccessToken}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Refresh Token</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ backgroundColor: "#10B981", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 12 }}
          onPress={signIn}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Sign In</Text>
        </TouchableOpacity>
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
      </View>

      {/* Swipe hint at top - only show in swipe mode */}
      {inboxMode === "swipe" && (
      <View style={styles.swipeHintContainer}>
        <Text style={styles.swipeHintText}>Drag ball to Done, Reply, or Mic - Swipe left for TODO</Text>
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
                <Text style={styles.searchClearText}>{"\u2715"}</Text>
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
          isRecordingConnected={isConnected}
          pendingTranscriptForId={pendingTranscriptFor}
          transcript={transcript}
        />
      )}

      {/* Compose FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push("/compose")}>
        <Text style={styles.fabIcon}>{"\u270f\ufe0f"}</Text>
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
