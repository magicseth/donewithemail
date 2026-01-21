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
  Modal,
  Animated,
  Dimensions,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/authContext";
import { useDemoMode } from "../../lib/demoModeContext";
import { useQuery, useAction, useMutation } from "convex/react";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { api } from "../../convex/_generated/api";
import { useAppLogs, appLogger } from "../../lib/appLogger";
import { VoiceRecordButton } from "../../components/VoiceRecordButton";

export default function SettingsScreen() {
  const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
  const { isDemoMode, enterDemoMode, exitDemoMode } = useDemoMode();
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

  // Feature request
  const [isSubmittingFeature, setIsSubmittingFeature] = useState(false);
  const [featureTranscript, setFeatureTranscript] = useState<string | null>(null);
  const [streamingTranscript, setStreamingTranscript] = useState<string | null>(null);
  const [isRecordingFeature, setIsRecordingFeature] = useState(false);
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
  const [showFeatureConfirmModal, setShowFeatureConfirmModal] = useState(false);
  const [pendingTranscript, setPendingTranscript] = useState<string | null>(null);
  const [includeDebugLogs, setIncludeDebugLogs] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [selectedErrorRequest, setSelectedErrorRequest] = useState<{
    transcript: string;
    error: string;
    claudeOutput?: string;
  } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedSuccessRequest, setSelectedSuccessRequest] = useState<{
    transcript: string;
    claudeOutput?: string;
    commitHash?: string;
    branchName?: string;
    easUpdateId?: string;
    easDashboardUrl?: string;
    progressMessage?: string;
  } | null>(null);
  const submitFeatureRequest = useMutation(api.featureRequests.submit);
  const cancelFeatureRequest = useMutation(api.featureRequests.cancel);
  const myFeatureRequests = useQuery(api.featureRequests.getMine);
  const myCosts = useQuery(api.costs.getMyTotalCosts);

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

  // IMAP accounts
  const [imapAccounts, setImapAccounts] = useState<Array<{ email: string; host?: string; port?: number }>>([]);
  const [isLoadingImapAccounts, setIsLoadingImapAccounts] = useState(false);
  const [hasLoadedImapAccounts, setHasLoadedImapAccounts] = useState(false);
  const listImapAccounts = useMutation(api.imapAuth.listImapAccounts);
  const removeImapAccount = useMutation(api.imapAuth.removeImapAccount);

  // Load IMAP accounts on mount
  useEffect(() => {
    if (!isDemoMode && user && !hasLoadedImapAccounts) {
      setIsLoadingImapAccounts(true);
      listImapAccounts()
        .then((accounts) => {
          setImapAccounts(accounts);
          setHasLoadedImapAccounts(true);
        })
        .catch(console.error)
        .finally(() => setIsLoadingImapAccounts(false));
    }
  }, [isDemoMode, user, hasLoadedImapAccounts]);

  const handleRemoveImap = async (email: string) => {
    const doRemove = async () => {
      try {
        await removeImapAccount({ email });
        // Reload accounts by fetching again
        setIsLoadingImapAccounts(true);
        const accounts = await listImapAccounts();
        setImapAccounts(accounts);
      } catch (error) {
        console.error("Remove IMAP error:", error);
      } finally {
        setIsLoadingImapAccounts(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(`Remove IMAP account ${email}?`);
      if (confirmed) {
        await doRemove();
      }
    } else {
      Alert.alert(
        "Remove IMAP Account",
        `Remove ${email}?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: doRemove },
        ]
      );
    }
  };

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

  const handleFeatureTranscript = useCallback((transcript: string) => {
    setFeatureTranscript(transcript);
    setPendingTranscript(transcript);
    setIncludeDebugLogs(false);
    setShowFeatureConfirmModal(true);
  }, []);

  const handleConfirmFeatureSubmit = useCallback(async () => {
    if (!pendingTranscript) return;

    setShowFeatureConfirmModal(false);
    setIsSubmittingFeature(true);

    try {
      let debugLogsStr: string | undefined;
      if (includeDebugLogs) {
        const currentLogs = logs.map(l =>
          `[${new Date(l.timestamp).toISOString()}] ${l.level.toUpperCase()}: ${l.message}`
        ).join("\n");
        debugLogsStr = currentLogs || undefined;
      }

      await submitFeatureRequest({
        transcript: pendingTranscript,
        debugLogs: debugLogsStr,
      });
      const msg = `Feature request submitted!\n\n"${pendingTranscript}"`;
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Submitted", msg);
      setFeatureTranscript(null);
      setPendingTranscript(null);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      Platform.OS === "web" ? window.alert(`Error: ${errorMsg}`) : Alert.alert("Error", errorMsg);
    } finally {
      setIsSubmittingFeature(false);
    }
  }, [pendingTranscript, includeDebugLogs, logs, submitFeatureRequest]);

  const handleCancelFeatureConfirm = useCallback(() => {
    setShowFeatureConfirmModal(false);
    setFeatureTranscript(null);
    setPendingTranscript(null);
    setIncludeDebugLogs(false);
  }, []);

  const handleFeatureError = useCallback((error: string) => {
    setIsRecordingFeature(false);
    setStreamingTranscript(null);
    Platform.OS === "web" ? window.alert(error) : Alert.alert("Error", error);
  }, []);

  const handleFeatureStreamingTranscript = useCallback((transcript: string) => {
    setStreamingTranscript(transcript);
  }, []);

  const handleFeatureRecordingStart = useCallback(() => {
    setIsRecordingFeature(true);
    setStreamingTranscript(null);
    setFeatureTranscript(null);
  }, []);

  const handleFeatureRecordingEnd = useCallback(() => {
    setIsRecordingFeature(false);
  }, []);

  const handleCancelFeatureRequest = useCallback(async (requestId: string) => {
    const doCancel = async () => {
      setCancellingRequestId(requestId);
      try {
        await cancelFeatureRequest({ id: requestId as any });
        const msg = "Feature request cancelled";
        Platform.OS === "web" ? window.alert(msg) : Alert.alert("Cancelled", msg);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "Unknown error";
        Platform.OS === "web" ? window.alert(`Error: ${errorMsg}`) : Alert.alert("Error", errorMsg);
      } finally {
        setCancellingRequestId(null);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm("Cancel this feature request?");
      if (confirmed) {
        await doCancel();
      }
    } else {
      Alert.alert(
        "Cancel Feature Request",
        "Are you sure you want to cancel this request?",
        [
          { text: "No", style: "cancel" },
          { text: "Yes, Cancel", style: "destructive", onPress: doCancel },
        ]
      );
    }
  }, [cancelFeatureRequest]);

  const handleShowErrorDetails = useCallback((
    transcript: string,
    error: string,
    claudeOutput?: string
  ) => {
    setSelectedErrorRequest({ transcript, error, claudeOutput });
    setShowErrorModal(true);
  }, []);

  const handleCloseErrorModal = useCallback(() => {
    setShowErrorModal(false);
    setSelectedErrorRequest(null);
  }, []);

  const handleShowSuccessDetails = useCallback((
    transcript: string,
    claudeOutput?: string,
    commitHash?: string,
    branchName?: string,
    easUpdateId?: string,
    easDashboardUrl?: string,
    progressMessage?: string
  ) => {
    setSelectedSuccessRequest({
      transcript,
      claudeOutput,
      commitHash,
      branchName,
      easUpdateId,
      easDashboardUrl,
      progressMessage
    });
    setShowSuccessModal(true);
  }, []);

  const handleCloseSuccessModal = useCallback(() => {
    setShowSuccessModal(false);
    setSelectedSuccessRequest(null);
  }, []);

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

  // Animation values for sign-in page
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [scaleAnim] = useState(new Animated.Value(0.9));

  useEffect(() => {
    if (!isAuthenticated) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated && !isDemoMode) {
    const { width, height } = Dimensions.get("window");

    return (
      <View style={styles.signInContainer}>
        {/* Gradient Background Effect */}
        <View style={styles.gradientBackground}>
          <View style={[styles.gradientCircle, styles.gradientCircle1]} />
          <View style={[styles.gradientCircle, styles.gradientCircle2]} />
          <View style={[styles.gradientCircle, styles.gradientCircle3]} />
        </View>

        <Animated.View
          style={[
            styles.signInContent,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {/* App Icon */}
          <View style={styles.appIcon}>
            <Text style={styles.appIconText}>✓</Text>
          </View>

          {/* Title */}
          <Text style={styles.signInTitle}>Welcome to donewith</Text>

          {/* Subtitle */}
          <Text style={styles.signInSubtitle}>
            AI-powered email triage that helps you focus on what matters
          </Text>

          {/* Features List */}
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>⚡</Text>
              </View>
              <Text style={styles.featureText}>Smart AI summarization</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>👆</Text>
              </View>
              <Text style={styles.featureText}>Swipe to triage</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>🔔</Text>
              </View>
              <Text style={styles.featureText}>Smart notifications</Text>
            </View>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.signInButton, isLoading && styles.signInButtonDisabled]}
            onPress={signIn}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.signInButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Try Demo Button */}
          <TouchableOpacity
            style={styles.demoButton}
            onPress={() => {
              enterDemoMode();
              router.replace("/(tabs)");
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.demoButtonText}>Try Demo</Text>
          </TouchableOpacity>

          {/* Privacy Notice */}
          <Text style={styles.privacyText}>
            By signing in, you agree to our Terms of Service and Privacy Policy
          </Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <View style={styles.section}>
          <View style={styles.demoBanner}>
            <Text style={styles.demoBannerTitle}>🎭 Demo Mode</Text>
            <Text style={styles.demoBannerText}>
              You're exploring with sample data. Sign in to use your real Gmail account.
            </Text>
            <TouchableOpacity
              style={styles.exitDemoButton}
              onPress={() => {
                exitDemoMode();
                router.replace("/(tabs)/settings");
              }}
            >
              <Text style={styles.exitDemoButtonText}>Exit Demo & Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Account Section */}
      {!isDemoMode && (
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
      )}

      {/* Connected Accounts Section */}
      {!isDemoMode && (
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

          {/* IMAP Accounts */}
          {imapAccounts.map((account, index) => (
            <View key={account.email}>
              <View style={styles.divider} />
              <View style={styles.providerRow}>
                <View style={styles.providerIcon}>
                  <Text style={styles.providerIconText}>📨</Text>
                </View>
                <View style={styles.providerInfo}>
                  <Text style={styles.providerName}>IMAP</Text>
                  <Text style={styles.providerEmail}>
                    {account.email}
                  </Text>
                  {account.host && (
                    <Text style={styles.providerDetail}>
                      {account.host}:{account.port}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveImap(account.email)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Add IMAP Account Button */}
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.addAccountButton}
            onPress={() => router.push("/add-imap")}
          >
            <Text style={styles.addAccountButtonText}>+ Add IMAP Account</Text>
          </TouchableOpacity>
        </View>
      </View>
      )}

      {/* Subscriptions Section */}
      {!isDemoMode && (
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
      )}

      {/* AI Usage & Costs Section */}
      {!isDemoMode && myCosts && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Usage</Text>
          <View style={styles.card}>
            <View style={styles.costRow}>
              <View style={styles.costItem}>
                <Text style={styles.costLabel}>AI Summarization</Text>
                <Text style={styles.costValue}>
                  {myCosts.aiCosts?.totalRawCost != null ? `$${myCosts.aiCosts.totalRawCost.toFixed(4)}` : "$0.00"}
                </Text>
                <Text style={styles.costCount}>
                  {myCosts.aiCosts?.count ?? 0} calls
                </Text>
              </View>
              <View style={styles.costDivider} />
              <View style={styles.costItem}>
                <Text style={styles.costLabel}>Embeddings</Text>
                <Text style={styles.costValue}>
                  {myCosts.toolCosts?.totalRawCost != null ? `$${myCosts.toolCosts.totalRawCost.toFixed(4)}` : "$0.00"}
                </Text>
                <Text style={styles.costCount}>
                  {myCosts.toolCosts?.count ?? 0} calls
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalCostRow}>
              <Text style={styles.totalCostLabel}>Total AI Cost</Text>
              <Text style={styles.totalCostValue}>
                ${myCosts.totalCost != null ? myCosts.totalCost.toFixed(4) : "0.0000"}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* AI Settings Section */}
      {!isDemoMode && (
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
      )}

      {/* Debug Section */}
      {!isDemoMode && (
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
      )}

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
      {!isDemoMode && (
        <View style={styles.section}>
        <Text style={styles.sectionTitle}>Developer</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Add Feature</Text>
              <Text style={[
                styles.settingDescription,
                isRecordingFeature && streamingTranscript && styles.streamingTranscript
              ]}>
                {isSubmittingFeature
                  ? "Submitting..."
                  : isRecordingFeature
                    ? (streamingTranscript || "Listening...")
                    : featureTranscript
                      ? featureTranscript
                      : "Press and hold to describe a feature"}
              </Text>
            </View>
            <VoiceRecordButton
              onTranscript={handleFeatureTranscript}
              onStreamingTranscript={handleFeatureStreamingTranscript}
              onRecordingStart={handleFeatureRecordingStart}
              onRecordingEnd={handleFeatureRecordingEnd}
              onError={handleFeatureError}
              disabled={isSubmittingFeature}
              size="medium"
            />
          </View>

          {/* Show recent feature requests */}
          {myFeatureRequests && myFeatureRequests.length > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.featureRequestsContainer}>
                <Text style={styles.featureRequestsTitle}>Recent Requests</Text>
                {myFeatureRequests.map((req: any) => {
                  const isFailed = req.status === "failed";
                  const isCompleted = req.status === "completed";
                  const isClickable = isFailed || isCompleted;
                  const RowWrapper = isClickable ? TouchableOpacity : View;

                  return (
                    <RowWrapper
                      key={req._id}
                      style={styles.featureRequestRow}
                      {...(isClickable ? {
                        onPress: () => {
                          if (isFailed) {
                            handleShowErrorDetails(
                              req.transcript,
                              req.error || "Unknown error",
                              req.claudeOutput
                            );
                          } else if (isCompleted) {
                            handleShowSuccessDetails(
                              req.transcript,
                              req.claudeOutput,
                              req.commitHash,
                              req.branchName,
                              req.easUpdateId,
                              req.easDashboardUrl,
                              req.progressMessage
                            );
                          }
                        },
                        activeOpacity: 0.7
                      } : {})}
                    >
                      <View style={[
                        styles.featureRequestStatus,
                        req.status === "completed" && styles.featureRequestStatusCompleted,
                        req.status === "processing" && styles.featureRequestStatusProcessing,
                        req.status === "failed" && styles.featureRequestStatusFailed,
                      ]} />
                      <View style={styles.featureRequestContent}>
                        <Text style={styles.featureRequestText} numberOfLines={2}>
                          {req.transcript}
                        </Text>
                        {req.status === "processing" && req.progressMessage && (
                          <Text style={styles.featureRequestProgress}>
                            {req.progressMessage}
                          </Text>
                        )}
                        {req.status === "completed" && req.easDashboardUrl && (
                          <Text style={styles.featureRequestReady}>
                            Ready to test in voice-preview • Tap for details
                          </Text>
                        )}
                        {req.status === "failed" && req.error && (
                          <Text style={styles.featureRequestError} numberOfLines={1}>
                            {req.error} • Tap for details
                          </Text>
                        )}
                      </View>
                      {(req.status === "pending" || req.status === "processing") ? (
                        <TouchableOpacity
                          style={styles.featureRequestCancelButton}
                          onPress={() => handleCancelFeatureRequest(req._id)}
                          disabled={cancellingRequestId === req._id}
                        >
                          {cancellingRequestId === req._id ? (
                            <ActivityIndicator size="small" color="#EF4444" />
                          ) : (
                            <Text style={styles.featureRequestCancelText}>Cancel</Text>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.featureRequestStatusText}>
                          {req.status}
                        </Text>
                      )}
                    </RowWrapper>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </View>
      )}

      {/* Sign Out */}
      {!isDemoMode && (
        <View style={styles.section}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
      )}

      <View style={styles.bottomPadding} />

      {/* Feature Request Confirmation Modal */}
      <Modal
        visible={showFeatureConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelFeatureConfirm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Feature Request</Text>
            <Text style={styles.modalMessage}>Submit this request?</Text>
            <Text style={styles.modalTranscript}>"{pendingTranscript}"</Text>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setIncludeDebugLogs(!includeDebugLogs)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, includeDebugLogs && styles.checkboxChecked]}>
                {includeDebugLogs && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Include debug logs ({logs.length})</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={handleCancelFeatureConfirm}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSubmit]}
                onPress={handleConfirmFeatureSubmit}
              >
                <Text style={styles.modalButtonSubmitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Details Modal */}
      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseErrorModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.errorModalContent]}>
            <Text style={styles.modalTitle}>Feature Request Failed</Text>

            <View style={styles.errorSection}>
              <Text style={styles.errorSectionTitle}>Request</Text>
              <Text style={styles.errorSectionText}>"{selectedErrorRequest?.transcript}"</Text>
            </View>

            <View style={styles.errorSection}>
              <Text style={styles.errorSectionTitle}>Error</Text>
              <ScrollView style={styles.errorScrollView} nestedScrollEnabled>
                <Text style={styles.errorText}>{selectedErrorRequest?.error}</Text>
              </ScrollView>
            </View>

            {selectedErrorRequest?.claudeOutput && (
              <View style={styles.errorSection}>
                <Text style={styles.errorSectionTitle}>Claude Output</Text>
                <ScrollView style={styles.errorScrollView} nestedScrollEnabled>
                  <Text style={styles.claudeOutputText}>{selectedErrorRequest.claudeOutput}</Text>
                </ScrollView>
              </View>
            )}

            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSubmit, { marginTop: 16 }]}
              onPress={handleCloseErrorModal}
            >
              <Text style={styles.modalButtonSubmitText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Details Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseSuccessModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.errorModalContent]}>
            <Text style={styles.modalTitle}>Feature Request Completed</Text>

            <View style={styles.errorSection}>
              <Text style={styles.errorSectionTitle}>Request</Text>
              <Text style={styles.errorSectionText}>"{selectedSuccessRequest?.transcript}"</Text>
            </View>

            {selectedSuccessRequest?.progressMessage && (
              <View style={styles.errorSection}>
                <Text style={styles.errorSectionTitle}>Status</Text>
                <Text style={styles.successText}>{selectedSuccessRequest.progressMessage}</Text>
              </View>
            )}

            {selectedSuccessRequest?.claudeOutput && (
              <View style={styles.errorSection}>
                <Text style={styles.errorSectionTitle}>Claude Output</Text>
                <ScrollView style={styles.errorScrollView} nestedScrollEnabled>
                  <Text style={styles.claudeOutputText}>{selectedSuccessRequest.claudeOutput}</Text>
                </ScrollView>
              </View>
            )}

            {(selectedSuccessRequest?.commitHash || selectedSuccessRequest?.branchName) && (
              <View style={styles.errorSection}>
                <Text style={styles.errorSectionTitle}>Implementation Details</Text>
                {selectedSuccessRequest.branchName && (
                  <Text style={styles.metadataText}>Branch: {selectedSuccessRequest.branchName}</Text>
                )}
                {selectedSuccessRequest.commitHash && (
                  <Text style={styles.metadataText}>Commit: {selectedSuccessRequest.commitHash.substring(0, 7)}</Text>
                )}
                {selectedSuccessRequest.easUpdateId && (
                  <Text style={styles.metadataText}>EAS Update: {selectedSuccessRequest.easUpdateId}</Text>
                )}
              </View>
            )}

            {selectedSuccessRequest?.easDashboardUrl && (
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSubmit, { marginTop: 16, marginBottom: 8 }]}
                onPress={() => {
                  if (selectedSuccessRequest.easDashboardUrl) {
                    Linking.openURL(selectedSuccessRequest.easDashboardUrl);
                  }
                }}
              >
                <Text style={styles.modalButtonSubmitText}>View on EAS Dashboard</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel, { marginTop: selectedSuccessRequest?.easDashboardUrl ? 0 : 16 }]}
              onPress={handleCloseSuccessModal}
            >
              <Text style={styles.modalButtonCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  demoBanner: {
    backgroundColor: "#FFF4E6",
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: "#FFB84D",
  },
  demoBannerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  demoBannerText: {
    fontSize: 15,
    color: "#666",
    lineHeight: 22,
    marginBottom: 16,
  },
  exitDemoButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  exitDemoButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
  providerDetail: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EF4444",
  },
  addAccountButton: {
    padding: 16,
    alignItems: "center",
  },
  addAccountButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6366F1",
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
  streamingTranscript: {
    color: "#EF4444",
    fontStyle: "italic",
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
    backgroundColor: "#F8F9FE",
    overflow: "hidden",
  },
  gradientBackground: {
    position: "absolute",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
  gradientCircle: {
    position: "absolute",
    borderRadius: 9999,
    opacity: 0.15,
  },
  gradientCircle1: {
    width: 400,
    height: 400,
    backgroundColor: "#6366F1",
    top: -100,
    right: -100,
  },
  gradientCircle2: {
    width: 300,
    height: 300,
    backgroundColor: "#8B5CF6",
    bottom: -80,
    left: -80,
  },
  gradientCircle3: {
    width: 250,
    height: 250,
    backgroundColor: "#EC4899",
    top: "40%",
    left: "50%",
    marginLeft: -125,
    marginTop: -125,
  },
  signInContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    maxWidth: 480,
    width: "100%",
    zIndex: 1,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  appIconText: {
    fontSize: 40,
    color: "#fff",
    fontWeight: "700",
  },
  signInTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
    textAlign: "center",
  },
  signInSubtitle: {
    fontSize: 17,
    color: "#666",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 26,
    maxWidth: 400,
  },
  featuresList: {
    width: "100%",
    marginBottom: 40,
    gap: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F0F1FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  featureIconText: {
    fontSize: 20,
  },
  featureText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1a1a1a",
    flex: 1,
  },
  signInButton: {
    flexDirection: "row",
    backgroundColor: "#6366F1",
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
    gap: 12,
  },
  signInButtonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    width: 32,
    height: 32,
    borderRadius: 8,
    textAlign: "center",
    lineHeight: 32,
    overflow: "hidden",
  },
  signInButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  demoButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#6366F1",
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  demoButtonText: {
    color: "#6366F1",
    fontSize: 18,
    fontWeight: "600",
  },
  privacyText: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    marginTop: 24,
    lineHeight: 20,
    maxWidth: 320,
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
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  featureRequestContent: {
    flex: 1,
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
    fontSize: 13,
    color: "#333",
  },
  featureRequestProgress: {
    fontSize: 11,
    color: "#6366F1",
    marginTop: 4,
    fontStyle: "italic",
  },
  featureRequestReady: {
    fontSize: 11,
    color: "#10B981",
    marginTop: 4,
    fontWeight: "500",
  },
  featureRequestError: {
    fontSize: 11,
    color: "#EF4444",
    marginTop: 4,
  },
  featureRequestStatusText: {
    fontSize: 11,
    color: "#999",
    marginLeft: 8,
  },
  featureRequestCancelButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#EF4444",
    minWidth: 50,
    alignItems: "center",
  },
  featureRequestCancelText: {
    fontSize: 11,
    color: "#EF4444",
    fontWeight: "500",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 12,
  },
  modalTranscript: {
    fontSize: 14,
    color: "#333",
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#ccc",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  checkmark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#333",
  },
  modalButtons: {
    flexDirection: "row",
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#F3F4F6",
  },
  modalButtonSubmit: {
    backgroundColor: "#6366F1",
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  modalButtonSubmitText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  errorModalContent: {
    maxHeight: "80%",
  },
  errorSection: {
    marginBottom: 16,
    width: "100%",
  },
  errorSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  errorSectionText: {
    fontSize: 14,
    color: "#333",
    fontStyle: "italic",
  },
  errorScrollView: {
    maxHeight: 120,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  errorText: {
    fontSize: 13,
    color: "#EF4444",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 18,
  },
  claudeOutputText: {
    fontSize: 12,
    color: "#374151",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 16,
  },
  successText: {
    fontSize: 13,
    color: "#10B981",
    lineHeight: 18,
  },
  metadataText: {
    fontSize: 13,
    color: "#374151",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 18,
    marginBottom: 4,
  },
  costRow: {
    flexDirection: "row",
    padding: 16,
  },
  costItem: {
    flex: 1,
    alignItems: "center",
  },
  costDivider: {
    width: 1,
    backgroundColor: "#eee",
  },
  costLabel: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
  },
  costValue: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  costCount: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  totalCostRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F9FAFB",
  },
  totalCostLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  totalCostValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#6366F1",
  },
});
