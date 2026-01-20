import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  Share,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/authContext";
import { useQuery, useAction, useMutation } from "convex/react";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { api } from "../../convex/_generated/api";
import { useAppLogs, appLogger } from "../../lib/appLogger";
import { useVoiceRecording } from "../../hooks/useDailyVoice";

export default function SettingsScreen() {
  const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
  const [autoProcess, setAutoProcess] = useState(true);
  const [urgencyThreshold, setUrgencyThreshold] = useState(80);
  const [isResummarizing, setIsResummarizing] = useState(false);
  const [isSendingTestNotification, setIsSendingTestNotification] = useState(false);

  const resetAndResummarize = useAction(api.summarizeActions.resetAndResummarizeAll);
  const retryUnprocessed = useAction(api.summarizeActions.retryUnprocessedEmails);
  const sendTestNotification = useMutation(api.notifications.sendMyTestNotificationWithAvatar);
  const sendTestCommunicationNotification = useMutation(api.notifications.sendMyTestCommunicationNotification);
  const sendTestNotificationForRecentEmail = useMutation(api.notifications.sendTestNotificationForRecentEmail);
  const resetAllToUntriaged = useMutation(api.emails.resetMyTriagedEmails);
  const scanExistingEmailsAction = useAction(api.subscriptions.scanMyExistingEmails);
  const [isResettingTriage, setIsResettingTriage] = useState(false);
  const [isRetryingUnprocessed, setIsRetryingUnprocessed] = useState(false);
  const [isSendingCommNotification, setIsSendingCommNotification] = useState(false);
  const [isSendingRecentEmailNotification, setIsSendingRecentEmailNotification] = useState(false);
  const [isScanningSubscriptions, setIsScanningSubscriptions] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<string>("checking...");
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [currentChannel, setCurrentChannel] = useState<string>("checking...");
  const [showLogs, setShowLogs] = useState(false);
  const logs = useAppLogs();

  // Feature request voice recording
  const {
    startRecording: startVoiceRecording,
    stopRecording: stopVoiceRecording,
    cancelRecording: cancelVoiceRecording,
    transcript: voiceTranscript,
    isConnecting: isVoiceConnecting,
    isConnected: isVoiceConnected,
  } = useVoiceRecording();
  const [isRecordingFeature, setIsRecordingFeature] = useState(false);
  const [isSubmittingFeature, setIsSubmittingFeature] = useState(false);
  const submitFeatureRequest = useMutation(api.featureRequests.submit);
  const myFeatureRequests = useQuery(api.featureRequests.getMine);

  const checkForUpdates = async () => {
    if (Platform.OS === "web") return;
    setIsCheckingUpdate(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setUpdateInfo("Update found! Downloading...");
        const result = await Updates.fetchUpdateAsync();
        setUpdateInfo(`Downloaded! Restart to apply. ID: ${result.manifest?.id?.slice(0, 8)}`);
        Alert.alert(
          "Update Ready",
          "Restart the app to apply the update?",
          [
            { text: "Later", style: "cancel" },
            { text: "Restart", onPress: () => Updates.reloadAsync() },
          ]
        );
      } else {
        setUpdateInfo(prev => prev + " (up to date)");
        Alert.alert("Up to Date", "No new updates available.");
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setUpdateInfo(`Error: ${errorMessage}`);
      Alert.alert("Update Error", errorMessage);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  useEffect(() => {
    if (Platform.OS !== "web") {
      // Get commit from update manifest or build constants
      const manifest = Updates.manifest as any;
      const commit = manifest?.extra?.expoClient?.extra?.gitCommit
        || Constants.expoConfig?.extra?.gitCommit
        || "?";
      const info = [
        `${Updates.channel || "no-channel"}`,
        `${Updates.updateId?.slice(0, 8) || "embedded"}`,
        `${commit}`,
      ].join(" | ");
      setUpdateInfo(info);
      setCurrentChannel(Updates.channel || "embedded");
    } else {
      const commit = Constants.expoConfig?.extra?.gitCommit || "?";
      setUpdateInfo(`web | ${commit}`);
      setCurrentChannel("web");
    }
  }, []);

  const openDevMenu = () => {
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "Channel switching is only available in native dev builds");
      return;
    }

    Alert.alert(
      "Switch Update Channel",
      "To load updates from a different channel:\n\n" +
      "1. Open the dev build launcher (shake or Cmd+D → 'Go Home')\n" +
      "2. Go to the 'Extensions' tab at the bottom\n" +
      "3. Log in to your Expo account if needed\n" +
      "4. Tap the branch/update you want to load\n\n" +
      "Available channels:\n• development\n• preview\n• voice-preview\n\n" +
      "Or scan a QR code from the EAS dashboard.",
      [{ text: "OK" }]
    );
  };

  // Check if Gmail is actually connected (has tokens stored)
  const isGmailConnected = useQuery(
    api.gmailOAuth.hasGmailConnected,
    user?.email ? { email: user.email } : "skip"
  );

  const handleResetTriage = async () => {
    setIsResettingTriage(true);
    try {
      const result = await resetAllToUntriaged({});
      const message = `Reset ${result.count} emails to untriaged`;
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Triage Reset", message);
      }
    } catch (e) {
      console.error("Reset triage error:", e);
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      if (Platform.OS === "web") {
        window.alert(`Error: ${errorMsg}`);
      } else {
        Alert.alert("Error", errorMsg);
      }
    } finally {
      setIsResettingTriage(false);
    }
  };

  const handleTestNotification = async (testContactEmail?: string) => {
    setIsSendingTestNotification(true);
    try {
      const result = await sendTestNotification({
        testContactEmail,
      });
      const message = `Test notification sent!\nContact: ${result.contactName}\nAvatar URL: ${result.avatarUrl.substring(0, 80)}...`;
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Test Notification Sent", message);
      }
    } catch (e) {
      console.error("Test notification error:", e);
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      if (Platform.OS === "web") {
        window.alert(`Error: ${errorMsg}`);
      } else {
        Alert.alert("Error", errorMsg);
      }
    } finally {
      setIsSendingTestNotification(false);
    }
  };

  const handleTestCommunicationNotification = async () => {
    setIsSendingCommNotification(true);
    try {
      const result = await sendTestCommunicationNotification({});
      const message = `Communication notification sent!\nStyle: ${result.style}\nContact: ${result.contactName}`;
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Communication Notification Sent", message);
      }
    } catch (e) {
      console.error("Communication notification error:", e);
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      if (Platform.OS === "web") {
        window.alert(`Error: ${errorMsg}`);
      } else {
        Alert.alert("Error", errorMsg);
      }
    } finally {
      setIsSendingCommNotification(false);
    }
  };

  const handleTestRecentEmailNotification = async () => {
    setIsSendingRecentEmailNotification(true);
    try {
      const result = await sendTestNotificationForRecentEmail({});
      const message = `Notification sent!\nEmail: ${result.subject}\nFrom: ${result.senderName}`;
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Test Notification Sent", message);
      }
    } catch (e) {
      console.error("Recent email notification error:", e);
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      if (Platform.OS === "web") {
        window.alert(`Error: ${errorMsg}`);
      } else {
        Alert.alert("Error", errorMsg);
      }
    } finally {
      setIsSendingRecentEmailNotification(false);
    }
  };

  const handleScanSubscriptions = async () => {
    setIsScanningSubscriptions(true);
    try {
      const result = await scanExistingEmailsAction({});
      const message = `Scanned ${result.scanned} emails.\nFound ${result.found} subscription(s).`;
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Subscription Scan Complete", message);
      }
    } catch (e) {
      console.error("Scan subscriptions error:", e);
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      if (Platform.OS === "web") {
        window.alert(`Error: ${errorMsg}`);
      } else {
        Alert.alert("Error", errorMsg);
      }
    } finally {
      setIsScanningSubscriptions(false);
    }
  };

  const handleRetryUnprocessed = async () => {
    if (!user?.email) return;
    setIsRetryingUnprocessed(true);
    try {
      const result = await retryUnprocessed({ userEmail: user.email });
      const message = result.queued > 0
        ? `Queued ${result.queued} emails for processing`
        : "No unprocessed emails found";
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Retry Started", message);
      }
    } catch (e) {
      console.error("Retry unprocessed error:", e);
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      if (Platform.OS === "web") {
        window.alert(`Error: ${errorMsg}`);
      } else {
        Alert.alert("Error", errorMsg);
      }
    } finally {
      setIsRetryingUnprocessed(false);
    }
  };

  const handleResummarize = async () => {
    if (!user?.email) return;

    const doResummarize = async () => {
      setIsResummarizing(true);
      try {
        const result = await resetAndResummarize({ userEmail: user.email! });
        const message = `Deleted ${result.deleted} old summaries.\nQueued ${result.queued} emails for resummarization.`;
        if (Platform.OS === "web") {
          window.alert(message);
        } else {
          Alert.alert("Resummarization Started", message);
        }
      } catch (e) {
        console.error("Resummarize error:", e);
        const errorMsg = e instanceof Error ? e.message : "Unknown error";
        if (Platform.OS === "web") {
          window.alert(`Error: ${errorMsg}`);
        } else {
          Alert.alert("Error", errorMsg);
        }
      } finally {
        setIsResummarizing(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm("This will delete all AI summaries and regenerate them. Continue?");
      if (confirmed) {
        await doResummarize();
      }
    } else {
      Alert.alert(
        "Resummarize All Emails",
        "This will delete all AI summaries and regenerate them. This may take a while and use API credits.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", onPress: doResummarize },
        ]
      );
    }
  };

  const handleFeatureRecordStart = useCallback(async () => {
    setIsRecordingFeature(true);
    await startVoiceRecording();
  }, [startVoiceRecording]);

  const handleFeatureRecordStop = useCallback(async () => {
    const transcript = await stopVoiceRecording();
    setIsRecordingFeature(false);

    if (!transcript || !transcript.trim()) {
      const msg = "No speech detected. Please try again.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Error", msg);
      return;
    }

    // Submit the feature request
    setIsSubmittingFeature(true);
    try {
      await submitFeatureRequest({ transcript: transcript.trim() });
      const msg = `Feature request submitted!\n\n"${transcript.trim()}"`;
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Submitted", msg);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      Platform.OS === "web" ? window.alert(`Error: ${errorMsg}`) : Alert.alert("Error", errorMsg);
    } finally {
      setIsSubmittingFeature(false);
    }
  }, [stopVoiceRecording, submitFeatureRequest]);

  const handleFeatureRecordCancel = useCallback(() => {
    cancelVoiceRecording();
    setIsRecordingFeature(false);
  }, [cancelVoiceRecording]);

  const handleSignOut = async () => {
    const doSignOut = async () => {
      try {
        await signOut();
      } catch (e) {
        console.log("SignOut error:", e);
      }

      // Clear web storage if on web
      if (Platform.OS === "web" && typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
      }

      // Navigate to home/login
      router.replace("/");
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const confirmed = window.confirm("Are you sure you want to sign out?");
      if (confirmed) {
        await doSignOut();
      }
    } else {
      Alert.alert("Sign Out", "Are you sure you want to sign out?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: doSignOut,
        },
      ]);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.signInContainer}>
        <Text style={styles.signInTitle}>Welcome to donewith</Text>
        <Text style={styles.signInSubtitle}>
          Sign in to connect your email and start triaging
        </Text>
        <TouchableOpacity
          style={styles.signInButton}
          onPress={signIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.signInButtonText}>Sign in with Google</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "?"}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email || "User"}
              </Text>
              <Text style={styles.profileEmail}>{user?.email || ""}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Connected Accounts Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Email Access</Text>
        <View style={styles.card}>
          <View style={styles.providerRow}>
            <View style={styles.providerIcon}>
              <Text style={styles.providerIconText}>📧</Text>
            </View>
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>Gmail</Text>
              <Text style={styles.providerEmail}>
                {isGmailConnected === undefined
                  ? "Checking connection..."
                  : isGmailConnected
                    ? user?.email
                    : "Not connected"}
              </Text>
            </View>
            {isGmailConnected === undefined ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : isGmailConnected ? (
              <View style={styles.connectedBadge}>
                <Text style={styles.connectedText}>Connected</Text>
              </View>
            ) : (
              <View style={styles.notConnectedBadge}>
                <Text style={styles.notConnectedText}>Not Connected</Text>
              </View>
            )}
          </View>
          {isGmailConnected === false && (
            <View style={styles.helpText}>
              <Text style={styles.helpTextContent}>
                Gmail access is granted during sign-in. Sign out and sign in
                again, making sure to accept all Gmail permissions when prompted.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Subscriptions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Email Management</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.aboutRow}
            onPress={() => router.push("/subscriptions")}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Manage Subscriptions</Text>
              <Text style={styles.settingDescription}>
                Unsubscribe from newsletters and mailing lists
              </Text>
            </View>
            <Text style={styles.aboutArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* AI Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Settings</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto-process emails</Text>
              <Text style={styles.settingDescription}>
                Automatically summarize and score new emails
              </Text>
            </View>
            <Switch
              value={autoProcess}
              onValueChange={setAutoProcess}
              trackColor={{ true: "#6366F1" }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>
                Urgency notification threshold
              </Text>
              <Text style={styles.settingDescription}>
                Get notified for emails with urgency score above{" "}
                {urgencyThreshold}
              </Text>
            </View>
            <Text style={styles.thresholdValue}>{urgencyThreshold}</Text>
          </View>

          <View style={styles.thresholdButtons}>
            {[50, 65, 80, 95].map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.thresholdButton,
                  urgencyThreshold === value && styles.thresholdButtonActive,
                ]}
                onPress={() => setUrgencyThreshold(value)}
              >
                <Text
                  style={[
                    styles.thresholdButtonText,
                    urgencyThreshold === value &&
                      styles.thresholdButtonTextActive,
                  ]}
                >
                  {value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Debug Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debug</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.aboutRow}
            onPress={handleResetTriage}
            disabled={isResettingTriage}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Reset All Emails to Untriaged</Text>
              <Text style={styles.settingDescription}>
                Mark all emails as untriaged so they appear in inbox
              </Text>
            </View>
            {isResettingTriage ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <Text style={styles.aboutArrow}>→</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.aboutRow}
            onPress={handleScanSubscriptions}
            disabled={isScanningSubscriptions}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Scan for Subscriptions</Text>
              <Text style={styles.settingDescription}>
                Find unsubscribe links in existing emails
              </Text>
            </View>
            {isScanningSubscriptions ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <Text style={styles.aboutArrow}>→</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.aboutRow}
            onPress={handleRetryUnprocessed}
            disabled={isRetryingUnprocessed}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Retry Failed Summaries</Text>
              <Text style={styles.settingDescription}>
                Reprocess emails that failed AI summarization
              </Text>
            </View>
            {isRetryingUnprocessed ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <Text style={styles.aboutArrow}>→</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.aboutRow}
            onPress={handleResummarize}
            disabled={isResummarizing}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Resummarize All Emails</Text>
              <Text style={styles.settingDescription}>
                Delete all AI summaries and regenerate them
              </Text>
            </View>
            {isResummarizing ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <Text style={styles.aboutArrow}>→</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.aboutRow}
            onPress={() => handleTestNotification()}
            disabled={isSendingTestNotification}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Test Notification (Generic)</Text>
              <Text style={styles.settingDescription}>
                Send a test notification with a generated avatar
              </Text>
            </View>
            {isSendingTestNotification ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <Text style={styles.aboutArrow}>→</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.aboutRow}
            onPress={() => handleTestNotification("seth@magicseth.com")}
            disabled={isSendingTestNotification}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Test Notification (seth@magicseth.com)</Text>
              <Text style={styles.settingDescription}>
                Send a test notification using a real contact's avatar
              </Text>
            </View>
            {isSendingTestNotification ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <Text style={styles.aboutArrow}>→</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.aboutRow}
            onPress={handleTestCommunicationNotification}
            disabled={isSendingCommNotification}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Test Communication Notification</Text>
              <Text style={styles.settingDescription}>
                Test circular avatar on left (iOS 15+ feature)
              </Text>
            </View>
            {isSendingCommNotification ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <Text style={styles.aboutArrow}>→</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.aboutRow}
            onPress={handleTestRecentEmailNotification}
            disabled={isSendingRecentEmailNotification}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Test Deep Link Notification</Text>
              <Text style={styles.settingDescription}>
                Send notification for most recent email to test navigation
              </Text>
            </View>
            {isSendingRecentEmailNotification ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <Text style={styles.aboutArrow}>→</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.aboutRow}
            onPress={checkForUpdates}
            disabled={isCheckingUpdate || Platform.OS === "web"}
          >
            <Text style={[styles.aboutLabel, { fontSize: 12 }]}>Update</Text>
            <Text style={[styles.aboutValue, { fontSize: 10 }]}>
              {isCheckingUpdate ? "Checking..." : updateInfo}
            </Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.aboutRow}
            onPress={openDevMenu}
            disabled={Platform.OS === "web"}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Switch Channel</Text>
              <Text style={styles.settingDescription}>
                Current: {currentChannel}
              </Text>
            </View>
            <Text style={styles.aboutArrow}>→</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Privacy Policy</Text>
            <Text style={styles.aboutArrow}>→</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Terms of Service</Text>
            <Text style={styles.aboutArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Debug Logs */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => setShowLogs(!showLogs)}
        >
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Debug Logs ({logs.length})</Text>
            <Text style={styles.aboutArrow}>{showLogs ? "▼" : "→"}</Text>
          </View>
        </TouchableOpacity>
        {showLogs && (
          <View style={[styles.card, { marginTop: 8 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 8, borderBottomWidth: 1, borderBottomColor: "#eee" }}>
              <TouchableOpacity onPress={() => appLogger.clear()}>
                <Text style={{ color: "#6366F1", fontSize: 14 }}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={async () => {
                const logText = logs.map(l =>
                  `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.level.toUpperCase()}: ${l.message}`
                ).join("\n");
                if (Platform.OS === "web") {
                  navigator.clipboard?.writeText(logText);
                  alert("Copied to clipboard");
                } else {
                  await Share.share({ message: logText });
                }
              }}>
                <Text style={{ color: "#6366F1", fontSize: 14 }}>Share</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300, padding: 8 }} nestedScrollEnabled>
              {logs.length === 0 ? (
                <Text style={{ color: "#999", fontStyle: "italic" }}>No logs yet</Text>
              ) : (
                logs.slice().reverse().map((log, i) => (
                  <Text
                    key={i}
                    style={{
                      fontSize: 11,
                      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                      color: log.level === "error" ? "#FF4444" : log.level === "warn" ? "#FFA500" : "#333",
                      marginBottom: 4,
                    }}
                  >
                    {new Date(log.timestamp).toLocaleTimeString()}: {log.message}
                  </Text>
                ))
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Add Feature Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Developer</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Add Feature</Text>
              <Text style={styles.settingDescription}>
                {isRecordingFeature
                  ? voiceTranscript || (isVoiceConnected ? "Listening..." : "Connecting...")
                  : "Press and hold to describe a feature"}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.recordButton,
                isRecordingFeature && styles.recordButtonActive,
                isSubmittingFeature && styles.recordButtonDisabled,
              ]}
              onPressIn={handleFeatureRecordStart}
              onPressOut={handleFeatureRecordStop}
              disabled={isSubmittingFeature}
            >
              {isSubmittingFeature ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.recordButtonText}>
                  {isRecordingFeature ? "🎙️" : "🎤"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Show recent feature requests */}
          {myFeatureRequests && myFeatureRequests.length > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.featureRequestsContainer}>
                <Text style={styles.featureRequestsTitle}>Recent Requests</Text>
                {myFeatureRequests.slice(0, 3).map((req) => (
                  <View key={req._id} style={styles.featureRequestRow}>
                    <View style={[
                      styles.featureRequestStatus,
                      req.status === "completed" && styles.featureRequestStatusCompleted,
                      req.status === "processing" && styles.featureRequestStatusProcessing,
                      req.status === "failed" && styles.featureRequestStatusFailed,
                    ]} />
                    <Text style={styles.featureRequestText} numberOfLines={2}>
                      {req.transcript}
                    </Text>
                    <Text style={styles.featureRequestStatusText}>
                      {req.status}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </View>

      {/* Sign Out */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  profileEmail: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  providerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  providerIconText: {
    fontSize: 20,
  },
  providerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  providerName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  providerEmail: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  connectedBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  connectedText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  notConnectedBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  notConnectedText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
  },
  helpText: {
    padding: 16,
    paddingTop: 0,
  },
  helpTextContent: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  settingDescription: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginLeft: 16,
  },
  thresholdValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6366F1",
  },
  thresholdButtons: {
    flexDirection: "row",
    padding: 16,
    paddingTop: 0,
    gap: 8,
  },
  thresholdButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
  },
  thresholdButtonActive: {
    backgroundColor: "#6366F1",
  },
  thresholdButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  thresholdButtonTextActive: {
    color: "#fff",
  },
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  aboutLabel: {
    flex: 1,
    fontSize: 16,
    color: "#1a1a1a",
  },
  aboutValue: {
    fontSize: 16,
    color: "#666",
  },
  aboutArrow: {
    fontSize: 16,
    color: "#999",
  },
  signOutButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  signOutText: {
    color: "#FF4444",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomPadding: {
    height: 40,
  },
  signInContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    backgroundColor: "#F5F5F5",
  },
  signInTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  signInSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  signInButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: "center",
  },
  signInButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  // Add Feature styles
  recordButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  recordButtonActive: {
    backgroundColor: "#DC2626",
    transform: [{ scale: 1.1 }],
  },
  recordButtonDisabled: {
    opacity: 0.6,
  },
  recordButtonText: {
    fontSize: 20,
  },
  featureRequestsContainer: {
    padding: 16,
  },
  featureRequestsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  featureRequestRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  featureRequestStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFA500",
    marginRight: 8,
  },
  featureRequestStatusCompleted: {
    backgroundColor: "#10B981",
  },
  featureRequestStatusProcessing: {
    backgroundColor: "#6366F1",
  },
  featureRequestStatusFailed: {
    backgroundColor: "#EF4444",
  },
  featureRequestText: {
    flex: 1,
    fontSize: 13,
    color: "#333",
  },
  featureRequestStatusText: {
    fontSize: 11,
    color: "#999",
    marginLeft: 8,
  },
});
