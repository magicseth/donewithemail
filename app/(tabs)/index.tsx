import React, { useCallback, useState, useRef } from "react";
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SwipeStack, SwipeDirection } from "../../components/SwipeStack";
import { EmailCard, EmailCardData } from "../../components/EmailCard";
import { useAuth } from "../../lib/authContext";
import { Id } from "../../convex/_generated/dataModel";

// Minimum time after swipe before allowing taps (ms)
const TAP_COOLDOWN_AFTER_SWIPE = 500;

// Convert TODO email to EmailCardData format
function toEmailCardData(email: any): EmailCardData {
  return {
    _id: email._id,
    subject: email.subject,
    bodyPreview: email.bodyPreview,
    receivedAt: email.receivedAt,
    isRead: email.isRead,
    summary: email.summary,
    urgencyScore: email.urgencyScore,
    urgencyReason: email.urgencyReason,
    suggestedReply: email.suggestedReply,
    fromContact: email.fromContact ? {
      _id: email.fromContact._id,
      email: email.fromContact.email,
      name: email.fromContact.name,
      relationship: email.fromContact.relationship || "regular",
    } : undefined,
  };
}

export default function TodosScreen() {
  const { user, isAuthenticated } = useAuth();
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
  const lastSwipeTimeRef = useRef<number>(0);

  // Query for TODO emails (marked as reply_needed)
  const todoEmails = useQuery(
    api.emails.getTodosByEmail,
    isAuthenticated && user?.email ? { email: user.email, limit: 50 } : "skip"
  );

  const triageEmail = useMutation(api.emails.triageEmail);

  const isLoading = todoEmails === undefined;

  // Convert to card format and filter out processed emails
  const emailCards = (todoEmails || [])
    .filter((email: any) => !processedIds.has(email._id))
    .map(toEmailCardData);

  const handleSwipe = useCallback(
    async (email: EmailCardData, direction: SwipeDirection) => {
      // Record swipe time to prevent accidental taps on next card
      lastSwipeTimeRef.current = Date.now();
      // Immediately remove from UI
      setProcessedIds(prev => new Set(prev).add(email._id));

      try {
        // Swipe right = mark as done (processed)
        if (direction === "right") {
          await triageEmail({
            emailId: email._id as Id<"emails">,
            action: "done",
          });
        }
        // Swipe left = keep as TODO (do nothing, just remove from stack view)
        // The email will still appear in the list on next query
      } catch (error) {
        console.error("Error processing TODO email:", error);
        // Revert on error
        setProcessedIds(prev => {
          const next = new Set(prev);
          next.delete(email._id);
          return next;
        });
      }
    },
    [triageEmail]
  );

  const handleEmailPress = useCallback((email: EmailCardData) => {
    // Ignore taps that happen too soon after a swipe (prevents accidental opens)
    const timeSinceSwipe = Date.now() - lastSwipeTimeRef.current;
    if (timeSinceSwipe < TAP_COOLDOWN_AFTER_SWIPE) {
      return;
    }
    router.push(`/email/${email._id}`);
  }, []);

  const handleContactPress = useCallback((email: EmailCardData) => {
    if (email.fromContact?._id) {
      router.push(`/person/${email.fromContact._id}`);
    }
  }, []);

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
    <View style={styles.container}>
      <SwipeStack
        data={emailCards}
        keyExtractor={(email) => email._id}
        onSwipe={handleSwipe}
        renderCard={(email) => (
          <EmailCard
            email={email}
            onPress={() => handleEmailPress(email)}
            onContactPress={() => handleContactPress(email)}
          />
        )}
        emptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>No TODOs!</Text>
            <Text style={styles.emptySubtitle}>
              Swipe left on inbox emails to add them here for later processing.
            </Text>
          </View>
        }
      />

      {/* Swipe hints */}
      <View style={styles.hintsContainer}>
        <View style={styles.hint}>
          <Text style={styles.hintArrow}>←</Text>
          <Text style={styles.hintText}>Skip</Text>
        </View>
        <View style={styles.hint}>
          <Text style={styles.hintText}>Done</Text>
          <Text style={styles.hintArrow}>→</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
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
    backgroundColor: "#F5F5F5",
    padding: 40,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    padding: 40,
  },
  errorIcon: {
    fontSize: 48,
    color: "#EF4444",
    fontWeight: "700",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
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
  hintsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    paddingVertical: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hintArrow: {
    fontSize: 20,
    color: "#999",
  },
  hintText: {
    fontSize: 14,
    color: "#666",
  },
});
