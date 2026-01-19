import React, { useState, useCallback, useEffect } from "react";
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
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "../lib/authContext";
import { Id } from "../convex/_generated/dataModel";

export default function ComposeScreen() {
  const { replyTo, subject: initialSubject, emailId, body: initialBody } = useLocalSearchParams<{
    replyTo?: string;
    subject?: string;
    emailId?: string;
    body?: string;
  }>();
  const { user } = useAuth();

  const [to, setTo] = useState(replyTo || "");
  const [subject, setSubject] = useState(initialSubject || "");
  const [body, setBody] = useState(initialBody || "");
  const [isSending, setIsSending] = useState(false);

  const isReply = Boolean(replyTo);

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

    if (!user?.email) {
      Alert.alert("Error", "Not authenticated");
      return;
    }

    setIsSending(true);

    try {
      await sendEmailAction({
        userEmail: user.email,
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
  }, [to, subject, body, user?.email, emailId, sendEmailAction]);

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
});
