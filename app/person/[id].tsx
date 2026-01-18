import React, { useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { PersonContext, ContactData, EmailPreview } from "../../components/PersonContext";
import { useContactStats, useContactActions } from "../../hooks/useContacts";
import { Id } from "../../convex/_generated/dataModel";

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const contactStats = useContactStats(id as Id<"contacts"> | undefined);
  const { updateRelationship } = useContactActions();

  const handleEmailPress = useCallback((emailId: string) => {
    router.push(`/email/${emailId}`);
  }, []);

  const handleRelationshipChange = useCallback(
    async (relationship: "vip" | "regular" | "unknown") => {
      if (id) {
        await updateRelationship(id as Id<"contacts">, relationship);
      }
    },
    [id, updateRelationship]
  );

  // Mock data for development
  const mockContact: ContactData = {
    _id: id || "c1",
    email: "sarah@company.com",
    name: "Sarah Chen",
    emailCount: 47,
    lastEmailAt: Date.now() - 3600000,
    relationship: "vip",
    relationshipSummary:
      "Sarah is your primary contact at the company. You've exchanged 47 emails over the past 6 months, mostly about quarterly planning and project updates. She typically responds within 2-4 hours during business days.",
  };

  const mockEmails: EmailPreview[] = [
    {
      _id: "e1",
      subject: "Q4 Planning Meeting - Action Items",
      bodyPreview: "Hi team, Following up on our Q4 planning meeting...",
      receivedAt: Date.now() - 3600000,
      isRead: true,
      urgencyScore: 65,
    },
    {
      _id: "e2",
      subject: "Re: Budget Review",
      bodyPreview: "Thanks for the update. I've reviewed the numbers and...",
      receivedAt: Date.now() - 86400000,
      isRead: true,
      urgencyScore: 40,
    },
    {
      _id: "e3",
      subject: "Quick sync tomorrow?",
      bodyPreview: "Hey! Do you have 15 minutes tomorrow to discuss...",
      receivedAt: Date.now() - 172800000,
      isRead: true,
      urgencyScore: 55,
    },
    {
      _id: "e4",
      subject: "Project Proposal Draft",
      bodyPreview: "Attached is the draft proposal we discussed. Let me know...",
      receivedAt: Date.now() - 259200000,
      isRead: true,
      urgencyScore: 45,
    },
    {
      _id: "e5",
      subject: "Team offsite - Save the date",
      bodyPreview: "Hi everyone! Wanted to give you a heads up about our...",
      receivedAt: Date.now() - 604800000,
      isRead: true,
      urgencyScore: 25,
    },
  ];

  const displayContact = contactStats?.contact
    ? {
        _id: contactStats.contact._id,
        email: contactStats.contact.email,
        name: contactStats.contact.name,
        avatarUrl: contactStats.contact.avatarUrl,
        emailCount: contactStats.contact.emailCount,
        lastEmailAt: contactStats.contact.lastEmailAt,
        relationship: contactStats.contact.relationship,
        relationshipSummary: contactStats.contact.relationshipSummary,
      }
    : mockContact;

  const displayEmails = contactStats?.recentEmails
    ? contactStats.recentEmails.map((e) => ({
        _id: e._id,
        subject: e.subject,
        bodyPreview: e.bodyPreview,
        receivedAt: e.receivedAt,
        isRead: e.isRead,
        urgencyScore: e.urgencyScore,
      }))
    : mockEmails;

  if (contactStats === undefined && !mockContact) {
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
          headerTitle: displayContact.name || displayContact.email,
        }}
      />

      <ScrollView style={styles.container}>
        <PersonContext
          contact={displayContact}
          recentEmails={displayEmails}
          onEmailPress={handleEmailPress}
          onRelationshipChange={handleRelationshipChange}
        />
      </ScrollView>
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
});
