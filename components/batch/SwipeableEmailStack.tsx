import React, { useCallback, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { SwipeableEmailCard } from "./SwipeableEmailCard";
import { EmailCardContent } from "./EmailCardContent";
import { BatchEmailPreview } from "../../hooks/useBatchTriage";

interface SwipeableEmailStackProps {
  emails: BatchEmailPreview[];
  onMarkDone: (emailId: string) => void;
  onReply: (email: BatchEmailPreview) => void;
  isLoading?: boolean;
}

export const SwipeableEmailStack = React.memo(function SwipeableEmailStack({
  emails,
  onMarkDone,
  onReply,
  isLoading = false,
}: SwipeableEmailStackProps) {
  // Track which emails have been swiped away (for optimistic UI)
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());

  // Filter out swiped emails
  const visibleEmails = emails.filter(e => !swipedIds.has(e._id));

  // Show top 3 cards in stack for depth effect
  const displayEmails = visibleEmails.slice(0, 3);

  const handleSwipeLeft = useCallback((email: BatchEmailPreview, index: number) => {
    // Mark as done
    setSwipedIds(prev => new Set(prev).add(email._id));
    onMarkDone(email._id);
  }, [onMarkDone]);

  const handleSwipeRight = useCallback((email: BatchEmailPreview, index: number) => {
    // Open reply
    setSwipedIds(prev => new Set(prev).add(email._id));
    onReply(email);
  }, [onReply]);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading emails...</Text>
      </View>
    );
  }

  // Empty state
  if (visibleEmails.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📭</Text>
        <Text style={styles.emptyTitle}>Inbox Zero!</Text>
        <Text style={styles.emptySubtitle}>No emails to triage</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Email counter */}
      <View style={styles.counterContainer}>
        <Text style={styles.counterText}>
          {visibleEmails.length} email{visibleEmails.length === 1 ? "" : "s"} left
        </Text>
      </View>

      {/* Stack of cards - render in reverse so top card is last (renders on top) */}
      <View style={styles.stackContainer}>
        {displayEmails.reverse().map((email, index) => {
          const actualIndex = displayEmails.length - 1 - index;
          const isTopCard = actualIndex === 0;

          // Calculate stack offset for cards behind
          const stackOffset = actualIndex * 8;
          const stackScale = 1 - (actualIndex * 0.03);
          const stackOpacity = 1 - (actualIndex * 0.2);

          return (
            <View
              key={email._id}
              style={[
                styles.cardWrapper,
                !isTopCard && {
                  transform: [
                    { translateY: -stackOffset },
                    { scale: stackScale },
                  ],
                  opacity: stackOpacity,
                },
              ]}
              pointerEvents={isTopCard ? "auto" : "none"}
            >
              {isTopCard ? (
                <SwipeableEmailCard
                  email={email}
                  onSwipeLeft={() => handleSwipeLeft(email, actualIndex)}
                  onSwipeRight={() => handleSwipeRight(email, actualIndex)}
                >
                  <EmailCardContent email={email} />
                </SwipeableEmailCard>
              ) : (
                // Static preview for cards in the stack
                <View style={styles.stackCard}>
                  <EmailCardContent email={email} />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#666",
  },
  counterContainer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  counterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  stackContainer: {
    flex: 1,
    position: "relative",
  },
  cardWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  stackCard: {
    flex: 1,
    marginVertical: 8,
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: "hidden",
  },
});
