import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import Markdown from "react-native-markdown-display";
import { useRouter } from "expo-router";
import { Id } from "../../convex/_generated/dataModel";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ThreadInfo {
  threadId: string;
  title: string | null;
  createdAt: number;
  firstMessage: string | null;
}

type ViewMode = "chat" | "history";

export default function AskScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  const startChat = useAction(api.emailAgent.startChat);
  const continueChat = useAction(api.emailAgent.continueChat);
  const listThreads = useAction(api.chatHistory.listThreads);
  const deleteThread = useAction(api.chatHistory.deleteThread);
  const getThreadMessages = useAction(api.chatHistory.getThreadMessages);

  // Load history when switching to history view
  useEffect(() => {
    if (viewMode === "history") {
      loadHistory();
    }
  }, [viewMode]);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const result = await listThreads({});
      setThreads(result);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [listThreads]);

  // Handle link presses in markdown - intercept email: links
  const handleLinkPress = useCallback(
    (url: string) => {
      if (url.startsWith("email:")) {
        const emailId = url.replace("email:", "") as Id<"emails">;
        router.push(`/email/${emailId}`);
        return false; // Prevent default link handling
      }
      return true; // Allow default handling for other links
    },
    [router]
  );

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

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setInput("");
    setThreadId(null);
    setViewMode("chat");
  }, []);

  const handleResumeThread = useCallback(
    async (thread: ThreadInfo) => {
      setIsLoading(true);
      try {
        // Load messages for this thread
        const threadMessages = await getThreadMessages({ threadId: thread.threadId });

        // Convert to our Message format
        const loadedMessages: Message[] = threadMessages.map((m, i) => ({
          id: `${thread.threadId}-${i}`,
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        setMessages(loadedMessages);
        setThreadId(thread.threadId);
        setViewMode("chat");
      } catch (err) {
        console.error("Failed to load thread:", err);
        Alert.alert("Error", "Failed to load conversation");
      } finally {
        setIsLoading(false);
      }
    },
    [getThreadMessages]
  );

  const handleDeleteThread = useCallback(
    async (thread: ThreadInfo) => {
      Alert.alert(
        "Delete Conversation",
        "Are you sure you want to delete this conversation?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setDeletingThreadId(thread.threadId);
              try {
                await deleteThread({ threadId: thread.threadId });
                setThreads((prev) => prev.filter((t) => t.threadId !== thread.threadId));
              } catch (err) {
                console.error("Failed to delete thread:", err);
                Alert.alert("Error", "Failed to delete conversation");
              } finally {
                setDeletingThreadId(null);
              }
            },
          },
        ]
      );
    },
    [deleteThread]
  );

  // Markdown styles for assistant messages
  const markdownStyles = useMemo(
    () => ({
      body: {
        color: "#1a1a1a",
        fontSize: 15,
        lineHeight: 22,
      },
      strong: {
        fontWeight: "800" as const,
        color: "#1a1a1a",
      },
      em: {
        fontStyle: "italic" as const,
      },
      bullet_list: {
        marginVertical: 4,
      },
      ordered_list: {
        marginVertical: 4,
      },
      list_item: {
        marginVertical: 2,
      },
      paragraph: {
        marginVertical: 4,
      },
      heading1: {
        fontSize: 18,
        fontWeight: "700" as const,
        marginVertical: 6,
      },
      heading2: {
        fontSize: 17,
        fontWeight: "600" as const,
        marginVertical: 5,
      },
      heading3: {
        fontSize: 16,
        fontWeight: "600" as const,
        marginVertical: 4,
      },
      link: {
        color: "#6366F1",
        textDecorationLine: "underline" as const,
        fontWeight: "600" as const,
      },
    }),
    []
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isUser = item.role === "user";
      return (
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          {isUser ? (
            <Text style={[styles.messageText, styles.userMessageText]}>
              {item.content}
            </Text>
          ) : (
            <Markdown style={markdownStyles} onLinkPress={handleLinkPress}>
              {item.content}
            </Markdown>
          )}
        </View>
      );
    },
    [markdownStyles, handleLinkPress]
  );

  const renderThreadItem = useCallback(
    ({ item }: { item: ThreadInfo }) => {
      const isDeleting = deletingThreadId === item.threadId;
      const date = new Date(item.createdAt);
      const dateStr = date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      return (
        <View style={styles.threadItem}>
          <TouchableOpacity
            style={styles.threadContent}
            onPress={() => handleResumeThread(item)}
            disabled={isDeleting}
          >
            <Text style={styles.threadMessage} numberOfLines={2}>
              {item.firstMessage || "Empty conversation"}
            </Text>
            <Text style={styles.threadDate}>{dateStr}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteThread(item)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Text style={styles.deleteButtonText}>Delete</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [deletingThreadId, handleResumeThread, handleDeleteThread]
  );

  const exampleQuestions = [
    "When is my iFly reservation?",
    "What appointments do I have this week?",
    "Find my Amazon order confirmations",
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      {/* Toggle buttons */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === "chat" && styles.toggleButtonActive]}
          onPress={() => setViewMode("chat")}
        >
          <Text style={[styles.toggleText, viewMode === "chat" && styles.toggleTextActive]}>
            Chat
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === "history" && styles.toggleButtonActive]}
          onPress={() => setViewMode("history")}
        >
          <Text style={[styles.toggleText, viewMode === "history" && styles.toggleTextActive]}>
            History
          </Text>
        </TouchableOpacity>
        {viewMode === "chat" && messages.length > 0 && (
          <TouchableOpacity style={styles.newChatButton} onPress={handleNewChat}>
            <Text style={styles.newChatText}>New Chat</Text>
          </TouchableOpacity>
        )}
      </View>

      {viewMode === "history" ? (
        // History View
        isLoadingHistory ? (
          <View style={styles.loadingHistoryContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Loading history...</Text>
          </View>
        ) : threads.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyHistoryText}>No previous conversations</Text>
            <TouchableOpacity
              style={styles.startNewButton}
              onPress={handleNewChat}
            >
              <Text style={styles.startNewButtonText}>Start a new chat</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={threads}
            renderItem={renderThreadItem}
            keyExtractor={(item) => item.threadId}
            contentContainerStyle={styles.historyContent}
          />
        )
      ) : (
        // Chat View
        <>
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
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  toggleContainer: {
    flexDirection: "row",
    padding: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    alignItems: "center",
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: "#F3F4F6",
  },
  toggleButtonActive: {
    backgroundColor: "#6366F1",
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  toggleTextActive: {
    color: "#fff",
  },
  newChatButton: {
    marginLeft: "auto",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  newChatText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6366F1",
  },
  // History styles
  loadingHistoryContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyHistory: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyHistoryText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
  },
  startNewButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  startNewButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  historyContent: {
    padding: 16,
  },
  threadItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
  },
  threadContent: {
    flex: 1,
    padding: 14,
  },
  threadMessage: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  threadDate: {
    fontSize: 13,
    color: "#666",
  },
  deleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#EF4444",
  },
  // Chat styles
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
    paddingBottom: Platform.OS === "ios" ? 12 : 12,
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
