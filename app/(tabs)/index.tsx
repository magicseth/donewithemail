import React, { useCallback, useEffect, useState, useRef } from "react";
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { SwipeStack, SwipeDirection } from "../../components/SwipeStack";
import { EmailCard, EmailCardData } from "../../components/EmailCard";
import { useEmailActions } from "../../hooks/useEmails";
import { useGmail, GmailEmail } from "../../hooks/useGmail";
import { Id } from "../../convex/_generated/dataModel";

// Minimum time after swipe before allowing taps (ms)
const TAP_COOLDOWN_AFTER_SWIPE = 500;

// Convert Gmail email to EmailCardData format
function toEmailCardData(email: GmailEmail): EmailCardData {
  return {
    _id: email.id,
    subject: email.subject,
    bodyPreview: email.snippet,
    receivedAt: email.receivedAt,
    isRead: email.isRead,
    fromContact: {
      _id: email.from.email,
      email: email.from.email,
      name: email.from.name,
      relationship: "regular" as const,
    },
  };
}

export default function FeedScreen() {
  const { isAuthenticated, emails, isLoading, error, fetchEmails, refetch } = useGmail();
  const { archiveEmail, markReplyNeeded, archiveByExternalId, markReplyNeededByExternalId } = useEmailActions();
  const [triagedIds, setTriagedIds] = useState<Set<string>>(new Set());
  const lastSwipeTimeRef = useRef<number>(0);

  // Fetch emails when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchEmails();
    }
  }, [isAuthenticated, fetchEmails]);

  // Convert to card format and filter out triaged emails
  const emailCards = emails
    .filter(email => !triagedIds.has(email.id))
    .map(toEmailCardData);

  // Check if an ID looks like a valid Convex ID (not a Gmail ID)
  const isValidConvexId = (id: string) => id.length > 20 && !id.match(/^[0-9a-f]+$/);

  const handleSwipe = useCallback(
    async (email: EmailCardData, direction: SwipeDirection) => {
      // Record swipe time to prevent accidental taps on next card
      lastSwipeTimeRef.current = Date.now();
      // Immediately remove from UI
      setTriagedIds(prev => new Set(prev).add(email._id));

      try {
        if (isValidConvexId(email._id)) {
          // Use Convex ID directly
          if (direction === "right") {
            await archiveEmail(email._id as Id<"emails">);
          } else if (direction === "left") {
            await markReplyNeeded(email._id as Id<"emails">);
          }
        } else {
          // Use external ID (Gmail ID)
          if (direction === "right") {
            await archiveByExternalId(email._id);
          } else if (direction === "left") {
            await markReplyNeededByExternalId(email._id);
          }
        }
      } catch (error) {
        console.error("Error triaging email:", error);
        // Revert on error
        setTriagedIds(prev => {
          const next = new Set(prev);
          next.delete(email._id);
          return next;
        });
      }
    },
    [archiveEmail, markReplyNeeded, archiveByExternalId, markReplyNeededByExternalId]
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

  // Mock data for when not authenticated
  const mockEmails: EmailCardData[] = [
    {
      _id: "1",
      subject: "Q4 Planning Meeting - Action Items",
      bodyPreview:
        "Hi team, Following up on our Q4 planning meeting, here are the key action items we discussed. Please review and let me know if I missed anything important...",
      receivedAt: Date.now() - 3600000,
      isRead: false,
      summary: "Follow-up from Q4 planning meeting with action items for the team to review.",
      urgencyScore: 65,
      urgencyReason: "Contains action items with implied deadline",
      fromContact: {
        _id: "c1",
        email: "sarah@company.com",
        name: "Sarah Chen",
        relationship: "vip",
      },
    },
    {
      _id: "2",
      subject: "Invoice #INV-2024-001 - Payment Due",
      bodyPreview:
        "Please find attached the invoice for services rendered in December. Payment is due within 30 days. Let me know if you have any questions...",
      receivedAt: Date.now() - 7200000,
      isRead: false,
      summary: "Invoice for December services, payment due in 30 days.",
      urgencyScore: 45,
      urgencyReason: "Payment request with standard 30-day terms",
      suggestedReply: "Thanks for sending this over. I'll process the payment this week.",
      fromContact: {
        _id: "c2",
        email: "billing@vendor.com",
        name: "Vendor Billing",
        relationship: "regular",
      },
    },
    {
      _id: "3",
      subject: "Quick question about the API",
      bodyPreview:
        "Hey! I was looking at the API docs and had a quick question about the authentication flow. Do we need to refresh tokens manually or is that handled automatically?",
      receivedAt: Date.now() - 86400000,
      isRead: false,
      summary: "Technical question about API authentication token refresh.",
      urgencyScore: 30,
      urgencyReason: "Non-urgent technical question",
      fromContact: {
        _id: "c3",
        email: "dev@partner.io",
        name: "Alex Developer",
        relationship: "regular",
      },
    },
  ];

  // Use real emails if authenticated, mock only for unauthenticated users
  const displayEmails = isAuthenticated ? emailCards : mockEmails;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading emails...</Text>
      </View>
    );
  }

  if (error && isAuthenticated) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Unable to load emails</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refetch}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SwipeStack
        data={displayEmails}
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
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              You've triaged all your emails. Check back later for new messages.
            </Text>
          </View>
        }
      />

      {/* Swipe hints */}
      <View style={styles.hintsContainer}>
        <View style={styles.hint}>
          <Text style={styles.hintArrow}>←</Text>
          <Text style={styles.hintText}>Needs Reply</Text>
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
