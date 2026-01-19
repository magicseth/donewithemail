import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

interface FactEditModalProps {
  visible: boolean;
  initialText?: string;
  isEditing: boolean;
  onSave: (text: string) => void;
  onCancel: () => void;
}

export function FactEditModal({
  visible,
  initialText = "",
  isEditing,
  onSave,
  onCancel,
}: FactEditModalProps) {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    setText(initialText);
  }, [initialText, visible]);

  const handleSave = () => {
    const trimmedText = text.trim();
    if (trimmedText) {
      onSave(trimmedText);
    }
  };

  const canSave = text.trim().length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>
              {isEditing ? "Edit Fact" : "Add Fact"}
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              style={styles.headerButton}
              disabled={!canSave}
            >
              <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>

          {/* Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="e.g., Works at Microsoft as Product Manager"
              placeholderTextColor="#999"
              multiline
              autoFocus
              textAlignVertical="top"
            />
          </View>

          {/* Hint */}
          <Text style={styles.hint}>
            Facts help the AI understand your relationship with this contact.
            Add details like their job, company, family, location, or how you know them.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: "70%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerButton: {
    minWidth: 60,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  cancelText: {
    fontSize: 16,
    color: "#666",
  },
  saveText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6366F1",
    textAlign: "right",
  },
  saveTextDisabled: {
    color: "#ccc",
  },
  inputContainer: {
    padding: 16,
  },
  input: {
    fontSize: 16,
    color: "#1a1a1a",
    minHeight: 100,
    padding: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  hint: {
    fontSize: 13,
    color: "#666",
    paddingHorizontal: 16,
    lineHeight: 18,
  },
});
