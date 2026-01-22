import React, { useCallback, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from "react-native";
import { router, Stack } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { isAuthError, useAuthError } from "../../lib/AuthErrorBoundary";
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
import { useAuth } from "../../lib/authContext";
import { Id } from "../../convex/_generated/dataModel";
import { replaceDatePlaceholders } from "../../lib/datePlaceholders";
import { usePushNotifications } from "../../hooks/usePushNotifications";

// Swipe threshold for done action
const SWIPE_THRESHOLD = 100;

interface TodoEmail {
  _id: string;
  subject: string;
  bodyPreview: string;
  receivedAt: number;
  isRead: boolean;
  urgencyScore?: number;
  summary?: string;
  fromName?: string; // Sender name as it appeared in this email
  fromContact?: {
    _id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
  } | null;
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

// Swipeable row component for swipe-right-to-done
interface SwipeableRowProps {
  children: React.ReactNode;
  onSwipeRight: () => void;
}

const SwipeableRow = React.memo(function SwipeableRow({
  children,
  onSwipeRight,
}: SwipeableRowProps) {
  const translateX = useSharedValue(0);
  const onSwipeRightRef = useRef(onSwipeRight);
  onSwipeRightRef.current = onSwipeRight;

  const handleSwipeComplete = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onSwipeRightRef.current();
  }, []);

  const panGesture = Gesture.Pan()
    .enableTrackpadTwoFingerGesture(true)
    .mouseButton(MouseButton.LEFT)
    .minDistance(10)
    .activeOffsetX(15) // Activate after 15px horizontal movement
    .failOffsetY([-15, 15]) // Fail if vertical movement detected first
    .onUpdate((event) => {
      // Only allow swiping right (positive values)
      if (event.translationX > 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      const swipedRight = event.translationX > SWIPE_THRESHOLD ||
        (event.translationX > 50 && event.velocityX > 500);

      if (swipedRight) {
        translateX.value = withTiming(400, { duration: 200 }, () => {
          runOnJS(handleSwipeComplete)();
        });
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const doneIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <View style={swipeRowStyles.container}>
      {/* Background indicator */}
      <Animated.View style={[swipeRowStyles.doneIndicator, doneIndicatorStyle]}>
        <Text style={swipeRowStyles.doneIndicatorText}>DONE</Text>
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
  doneIndicator: {
    position: "absolute",
    left: 20,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: 20,
  },
  doneIndicatorText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10B981",
    letterSpacing: 1,
  },
});

// Email row component
interface EmailRowProps {
  item: TodoEmail;
  onSwipeToDone: (email: TodoEmail) => void;
}

const EmailRow = React.memo(function EmailRow({
  item,
  onSwipeToDone,
}: EmailRowProps) {
  // Prefer fromName (from email header) over contact name (may be stale for shared addresses)
  const fromName = item.fromName || item.fromContact?.name || item.fromContact?.email || "Unknown";
  const initials = getInitials(fromName);
  const timeAgo = formatTimeAgo(item.receivedAt);

  // Replace date placeholders with relative dates
  const displaySummary = useMemo(() => {
    const text = item.summary || decodeHtmlEntities(item.bodyPreview);
    return replaceDatePlaceholders(text);
  }, [item.summary, item.bodyPreview]);

  const handleSwipeRight = useCallback(() => {
    onSwipeToDone(item);
  }, [item, onSwipeToDone]);

  const handlePress = useCallback(() => {
    router.push(`/email/${item._id}`);
  }, [item._id]);

  return (
    <SwipeableRow onSwipeRight={handleSwipeRight}>
      <TouchableOpacity
        style={styles.emailItem}
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
              <Text style={styles.senderName} numberOfLines={1}>
                {fromName}
              </Text>
              <Text style={styles.timeAgo}>{timeAgo}</Text>
            </View>

            <Text style={styles.subject} numberOfLines={1}>
              {decodeHtmlEntities(item.subject)}
            </Text>
          </View>

          {/* Summary or preview */}
          <Text style={styles.preview} numberOfLines={2}>
            {displaySummary}
          </Text>
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
    </SwipeableRow>
  );
});

export default function TodosScreen() {
  const { user, isAuthenticated } = useAuth();
  const { reportAuthError } = useAuthError();
  const { dismissNotificationForEmail } = usePushNotifications();
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
  const [isSearchingMissed, setIsSearchingMissed] = useState(false);

  // Query for TODO emails (marked as reply_needed) - authenticated endpoint
  const todoEmails = useQuery(
    api.emails.getMyTodoEmails,
    isAuthenticated ? { limit: 50 } : "skip"
  );

  const triageEmail = useMutation(api.emails.triageMyEmail);
  const startMissedSearch = useMutation(api.missedTodos.startMissedTodosSearchByEmail);

  const isLoading = todoEmails === undefined;

  // Filter out processed emails for optimistic updates
  const emails: TodoEmail[] = (todoEmails || [])
    .filter((email: any) => !processedIds.has(email._id))
    .map((email: any): TodoEmail => ({
      _id: email._id,
      subject: email.subject,
      bodyPreview: email.bodyPreview,
      receivedAt: email.receivedAt,
      isRead: email.isRead,
      urgencyScore: email.urgencyScore,
      summary: email.summary,
      fromName: email.fromName,
      fromContact: email.fromContact ? {
        _id: email.fromContact._id,
        email: email.fromContact.email,
        name: email.fromContact.name,
        avatarUrl: email.fromContact.avatarUrl,
      } : null,
    }));

  // Handler for swipe right to mark as done
  const handleSwipeToDone = useCallback(async (email: TodoEmail) => {
    // Optimistically update UI
    setProcessedIds((prev) => new Set(prev).add(email._id));

    try {
      await triageEmail({
        emailId: email._id as Id<"emails">,
        action: "done",
      });

      // Dismiss notification for this specific email
      await dismissNotificationForEmail(email._id);
    } catch (error) {
      console.error("Error marking email as done:", error);
      // Check for auth errors and report them
      if (error instanceof Error && isAuthError(error)) {
        reportAuthError(error);
      }
      // Revert on error
      setProcessedIds((prev) => {
        const next = new Set(prev);
        next.delete(email._id);
        return next;
      });
    }
  }, [triageEmail, reportAuthError, dismissNotificationForEmail]);

  // Handler for searching missed TODOs
  const handleSearchMissedTodos = useCallback(async () => {
    if (!user?.email || isSearchingMissed) return;

    setIsSearchingMissed(true);
    try {
      await startMissedSearch({ email: user.email });
      // Workflow runs async - notification will come when done
      const message = "Scanning your inbox for missed emails. You'll get a notification when complete.";
      if (Platform.OS === "web") {
        alert(message);
      } else {
        Alert.alert("Searching...", message);
      }
    } catch (error) {
      console.error("Failed to start missed todos search:", error);
      // Check for auth errors and report them
      if (error instanceof Error && isAuthError(error)) {
        reportAuthError(error);
        return; // Don't show generic error for auth issues
      }
      const errorMessage = "Failed to start search. Please try again.";
      if (Platform.OS === "web") {
        alert(errorMessage);
      } else {
        Alert.alert("Error", errorMessage);
      }
    } finally {
      setIsSearchingMissed(false);
    }
  }, [user?.email, isSearchingMissed, startMissedSearch, reportAuthError]);

  // Render email item
  const renderEmailItem = useCallback(({ item }: { item: TodoEmail }) => (
    <EmailRow
      item={item}
      onSwipeToDone={handleSwipeToDone}
    />
  ), [handleSwipeToDone]);

  if (!isAuthenticated) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>TODOs</Text>
        <Text style={styles.emptySubtitle}>
          Sign in to see emails you've marked as TODO
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading TODOs...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Header with "Look for todos" button */}
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity
              style={[styles.headerButton, isSearchingMissed && styles.headerButtonDisabled]}
              onPress={handleSearchMissedTodos}
              disabled={isSearchingMissed}
            >
              {isSearchingMissed ? (
                <ActivityIndicator size="small" color="#6366F1" />
              ) : (
                <Text style={styles.headerButtonText}>Find more</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      {/* Swipe hint at top */}
      <View style={styles.swipeHintContainer}>
        <Text style={styles.swipeHintText}>→ Swipe right to mark as done</Text>
      </View>

      <FlatList
        data={emails}
        keyExtractor={(item) => item._id}
        renderItem={renderEmailItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>No TODOs!</Text>
            <Text style={styles.emptySubtitle}>
              Swipe left on inbox emails to add them here.
            </Text>
            <TouchableOpacity
              style={[styles.searchButton, isSearchingMissed && styles.searchButtonDisabled]}
              onPress={handleSearchMissedTodos}
              disabled={isSearchingMissed}
            >
              {isSearchingMissed ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.searchButtonText}>Look for missing todos</Text>
              )}
            </TouchableOpacity>
          </View>
        }
      />
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
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 40,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  headerButtonDisabled: {
    opacity: 0.6,
  },
  headerButtonText: {
    color: "#6366F1",
    fontSize: 15,
    fontWeight: "600",
  },
  swipeHintContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F0FDF4",
    borderBottomWidth: 1,
    borderBottomColor: "#BBF7D0",
  },
  swipeHintText: {
    fontSize: 13,
    color: "#16A34A",
    fontWeight: "500",
  },
  listContent: {
    paddingBottom: 100,
  },
  emailItem: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  emailContent: {
    flex: 1,
  },
  emailHeader: {
    marginBottom: 4,
  },
  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  senderName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  timeAgo: {
    fontSize: 13,
    color: "#999",
    marginLeft: 8,
  },
  subject: {
    fontSize: 15,
    color: "#1a1a1a",
    fontWeight: "500",
  },
  preview: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginTop: 4,
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
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
  },
  searchButton: {
    marginTop: 24,
    backgroundColor: "#6366F1",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 200,
    alignItems: "center",
  },
  searchButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  searchButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
