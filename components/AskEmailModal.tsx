import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AskEmailModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AskEmailModal({ visible, onClose }: AskEmailModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const startChat = useAction(api.emailAgent.startChat);
  const continueChat = useAction(api.emailAgent.continueChat);

  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmedInput,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      let response: string;

      if (threadId) {
        // Continue existing thread
        const result = await continueChat({
          threadId,
          message: trimmedInput,
        });
        response = result.response;
      } else {
        // Start new thread
        const result = await startChat({
          message: trimmedInput,
        });
        setThreadId(result.threadId);
        response = result.response;
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Failed to send message:", err);
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, threadId, startChat, continueChat]);

  const handleClose = useCallback(() => {
    // Reset state when closing
    setMessages([]);
    setInput("");
    setThreadId(null);
    setIsLoading(false);
    onClose();
  }, [onClose]);

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text style={[styles.messageText, isUser && styles.userMessageText]}>
          {item.content}
        </Text>
      </View>
    );
  }, []);

  const exampleQuestions = [
    "When is my iFly reservation?",
    "What appointments do I have this week?",
    "Find my Amazon order confirmations",
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <Text style={styles.title}>Ask My Email</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Messages */}
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Ask about your emails</Text>
              <Text style={styles.emptySubtitle}>
                I can search through your emails to find information about
                reservations, appointments, orders, and more.
              </Text>
              <View style={styles.examplesContainer}>
                <Text style={styles.examplesTitle}>Try asking:</Text>
                {exampleQuestions.map((q, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.exampleButton}
                    onPress={() => setInput(q)}
                  >
                    <Text style={styles.exampleText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: true })
              }
            />
          )}

          {/* Loading indicator */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#6366F1" />
              <Text style={styles.loadingText}>Searching your emails...</Text>
            </View>
          )}

          {/* Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about your emails..."
              placeholderTextColor="#999"
              multiline
              maxLength={500}
              editable={!isLoading}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!input.trim() || isLoading) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <Text
                style={[
                  styles.sendButtonText,
                  (!input.trim() || isLoading) && styles.sendButtonTextDisabled,
                ]}
              >
                Send
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerSpacer: {
    width: 60,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  closeButton: {
    minWidth: 60,
    alignItems: "flex-end",
  },
  closeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6366F1",
  },
  emptyState: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  examplesContainer: {
    alignItems: "center",
  },
  examplesTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  exampleButton: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
    width: "100%",
    maxWidth: 300,
  },
  exampleText: {
    fontSize: 15,
    color: "#374151",
    textAlign: "center",
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: "85%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userBubble: {
    backgroundColor: "#6366F1",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: "#F3F4F6",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#1a1a1a",
  },
  userMessageText: {
    color: "#fff",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1a1a1a",
    maxHeight: 100,
    padding: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  sendButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#E0E0E0",
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  sendButtonTextDisabled: {
    color: "#999",
  },
});
