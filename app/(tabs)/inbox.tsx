import React, { useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDecay,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useGmail, GmailEmail } from "../../hooks/useGmail";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BALL_SIZE = 40;
const TARGET_SIZE = 60;
const TRIAGE_BAR_HEIGHT = 80;
// Ball can move from left target to right target
const BALL_TRAVEL_RANGE = SCREEN_WIDTH - TARGET_SIZE * 2;

interface InboxEmail {
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
  fromContact?: {
    _id: string;
    email: string;
    name?: string;
  } | null;
}

// Convert Gmail email to InboxEmail format
function toInboxEmail(email: GmailEmail): InboxEmail {
  return {
    _id: email.id,
    subject: email.subject,
    bodyPreview: email.snippet,
    receivedAt: email.receivedAt,
    isRead: email.isRead,
    isTriaged: false,
    urgencyScore: email.urgencyScore,
    summary: email.summary,
    urgencyReason: email.urgencyReason,
    fromContact: {
      _id: email.from.email,
      email: email.from.email,
      name: email.from.name,
    },
  };
}

type TriageAction = "reply" | "save" | "archive";

// Decode HTML entities in text (for email snippets)
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

function getActiveTarget(ballX: number): TriageAction {
  const normalizedX = (ballX + BALL_TRAVEL_RANGE / 2) / BALL_TRAVEL_RANGE;
  if (normalizedX < 0.33) return "reply";
  if (normalizedX > 0.66) return "archive";
  return "save";
}

export default function InboxScreen() {
  const { isAuthenticated, emails: gmailEmails, isLoading, isLoadingMore, isSummarizing, hasMore, fetchEmails, loadMore, refetch } = useGmail();
  const [refreshing, setRefreshing] = React.useState(false);

  // Ball position (0 = center, negative = left, positive = right)
  const ballX = useSharedValue(0);

  // For wheel event handling on web
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWheelActiveRef = useRef(false);

  // Fetch emails when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchEmails();
    }
  }, [isAuthenticated, fetchEmails]);

  // Convert Gmail emails to inbox format
  const emails = gmailEmails.map(toInboxEmail);

  const handleEmailPress = useCallback((emailId: string) => {
    router.push(`/email/${emailId}`);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  // Handle wheel events for trackpad scrolling on web
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handleWheel = (event: WheelEvent) => {
      const deltaX = event.deltaX;

      // Only handle if there's meaningful horizontal movement
      if (Math.abs(deltaX) < 1) return;

      // Update ball position based on horizontal scroll
      // Negate deltaX so scrolling right moves ball right
      // Higher multiplier (3) for faster response
      const newX = Math.max(
        -BALL_TRAVEL_RANGE / 2,
        Math.min(BALL_TRAVEL_RANGE / 2, ballX.value - deltaX * 3)
      );
      ballX.value = newX;

      // Mark wheel as active
      isWheelActiveRef.current = true;

      // Clear existing timeout
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }

      // Set timeout to snap ball when wheel stops
      wheelTimeoutRef.current = setTimeout(() => {
        if (isWheelActiveRef.current) {
          isWheelActiveRef.current = false;
          // Snap to nearest target
          const activeTarget = getActiveTarget(ballX.value);
          if (activeTarget === "reply") {
            ballX.value = withSpring(-BALL_TRAVEL_RANGE / 2 + TARGET_SIZE / 2);
          } else if (activeTarget === "archive") {
            ballX.value = withSpring(BALL_TRAVEL_RANGE / 2 - TARGET_SIZE / 2);
          } else {
            ballX.value = withSpring(0);
          }
        }
      }, 150);
    };

    // Add wheel event listener to window
    window.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
    };
  }, [ballX]);

  // Pan gesture for horizontal ball movement
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Map horizontal translation to ball position
      // Clamp to travel range
      const newX = Math.max(
        -BALL_TRAVEL_RANGE / 2,
        Math.min(BALL_TRAVEL_RANGE / 2, event.translationX)
      );
      ballX.value = newX;
    })
    .onEnd(() => {
      // Snap ball to nearest target
      const activeTarget = getActiveTarget(ballX.value);
      if (activeTarget === "reply") {
        ballX.value = withSpring(-BALL_TRAVEL_RANGE / 2 + TARGET_SIZE / 2);
      } else if (activeTarget === "archive") {
        ballX.value = withSpring(BALL_TRAVEL_RANGE / 2 - TARGET_SIZE / 2);
      } else {
        ballX.value = withSpring(0);
      }
    });

  // Native gesture for FlatList scrolling
  const nativeGesture = Gesture.Native();

  // Combine gestures - pan for horizontal, native for vertical scroll
  const composedGesture = Gesture.Simultaneous(panGesture, nativeGesture);

  // Ball animated style
  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ballX.value }],
  }));

  // Target highlight styles
  const replyTargetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      ballX.value,
      [-BALL_TRAVEL_RANGE / 2, -BALL_TRAVEL_RANGE / 4, 0],
      [1, 0.5, 0.3],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          ballX.value,
          [-BALL_TRAVEL_RANGE / 2, 0],
          [1.2, 1],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const saveTargetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.abs(ballX.value),
      [0, BALL_TRAVEL_RANGE / 4],
      [1, 0.3],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          Math.abs(ballX.value),
          [0, BALL_TRAVEL_RANGE / 4],
          [1.2, 1],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const archiveTargetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      ballX.value,
      [0, BALL_TRAVEL_RANGE / 4, BALL_TRAVEL_RANGE / 2],
      [0.3, 0.5, 1],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          ballX.value,
          [0, BALL_TRAVEL_RANGE / 2],
          [1, 1.2],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const renderEmailItem = ({ item }: { item: InboxEmail }) => {
    const fromName = item.fromContact?.name || item.fromContact?.email || "Unknown";
    const timeAgo = formatTimeAgo(item.receivedAt);

    return (
      <TouchableOpacity
        style={[styles.emailItem, !item.isRead && styles.emailItemUnread]}
        onPress={() => handleEmailPress(item._id)}
      >
        <View style={styles.emailHeader}>
          <View style={styles.senderRow}>
            {!item.isRead && <View style={styles.unreadDot} />}
            <Text
              style={[styles.senderName, !item.isRead && styles.textBold]}
              numberOfLines={1}
            >
              {fromName}
            </Text>
            <Text style={styles.timeAgo}>{timeAgo}</Text>
          </View>

          <View style={styles.subjectRow}>
            <Text
              style={[styles.subject, !item.isRead && styles.textBold]}
              numberOfLines={1}
            >
              {decodeHtmlEntities(item.subject)}
            </Text>
            {item.triageAction && (
              <View
                style={[
                  styles.triageBadge,
                  item.triageAction === "reply_needed" && styles.triageBadgeReply,
                ]}
              >
                <Text style={styles.triageBadgeText}>
                  {item.triageAction === "done"
                    ? "✓"
                    : item.triageAction === "reply_needed"
                    ? "↩"
                    : "→"}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* AI Summary or body preview */}
        {item.summary ? (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryLabel}>AI Summary</Text>
            <Text style={styles.summaryText} numberOfLines={2}>
              {item.summary}
            </Text>
          </View>
        ) : (
          <Text style={styles.preview} numberOfLines={2}>
            {decodeHtmlEntities(item.bodyPreview)}
          </Text>
        )}

        {item.urgencyScore !== undefined && item.urgencyScore >= 50 && (
          <View
            style={[
              styles.urgencyIndicator,
              {
                backgroundColor:
                  item.urgencyScore >= 80 ? "#FF4444" : "#FFAA00",
              },
            ]}
          />
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading && emails.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Triage bar with targets and ball */}
      <View style={styles.triageBar}>
        <Animated.View style={[styles.target, styles.targetLeft, replyTargetStyle]}>
          <Text style={styles.targetIcon}>↩</Text>
          <Text style={styles.targetLabel}>Reply</Text>
        </Animated.View>

        <Animated.View style={[styles.target, styles.targetCenter, saveTargetStyle]}>
          <Text style={styles.targetIcon}>★</Text>
          <Text style={styles.targetLabel}>Save</Text>
        </Animated.View>

        <Animated.View style={[styles.target, styles.targetRight, archiveTargetStyle]}>
          <Text style={styles.targetIcon}>✓</Text>
          <Text style={styles.targetLabel}>Archive</Text>
        </Animated.View>

        {/* The ball */}
        <Animated.View style={[styles.ball, ballStyle]} />
      </View>

      {/* Email list with gesture detection */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={styles.listContainer}>
          <FlatList
            data={emails}
            keyExtractor={(item) => item._id}
            renderItem={renderEmailItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#6366F1"
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyText}>No emails yet</Text>
              </View>
            }
            ListFooterComponent={
              isLoadingMore || isSummarizing ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Text style={styles.loadingMoreText}>
                    {isLoadingMore ? "Loading more..." : "Summarizing with AI..."}
                  </Text>
                </View>
              ) : null
            }
          />
        </Animated.View>
      </GestureDetector>

      {/* Compose FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/compose")}
      >
        <Text style={styles.fabIcon}>✏️</Text>
      </TouchableOpacity>
    </GestureHandlerRootView>
  );
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
  triageBar: {
    height: TRIAGE_BAR_HEIGHT,
    backgroundColor: "#F5F5F5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  target: {
    width: TARGET_SIZE,
    height: TARGET_SIZE,
    borderRadius: TARGET_SIZE / 2,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  targetLeft: {
    backgroundColor: "#FFE0B2",
  },
  targetCenter: {
    backgroundColor: "#C8E6C9",
  },
  targetRight: {
    backgroundColor: "#B3E5FC",
  },
  targetIcon: {
    fontSize: 20,
  },
  targetLabel: {
    fontSize: 10,
    marginTop: 2,
    color: "#666",
  },
  ball: {
    position: "absolute",
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    backgroundColor: "#6366F1",
    left: SCREEN_WIDTH / 2 - BALL_SIZE / 2,
    top: TRIAGE_BAR_HEIGHT / 2 - BALL_SIZE / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100,
  },
  emailItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    position: "relative",
  },
  emailItemUnread: {
    backgroundColor: "#F8F9FF",
  },
  emailHeader: {
    marginBottom: 4,
  },
  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6366F1",
    marginRight: 8,
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
  subjectRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subject: {
    flex: 1,
    fontSize: 15,
    color: "#1a1a1a",
  },
  textBold: {
    fontWeight: "600",
  },
  triageBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  triageBadgeReply: {
    backgroundColor: "#FF9800",
  },
  triageBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  preview: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  summaryContainer: {
    backgroundColor: "#F0F4FF",
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6366F1",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
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
    fontSize: 16,
    color: "#666",
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
});
