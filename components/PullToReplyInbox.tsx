import React, { useCallback, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
  ViewToken,
} from "react-native";
import { router } from "expo-router";
import Animated, {
  useAnimatedStyle,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import {
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

import { usePullToReplyGesture } from "../hooks/usePullToReplyGesture";
import { PullToRevealHeader, ACTIVATION_THRESHOLD } from "./PullToRevealHeader";
import { QuickReply } from "./QuickReplyButtons";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface InboxEmail {
  _id: string;
  subject: string;
  bodyPreview: string;
  receivedAt: number;
  isRead: boolean;
  isTriaged: boolean;
  triageAction?: "done" | "reply_needed" | "delegated";
  urgencyScore?: number;
  summary?: string;
  urgencyReason?: string;
  actionRequired?: "reply" | "action" | "fyi" | "none";
  quickReplies?: QuickReply[];
  fromContact?: {
    _id: string;
    email: string;
    name?: string;
  } | null;
}

interface PullToReplyInboxProps {
  emails: InboxEmail[];
  isLoading: boolean;
  isSyncing: boolean;
  isSummarizing: boolean;
  hasMore: boolean;
  userEmail: string | undefined;
  // Voice recording handlers
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  cancelRecording: () => void;
  transcript: string;
  isRecording: boolean;
  // Callbacks
  onLoadMore: () => void;
  onRefresh: () => void;
  onSendReply: (emailId: string, to: string, subject: string, body: string) => Promise<void>;
  // Render item
  renderEmailItem: ({ item }: { item: InboxEmail }) => React.ReactElement;
}

// Viewability configuration for tracking top visible email
const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 100,
};

export function PullToReplyInbox({
  emails,
  isLoading,
  isSyncing,
  isSummarizing,
  hasMore,
  userEmail,
  startRecording,
  stopRecording,
  cancelRecording,
  transcript,
  isRecording,
  onLoadMore,
  onRefresh,
  onSendReply,
  renderEmailItem,
}: PullToReplyInboxProps) {
  const flatListRef = useRef<Animated.FlatList<InboxEmail>>(null);

  // Track the top visible email ID
  const [topVisibleEmailId, setTopVisibleEmailId] = useState<string | null>(null);
  const [sendingQuickReply, setSendingQuickReply] = useState(false);

  // Track if we've triggered haptic feedback for this pull gesture
  const hasTriggeredHaptic = useRef(false);

  // Get the top visible email object
  const topVisibleEmail = useMemo(() => {
    if (!topVisibleEmailId) return null;
    return emails.find((e) => e._id === topVisibleEmailId) || null;
  }, [topVisibleEmailId, emails]);

  // Handle viewable items change to track top email
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const topItem = viewableItems[0];
        if (topItem.item && topItem.item._id) {
          setTopVisibleEmailId(topItem.item._id);
        }
      }
    },
    []
  );

  // Stable reference for viewabilityConfigCallbackPairs
  const viewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig: VIEWABILITY_CONFIG,
      onViewableItemsChanged,
    },
  ]);

  // Handle recording started - with haptic feedback
  const handleStartRecording = useCallback(async () => {
    // Trigger haptic feedback when recording starts
    if (Platform.OS !== "web") {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        // Haptics may not be available
      }
    }
    hasTriggeredHaptic.current = true;
    await startRecording();
  }, [startRecording]);

  // Handle recording stopped
  const handleStopRecording = useCallback(async () => {
    hasTriggeredHaptic.current = false;
    return await stopRecording();
  }, [stopRecording]);

  // Handle recording complete - send the voice reply
  const handleRecordingComplete = useCallback(
    async (transcriptText: string) => {
      if (!transcriptText.trim() || !topVisibleEmail || !userEmail) {
        return;
      }

      // Send the voice reply
      try {
        const subject = topVisibleEmail.subject.startsWith("Re:")
          ? topVisibleEmail.subject
          : `Re: ${topVisibleEmail.subject}`;

        await onSendReply(
          topVisibleEmail._id,
          topVisibleEmail.fromContact?.email || "",
          subject,
          transcriptText
        );

        Alert.alert("Sent", "Voice reply sent!");
      } catch (err) {
        Alert.alert("Error", "Failed to send reply. Please try again.");
        console.error("Failed to send voice reply:", err);
      }
    },
    [topVisibleEmail, userEmail, onSendReply]
  );

  // Set up the pull gesture
  const {
    pullDistance,
    isPulling,
    scrollEnabled,
    panGesture,
    resetPull,
  } = usePullToReplyGesture({
    onStartRecording: handleStartRecording,
    onStopRecording: handleStopRecording,
    onRecordingComplete: handleRecordingComplete,
    enabled: emails.length > 0 && !isRecording,
  });

  // Handle quick reply
  const handleQuickReply = useCallback(
    async (reply: QuickReply) => {
      if (!topVisibleEmail || !userEmail) return;

      setSendingQuickReply(true);
      try {
        const subject = topVisibleEmail.subject.startsWith("Re:")
          ? topVisibleEmail.subject
          : `Re: ${topVisibleEmail.subject}`;

        await onSendReply(
          topVisibleEmail._id,
          topVisibleEmail.fromContact?.email || "",
          subject,
          reply.body
        );

        // Reset pull state after successful send
        resetPull();
        Alert.alert("Sent", `Reply sent: "${reply.label}"`);
      } catch (err) {
        Alert.alert("Error", "Failed to send reply. Please try again.");
        console.error("Failed to send quick reply:", err);
      } finally {
        setSendingQuickReply(false);
      }
    },
    [topVisibleEmail, userEmail, onSendReply, resetPull]
  );

  // Handle send voice reply from the recording UI
  const handleSendVoiceReply = useCallback(async () => {
    if (!topVisibleEmail || !userEmail || !transcript.trim()) return;

    try {
      const subject = topVisibleEmail.subject.startsWith("Re:")
        ? topVisibleEmail.subject
        : `Re: ${topVisibleEmail.subject}`;

      await onSendReply(
        topVisibleEmail._id,
        topVisibleEmail.fromContact?.email || "",
        subject,
        transcript
      );

      cancelRecording();
      resetPull();
      Alert.alert("Sent", "Voice reply sent!");
    } catch (err) {
      Alert.alert("Error", "Failed to send reply. Please try again.");
      console.error("Failed to send voice reply:", err);
    }
  }, [topVisibleEmail, userEmail, transcript, onSendReply, cancelRecording, resetPull]);

  // Handle cancel recording
  const handleCancelRecording = useCallback(() => {
    cancelRecording();
    resetPull();
  }, [cancelRecording, resetPull]);

  // Animated style for the list container (translate down during pull)
  const listContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pullDistance.value > 0 ? pullDistance.value : 0 }],
  }));

  // Handle load more
  const handleEndReached = useCallback(() => {
    if (hasMore && !isSyncing) {
      onLoadMore();
    }
  }, [hasMore, isSyncing, onLoadMore]);

  // Key extractor
  const keyExtractor = useCallback((item: InboxEmail) => item._id, []);

  if (isLoading && emails.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.container}>
          {/* Pull-to-reveal header - positioned at top */}
          <PullToRevealHeader
            pullDistance={pullDistance}
            expandedEmail={topVisibleEmail}
            isRecording={isRecording}
            transcript={transcript}
            onQuickReply={handleQuickReply}
            onSendVoiceReply={handleSendVoiceReply}
            onCancelRecording={handleCancelRecording}
            sendingQuickReply={sendingQuickReply}
          />

          {/* Email list */}
          <Animated.View style={[styles.listContainer, listContainerStyle]}>
            <Animated.FlatList
              ref={flatListRef}
              data={emails}
              keyExtractor={keyExtractor}
              renderItem={renderEmailItem}
              contentContainerStyle={styles.listContent}
              scrollEnabled={scrollEnabled}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📭</Text>
                  <Text style={styles.emptyText}>No emails yet</Text>
                  <Text style={styles.emptySubtext}>
                    Tap the refresh button to sync
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

          {/* Manual refresh button (since we're using the pull gesture for reply) */}
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.refreshIcon}>↻</Text>
            )}
          </TouchableOpacity>

          {/* Compose FAB */}
          <TouchableOpacity
            style={styles.fab}
            onPress={() => router.push("/compose")}
          >
            <Text style={styles.fabIcon}>✏️</Text>
          </TouchableOpacity>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100,
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
  refreshButton: {
    position: "absolute",
    left: 20,
    bottom: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  refreshIcon: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "bold",
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
});
