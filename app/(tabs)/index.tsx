/**
 * Inbox Screen - AI Batch triage interface.
 */
import React, { useCallback, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import { useAction } from "convex/react";
import { useAuth } from "../../lib/authContext";
import { useDemoMode } from "../../lib/demoModeContext";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../convex/_generated/api";
import { useGmail } from "../../hooks/useGmail";
import { useVoiceRecording } from "../../hooks/useDailyVoice";
import { BatchTriageView, VoiceEmailData, BatchTriageViewRef } from "../../components/batch";

import {
  ReplyDraft,
  showAlert,
  ErrorBoundary,
  inboxStyles as styles,
} from "../../components/inbox";

// Sound feedback for mic actions
const useMicSounds = () => {
  const webStartAudioRef = useRef<HTMLAudioElement | null>(null);
  const webStopAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopPlayer = useAudioPlayer(
    Platform.OS !== "web" ? require("../../assets/sounds/micclose.wav") : null
  );

  useEffect(() => {
    if (Platform.OS === "web") {
      webStartAudioRef.current = new window.Audio(require("../../assets/sounds/micopen.wav"));
      webStartAudioRef.current.load();
      webStopAudioRef.current = new window.Audio(require("../../assets/sounds/micclose.wav"));
      webStopAudioRef.current.load();
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
      stopPlayer.seekTo(0);
      stopPlayer.play();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.log("Sound/haptic error:", e);
    }
  }, [stopPlayer]);

  return { playStopSound };
};

export default function InboxScreen() {
  const { refreshAccessToken, signIn } = useAuth();
  const { isDemoMode } = useDemoMode();
  const insets = useSafeAreaInsets();

  // Session state
  const [sessionStart] = useState(() => Date.now());
  const { emails: gmailEmails, isLoading, isSyncing, syncWithGmail, userEmail } = useGmail(sessionStart);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingReplyFor, setSendingReplyFor] = useState<string | null>(null);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [pendingTranscriptFor, setPendingTranscriptFor] = useState<string | null>(null);
  // Store the email being recorded so we don't lose it if it gets triaged during recording
  const [pendingTranscriptEmail, setPendingTranscriptEmail] = useState<VoiceEmailData | null>(null);
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const batchTriageRef = useRef<BatchTriageViewRef>(null);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const {
    startRecording,
    stopRecording,
    cancelRecording,
    transcript,
    isConnected,
  } = useVoiceRecording();

  const { playStopSound } = useMicSounds();
  const sendEmailAction = useAction(api.gmailSend.sendReply);

  // Close any open category when tab is focused (e.g., user taps inbox tab while category is open)
  useFocusEffect(
    useCallback(() => {
      batchTriageRef.current?.closeCategory();
    }, [])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncWithGmail();
    setRefreshing(false);
  }, [syncWithGmail]);

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
      setReplyDraft(null);
      setSendingReplyFor(null);

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

  // Batch mode handlers
  const handleBatchQuickReply = useCallback((emailId: string, reply: { label: string; body: string }) => {
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

    setReplyDraft({ email, body: reply.body, subject });
  }, [gmailEmails]);

  const handleBatchMicPressIn = useCallback((emailId: string, email: VoiceEmailData) => {
    if (recordingFor === emailId) return;

    if (recordingFor && recordingFor !== emailId) {
      cancelRecording();
      setRecordingFor(null);
      setPendingTranscriptFor(null);
      setPendingTranscriptEmail(null);
    }

    if (pendingTranscriptFor && pendingTranscriptFor !== emailId) {
      setPendingTranscriptFor(null);
      setPendingTranscriptEmail(null);
    }

    // Email data is now passed directly from BatchTriageView, avoiding lookup issues
    // when the email gets triaged during recording and disappears from query results
    setRecordingFor(emailId);
    setPendingTranscriptFor(null);
    setPendingTranscriptEmail(email);
    startRecording();
  }, [recordingFor, pendingTranscriptFor, startRecording, cancelRecording]);

  const handleBatchMicPressOut = useCallback(async (emailId: string) => {
    if (recordingFor !== emailId) return;

    playStopSound();
    setPendingTranscriptFor(emailId);
    // Keep pendingTranscriptEmail - it was already set in handleBatchMicPressIn
    setRecordingFor(null);

    const currentTranscript = transcript;
    const finalTranscript = await stopRecording();

    const actualTranscript = (finalTranscript && finalTranscript.trim())
      ? finalTranscript.trim()
      : (currentTranscript && currentTranscript.trim())
        ? currentTranscript.trim()
        : null;

    if (!actualTranscript) {
      showToast("No speech detected", "error");
      setPendingTranscriptFor(null);
      setPendingTranscriptEmail(null);
    }
  }, [recordingFor, transcript, stopRecording, playStopSound, showToast]);

  const handleBatchSendTranscript = useCallback((emailId: string) => {
    // Use the stored email (captured when recording started)
    // This prevents "Email not found" errors if the email was triaged during recording
    if (!pendingTranscriptEmail || pendingTranscriptEmail._id !== emailId) {
      showAlert("Error", "Email not found");
      return;
    }

    if (!transcript || !transcript.trim()) {
      showToast("No transcript to send", "error");
      return;
    }

    const subject = pendingTranscriptEmail.subject.startsWith("Re:")
      ? pendingTranscriptEmail.subject
      : `Re: ${pendingTranscriptEmail.subject}`;

    // Build a minimal email object for ReplyDraft that has what we need
    // The reply modal only uses _id, subject, and fromContact
    const emailForDraft = {
      _id: pendingTranscriptEmail._id,
      subject: pendingTranscriptEmail.subject,
      fromContact: pendingTranscriptEmail.fromContact,
    } as typeof gmailEmails[number];

    setReplyDraft({ email: emailForDraft, body: transcript.trim(), subject });
    setPendingTranscriptFor(null);
    setPendingTranscriptEmail(null);
  }, [pendingTranscriptEmail, gmailEmails, transcript, showToast]);

  // Skip loading screen in demo mode - BatchTriageView will show demo data
  if (!isDemoMode && isLoading && gmailEmails.length === 0) {
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
      <GestureHandlerRootView style={styles.container}>
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

        <BatchTriageView
          ref={batchTriageRef}
          userEmail={userEmail}
          sessionStart={sessionStart}
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

        <TouchableOpacity style={styles.fab} onPress={() => router.push("/compose")}>
          <Text style={styles.fabIcon}>{"\u270f\ufe0f"}</Text>
        </TouchableOpacity>

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

        {toast && (
          <View
            pointerEvents="none"
            style={[
              styles.toast,
              { top: insets.top + 10 },
              toast.type === "success" && styles.toastSuccess,
              toast.type === "error" && styles.toastError,
            ]}
          >
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        )}
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
