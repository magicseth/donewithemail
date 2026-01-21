import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withRepeat,
  withTiming,
  SharedValue,
} from "react-native-reanimated";
import { QuickReplyButtons, QuickReply } from "./QuickReplyButtons";

// Animation thresholds
export const STAGE_1_THRESHOLD = 60;   // Quick replies visible
export const STAGE_2_THRESHOLD = 120;  // Mic fully grown
export const ACTIVATION_THRESHOLD = 120; // Recording activates

interface ExpandedEmail {
  _id: string;
  subject: string;
  fromContact?: {
    _id: string;
    email: string;
    name?: string;
  } | null;
  quickReplies?: QuickReply[];
}

interface PullToRevealHeaderProps {
  pullDistance: SharedValue<number>;
  expandedEmail: ExpandedEmail | null;
  isRecording: boolean;
  transcript: string;
  onQuickReply: (reply: QuickReply) => void;
  onSendVoiceReply: () => void;
  onCancelRecording: () => void;
  sendingQuickReply?: boolean;
}

export function PullToRevealHeader({
  pullDistance,
  expandedEmail,
  isRecording,
  transcript,
  onQuickReply,
  onSendVoiceReply,
  onCancelRecording,
  sendingQuickReply = false,
}: PullToRevealHeaderProps) {
  // Header expansion animated style
  const headerStyle = useAnimatedStyle(() => ({
    height: interpolate(
      pullDistance.value,
      [0, STAGE_1_THRESHOLD, STAGE_2_THRESHOLD],
      [0, 140, 220],
      Extrapolation.CLAMP
    ),
    opacity: interpolate(
      pullDistance.value,
      [0, 20, STAGE_1_THRESHOLD],
      [0, 0.5, 1],
      Extrapolation.CLAMP
    ),
    overflow: "hidden" as const,
  }));

  // Quick reply section fade in
  const quickReplyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      pullDistance.value,
      [0, STAGE_1_THRESHOLD / 2, STAGE_1_THRESHOLD],
      [0, 0, 1],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        translateY: interpolate(
          pullDistance.value,
          [0, STAGE_1_THRESHOLD],
          [20, 0],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  // Microphone growth
  const micContainerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      pullDistance.value,
      [STAGE_1_THRESHOLD, STAGE_1_THRESHOLD + 20],
      [0, 1],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          pullDistance.value,
          [STAGE_1_THRESHOLD, STAGE_2_THRESHOLD],
          [0.3, 1],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  // Pulsing glow when at activation threshold
  const glowStyle = useAnimatedStyle(() => {
    const isActive = pullDistance.value >= ACTIVATION_THRESHOLD || isRecording;
    return {
      shadowOpacity: isActive
        ? withRepeat(withTiming(0.8, { duration: 500 }), -1, true)
        : 0,
      shadowRadius: isActive ? 20 : 0,
      shadowColor: "#6366F1",
    };
  });

  // If we're actively recording, show a different UI
  if (isRecording) {
    return (
      <View style={styles.recordingContainer}>
        <View style={styles.recordingHeader}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancelRecording}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.recordingTitle}>Recording...</Text>

          <TouchableOpacity
            style={styles.sendButton}
            onPress={onSendVoiceReply}
            disabled={!transcript.trim()}
          >
            <Text
              style={[
                styles.sendButtonText,
                !transcript.trim() && styles.sendButtonDisabled,
              ]}
            >
              Send
            </Text>
          </TouchableOpacity>
        </View>

        {/* Pulsing mic icon */}
        <Animated.View style={[styles.micIconLarge, glowStyle]}>
          <Text style={styles.micEmoji}>🎙️</Text>
        </Animated.View>

        {/* Reply target info */}
        {expandedEmail && (
          <Text style={styles.replyingTo} numberOfLines={1}>
            Replying to: {expandedEmail.fromContact?.name || expandedEmail.fromContact?.email}
          </Text>
        )}

        {/* Transcript display */}
        <View style={styles.transcriptContainer}>
          {transcript ? (
            <Text style={styles.transcriptText}>{transcript}</Text>
          ) : (
            <Text style={styles.transcriptPlaceholder}>
              Start speaking...
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Pull-to-reveal UI (not recording)
  return (
    <Animated.View style={[styles.container, headerStyle]}>
      {/* Expanded email preview */}
      {expandedEmail && (
        <Animated.View style={[styles.emailPreview, quickReplyStyle]}>
          <View style={styles.emailInfo}>
            <Text style={styles.fromLabel}>Reply to</Text>
            <Text style={styles.fromName} numberOfLines={1}>
              {expandedEmail.fromContact?.name || expandedEmail.fromContact?.email || "Unknown"}
            </Text>
            <Text style={styles.subjectText} numberOfLines={1}>
              {expandedEmail.subject}
            </Text>
          </View>

          {/* Quick reply buttons */}
          {expandedEmail.quickReplies && Array.isArray(expandedEmail.quickReplies) && expandedEmail.quickReplies.length > 0 && (
            <QuickReplyButtons
              replies={expandedEmail.quickReplies}
              onSelectReply={onQuickReply}
              disabled={sendingQuickReply}
              sending={sendingQuickReply}
            />
          )}
        </Animated.View>
      )}

      {/* Microphone icon */}
      <Animated.View style={[styles.micContainer, micContainerStyle]}>
        <Animated.View style={[styles.micIcon, glowStyle]}>
          <Text style={styles.micEmoji}>🎙️</Text>
        </Animated.View>
        <Text style={styles.micHint}>Pull more to record</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F8F9FF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E4FF",
    paddingHorizontal: 16,
    justifyContent: "flex-end",
    paddingBottom: 12,
  },
  emailPreview: {
    marginBottom: 12,
  },
  emailInfo: {
    marginBottom: 8,
  },
  fromLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6366F1",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fromName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginTop: 2,
  },
  subjectText: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  micContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  micIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#6366F1",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  micEmoji: {
    fontSize: 28,
  },
  micHint: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  // Recording state styles
  recordingContainer: {
    backgroundColor: "#F8F9FF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E4FF",
  },
  recordingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  recordingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6366F1",
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelButtonText: {
    fontSize: 14,
    color: "#666",
  },
  sendButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#6366F1",
    borderRadius: 16,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  micIconLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#6366F1",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  replyingTo: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginBottom: 12,
  },
  transcriptContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    minHeight: 80,
    borderWidth: 1,
    borderColor: "#E0E4FF",
  },
  transcriptText: {
    fontSize: 16,
    color: "#1a1a1a",
    lineHeight: 24,
  },
  transcriptPlaceholder: {
    fontSize: 16,
    color: "#999",
    fontStyle: "italic",
  },
});
