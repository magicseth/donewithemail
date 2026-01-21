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
import { VoiceRecordButton } from "../../components/VoiceRecordButton";
import { useAuth } from "../../lib/authContext";

interface CalendarEventInfo {
  title: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  emailId?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolResults?: any[];
  calendarEvent?: CalendarEventInfo;
}

interface ThreadInfo {
  threadId: string;
  title: string | null;
  createdAt: number;
  firstMessage: string | null;
}

export default function AskScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [streamingTranscript, setStreamingTranscript] = useState("");
  const [processingStages, setProcessingStages] = useState<string[]>([]);
  const [relevantEmails, setRelevantEmails] = useState<Array<{ subject: string; from: string }>>([]);
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const { user } = useAuth();

  const startChat = useAction(api.emailAgent.startChat);
  const continueChat = useAction(api.emailAgent.continueChat);
  const listThreads = useAction(api.chatHistory.listThreads);
  const deleteThread = useAction(api.chatHistory.deleteThread);
  const getThreadMessages = useAction(api.chatHistory.getThreadMessages);
  const addToCalendar = useAction(api.calendar.addToCalendar);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

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
    setProcessingStages([]);
    setRelevantEmails([]);

    try {
      let response: string;
      let toolResults: any[] | undefined;

      // Show initial searching stage
      setProcessingStages(["Searching emails..."]);

      if (threadId) {
        // Continue existing thread
        const result = await continueChat({
          threadId,
          message: trimmedInput,
        });
        response = result.response;
        toolResults = result.toolResults;
      } else {
        // Start new thread
        const result = await startChat({
          message: trimmedInput,
        });
        setThreadId(result.threadId);
        response = result.response;
        toolResults = result.toolResults;
      }

      // Process tool results to extract and display relevant emails
      let calendarEvent: CalendarEventInfo | undefined;
      if (toolResults && toolResults.length > 0) {
        const emails: Array<{ subject: string; from: string }> = [];
        const stages: string[] = ["Searching emails..."];

        toolResults.forEach((toolResult: any) => {
          if (toolResult.result?.emails && Array.isArray(toolResult.result.emails)) {
            // Extract emails from search results
            toolResult.result.emails.forEach((email: any) => {
              if (email.subject && email.from) {
                emails.push({
                  subject: email.subject,
                  from: email.from,
                });
              }
            });
            if (emails.length > 0) {
              setRelevantEmails(emails);
              stages.push(`Found ${emails.length} relevant email${emails.length > 1 ? 's' : ''}`);
            }
          }

          // Detect other tool calls
          if (toolResult.toolName === "getEmailDetails") {
            stages.push("Analyzing email content...");
            // Check if the email has calendar event data
            if (toolResult.result?.calendarEvent) {
              calendarEvent = {
                title: toolResult.result.calendarEvent.title,
                startTime: toolResult.result.calendarEvent.startTime,
                endTime: toolResult.result.calendarEvent.endTime,
                location: toolResult.result.calendarEvent.location,
                description: toolResult.result.calendarEvent.description,
                emailId: toolResult.args?.emailId,
              };
            }
          } else if (toolResult.toolName === "createCalendarEvent") {
            stages.push("Creating calendar event...");
          }
        });

        stages.push("Generating response...");
        setProcessingStages(stages);

        // Give user time to see the stages
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        toolResults,
        calendarEvent,
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
      setProcessingStages([]);
      setRelevantEmails([]);
    }
  }, [input, isLoading, threadId, startChat, continueChat]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setInput("");
    setThreadId(null);
  }, []);

  const handleVoiceTranscript = useCallback((transcript: string) => {
    // Auto-fill the input with voice transcript
    setInput(transcript);
    setIsRecordingVoice(false);
    setStreamingTranscript("");
  }, []);

  const handleStreamingTranscript = useCallback((transcript: string) => {
    // Update streaming transcript in real-time
    setStreamingTranscript(transcript);
  }, []);

  const handleVoiceError = useCallback((error: string) => {
    Alert.alert("Voice Recording Error", error);
    setIsRecordingVoice(false);
  }, []);

  const handleVoiceRecordingStart = useCallback(() => {
    setIsRecordingVoice(true);
    setStreamingTranscript("");
  }, []);

  const handleVoiceRecordingEnd = useCallback(() => {
    setIsRecordingVoice(false);
  }, []);

  const handleAddToCalendar = useCallback(async (event: CalendarEventInfo) => {
    if (!user?.email) {
      Alert.alert("Error", "Not signed in");
      return;
    }

    // Get client timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";

    setIsAddingToCalendar(true);
    try {
      const result = await addToCalendar({
        userEmail: user.email,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        description: event.description,
        timezone,
        emailId: event.emailId as Id<"emails"> | undefined,
      });

      Alert.alert("Success", "Event added to calendar!");

      // Open the calendar link on web
      if (Platform.OS === "web" && result.htmlLink) {
        window.open(result.htmlLink, "_blank");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add event";
      Alert.alert("Error", message);
      console.error("Failed to add to calendar:", err);
    } finally {
      setIsAddingToCalendar(false);
    }
  }, [user?.email, addToCalendar]);

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
        <View>
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
          {/* Show calendar event button if available */}
          {!isUser && item.calendarEvent && (
            <View style={styles.calendarEventContainer}>
              <View style={styles.calendarEventInfo}>
                <Text style={styles.calendarEventTitle}>📅 {item.calendarEvent.title}</Text>
                {item.calendarEvent.startTime && (
                  <Text style={styles.calendarEventTime}>
                    {new Date(item.calendarEvent.startTime).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                )}
                {item.calendarEvent.location && (
                  <Text style={styles.calendarEventLocation}>📍 {item.calendarEvent.location}</Text>
                )}
              </View>
              <TouchableOpacity
                style={[styles.addToCalendarButton, isAddingToCalendar && styles.addToCalendarButtonDisabled]}
                onPress={() => handleAddToCalendar(item.calendarEvent!)}
                disabled={isAddingToCalendar}
              >
                {isAddingToCalendar ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.addToCalendarButtonText}>Add to Calendar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    },
    [markdownStyles, handleLinkPress, handleAddToCalendar, isAddingToCalendar]
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
      {/* Header with New Chat button when in active conversation */}
      {messages.length > 0 && (
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.newChatButton} onPress={handleNewChat}>
            <Text style={styles.newChatText}>New Chat</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages or Empty State with History */}
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.topSection}>
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

          {/* History section integrated into empty state */}
          {isLoadingHistory ? (
            <View style={styles.historyLoadingContainer}>
              <ActivityIndicator size="small" color="#6366F1" />
              <Text style={styles.historyLoadingText}>Loading history...</Text>
            </View>
          ) : threads.length > 0 ? (
            <View style={styles.historySection}>
              <Text style={styles.historySectionTitle}>Recent Conversations</Text>
              {threads.slice(0, 5).map((thread) => {
                const isDeleting = deletingThreadId === thread.threadId;
                const date = new Date(thread.createdAt);
                const dateStr = date.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                });
                return (
                  <View key={thread.threadId} style={styles.threadItem}>
                    <TouchableOpacity
                      style={styles.threadContent}
                      onPress={() => handleResumeThread(thread)}
                      disabled={isDeleting}
                    >
                      <Text style={styles.threadMessage} numberOfLines={1}>
                        {thread.firstMessage || "Empty conversation"}
                      </Text>
                      <Text style={styles.threadDate}>{dateStr}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteThread(thread)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <Text style={styles.deleteButtonText}>×</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : null}
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

      {/* Relevant emails being processed */}
      {isLoading && relevantEmails.length > 0 && (
        <View style={styles.relevantEmailsContainer}>
          <Text style={styles.relevantEmailsTitle}>Relevant Emails:</Text>
          {relevantEmails.map((email, index) => (
            <View key={index} style={styles.relevantEmailItem}>
              <View style={styles.emailDot} />
              <View style={styles.emailInfo}>
                <Text style={styles.emailSubject} numberOfLines={1}>
                  {email.subject}
                </Text>
                <Text style={styles.emailFrom} numberOfLines={1}>
                  {email.from}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Loading indicator with processing stages */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6366F1" />
          <View style={styles.loadingTextContainer}>
            {processingStages.length === 0 ? (
              <Text style={styles.loadingText}>Processing your question...</Text>
            ) : (
              processingStages.map((stage, index) => (
                <View key={index} style={styles.stageRow}>
                  <Text style={styles.stageCheckmark}>✓</Text>
                  <Text style={[styles.stageText, index === processingStages.length - 1 && styles.stageTextActive]}>
                    {stage}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* Real-time transcript display */}
      {isRecordingVoice && streamingTranscript && (
        <View style={styles.transcriptContainer}>
          <Text style={styles.transcriptLabel}>Listening...</Text>
          <Text style={styles.transcriptText}>{streamingTranscript}</Text>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type or speak your question..."
          placeholderTextColor="#999"
          multiline
          maxLength={500}
          editable={!isLoading && !isRecordingVoice}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <VoiceRecordButton
          onTranscript={handleVoiceTranscript}
          onStreamingTranscript={handleStreamingTranscript}
          onError={handleVoiceError}
          onRecordingStart={handleVoiceRecordingStart}
          onRecordingEnd={handleVoiceRecordingEnd}
          disabled={isLoading}
          size="medium"
          style={styles.voiceButton}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!input.trim() || isLoading || isRecordingVoice) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!input.trim() || isLoading || isRecordingVoice}
        >
          <Text
            style={[
              styles.sendButtonText,
              (!input.trim() || isLoading || isRecordingVoice) && styles.sendButtonTextDisabled,
            ]}
          >
            Send
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  headerContainer: {
    flexDirection: "row",
    padding: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    justifyContent: "flex-end",
  },
  newChatButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  newChatText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6366F1",
  },
  // History styles integrated into empty state
  historyLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    gap: 8,
  },
  historyLoadingText: {
    fontSize: 14,
    color: "#666",
  },
  historySection: {
    marginTop: 32,
    width: "100%",
    maxWidth: 300,
    alignSelf: "center",
  },
  historySectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
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
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  threadMessage: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a1a",
    flex: 1,
    marginRight: 8,
  },
  threadDate: {
    fontSize: 12,
    color: "#999",
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 20,
    fontWeight: "400",
    color: "#999",
  },
  // Chat styles
  emptyState: {
    flex: 1,
    padding: 24,
  },
  topSection: {
    flex: 1,
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
    alignItems: "flex-start",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  loadingTextContainer: {
    flex: 1,
    alignItems: "flex-start",
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  stageCheckmark: {
    fontSize: 14,
    color: "#10B981",
  },
  stageText: {
    fontSize: 14,
    color: "#999",
  },
  stageTextActive: {
    color: "#6366F1",
    fontWeight: "500",
  },
  transcriptContainer: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#DC2626",
  },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#DC2626",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  transcriptText: {
    fontSize: 15,
    color: "#1a1a1a",
    lineHeight: 22,
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
  voiceButton: {
    alignSelf: "flex-end",
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
  relevantEmailsContainer: {
    backgroundColor: "#F0F9FF",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  relevantEmailsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0284C7",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  relevantEmailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 8,
  },
  emailDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0284C7",
    marginTop: 6,
  },
  emailInfo: {
    flex: 1,
  },
  emailSubject: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  emailFrom: {
    fontSize: 11,
    color: "#666",
  },
  calendarEventContainer: {
    marginTop: 8,
    marginLeft: 0,
    marginRight: "15%",
    backgroundColor: "#F0F9FF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  calendarEventInfo: {
    marginBottom: 12,
  },
  calendarEventTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 6,
  },
  calendarEventTime: {
    fontSize: 14,
    color: "#0284C7",
    marginBottom: 4,
    fontWeight: "500",
  },
  calendarEventLocation: {
    fontSize: 13,
    color: "#666",
  },
  addToCalendarButton: {
    backgroundColor: "#0284C7",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  addToCalendarButtonDisabled: {
    backgroundColor: "#BAE6FD",
  },
  addToCalendarButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
