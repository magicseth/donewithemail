import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
} from "react-native";

// Decode HTML entities in text
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

export interface ContactFact {
  id: string;
  text: string;
  source: "manual" | "ai";
  createdAt: number;
  sourceEmailId?: string;
}

export interface WritingStyle {
  tone: string;
  greeting?: string;
  signoff?: string;
  characteristics?: string[];
  samplePhrases?: string[];
  emailsAnalyzed: number;
  analyzedAt: number;
}

export interface ContactData {
  _id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  emailCount: number;
  lastEmailAt: number;
  relationship?: "vip" | "regular" | "unknown";
  relationshipSummary?: string;
  facts?: ContactFact[];
  writingStyle?: WritingStyle;
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
  onAddFact?: () => void;
  onEditFact?: (fact: ContactFact) => void;
  onDeleteFact?: (factId: string) => void;
}

export function PersonContext({
  contact,
  recentEmails,
  onEmailPress,
  onRelationshipChange,
  onAddFact,
  onEditFact,
  onDeleteFact,
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

      {/* Dossier facts */}
      <View style={styles.dossierSection}>
        <View style={styles.dossierHeader}>
          <Text style={styles.sectionLabel}>Dossier</Text>
          <TouchableOpacity style={styles.addButton} onPress={onAddFact}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {contact.facts && contact.facts.length > 0 ? (
          contact.facts.map((fact) => (
            <View key={fact.id} style={styles.factItem}>
              <View style={styles.factContent}>
                {fact.source === "ai" && (
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>AI</Text>
                  </View>
                )}
                <Text style={styles.factText}>{fact.text}</Text>
              </View>
              <View style={styles.factActions}>
                <TouchableOpacity
                  style={styles.factActionButton}
                  onPress={() => onEditFact?.(fact)}
                >
                  <Text style={styles.factActionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.factActionButton}
                  onPress={() => onDeleteFact?.(fact.id)}
                >
                  <Text style={[styles.factActionText, styles.deleteText]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>
            No facts yet. Add facts to help the AI understand your relationship.
          </Text>
        )}
      </View>

      {/* Writing style analysis */}
      {contact.writingStyle && (
        <View style={styles.writingStyleSection}>
          <View style={styles.aiHeader}>
            <View style={styles.aiIcon}>
              <Text style={styles.aiIconText}>AI</Text>
            </View>
            <Text style={styles.sectionLabel}>Your Writing Style</Text>
          </View>
          <Text style={styles.writingStyleSubtitle}>
            How you typically write to {contact.name || "this contact"}
          </Text>

          <View style={styles.writingStyleRow}>
            <Text style={styles.writingStyleLabel}>Tone:</Text>
            <Text style={styles.writingStyleValue}>{contact.writingStyle.tone}</Text>
          </View>

          {contact.writingStyle.greeting && (
            <View style={styles.writingStyleRow}>
              <Text style={styles.writingStyleLabel}>Greeting:</Text>
              <Text style={styles.writingStyleValue}>"{contact.writingStyle.greeting}"</Text>
            </View>
          )}

          {contact.writingStyle.signoff && (
            <View style={styles.writingStyleRow}>
              <Text style={styles.writingStyleLabel}>Sign-off:</Text>
              <Text style={styles.writingStyleValue}>"{contact.writingStyle.signoff}"</Text>
            </View>
          )}

          {contact.writingStyle.characteristics && contact.writingStyle.characteristics.length > 0 && (
            <View style={styles.writingStyleCharacteristics}>
              <Text style={styles.writingStyleLabel}>Style traits:</Text>
              <View style={styles.characteristicsList}>
                {contact.writingStyle.characteristics.map((trait, idx) => (
                  <View key={idx} style={styles.characteristicChip}>
                    <Text style={styles.characteristicText}>{trait}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {contact.writingStyle.samplePhrases && contact.writingStyle.samplePhrases.length > 0 && (
            <View style={styles.samplePhrasesSection}>
              <Text style={styles.writingStyleLabel}>Sample phrases:</Text>
              {contact.writingStyle.samplePhrases.slice(0, 3).map((phrase, idx) => (
                <Text key={idx} style={styles.samplePhrase}>"{phrase}"</Text>
              ))}
            </View>
          )}

          <Text style={styles.writingStyleMeta}>
            Based on {contact.writingStyle.emailsAnalyzed} email{contact.writingStyle.emailsAnalyzed !== 1 ? 's' : ''}
          </Text>
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
                  {decodeHtmlEntities(item.subject)}
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
                {decodeHtmlEntities(item.bodyPreview)}
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
  dossierSection: {
    marginBottom: 24,
  },
  dossierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#6366F1",
    borderRadius: 6,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  factItem: {
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  factContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  aiBadge: {
    backgroundColor: "#E0E4FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6366F1",
  },
  factText: {
    flex: 1,
    fontSize: 14,
    color: "#1a1a1a",
    lineHeight: 20,
  },
  factActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    gap: 12,
  },
  factActionButton: {
    padding: 4,
  },
  factActionText: {
    fontSize: 13,
    color: "#6366F1",
    fontWeight: "500",
  },
  deleteText: {
    color: "#FF4444",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
  },
  // Writing style styles
  writingStyleSection: {
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  writingStyleSubtitle: {
    fontSize: 13,
    color: "#15803D",
    marginBottom: 12,
  },
  writingStyleRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  writingStyleLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#166534",
    marginRight: 8,
    minWidth: 70,
  },
  writingStyleValue: {
    fontSize: 13,
    color: "#15803D",
    flex: 1,
  },
  writingStyleCharacteristics: {
    marginBottom: 12,
  },
  characteristicsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  characteristicChip: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  characteristicText: {
    fontSize: 12,
    color: "#166534",
  },
  samplePhrasesSection: {
    marginBottom: 8,
  },
  samplePhrase: {
    fontSize: 13,
    color: "#15803D",
    fontStyle: "italic",
    marginTop: 4,
    marginLeft: 8,
  },
  writingStyleMeta: {
    fontSize: 11,
    color: "#86EFAC",
    marginTop: 8,
  },
});
