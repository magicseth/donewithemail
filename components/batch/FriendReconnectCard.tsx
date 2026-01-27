import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { router } from "expo-router";

export interface ReconnectSuggestion {
  _id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  lastEmailAt: number;
  daysSinceContact: number;
  emailCount: number;
}

interface FriendReconnectCardProps {
  suggestion: ReconnectSuggestion;
  onDismiss: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDaysAgo(days: number): string {
  if (days < 7) {
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  } else if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  } else if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months !== 1 ? "s" : ""} ago`;
  } else {
    const years = Math.floor(days / 365);
    return `${years} year${years !== 1 ? "s" : ""} ago`;
  }
}

export function FriendReconnectCard({ suggestion, onDismiss }: FriendReconnectCardProps) {
  const displayName = suggestion.name || suggestion.email.split("@")[0];
  const initials = getInitials(displayName);

  const handleSayHi = () => {
    router.push({
      pathname: "/compose",
      params: {
        to: suggestion.email,
        toName: suggestion.name,
      },
    });
  };

  const handleViewProfile = () => {
    router.push({
      pathname: "/person/[id]",
      params: { id: suggestion._id },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>👋</Text>
        <Text style={styles.headerText}>Catch up with a friend</Text>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.dismissText}>×</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.content} onPress={handleViewProfile} activeOpacity={0.7}>
        {suggestion.avatarUrl ? (
          <Image source={{ uri: suggestion.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Last emailed {formatDaysAgo(suggestion.daysSinceContact)}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.sayHiButton} onPress={handleSayHi}>
          <Text style={styles.sayHiText}>Say hi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FDE68A",
  },
  headerIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  headerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
  },
  dismissButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissText: {
    fontSize: 20,
    color: "#92400E",
    fontWeight: "300",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    backgroundColor: "#F59E0B",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: "#78716C",
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  sayHiButton: {
    flex: 1,
    backgroundColor: "#F59E0B",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  sayHiText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
