import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
  TouchableOpacity,
  Text,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { PersonContext, ContactData, EmailPreview, ContactFact } from "../../components/PersonContext";
import { FactEditModal } from "../../components/FactEditModal";
import { useContactStats, useContactStatsByEmail, useContactActions, useContactFacts, useContactCommitments } from "../../hooks/useContacts";
import { Id } from "../../convex/_generated/dataModel";

// Check if the ID looks like an email address
function isEmail(id: string): boolean {
  return id.includes("@");
}

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // Use the appropriate lookup based on whether it's an email or Convex ID
  const isEmailId = id ? isEmail(id) : false;
  const contactStatsByEmail = useContactStatsByEmail(isEmailId ? id : undefined);
  const contactStatsById = useContactStats(!isEmailId ? (id as Id<"contacts">) : undefined);

  const contactStats = isEmailId ? contactStatsByEmail : contactStatsById;
  const { updateRelationship } = useContactActions();

  // Get the actual Convex contact ID (from contactStats, not URL param)
  const contactId = contactStats?.contact?._id as Id<"contacts"> | undefined;
  const { addFact, updateFact, deleteFact } = useContactFacts(contactId);
  const { addCommitment, updateCommitmentStatus, deleteCommitment } = useContactCommitments(contactId);

  // Fact editing modal state
  const [factModalVisible, setFactModalVisible] = useState(false);
  const [editingFact, setEditingFact] = useState<ContactFact | null>(null);

  // Commitment modal state
  const [commitmentModalVisible, setCommitmentModalVisible] = useState(false);
  const [commitmentDirection, setCommitmentDirection] = useState<"from_contact" | "to_contact">("from_contact");
  const [commitmentText, setCommitmentText] = useState("");

  const handleEmailPress = useCallback((emailId: string) => {
    router.push(`/email/${emailId}`);
  }, []);

  const handleRelationshipChange = useCallback(
    async (relationship: "vip" | "regular" | "unknown") => {
      if (contactId) {
        await updateRelationship(contactId, relationship);
      }
    },
    [contactId, updateRelationship]
  );

  const handleAddFact = useCallback(() => {
    setEditingFact(null);
    setFactModalVisible(true);
  }, []);

  const handleEditFact = useCallback((fact: ContactFact) => {
    setEditingFact(fact);
    setFactModalVisible(true);
  }, []);

  const handleDeleteFact = useCallback(
    async (factId: string) => {
      await deleteFact(factId);
    },
    [deleteFact]
  );

  const handleSaveFact = useCallback(
    async (text: string) => {
      if (editingFact) {
        await updateFact(editingFact.id, text);
      } else {
        await addFact(text, "manual");
      }
      setFactModalVisible(false);
      setEditingFact(null);
    },
    [editingFact, addFact, updateFact]
  );

  const handleCancelFact = useCallback(() => {
    setFactModalVisible(false);
    setEditingFact(null);
  }, []);

  // Commitment handlers
  const handleAddCommitment = useCallback((direction: "from_contact" | "to_contact") => {
    setCommitmentDirection(direction);
    setCommitmentText("");
    setCommitmentModalVisible(true);
  }, []);

  const handleSaveCommitment = useCallback(async () => {
    if (commitmentText.trim()) {
      await addCommitment(commitmentText.trim(), commitmentDirection, "manual");
    }
    setCommitmentModalVisible(false);
    setCommitmentText("");
  }, [commitmentText, commitmentDirection, addCommitment]);

  const handleCancelCommitment = useCallback(() => {
    setCommitmentModalVisible(false);
    setCommitmentText("");
  }, []);

  const handleToggleCommitmentStatus = useCallback(
    async (commitmentId: string, currentStatus: "pending" | "completed") => {
      const newStatus = currentStatus === "pending" ? "completed" : "pending";
      await updateCommitmentStatus(commitmentId, newStatus);
    },
    [updateCommitmentStatus]
  );

  const handleDeleteCommitment = useCallback(
    async (commitmentId: string) => {
      await deleteCommitment(commitmentId);
    },
    [deleteCommitment]
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
        facts: contactStats.contact.facts,
        writingStyle: contactStats.contact.writingStyle,
        commitments: contactStats.contact.commitments,
      }
    : mockContact;

  const displayEmails = contactStats?.recentEmails
    ? contactStats.recentEmails.map((e: any) => ({
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
          onAddFact={handleAddFact}
          onEditFact={handleEditFact}
          onDeleteFact={handleDeleteFact}
          onAddCommitment={handleAddCommitment}
          onToggleCommitmentStatus={handleToggleCommitmentStatus}
          onDeleteCommitment={handleDeleteCommitment}
        />
      </ScrollView>

      {/* Commitment Add Modal */}
      <Modal
        visible={commitmentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelCommitment}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {commitmentDirection === "from_contact"
                ? `What does ${displayContact.name || "they"} owe you?`
                : `What do you owe ${displayContact.name || "them"}?`}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={commitmentText}
              onChangeText={setCommitmentText}
              placeholder="e.g., Send the quarterly report"
              autoFocus
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={handleCancelCommitment}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, !commitmentText.trim() && styles.modalSaveButtonDisabled]}
                onPress={handleSaveCommitment}
                disabled={!commitmentText.trim()}
              >
                <Text style={styles.modalSaveText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <FactEditModal
        visible={factModalVisible}
        initialText={editingFact?.text || ""}
        isEditing={!!editingFact}
        onSave={handleSaveFact}
        onCancel={handleCancelFact}
      />
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
    gap: 12,
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: 16,
    color: "#6B7280",
  },
  modalSaveButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalSaveButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  modalSaveText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
});
