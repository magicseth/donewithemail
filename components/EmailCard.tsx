import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { AISummary } from "./AISummary";

export interface EmailCardData {
  _id: string;
  subject: string;
  bodyPreview: string;
  receivedAt: number;
  isRead: boolean;
  summary?: string;
  urgencyScore?: number;
  urgencyReason?: string;
  suggestedReply?: string;
  fromContact?: {
    _id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    relationship?: "vip" | "regular" | "unknown";
  };
}

interface EmailCardProps {
  email: EmailCardData;
  onPress?: () => void;
  onContactPress?: () => void;
  showFullContent?: boolean;
}

export function EmailCard({
  email,
  onPress,
  onContactPress,
  showFullContent = false,
}: EmailCardProps) {
  const fromName = email.fromContact?.name || email.fromContact?.email || "Unknown";
  const initials = getInitials(fromName);
  const timeAgo = formatTimeAgo(email.receivedAt);
  const isVip = email.fromContact?.relationship === "vip";

  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress
    ? { style: styles.container, onPress, activeOpacity: 0.9 }
    : { style: styles.container };

  return (
    <Container {...containerProps}>
      {/* Header with sender info */}
      <TouchableOpacity style={styles.header} onPress={onContactPress}>
        <View style={styles.avatarContainer}>
          {email.fromContact?.avatarUrl ? (
            <Image
              source={{ uri: email.fromContact.avatarUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          {isVip && <View style={styles.vipBadge} />}
        </View>

        <View style={styles.senderInfo}>
          <Text style={styles.senderName} numberOfLines={1}>
            {fromName}
          </Text>
          <Text style={styles.senderEmail} numberOfLines={1}>
            {email.fromContact?.email}
          </Text>
        </View>

        <Text style={styles.timeAgo}>{timeAgo}</Text>
      </TouchableOpacity>

      {/* Subject */}
      <Text style={styles.subject} numberOfLines={showFullContent ? undefined : 2}>
        {email.subject}
      </Text>

      {/* AI Summary */}
      {email.summary && (
        <AISummary
          summary={email.summary}
          urgencyScore={email.urgencyScore}
          urgencyReason={email.urgencyReason}
          suggestedReply={email.suggestedReply}
          compact={!showFullContent}
        />
      )}

      {/* Body preview */}
      <View style={styles.bodyContainer}>
        <Text
          style={styles.bodyText}
          numberOfLines={showFullContent ? undefined : 6}
        >
          {email.bodyPreview}
        </Text>
      </View>

      {/* Urgency indicator bar */}
      {email.urgencyScore !== undefined && (
        <View style={styles.urgencyBar}>
          <View
            style={[
              styles.urgencyFill,
              {
                width: `${email.urgencyScore}%`,
                backgroundColor: getUrgencyColor(email.urgencyScore),
              },
            ]}
          />
        </View>
      )}
    </Container>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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

function getUrgencyColor(score: number): string {
  if (score >= 80) return "#FF4444";
  if (score >= 50) return "#FFAA00";
  if (score >= 20) return "#44AA44";
  return "#888888";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  vipBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFD700",
    borderWidth: 2,
    borderColor: "#fff",
  },
  senderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  senderName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  senderEmail: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  timeAgo: {
    fontSize: 14,
    color: "#999",
  },
  subject: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 12,
    lineHeight: 26,
  },
  bodyContainer: {
    flex: 1,
    marginTop: 12,
  },
  bodyText: {
    fontSize: 16,
    color: "#444",
    lineHeight: 24,
  },
  urgencyBar: {
    height: 4,
    backgroundColor: "#eee",
    borderRadius: 2,
    marginTop: 16,
    overflow: "hidden",
  },
  urgencyFill: {
    height: "100%",
    borderRadius: 2,
  },
});
