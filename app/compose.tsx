import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";

export default function ComposeScreen() {
  const { replyTo } = useLocalSearchParams<{ replyTo?: string }>();

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(replyTo ? "Re: " : "");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const isReply = Boolean(replyTo);

  const handleSend = useCallback(async () => {
    if (!to.trim()) {
      Alert.alert("Error", "Please enter a recipient");
      return;
    }

    if (!body.trim()) {
      Alert.alert("Error", "Please enter a message");
      return;
    }

    setIsSending(true);

    try {
      // In production, call Gmail API to send
      await new Promise((resolve) => setTimeout(resolve, 1000));

      Alert.alert("Success", "Email sent!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to send email. Please try again.");
    } finally {
      setIsSending(false);
    }
  }, [to, body]);

  const handleDiscard = useCallback(() => {
    if (to.trim() || subject.trim() || body.trim()) {
      Alert.alert(
        "Discard Draft",
        "Are you sure you want to discard this email?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  }, [to, subject, body]);

  const handleAISuggest = useCallback(() => {
    // In production, call AI to generate response
    Alert.alert(
      "AI Assistant",
      "Would you like me to help draft a response?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Generate",
          onPress: () => {
            setBody(
              "Thanks for your email. I've reviewed the information and here are my thoughts:\n\n[Your response here]\n\nLet me know if you have any questions."
            );
          },
        },
      ]
    );
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: isReply ? "Reply" : "New Email",
          headerLeft: () => (
            <TouchableOpacity onPress={handleDiscard} style={styles.headerButton}>
              <Text style={styles.headerButtonCancel}>Cancel</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSend}
              style={styles.headerButton}
              disabled={isSending}
            >
              <Text
                style={[
                  styles.headerButtonSend,
                  isSending && styles.headerButtonDisabled,
                ]}
              >
                {isSending ? "Sending..." : "Send"}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

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
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.aiButton} onPress={handleAISuggest}>
            <View style={styles.aiIcon}>
              <Text style={styles.aiIconText}>AI</Text>
            </View>
            <Text style={styles.aiButtonText}>Suggest response</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButtonCancel: {
    color: "#666",
    fontSize: 16,
  },
  headerButtonSend: {
    color: "#6366F1",
    fontSize: 16,
    fontWeight: "600",
  },
  headerButtonDisabled: {
    color: "#999",
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
