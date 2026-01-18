import React, { useCallback } from "react";
import { View, StyleSheet, Text, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { SwipeStack, SwipeDirection } from "../../components/SwipeStack";
import { EmailCard, EmailCardData } from "../../components/EmailCard";
import { useUntriagedEmails, useEmailActions } from "../../hooks/useEmails";
import { Id } from "../../convex/_generated/dataModel";

// Mock user ID for development - replace with real auth
const MOCK_USER_ID = "placeholder" as Id<"users">;

export default function FeedScreen() {
  // In production, get userId from auth context
  const emails = useUntriagedEmails(undefined); // Will use "skip" until we have real auth
  const { archiveEmail, markReplyNeeded } = useEmailActions();

  // Check if an ID looks like a valid Convex ID (not a simple mock ID like "1")
  const isValidConvexId = (id: string) => id.length > 10;

  const handleSwipe = useCallback(
    async (email: EmailCardData, direction: SwipeDirection) => {
      // Skip Convex mutation for mock data
      if (!isValidConvexId(email._id)) {
        console.log(`Mock email swiped ${direction}:`, email.subject);
        return;
      }

      try {
        if (direction === "right") {
          await archiveEmail(email._id as Id<"emails">);
        } else if (direction === "left") {
          await markReplyNeeded(email._id as Id<"emails">);
        }
      } catch (error) {
        console.error("Error triaging email:", error);
      }
    },
    [archiveEmail, markReplyNeeded]
  );

  const handleEmailPress = useCallback((email: EmailCardData) => {
    router.push(`/email/${email._id}`);
  }, []);

  const handleContactPress = useCallback((email: EmailCardData) => {
    if (email.fromContact?._id) {
      router.push(`/person/${email.fromContact._id}`);
    }
  }, []);

  // Show mock data for development
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

  const displayEmails = emails ?? mockEmails;

  if (emails === undefined && !mockEmails.length) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading emails...</Text>
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
