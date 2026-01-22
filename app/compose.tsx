import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  FlatList,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "../lib/authContext";
import { Id } from "../convex/_generated/dataModel";

export default function ComposeScreen() {
  const { replyTo, subject: initialSubject, emailId, body: initialBody, fromAccountId } = useLocalSearchParams<{
    replyTo?: string;
    subject?: string;
    emailId?: string;
    body?: string;
    fromAccountId?: string;
  }>();
  const { user } = useAuth();

  const [to, setTo] = useState(replyTo || "");
  const [subject, setSubject] = useState(initialSubject || "");
  const [body, setBody] = useState(initialBody || "");
  const [isSending, setIsSending] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(fromAccountId || null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const isReply = Boolean(replyTo);

  // Get user's Gmail accounts
  const gmailAccounts = useQuery(api.gmailAccountAuth.listGmailAccounts);

  // Get AI suggested reply if available (only if no body was passed)
  const originalEmail = useQuery(
    api.emails.getMyEmail,
    emailId ? { emailId: emailId as Id<"emails"> } : "skip"
  );

  // Pre-fill with AI suggested reply if available and no body was passed
  useEffect(() => {
    if (originalEmail?.suggestedReply && !body && !initialBody) {
      setBody(originalEmail.suggestedReply);
    }
  }, [originalEmail?.suggestedReply]);

  // Auto-select account once when data becomes available
  const hasAutoSelected = React.useRef(false);
  useEffect(() => {
    if (hasAutoSelected.current) return;

    // First priority: use account from original email when replying
    if (originalEmail?.gmailAccountId) {
      setSelectedAccountId(originalEmail.gmailAccountId);
      hasAutoSelected.current = true;
      return;
    }

    // Second priority: use primary account
    if (gmailAccounts && gmailAccounts.length > 0) {
      const primaryAccount = gmailAccounts.find((a: { isPrimary: boolean }) => a.isPrimary) || gmailAccounts[0];
      setSelectedAccountId(primaryAccount._id);
      hasAutoSelected.current = true;
    }
  }, [originalEmail?.gmailAccountId, gmailAccounts]);

  // Get the selected account email
  const selectedAccount = useMemo(() => {
    if (!gmailAccounts || !selectedAccountId) return null;
    return gmailAccounts.find((a: { _id: string }) => a._id === selectedAccountId) || null;
  }, [gmailAccounts, selectedAccountId]);

  // Send email action
  const sendEmailAction = useAction(api.gmailSend.sendEmail);

  const handleSend = useCallback(async () => {
    if (!to.trim()) {
      Alert.alert("Error", "Please enter a recipient");
      return;
    }

    if (!body.trim()) {
      Alert.alert("Error", "Please enter a message");
      return;
    }

    // Use selected account email, or fall back to user email
    const senderEmail = selectedAccount?.email || user?.email;
    if (!senderEmail) {
      Alert.alert("Error", "Not authenticated");
      return;
    }

    setIsSending(true);

    try {
      await sendEmailAction({
        userEmail: senderEmail,
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
        replyToMessageId: emailId,
      });

      Alert.alert("Success", "Email sent!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Send failed:", error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to send email"
      );
    } finally {
      setIsSending(false);
    }
  }, [to, subject, body, selectedAccount?.email, user?.email, emailId, sendEmailAction]);

  const handleDiscard = useCallback(() => {
    console.log("Cancel pressed - going back");
    router.back();
  }, []);

  const handleAISuggest = useCallback(() => {
    if (originalEmail?.suggestedReply) {
      setBody(originalEmail.suggestedReply);
    } else {
      Alert.alert(
        "AI Assistant",
        "No AI suggestion available for this email yet."
      );
    }
  }, [originalEmail?.suggestedReply]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Custom header for better cross-platform support */}
      <View style={styles.header}>
        <Pressable
          onPress={handleDiscard}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.headerButtonPressed,
          ]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.headerButtonCancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{isReply ? "Reply" : "New Email"}</Text>
        <TouchableOpacity
          onPress={handleSend}
          style={styles.headerButton}
          disabled={isSending}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#6366F1" />
          ) : (
            <Text style={styles.headerButtonSend}>Send</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
          {/* From field (account selector) */}
          {gmailAccounts && gmailAccounts.length > 1 && (
            <>
              <TouchableOpacity
                style={styles.fieldRow}
                onPress={() => setShowAccountPicker(true)}
              >
                <Text style={styles.fieldLabel}>From:</Text>
                <Text style={styles.fieldInputText}>
                  {selectedAccount?.email || user?.email || "Select account"}
                </Text>
                <Text style={styles.chevron}>▼</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
            </>
          )}

          {/* To field */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>To:</Text>
            <TextInput
              style={styles.fieldInput}
              value={to}
              onChangeText={setTo}
              placeholder="recipient@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.divider} />

          {/* Subject field */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Subject:</Text>
            <TextInput
              style={styles.fieldInput}
              value={subject}
              onChangeText={setSubject}
              placeholder="Enter subject"
            />
          </View>

          <View style={styles.divider} />

          {/* Body */}
          <TextInput
            style={styles.bodyInput}
            value={body}
            onChangeText={setBody}
            placeholder="Write your message..."
            multiline
            textAlignVertical="top"
          />
        </ScrollView>

        {/* AI assist button */}
        {originalEmail?.suggestedReply && (
          <View style={styles.toolbar}>
            <TouchableOpacity style={styles.aiButton} onPress={handleAISuggest}>
              <View style={styles.aiIcon}>
                <Text style={styles.aiIconText}>AI</Text>
              </View>
              <Text style={styles.aiButtonText}>Use suggested reply</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Account picker modal */}
      <Modal
        visible={showAccountPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAccountPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAccountPicker(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Send from</Text>
            <FlatList
              data={gmailAccounts || []}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.accountItem,
                    item._id === selectedAccountId && styles.accountItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedAccountId(item._id);
                    setShowAccountPicker(false);
                  }}
                >
                  <Text style={styles.accountEmail}>{item.email}</Text>
                  {item.isPrimary && (
                    <Text style={styles.primaryBadge}>Primary</Text>
                  )}
                  {item._id === selectedAccountId && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowAccountPicker(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 60,
  },
  headerButtonPressed: {
    opacity: 0.5,
  },
  headerButtonCancel: {
    color: "#666",
    fontSize: 17,
  },
  headerButtonSend: {
    color: "#6366F1",
    fontSize: 17,
    fontWeight: "600",
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fieldLabel: {
    width: 70,
    fontSize: 16,
    color: "#666",
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: "#1a1a1a",
    padding: 0,
  },
  fieldInputText: {
    flex: 1,
    fontSize: 16,
    color: "#1a1a1a",
  },
  chevron: {
    fontSize: 12,
    color: "#999",
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginLeft: 16,
  },
  bodyInput: {
    flex: 1,
    fontSize: 16,
    color: "#1a1a1a",
    padding: 16,
    minHeight: 200,
  },
  toolbar: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    padding: 12,
    backgroundColor: "#F8F9FA",
  },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E4FF",
    alignSelf: "flex-start",
  },
  aiIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  aiIconText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  aiButtonText: {
    fontSize: 14,
    color: "#6366F1",
    fontWeight: "500",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    paddingBottom: 34,
    maxHeight: "50%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  accountItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  accountItemSelected: {
    backgroundColor: "#F0F0FF",
  },
  accountEmail: {
    flex: 1,
    fontSize: 16,
    color: "#1a1a1a",
  },
  primaryBadge: {
    fontSize: 12,
    color: "#6366F1",
    backgroundColor: "#E0E4FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  checkmark: {
    fontSize: 18,
    color: "#6366F1",
    fontWeight: "600",
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#666",
  },
});
