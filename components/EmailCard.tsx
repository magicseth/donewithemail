import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
} from "react-native";
import { WebView } from "react-native-webview";
import { AISummary } from "./AISummary";

// Check if content looks like HTML
function isHtml(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content);
}

// Format event time for display
function formatEventTime(startTime?: string, endTime?: string): string {
  if (!startTime) return "";

  // If it's a relative time string, just display it
  if (!startTime.match(/^\d{4}-\d{2}-\d{2}/)) {
    return startTime + (endTime && !endTime.match(/^\d{4}-\d{2}-\d{2}/) ? ` - ${endTime}` : "");
  }

  try {
    const start = new Date(startTime);
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    };
    let result = start.toLocaleString(undefined, options);

    if (endTime) {
      const end = new Date(endTime);
      // If same day, just show end time
      if (start.toDateString() === end.toDateString()) {
        result += ` - ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
      } else {
        result += ` - ${end.toLocaleString(undefined, options)}`;
      }
    }

    return result;
  } catch {
    return startTime;
  }
}

// Decode HTML entities in text (for email snippets)
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

export interface CalendarEventData {
  title: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  // Set when event has been added to calendar
  calendarEventId?: string;
  calendarEventLink?: string;
}

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
  calendarEvent?: CalendarEventData;
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
  onUseReply?: () => void;
  onAddToCalendar?: (event: CalendarEventData) => void;
  showFullContent?: boolean;
  isAddingToCalendar?: boolean;
}

export function EmailCard({
  email,
  onPress,
  onContactPress,
  onUseReply,
  onAddToCalendar,
  showFullContent = false,
  isAddingToCalendar = false,
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
        {decodeHtmlEntities(email.subject)}
      </Text>

      {/* AI Summary */}
      {email.summary && (
        <AISummary
          summary={email.summary}
          urgencyScore={email.urgencyScore}
          urgencyReason={email.urgencyReason}
          suggestedReply={email.suggestedReply}
          compact={!showFullContent}
          onUseReply={onUseReply}
        />
      )}

      {/* Calendar Event Suggestion */}
      {email.calendarEvent && showFullContent && (
        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarIcon}>📅</Text>
            <Text style={styles.calendarLabel}>
              {email.calendarEvent.calendarEventId ? "Event Added" : "Event Detected"}
            </Text>
          </View>
          <Text style={styles.calendarTitle}>{decodeHtmlEntities(email.calendarEvent.title)}</Text>
          {email.calendarEvent.startTime && (
            <Text style={styles.calendarTime}>
              {formatEventTime(email.calendarEvent.startTime, email.calendarEvent.endTime)}
            </Text>
          )}
          {email.calendarEvent.location && (
            <Text style={styles.calendarLocation}>
              📍 {decodeHtmlEntities(email.calendarEvent.location)}
            </Text>
          )}
          {email.calendarEvent.description && (
            <Text style={styles.calendarDescription} numberOfLines={2}>
              {decodeHtmlEntities(email.calendarEvent.description)}
            </Text>
          )}
          {email.calendarEvent.calendarEventId ? (
            <View style={styles.addedToCalendarBadge}>
              <Text style={styles.addedToCalendarText}>✓ Added to Calendar</Text>
            </View>
          ) : onAddToCalendar && (
            <TouchableOpacity
              style={styles.addToCalendarButton}
              onPress={() => onAddToCalendar(email.calendarEvent!)}
              disabled={isAddingToCalendar}
            >
              {isAddingToCalendar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.addToCalendarText}>Add to Calendar</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Body preview */}
      <View style={styles.bodyContainer}>
        {showFullContent && isHtml(email.bodyPreview) ? (
          Platform.OS === "web" ? (
            // Render HTML in iframe on web
            <iframe
              srcDoc={email.bodyPreview}
              style={{
                width: "100%",
                minHeight: 400,
                border: "none",
                backgroundColor: "#fff",
              }}
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-scripts"
            />
          ) : (
            // Render HTML in WebView on native
            <WebView
              originWhitelist={["*"]}
              source={{ html: email.bodyPreview }}
              style={styles.webView}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          )
        ) : (
          <Text
            style={styles.bodyText}
            numberOfLines={showFullContent ? undefined : 6}
          >
            {decodeHtmlEntities(email.bodyPreview)}
          </Text>
        )}
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
  webView: {
    minHeight: 400,
    backgroundColor: "#fff",
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
  // Calendar event styles
  calendarContainer: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  calendarIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  calendarLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#78350F",
    marginBottom: 4,
  },
  calendarTime: {
    fontSize: 14,
    color: "#92400E",
    marginBottom: 4,
  },
  calendarLocation: {
    fontSize: 13,
    color: "#92400E",
    marginBottom: 4,
  },
  calendarDescription: {
    fontSize: 13,
    color: "#A16207",
    marginBottom: 12,
  },
  addToCalendarButton: {
    backgroundColor: "#F59E0B",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 4,
  },
  addToCalendarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  addedToCalendarBadge: {
    backgroundColor: "#10B981",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 4,
  },
  addedToCalendarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
