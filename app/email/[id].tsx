import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { EmailCard, EmailCardData } from "../../components/EmailCard";
import { useEmail, useEmailByExternalId, useEmailActions } from "../../hooks/useEmails";
import { Id } from "../../convex/_generated/dataModel";

// Check if an ID looks like a valid Convex ID (not a Gmail ID)
function isConvexId(id: string): boolean {
  // Convex IDs are longer and contain special characters
  // Gmail IDs are typically hex strings like "19bcec856e234249"
  return id.length > 20 || !id.match(/^[0-9a-f]+$/i);
}

export default function EmailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // Try Convex ID lookup first, then fall back to external ID
  const isConvex = id ? isConvexId(id) : false;
  const emailByConvexId = useEmail(isConvex ? (id as Id<"emails">) : undefined);
  const emailByExternalId = useEmailByExternalId(!isConvex ? id : undefined);

  const email = isConvex ? emailByConvexId : emailByExternalId;
  const { archiveEmail, markReplyNeeded } = useEmailActions();

  // Use the Convex _id from the email object for mutations
  const convexId = email?._id;

  const handleArchive = useCallback(async () => {
    if (convexId) {
      await archiveEmail(convexId);
      router.back();
    }
  }, [convexId, archiveEmail]);

  const handleReply = useCallback(() => {
    router.push({
      pathname: "/compose",
      params: { replyTo: id },
    });
  }, [id]);

  const handleContactPress = useCallback(() => {
    if (email?.fromContact?._id) {
      router.push(`/person/${email.fromContact._id}`);
    }
  }, [email]);

  // Mock data for development
  const mockEmail: EmailCardData = {
    _id: id || "1",
    subject: "Q4 Planning Meeting - Action Items",
    bodyPreview:
      "Hi team,\n\nFollowing up on our Q4 planning meeting, here are the key action items we discussed:\n\n1. Review budget allocations by Friday\n2. Submit project proposals by next Monday\n3. Schedule one-on-ones with direct reports\n4. Update quarterly goals in the system\n\nPlease review and let me know if I missed anything important. Looking forward to a productive quarter!\n\nBest,\nSarah",
    receivedAt: Date.now() - 3600000,
    isRead: true,
    summary:
      "Follow-up from Q4 planning meeting with 4 key action items: review budget (Friday), submit proposals (Monday), schedule 1:1s, and update quarterly goals.",
    urgencyScore: 65,
    urgencyReason:
      "Contains action items with specific deadlines (Friday and Monday)",
    suggestedReply:
      "Thanks Sarah! I've noted all the action items. I'll have the budget review done by Friday and proposals ready by Monday. Let me know if you need anything else.",
    fromContact: {
      _id: "c1",
      email: "sarah@company.com",
      name: "Sarah Chen",
      relationship: "vip",
    },
  };

  const displayEmail = email
    ? {
        _id: email._id,
        subject: email.subject,
        bodyPreview: email.bodyFull || email.bodyPreview,
        receivedAt: email.receivedAt,
        isRead: email.isRead,
        summary: email.summary,
        urgencyScore: email.urgencyScore,
        urgencyReason: email.urgencyReason,
        suggestedReply: email.suggestedReply,
        fromContact: email.fromContact
          ? {
              _id: email.fromContact._id,
              email: email.fromContact.email,
              name: email.fromContact.name,
              avatarUrl: email.fromContact.avatarUrl,
              relationship: email.fromContact.relationship,
            }
          : undefined,
      }
    : mockEmail;

  if (email === undefined && !mockEmail) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: "",
          headerRight: () => (
            <TouchableOpacity onPress={handleArchive} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Archive</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.container}>
        <EmailCard
          email={displayEmail}
          onContactPress={handleContactPress}
          showFullContent
        />
      </ScrollView>

      {/* Action buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionButton} onPress={handleReply}>
          <Text style={styles.actionIcon}>↩️</Text>
          <Text style={styles.actionText}>Reply</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={handleArchive}
        >
          <Text style={styles.actionIcon}>✓</Text>
          <Text style={[styles.actionText, styles.actionTextPrimary]}>Done</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (convexId) markReplyNeeded(convexId);
          }}
        >
          <Text style={styles.actionIcon}>⏰</Text>
          <Text style={styles.actionText}>Remind</Text>
        </TouchableOpacity>
      </View>
    </>
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
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButtonText: {
    color: "#6366F1",
    fontSize: 16,
    fontWeight: "500",
  },
  actionBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
    gap: 8,
  },
  actionButtonPrimary: {
    backgroundColor: "#6366F1",
  },
  actionIcon: {
    fontSize: 18,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  actionTextPrimary: {
    color: "#fff",
  },
});
