import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  UIManager,
} from "react-native";
import { router } from "expo-router";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useGmail, GmailEmail } from "../../hooks/useGmail";
import { useVoiceRecording } from "../../hooks/useDailyVoice";
import { PullToReplyInbox, InboxEmail } from "../../components/PullToReplyInbox";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function toInboxEmail(email: GmailEmail): InboxEmail {
  return {
    _id: email._id,
    subject: email.subject,
    bodyPreview: email.bodyPreview,
    receivedAt: email.receivedAt,
    isRead: email.isRead,
    isTriaged: false,
    urgencyScore: email.urgencyScore,
    summary: email.summary,
    urgencyReason: email.urgencyReason,
    actionRequired: email.actionRequired,
    quickReplies: email.quickReplies,
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

  const {
    startRecording,
    stopRecording,
    cancelRecording,
    transcript,
    isConnecting,
    isConnected,
  } = useVoiceRecording();

  const sendEmailAction = useAction(api.gmailSend.sendReply);

  const emails = gmailEmails.map(toInboxEmail);
  const isRecording = isConnecting || isConnected;

  const handleEmailLongPress = useCallback((emailId: string) => {
    // Navigate to full email on long press
    router.push(`/email/${emailId}`);
  }, []);

  const handleRefresh = useCallback(async () => {
    await syncWithGmail();
  }, [syncWithGmail]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isSyncing) {
      loadMore();
    }
  }, [hasMore, isSyncing, loadMore]);

  const handleSendReply = useCallback(async (
    emailId: string,
    to: string,
    subject: string,
    body: string
  ) => {
    if (!userEmail) throw new Error("Not authenticated");

    await sendEmailAction({
      userEmail,
      to,
      subject,
      body,
      inReplyTo: emailId,
    });
  }, [userEmail, sendEmailAction]);

  const renderEmailItem = useCallback(({ item }: { item: InboxEmail }) => {
    const fromName = item.fromContact?.name || item.fromContact?.email || "Unknown";
    const timeAgo = formatTimeAgo(item.receivedAt);

    return (
      <TouchableOpacity
        style={[
          styles.emailItem,
          !item.isRead && styles.emailItemUnread,
        ]}
        onPress={() => router.push(`/email/${item._id}`)}
        onLongPress={() => handleEmailLongPress(item._id)}
        activeOpacity={0.7}
      >
        <View style={styles.emailContent}>
          <View style={styles.emailHeader}>
            <View style={styles.senderRow}>
              {!item.isRead && <View style={styles.unreadDot} />}
              <Text style={[styles.senderName, !item.isRead && styles.textBold]} numberOfLines={1}>
                {fromName}
              </Text>
              <Text style={styles.timeAgo}>{timeAgo}</Text>
            </View>

            <Text style={[styles.subject, !item.isRead && styles.textBold]} numberOfLines={1}>
              {decodeHtmlEntities(item.subject)}
            </Text>
          </View>

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
        </View>

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
  }, [handleEmailLongPress]);

  return (
    <PullToReplyInbox
      emails={emails}
      isLoading={isLoading}
      isSyncing={isSyncing}
      isSummarizing={isSummarizing}
      hasMore={hasMore}
      userEmail={userEmail}
      startRecording={startRecording}
      stopRecording={stopRecording}
      cancelRecording={cancelRecording}
      transcript={transcript}
      isRecording={isRecording}
      onLoadMore={handleLoadMore}
      onRefresh={handleRefresh}
      onSendReply={handleSendReply}
      renderEmailItem={renderEmailItem}
    />
  );
}

const styles = StyleSheet.create({
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
  urgencyIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
});
