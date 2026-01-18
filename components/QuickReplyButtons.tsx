import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";

export interface QuickReply {
  label: string;
  body: string;
}

interface QuickReplyButtonsProps {
  replies: QuickReply[];
  onSelectReply: (reply: QuickReply) => void;
  disabled?: boolean;
  sending?: boolean;
}

export function QuickReplyButtons({
  replies,
  onSelectReply,
  disabled = false,
  sending = false,
}: QuickReplyButtonsProps) {
  if (!replies || replies.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {replies.map((reply, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.button,
            disabled && styles.buttonDisabled,
            index === 0 && styles.buttonPrimary,
          ]}
          onPress={() => onSelectReply(reply)}
          disabled={disabled || sending}
          activeOpacity={0.7}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text
              style={[
                styles.buttonText,
                index === 0 && styles.buttonTextPrimary,
              ]}
              numberOfLines={1}
            >
              {reply.label}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    minWidth: 80,
    alignItems: "center",
  },
  buttonPrimary: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  buttonTextPrimary: {
    color: "#fff",
  },
});
