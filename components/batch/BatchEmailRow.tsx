import React, { useCallback, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import type { BatchEmailPreview } from "../../hooks/useBatchTriage";

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

interface BatchEmailRowProps {
  email: BatchEmailPreview;
  isSaved: boolean;
  isSubscription?: boolean;
  onSave: () => void;
  onUnsubscribe?: () => void;
  isUnsubscribing?: boolean;
}

export const BatchEmailRow = memo(function BatchEmailRow({
  email,
  isSaved,
  isSubscription,
  onSave,
  onUnsubscribe,
  isUnsubscribing,
}: BatchEmailRowProps) {
  // Prefer fromName (from email header) over contact name (may be stale for shared addresses)
  const fromName = email.fromName || email.fromContact?.name || email.fromContact?.email || "Unknown";
  const initials = getInitials(fromName);
  const timeAgo = formatTimeAgo(email.receivedAt);

  const handlePress = useCallback(() => {
    router.push(`/email/${email._id}`);
  }, [email._id]);

  return (
    <View style={[styles.container, isSaved && styles.containerSaved]}>
      {/* Unsubscribe button (for subscriptions only) */}
      {isSubscription && onUnsubscribe && (
        <TouchableOpacity
          style={[styles.unsubButton, isUnsubscribing && styles.unsubButtonDisabled]}
          onPress={onUnsubscribe}
          disabled={isUnsubscribing}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isUnsubscribing ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Text style={styles.unsubButtonText}>Unsub</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Avatar */}
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

      {/* Content - pressable to open email */}
      <TouchableOpacity style={styles.content} onPress={handlePress} activeOpacity={0.7}>
        {/* Header row: sender + time */}
        <View style={styles.headerRow}>
          <Text style={styles.senderName} numberOfLines={1}>
            {fromName}
          </Text>
          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>

        {/* Subject */}
        <Text style={styles.subject} numberOfLines={1}>
          {decodeHtmlEntities(email.subject)}
        </Text>

        {/* Summary/preview */}
        <Text style={styles.preview} numberOfLines={1}>
          {email.summary || decodeHtmlEntities(email.bodyPreview)}
        </Text>
      </TouchableOpacity>

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveButton, isSaved && styles.saveButtonSaved]}
        onPress={onSave}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.saveButtonText, isSaved && styles.saveButtonTextSaved]}>
          {isSaved ? "Saved" : "Save"}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  containerSaved: {
    backgroundColor: "#EEF2FF",
  },
  unsubButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FEE2E2",
    borderRadius: 4,
    marginRight: 8,
  },
  unsubButtonDisabled: {
    opacity: 0.6,
  },
  unsubButtonText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#EF4444",
  },
  avatarContainer: {
    marginRight: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  senderName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  timeAgo: {
    fontSize: 12,
    color: "#999",
    marginLeft: 8,
  },
  subject: {
    fontSize: 14,
    color: "#1a1a1a",
    marginBottom: 2,
  },
  preview: {
    fontSize: 13,
    color: "#666",
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f0f0f0",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  saveButtonSaved: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  saveButtonTextSaved: {
    color: "#fff",
  },
});
