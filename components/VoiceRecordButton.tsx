import React, { useState, useCallback, useRef } from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  Platform,
} from "react-native";
import { useVoiceRecording } from "../hooks/useDailyVoice";

interface VoiceRecordButtonProps {
  onTranscript: (transcript: string) => void;
  onStreamingTranscript?: (transcript: string) => void;
  onError?: (error: string) => void;
  onRecordingStart?: () => void;
  onRecordingEnd?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  size?: "small" | "medium" | "large";
  showTranscript?: boolean;
}

export function VoiceRecordButton({
  onTranscript,
  onStreamingTranscript,
  onError,
  onRecordingStart,
  onRecordingEnd,
  disabled = false,
  style,
  size = "medium",
  showTranscript = false,
}: VoiceRecordButtonProps) {
  const {
    startRecording,
    stopRecording,
    cancelRecording,
    transcript,
    isConnecting,
    isConnected,
  } = useVoiceRecording();

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Keep a ref to the transcript so we can capture it before stopping
  const transcriptRef = useRef<string>("");

  // Update ref whenever transcript changes and notify streaming callback
  React.useEffect(() => {
    transcriptRef.current = transcript;
    if (isRecording && transcript && onStreamingTranscript) {
      onStreamingTranscript(transcript);
    }
  }, [transcript, isRecording, onStreamingTranscript]);

  const handlePressIn = useCallback(async () => {
    if (disabled || isRecording || isProcessing) return;

    setIsRecording(true);
    transcriptRef.current = "";
    onRecordingStart?.();

    try {
      await startRecording();
    } catch (err) {
      setIsRecording(false);
      const errorMsg = err instanceof Error ? err.message : "Failed to start recording";
      onError?.(errorMsg);
    }
  }, [disabled, isRecording, isProcessing, startRecording, onRecordingStart, onError]);

  const handlePressOut = useCallback(async () => {
    if (!isRecording) return;

    setIsRecording(false);
    setIsProcessing(true);
    onRecordingEnd?.();

    try {
      // Capture current transcript BEFORE stopping (robustness for dropped packets)
      const preStopTranscript = transcriptRef.current;

      // Stop recording and wait for final transcript
      const finalTranscript = await stopRecording();

      // Use whichever transcript has content (prefer final, fall back to pre-stop)
      const actualTranscript =
        (finalTranscript && finalTranscript.trim())
          ? finalTranscript.trim()
          : (preStopTranscript && preStopTranscript.trim())
            ? preStopTranscript.trim()
            : null;

      if (actualTranscript) {
        onTranscript(actualTranscript);
      } else {
        onError?.("No speech detected. Please try again.");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to process recording";
      onError?.(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  }, [isRecording, stopRecording, onTranscript, onError, onRecordingEnd]);

  const handleCancel = useCallback(() => {
    cancelRecording();
    setIsRecording(false);
    setIsProcessing(false);
  }, [cancelRecording]);

  const sizeStyles = {
    small: { width: 36, height: 36, borderRadius: 18, fontSize: 14 },
    medium: { width: 48, height: 48, borderRadius: 24, fontSize: 20 },
    large: { width: 64, height: 64, borderRadius: 32, fontSize: 28 },
  };

  const currentSize = sizeStyles[size];

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          width: currentSize.width,
          height: currentSize.height,
          borderRadius: currentSize.borderRadius,
        },
        isRecording && styles.buttonActive,
        (disabled || isProcessing) && styles.buttonDisabled,
        style,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || isProcessing}
      activeOpacity={0.8}
    >
      {isProcessing ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text style={[styles.buttonText, { fontSize: currentSize.fontSize }]}>
          {isRecording ? "🎙️" : "🎤"}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// Hook version for more control
export function useRobustVoiceRecording() {
  const {
    startRecording,
    stopRecording,
    cancelRecording,
    transcript,
    isConnecting,
    isConnected,
    error,
  } = useVoiceRecording();

  const transcriptRef = useRef<string>("");

  // Keep ref updated
  React.useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const robustStopRecording = useCallback(async (): Promise<string | null> => {
    // Capture current transcript BEFORE stopping
    const preStopTranscript = transcriptRef.current;

    // Stop and wait for final
    const finalTranscript = await stopRecording();

    // Use whichever has content
    const actualTranscript =
      (finalTranscript && finalTranscript.trim())
        ? finalTranscript.trim()
        : (preStopTranscript && preStopTranscript.trim())
          ? preStopTranscript.trim()
          : null;

    return actualTranscript;
  }, [stopRecording]);

  return {
    startRecording,
    stopRecording: robustStopRecording,
    cancelRecording,
    transcript,
    isConnecting,
    isConnected,
    error,
  };
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonActive: {
    backgroundColor: "#DC2626",
    transform: [{ scale: 1.1 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
  },
});
