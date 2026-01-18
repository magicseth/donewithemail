import React, { useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useGmail, GmailEmail } from "../../hooks/useGmail";

interface InboxEmail {
  _id: string;
  subject: string;
  bodyPreview: string;
  receivedAt: number;
  isRead: boolean;
  isTriaged: boolean;
  triageAction?: "done" | "reply_needed" | "delegated";
  urgencyScore?: number;
  fromContact?: {
    _id: string;
    email: string;
    name?: string;
  } | null;
}

// Convert Gmail email to InboxEmail format
function toInboxEmail(email: GmailEmail): InboxEmail {
  return {
    _id: email.id,
    subject: email.subject,
    bodyPreview: email.snippet,
    receivedAt: email.receivedAt,
    isRead: email.isRead,
    isTriaged: false,
    fromContact: {
      _id: email.from.email,
      email: email.from.email,
      name: email.from.name,
    },
  };
}

export default function InboxScreen() {
  const { isAuthenticated, emails: gmailEmails, isLoading, fetchEmails, refetch } = useGmail();
  const [refreshing, setRefreshing] = React.useState(false);

  // Fetch emails when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchEmails();
    }
  }, [isAuthenticated, fetchEmails]);

  // Convert Gmail emails to inbox format
  const emails = gmailEmails.map(toInboxEmail);

  const handleEmailPress = useCallback((emailId: string) => {
    router.push(`/email/${emailId}`);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderEmailItem = ({ item }: { item: InboxEmail }) => {
    const fromName = item.fromContact?.name || item.fromContact?.email || "Unknown";
    const timeAgo = formatTimeAgo(item.receivedAt);

    return (
      <TouchableOpacity
        style={[styles.emailItem, !item.isRead && styles.emailItemUnread]}
        onPress={() => handleEmailPress(item._id)}
      >
        <View style={styles.emailHeader}>
          <View style={styles.senderRow}>
            {!item.isRead && <View style={styles.unreadDot} />}
            <Text
              style={[styles.senderName, !item.isRead && styles.textBold]}
              numberOfLines={1}
            >
              {fromName}
            </Text>
            <Text style={styles.timeAgo}>{timeAgo}</Text>
          </View>

          <View style={styles.subjectRow}>
            <Text
              style={[styles.subject, !item.isRead && styles.textBold]}
              numberOfLines={1}
            >
              {item.subject}
            </Text>
            {item.triageAction && (
              <View
                style={[
                  styles.triageBadge,
                  item.triageAction === "reply_needed" && styles.triageBadgeReply,
                ]}
              >
                <Text style={styles.triageBadgeText}>
                  {item.triageAction === "done"
                    ? "✓"
                    : item.triageAction === "reply_needed"
                    ? "↩"
                    : "→"}
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.preview} numberOfLines={2}>
          {item.bodyPreview}
        </Text>

        {item.urgencyScore !== undefined && item.urgencyScore >= 50 && (
          <View
            style={[
              styles.urgencyIndicator,
              {
                backgroundColor:
                  item.urgencyScore >= 80 ? "#FF4444" : "#FFAA00",
              },
            ]}
          />
        )}
      </TouchableOpacity>
    );
  };

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
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No emails yet</Text>
          </View>
        }
      />

      {/* Compose FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/compose")}
      >
        <Text style={styles.fabIcon}>✏️</Text>
      </TouchableOpacity>
    </View>
  );
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
    position: "relative",
  },
  emailItemUnread: {
    backgroundColor: "#F8F9FF",
  },
  emailHeader: {
    marginBottom: 4,
  },
  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
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
  subjectRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subject: {
    flex: 1,
    fontSize: 15,
    color: "#1a1a1a",
  },
  textBold: {
    fontWeight: "600",
  },
  triageBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  triageBadgeReply: {
    backgroundColor: "#FF9800",
  },
  triageBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  preview: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
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
    fontSize: 16,
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
