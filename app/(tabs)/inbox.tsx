import React, { useCallback, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  UIManager,
} from "react-native";
import { router } from "expo-router";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useGmail, GmailEmail, QuickReply } from "../../hooks/useGmail";
import { useVoiceRecording } from "../../hooks/useDailyVoice";

// Cross-platform alert that works on web too
function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}: ${message}`);
  } else {
    showAlert(title, message);
  }
}

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface InboxEmail {
  _id: string;
  subject: string;
  bodyPreview: string;
  receivedAt: number;
  isRead: boolean;
  urgencyScore?: number;
  summary?: string;
  quickReplies?: QuickReply[];
  threadCount?: number;
  fromContact?: {
    _id: string;
    email: string;
    name?: string;
  } | null;
}

function toInboxEmail(email: GmailEmail): InboxEmail {
  return {
    _id: email._id,
    subject: email.subject,
    bodyPreview: email.bodyPreview,
    receivedAt: email.receivedAt,
    isRead: email.isRead,
    urgencyScore: email.urgencyScore,
    summary: email.summary,
    quickReplies: email.quickReplies,
    threadCount: email.threadCount,
    fromContact: email.fromContact ? {
      _id: email.fromContact._id,
      email: email.fromContact.email,
      name: email.fromContact.name,
    } : null,
  };
}

function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString();
}

export default function InboxScreen() {
  const { emails: gmailEmails, isLoading, isSyncing, isSummarizing, hasMore, syncWithGmail, loadMore, userEmail } = useGmail();
  const [refreshing, setRefreshing] = useState(false);
  const [sendingReplyFor, setSendingReplyFor] = useState<string | null>(null);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);

  const {
    startRecording,
    stopRecording,
    cancelRecording,
    transcript,
    isConnecting,
    isConnected,
  } = useVoiceRecording();

  const sendEmailAction = useAction(api.gmailSend.sendReply);
  const flatListRef = useRef<FlatList>(null);

  const emails = gmailEmails.map(toInboxEmail);
  const isRecording = isConnecting || isConnected;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncWithGmail();
    setRefreshing(false);
  }, [syncWithGmail]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isSyncing) {
      loadMore();
    }
  }, [hasMore, isSyncing, loadMore]);

  const handleQuickReply = useCallback(async (email: InboxEmail, reply: QuickReply) => {
    if (!userEmail) {
      showAlert("Error", "Not signed in. Please sign in again.");
      return;
    }

    if (!email.fromContact?.email) {
      showAlert("Error", "Cannot determine recipient email address.");
      return;
    }

    setSendingReplyFor(email._id);
    try {
      const subject = email.subject.startsWith("Re:")
        ? email.subject
        : `Re: ${email.subject}`;

      await sendEmailAction({
        userEmail,
        to: email.fromContact.email,
        subject,
        body: reply.body,
        inReplyTo: email._id,
      });

      // Reply sent successfully - no alert needed
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      showAlert("Error", `Failed to send reply: ${errorMessage}`);
      console.error("Failed to send quick reply:", err);
    } finally {
      setSendingReplyFor(null);
    }
  }, [userEmail, sendEmailAction]);

  const handleMicPressIn = useCallback(async (emailId: string) => {
    setRecordingFor(emailId);
    await startRecording();
  }, [startRecording]);

  const handleMicPressOut = useCallback(async (email: InboxEmail) => {
    if (!recordingFor) {
      cancelRecording();
      setRecordingFor(null);
      return;
    }

    const finalTranscript = await stopRecording();
    setRecordingFor(null);

    if (!finalTranscript.trim()) {
      showAlert("No speech detected", "Please try recording again.");
      return;
    }

    if (!userEmail) {
      showAlert("Error", "Not signed in. Please sign in again.");
      return;
    }

    if (!email.fromContact?.email) {
      showAlert("Error", "Cannot determine recipient email address.");
      return;
    }

    setSendingReplyFor(email._id);
    try {
      const subject = email.subject.startsWith("Re:")
        ? email.subject
        : `Re: ${email.subject}`;

      await sendEmailAction({
        userEmail,
        to: email.fromContact.email,
        subject,
        body: finalTranscript,
        inReplyTo: email._id,
      });

      // Voice reply sent successfully - no alert needed
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      showAlert("Error", `Failed to send reply: ${errorMessage}`);
      console.error("Failed to send voice reply:", err);
    } finally {
      setSendingReplyFor(null);
    }
  }, [recordingFor, userEmail, stopRecording, cancelRecording, sendEmailAction]);

  const renderEmailItem = useCallback(({ item }: { item: InboxEmail }) => {
    const fromName = item.fromContact?.name || item.fromContact?.email || "Unknown";
    const timeAgo = formatTimeAgo(item.receivedAt);
    const isSending = sendingReplyFor === item._id;
    const isRecordingThis = recordingFor === item._id;

    return (
      <TouchableOpacity
        style={[
          styles.emailItem,
          !item.isRead && styles.emailItemUnread,
        ]}
        onPress={() => router.push(`/email/${item._id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.emailContent}>
          {/* Header row */}
          <View style={styles.emailHeader}>
            <View style={styles.senderRow}>
              {!item.isRead && <View style={styles.unreadDot} />}
              <Text style={[styles.senderName, !item.isRead && styles.textBold]} numberOfLines={1}>
                {fromName}
              </Text>
              {item.threadCount && item.threadCount > 1 && (
                <View style={styles.threadBadge}>
                  <Text style={styles.threadBadgeText}>{item.threadCount}</Text>
                </View>
              )}
              <Text style={styles.timeAgo}>{timeAgo}</Text>
            </View>

            <Text style={[styles.subject, !item.isRead && styles.textBold]} numberOfLines={1}>
              {decodeHtmlEntities(item.subject)}
            </Text>
          </View>

          {/* Summary or preview */}
          {item.summary ? (
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryLabel}>AI Summary</Text>
              <Text style={styles.summaryText} numberOfLines={2}>
                {item.summary}
              </Text>
            </View>
          ) : (
            <Text style={styles.preview} numberOfLines={2}>
              {decodeHtmlEntities(item.bodyPreview)}
            </Text>
          )}

          {/* Quick reply chips with mic button */}
          <View style={styles.quickReplyRow}>
            {item.quickReplies && item.quickReplies.slice(0, 3).map((reply, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.quickReplyChip,
                  idx === 0 && styles.quickReplyChipPrimary,
                  isSending && styles.quickReplyChipDisabled,
                ]}
                onPress={() => handleQuickReply(item, reply)}
                disabled={isSending || isRecording}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color={idx === 0 ? "#fff" : "#6366F1"} />
                ) : (
                  <Text
                    style={[
                      styles.quickReplyText,
                      idx === 0 && styles.quickReplyTextPrimary,
                    ]}
                    numberOfLines={1}
                  >
                    {reply.label}
                  </Text>
                )}
              </TouchableOpacity>
            ))}

            {/* Mic button - always visible */}
            <TouchableOpacity
              style={[
                styles.micButton,
                isRecordingThis && styles.micButtonRecording,
              ]}
              onPressIn={() => handleMicPressIn(item._id)}
              onPressOut={() => handleMicPressOut(item)}
              disabled={isSending || (isRecording && !isRecordingThis)}
              activeOpacity={0.7}
            >
              <Text style={styles.micIcon}>
                {isRecordingThis ? "🔴" : "🎤"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Show recording status */}
          {isRecordingThis ? (
            <View style={styles.transcriptPreview}>
              <Text style={styles.transcriptText}>
                {transcript || "Listening..."}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Urgency indicator */}
        {item.urgencyScore !== undefined && item.urgencyScore >= 50 && (
          <View
            style={[
              styles.urgencyIndicator,
              { backgroundColor: item.urgencyScore >= 80 ? "#FF4444" : "#FFAA00" },
            ]}
          />
        )}
      </TouchableOpacity>
    );
  }, [sendingReplyFor, recordingFor, transcript, isRecording, handleQuickReply, handleMicPressIn, handleMicPressOut]);

  if (isLoading && emails.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={emails}
        keyExtractor={(item) => item._id}
        renderItem={renderEmailItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No emails yet</Text>
            <Text style={styles.emptySubtext}>Pull down to sync</Text>
          </View>
        }
        ListFooterComponent={
          isSyncing || isSummarizing ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color="#6366F1" />
              <Text style={styles.loadingMoreText}>
                {isSyncing ? "Syncing..." : "Summarizing with AI..."}
              </Text>
            </View>
          ) : null
        }
      />

      {/* Compose FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push("/compose")}>
        <Text style={styles.fabIcon}>✏️</Text>
      </TouchableOpacity>
    </View>
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
  },
  listContent: {
    paddingBottom: 100,
  },
  emailItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  emailItemUnread: {
    backgroundColor: "#F8F9FF",
  },
  emailContent: {
    flex: 1,
  },
  emailHeader: {
    marginBottom: 6,
  },
  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6366F1",
    marginRight: 8,
  },
  senderName: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
  timeAgo: {
    fontSize: 13,
    color: "#999",
    marginLeft: 8,
  },
  threadBadge: {
    backgroundColor: "#E8EAFF",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  threadBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6366F1",
  },
  subject: {
    fontSize: 15,
    color: "#1a1a1a",
  },
  textBold: {
    fontWeight: "600",
  },
  preview: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginTop: 4,
  },
  summaryContainer: {
    backgroundColor: "#E8EAFF",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6366F1",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  quickReplyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  quickReplyChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  quickReplyChipPrimary: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  quickReplyChipDisabled: {
    opacity: 0.5,
  },
  quickReplyText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#333",
  },
  quickReplyTextPrimary: {
    color: "#fff",
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: "auto",
  },
  micButtonRecording: {
    backgroundColor: "#FEE2E2",
  },
  micIcon: {
    fontSize: 18,
  },
  transcriptPreview: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
  },
  transcriptText: {
    fontSize: 13,
    color: "#92400E",
    fontStyle: "italic",
  },
  urgencyIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  loadingMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 14,
    color: "#666",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabIcon: {
    fontSize: 24,
  },
});
