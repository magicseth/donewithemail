import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";

export type ChangelogEntry = {
  _id: string;
  version: string;
  title: string;
  description: string;
  type: "feature" | "improvement" | "bugfix" | "other";
  publishedAt: number;
};

interface ChangelogModalProps {
  visible: boolean;
  changelogs: ChangelogEntry[];
  onClose: () => void;
}

const getTypeLabel = (type: ChangelogEntry["type"]): string => {
  switch (type) {
    case "feature":
      return "NEW";
    case "improvement":
      return "IMPROVED";
    case "bugfix":
      return "FIXED";
    case "other":
      return "UPDATED";
  }
};

const getTypeColor = (type: ChangelogEntry["type"]): string => {
  switch (type) {
    case "feature":
      return "#10B981"; // green
    case "improvement":
      return "#3B82F6"; // blue
    case "bugfix":
      return "#F59E0B"; // orange
    case "other":
      return "#6B7280"; // gray
  }
};

export function ChangelogModal({ visible, changelogs, onClose }: ChangelogModalProps) {
  if (changelogs.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>What's New</Text>
          <Text style={styles.modalSubtitle}>
            Here's what changed since you last opened the app
          </Text>

          <ScrollView style={styles.changelogList} showsVerticalScrollIndicator={true}>
            {changelogs.map((changelog) => (
              <View key={changelog._id} style={styles.changelogItem}>
                <View style={styles.changelogHeader}>
                  <View
                    style={[
                      styles.typeBadge,
                      { backgroundColor: getTypeColor(changelog.type) },
                    ]}
                  >
                    <Text style={styles.typeBadgeText}>{getTypeLabel(changelog.type)}</Text>
                  </View>
                  <Text style={styles.changelogTitle}>{changelog.title}</Text>
                </View>
                <Text style={styles.changelogDescription}>{changelog.description}</Text>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Got it!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const { height } = Dimensions.get("window");

const styles = StyleSheet.create({
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
    maxWidth: 500,
    maxHeight: height * 0.8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: "#666",
    marginBottom: 20,
  },
  changelogList: {
    flex: 1,
    marginBottom: 20,
  },
  changelogItem: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  changelogHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 10,
  },
  typeBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  changelogTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    flex: 1,
  },
  changelogDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  closeButton: {
    backgroundColor: "#6366F1",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
