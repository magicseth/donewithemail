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
import { useEmail, useEmailActions } from "../../hooks/useEmails";
import { Id } from "../../convex/_generated/dataModel";

export default function EmailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const email = useEmail(id as Id<"emails"> | undefined);
  const { archiveEmail, markReplyNeeded } = useEmailActions();

  const handleArchive = useCallback(async () => {
    if (id) {
      await archiveEmail(id as Id<"emails">);
      router.back();
    }
  }, [id, archiveEmail]);

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
            if (id) markReplyNeeded(id as Id<"emails">);
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
