import React, { useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from "react-native";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

export type AttachmentData = {
  _id: string;
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  isInline: boolean;
};

type AttachmentListProps = {
  attachments: AttachmentData[];
  emailId: Id<"emails">;
  userEmail: string;
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎥";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📽️";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z")) return "📦";
  return "📎";
}

// Convert base64url to base64
function base64UrlToBase64(base64url: string): string {
  return base64url.replace(/-/g, "+").replace(/_/g, "/");
}

export function AttachmentList({ attachments, emailId, userEmail }: AttachmentListProps) {
  const downloadAttachment = useAction(api.gmailSync.downloadAttachment);

  const handleDownload = useCallback(
    async (attachment: AttachmentData) => {
      try {
        const result = await downloadAttachment({
          userEmail,
          emailId,
          attachmentId: attachment.attachmentId,
        });

        // Convert base64url to base64
        const base64Data = base64UrlToBase64(result.data);

        if (Platform.OS === "web") {
          // Web: Create a download link
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: result.mimeType });
          const url = URL.createObjectURL(blob);

          const link = document.createElement("a");
          link.href = url;
          link.download = result.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } else {
          // Mobile: Show alert (could implement native file saving here)
          Alert.alert(
            "Download",
            `Attachment downloaded: ${result.filename}`,
            [{ text: "OK" }]
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to download attachment";
        if (Platform.OS === "web") {
          window.alert(`Error: ${message}`);
        } else {
          Alert.alert("Error", message);
        }
      }
    },
    [downloadAttachment, emailId, userEmail]
  );

  // Filter out inline attachments (embedded images)
  const displayAttachments = attachments.filter((a) => !a.isInline);

  if (displayAttachments.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {displayAttachments.length} Attachment{displayAttachments.length !== 1 ? "s" : ""}
      </Text>
      {displayAttachments.map((attachment) => (
        <TouchableOpacity
          key={attachment._id}
          style={styles.attachmentItem}
          onPress={() => handleDownload(attachment)}
        >
          <Text style={styles.icon}>{getFileIcon(attachment.mimeType)}</Text>
          <View style={styles.attachmentInfo}>
            <Text style={styles.filename} numberOfLines={1}>
              {attachment.filename}
            </Text>
            <Text style={styles.fileSize}>{formatFileSize(attachment.size)}</Text>
          </View>
          <Text style={styles.downloadIcon}>⬇️</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  attachmentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  attachmentInfo: {
    flex: 1,
    marginRight: 8,
  },
  filename: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: "#999",
  },
  downloadIcon: {
    fontSize: 18,
  },
});
