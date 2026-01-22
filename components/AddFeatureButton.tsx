import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { VoiceRecordButton } from "./VoiceRecordButton";
import { useAppLogs } from "../lib/appLogger";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function AddFeatureButton() {
  const logs = useAppLogs();
  const insets = useSafeAreaInsets();

  // Feature request state
  const [isSubmittingFeature, setIsSubmittingFeature] = useState(false);
  const [featureTranscript, setFeatureTranscript] = useState<string | null>(null);
  const [streamingTranscript, setStreamingTranscript] = useState<string | null>(null);
  const [isRecordingFeature, setIsRecordingFeature] = useState(false);
  const [showFeatureConfirmModal, setShowFeatureConfirmModal] = useState(false);
  const [pendingTranscript, setPendingTranscript] = useState<string | null>(null);
  const [editableTranscript, setEditableTranscript] = useState<string>("");
  const [includeDebugLogs, setIncludeDebugLogs] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const showToast = useCallback((message: string) => {
    setToast({ message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const submitFeatureRequest = useMutation(api.featureRequests.submit);

  const handleFeatureTranscript = useCallback((transcript: string) => {
    setFeatureTranscript(transcript);
    setPendingTranscript(transcript);
    setEditableTranscript(transcript);
    setIncludeDebugLogs(false);
    // Modal is already shown from handleFeatureRecordingStart
  }, []);

  const handleConfirmFeatureSubmit = useCallback(async () => {
    // Use edited transcript instead of pendingTranscript
    const finalTranscript = editableTranscript.trim();
    if (!finalTranscript) return;

    setShowFeatureConfirmModal(false);
    setIsSubmittingFeature(true);

    try {
      let debugLogsStr: string | undefined;
      if (includeDebugLogs) {
        const currentLogs = logs.map(l =>
          `[${new Date(l.timestamp).toISOString()}] ${l.level.toUpperCase()}: ${l.message}`
        ).join("\n");
        debugLogsStr = currentLogs || undefined;
      }

      await submitFeatureRequest({
        transcript: finalTranscript,
        debugLogs: debugLogsStr,
      });
      showToast(`Feature request submitted: "${finalTranscript}"`);
      setFeatureTranscript(null);
      setPendingTranscript(null);
      setEditableTranscript("");
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      Platform.OS === "web" ? window.alert(`Error: ${errorMsg}`) : Alert.alert("Error", errorMsg);
    } finally {
      setIsSubmittingFeature(false);
    }
  }, [editableTranscript, includeDebugLogs, logs, submitFeatureRequest, showToast]);

  const handleCancelFeatureConfirm = useCallback(() => {
    setShowFeatureConfirmModal(false);
    setFeatureTranscript(null);
    setPendingTranscript(null);
    setEditableTranscript("");
    setIncludeDebugLogs(false);
  }, []);

  const handleRetryRecording = useCallback(() => {
    setShowFeatureConfirmModal(false);
    setFeatureTranscript(null);
    setPendingTranscript(null);
    setEditableTranscript("");
    setIncludeDebugLogs(false);
    // User can now tap the voice button again to re-record
  }, []);

  const handleFeatureError = useCallback((error: string) => {
    setIsRecordingFeature(false);
    setStreamingTranscript(null);
    Platform.OS === "web" ? window.alert(error) : Alert.alert("Error", error);
  }, []);

  const handleFeatureStreamingTranscript = useCallback((transcript: string) => {
    setStreamingTranscript(transcript);
    // Update editable transcript with streaming content while recording
    if (isRecordingFeature) {
      setEditableTranscript(transcript);
    }
  }, [isRecordingFeature]);

  const handleFeatureRecordingStart = useCallback(() => {
    setIsRecordingFeature(true);
    setStreamingTranscript(null);
    setFeatureTranscript(null);
    setEditableTranscript("");
    setIncludeDebugLogs(false);
    // Show modal immediately when recording starts
    setShowFeatureConfirmModal(true);
  }, []);

  const handleFeatureRecordingEnd = useCallback(() => {
    setIsRecordingFeature(false);
  }, []);

  return (
    <>
      <View style={styles.container}>
        {/* Show prominent streaming transcript when recording */}
        {isRecordingFeature && (
          <View style={styles.streamingContainer}>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingLabel}>Recording</Text>
            </View>
            <Text style={styles.streamingTranscriptText}>
              {streamingTranscript || "Listening..."}
            </Text>
          </View>
        )}
        {/* Show submitting status */}
        {isSubmittingFeature && (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="small" color="#6366F1" />
            <Text style={styles.statusText}>Submitting...</Text>
          </View>
        )}
        <VoiceRecordButton
          onTranscript={handleFeatureTranscript}
          onStreamingTranscript={handleFeatureStreamingTranscript}
          onRecordingStart={handleFeatureRecordingStart}
          onRecordingEnd={handleFeatureRecordingEnd}
          onError={handleFeatureError}
          disabled={isSubmittingFeature}
          size="medium"
        />
      </View>

      {/* Feature Request Confirmation Modal */}
      <Modal
        visible={showFeatureConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelFeatureConfirm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isRecordingFeature ? "Recording Voice..." : "Confirm Feature Request"}
            </Text>
            <Text style={styles.modalMessage}>
              {isRecordingFeature
                ? "Speak your feature request. Release to finish."
                : "Review and edit your request below:"}
            </Text>

            {/* Editable transcript field */}
            <TextInput
              style={[
                styles.modalTranscriptInput,
                isRecordingFeature && styles.modalTranscriptInputRecording,
              ]}
              value={editableTranscript}
              onChangeText={setEditableTranscript}
              placeholder={isRecordingFeature ? "Listening..." : "Enter your feature request"}
              placeholderTextColor="#999"
              multiline
              editable={!isRecordingFeature}
              numberOfLines={4}
              textAlignVertical="top"
            />

            {!isRecordingFeature && (
              <>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setIncludeDebugLogs(!includeDebugLogs)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, includeDebugLogs && styles.checkboxChecked]}>
                    {includeDebugLogs && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Include debug logs ({logs.length})</Text>
                </TouchableOpacity>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={handleCancelFeatureConfirm}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonRetry]}
                    onPress={handleRetryRecording}
                  >
                    <Text style={styles.modalButtonText}>Retry</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonSubmit]}
                    onPress={handleConfirmFeatureSubmit}
                    disabled={!editableTranscript.trim()}
                  >
                    <Text style={styles.modalButtonTextLight}>Submit</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Toast notification */}
      {toast && (
        <View style={[styles.toast, { top: insets.top + 10 }]}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    color: "#666",
  },
  streamingContainer: {
    marginRight: 12,
    maxWidth: 250,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  recordingLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#DC2626",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  streamingTranscriptText: {
    fontSize: 13,
    color: "#1a1a1a",
    fontStyle: "italic",
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  modalTranscript: {
    fontSize: 14,
    color: "#333",
    fontStyle: "italic",
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  modalTranscriptInput: {
    fontSize: 14,
    color: "#333",
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    minHeight: 100,
  },
  modalTranscriptInputRecording: {
    fontStyle: "italic",
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    color: "#666",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#ccc",
    borderRadius: 4,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  checkmark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#333",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#f0f0f0",
  },
  modalButtonRetry: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  modalButtonSubmit: {
    backgroundColor: "#6366F1",
  },
  modalButtonText: {
    color: "#333",
    fontSize: 15,
    fontWeight: "600",
  },
  modalButtonTextLight: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  toast: {
    position: "absolute",
    top: 10,
    left: 20,
    right: 20,
    backgroundColor: "#10B981",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});
