import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
} from "react-native";

export interface ContactData {
  _id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  emailCount: number;
  lastEmailAt: number;
  relationship?: "vip" | "regular" | "unknown";
  relationshipSummary?: string;
}

export interface EmailPreview {
  _id: string;
  subject: string;
  bodyPreview: string;
  receivedAt: number;
  isRead: boolean;
  urgencyScore?: number;
}

interface PersonContextProps {
  contact: ContactData;
  recentEmails: EmailPreview[];
  onEmailPress?: (emailId: string) => void;
  onRelationshipChange?: (relationship: "vip" | "regular" | "unknown") => void;
}

export function PersonContext({
  contact,
  recentEmails,
  onEmailPress,
  onRelationshipChange,
}: PersonContextProps) {
  const displayName = contact.name || contact.email;
  const initials = getInitials(displayName);
  const lastContact = formatDate(contact.lastEmailAt);

  return (
    <View style={styles.container}>
      {/* Contact header */}
      <View style={styles.header}>
        <View style={styles.avatarSection}>
          {contact.avatarUrl ? (
            <Image source={{ uri: contact.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          {contact.relationship === "vip" && (
            <View style={styles.vipBadge}>
              <Text style={styles.vipText}>VIP</Text>
            </View>
          )}
        </View>

        <View style={styles.nameSection}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{contact.email}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{contact.emailCount}</Text>
          <Text style={styles.statLabel}>Emails</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{lastContact}</Text>
          <Text style={styles.statLabel}>Last Contact</Text>
        </View>
      </View>

      {/* Relationship selector */}
      <View style={styles.relationshipSection}>
        <Text style={styles.sectionLabel}>Relationship</Text>
        <View style={styles.relationshipButtons}>
          {(["vip", "regular", "unknown"] as const).map((rel) => (
            <TouchableOpacity
              key={rel}
              style={[
                styles.relationshipButton,
                contact.relationship === rel && styles.relationshipButtonActive,
              ]}
              onPress={() => onRelationshipChange?.(rel)}
            >
              <Text
                style={[
                  styles.relationshipButtonText,
                  contact.relationship === rel && styles.relationshipButtonTextActive,
                ]}
              >
                {rel === "vip" ? "VIP" : rel.charAt(0).toUpperCase() + rel.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* AI relationship summary */}
      {contact.relationshipSummary && (
        <View style={styles.summarySection}>
          <View style={styles.aiHeader}>
            <View style={styles.aiIcon}>
              <Text style={styles.aiIconText}>AI</Text>
            </View>
            <Text style={styles.sectionLabel}>Relationship Summary</Text>
          </View>
          <Text style={styles.summaryText}>{contact.relationshipSummary}</Text>
        </View>
      )}

      {/* Recent emails */}
      <View style={styles.emailsSection}>
        <Text style={styles.sectionLabel}>Recent Emails</Text>
        <FlatList
          data={recentEmails}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.emailItem}
              onPress={() => onEmailPress?.(item._id)}
            >
              <View style={styles.emailHeader}>
                <Text style={styles.emailSubject} numberOfLines={1}>
                  {item.subject}
                </Text>
                {item.urgencyScore !== undefined && item.urgencyScore >= 50 && (
                  <View
                    style={[
                      styles.urgencyDot,
                      { backgroundColor: item.urgencyScore >= 80 ? "#FF4444" : "#FFAA00" },
                    ]}
                  />
                )}
              </View>
              <Text style={styles.emailPreview} numberOfLines={2}>
                {item.bodyPreview}
              </Text>
              <Text style={styles.emailDate}>{formatTimeAgo(item.receivedAt)}</Text>
            </TouchableOpacity>
          )}
          scrollEnabled={false}
        />
      </View>
    </View>
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

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / 86400000);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(timestamp);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  avatarSection: {
    position: "relative",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
  },
  vipBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#FFD700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#fff",
  },
  vipText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#333",
  },
  nameSection: {
    flex: 1,
    marginLeft: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  email: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: "#ddd",
    marginHorizontal: 16,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  relationshipSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 12,
  },
  relationshipButtons: {
    flexDirection: "row",
    gap: 8,
  },
  relationshipButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
  },
  relationshipButtonActive: {
    backgroundColor: "#6366F1",
  },
  relationshipButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  relationshipButtonTextActive: {
    color: "#fff",
  },
  summarySection: {
    backgroundColor: "#F8F9FF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E0E4FF",
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  aiIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  aiIconText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "700",
  },
  summaryText: {
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
  },
  emailsSection: {
    flex: 1,
  },
  emailItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  emailHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  emailSubject: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  urgencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  emailPreview: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
    lineHeight: 18,
  },
  emailDate: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
});
