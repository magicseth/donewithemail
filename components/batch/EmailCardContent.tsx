import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { BatchEmailPreview } from "../../hooks/useBatchTriage";
import { replaceDatePlaceholders } from "../../lib/datePlaceholders";

// Get initials from name for avatar placeholder
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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

interface EmailCardContentProps {
  email: BatchEmailPreview;
}

export const EmailCardContent = React.memo(function EmailCardContent({
  email,
}: EmailCardContentProps) {
  const fromName = email.fromName || email.fromContact?.name || email.fromContact?.email || "Unknown";
  const initials = getInitials(fromName);
  const timeAgo = formatTimeAgo(email.receivedAt);

  // Replace date placeholders with relative dates
  const displaySummary = useMemo(() => {
    const text = email.summary || decodeHtmlEntities(email.bodyPreview);
    return replaceDatePlaceholders(text);
  }, [email.summary, email.bodyPreview]);

  const handlePress = () => {
    router.push(`/email/${email._id}`);
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.9}>
      {/* Header with avatar and sender info */}
      <View style={styles.header}>
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
        </View>
        <View style={styles.headerText}>
          <Text style={styles.senderName} numberOfLines={1}>
            {fromName}
          </Text>
          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>
      </View>

      {/* Subject */}
      <Text style={styles.subject} numberOfLines={2}>
        {decodeHtmlEntities(email.subject)}
      </Text>

      {/* Summary/Preview */}
      <Text style={styles.summary} numberOfLines={4}>
        {displaySummary}
      </Text>

      {/* Quick action chips */}
      <View style={styles.chipsContainer}>
        {email.quickReplies && email.quickReplies.length > 0 && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              💬 {email.quickReplies.length} quick repl{email.quickReplies.length === 1 ? "y" : "ies"}
            </Text>
          </View>
        )}
        {email.calendarEvent && (
          <View style={[styles.chip, styles.chipCalendar]}>
            <Text style={[styles.chipText, styles.chipTextCalendar]}>
              📅 Calendar invite
            </Text>
          </View>
        )}
        {email.importantAttachments && email.importantAttachments.length > 0 && (
          <View style={[styles.chip, styles.chipAttachment]}>
            <Text style={[styles.chipText, styles.chipTextAttachment]}>
              📎 {email.importantAttachments.length} attachment{email.importantAttachments.length === 1 ? "" : "s"}
            </Text>
          </View>
        )}
      </View>

      {/* Swipe instruction hint */}
      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>← Swipe to reply or mark done →</Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 12,
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
  headerText: {
    flex: 1,
  },
  senderName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  timeAgo: {
    fontSize: 14,
    color: "#999",
  },
  subject: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
    lineHeight: 28,
  },
  summary: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    flex: 1,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  chip: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipCalendar: {
    backgroundColor: "#FFFBEB",
  },
  chipAttachment: {
    backgroundColor: "#F0FDF4",
  },
  chipText: {
    fontSize: 13,
    color: "#6366F1",
    fontWeight: "500",
  },
  chipTextCalendar: {
    color: "#F59E0B",
  },
  chipTextAttachment: {
    color: "#10B981",
  },
  hintContainer: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hintText: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
});
