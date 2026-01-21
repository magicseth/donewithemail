import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { WebViewWrapper } from "./WebViewWrapper";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface AttachmentViewerProps {
  visible: boolean;
  attachment: {
    _id: string;
    filename: string;
    mimeType: string;
    size: number;
  };
  data?: string; // base64url encoded data
  mimeType?: string;
  isLoading: boolean;
  onClose: () => void;
  onDownload: () => void;
}

// Convert base64url to base64
function base64UrlToBase64(base64url: string): string {
  return base64url.replace(/-/g, "+").replace(/_/g, "/");
}

export function AttachmentViewer({
  visible,
  attachment,
  data,
  mimeType,
  isLoading,
  onClose,
  onDownload,
}: AttachmentViewerProps) {
  const contentType = mimeType || attachment.mimeType;

  // Render content based on MIME type
  const renderContent = useMemo(() => {
    if (isLoading || !data) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading attachment...</Text>
        </View>
      );
    }

    const base64Data = base64UrlToBase64(data);

    // Images
    if (contentType.startsWith("image/")) {
      return (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          maximumZoomScale={3}
          minimumZoomScale={1}
        >
          <Image
            source={{ uri: `data:${contentType};base64,${base64Data}` }}
            style={styles.image}
            resizeMode="contain"
          />
        </ScrollView>
      );
    }

    // PDFs and documents - show in iframe/webview on web, prompt download on mobile
    if (
      contentType.includes("pdf") ||
      contentType.includes("word") ||
      contentType.includes("document") ||
      contentType.includes("sheet") ||
      contentType.includes("excel") ||
      contentType.includes("presentation") ||
      contentType.includes("powerpoint")
    ) {
      if (Platform.OS === "web") {
        // On web, embed the PDF or document
        const blob = base64Data;
        const htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { margin: 0; padding: 0; overflow: hidden; }
                iframe { border: none; width: 100vw; height: 100vh; }
              </style>
            </head>
            <body>
              <iframe src="data:${contentType};base64,${blob}" width="100%" height="100%"></iframe>
            </body>
          </html>
        `;
        return <WebViewWrapper html={htmlContent} />;
      } else {
        // On mobile, show download prompt
        return (
          <View style={styles.downloadPromptContainer}>
            <Text style={styles.downloadPromptIcon}>📄</Text>
            <Text style={styles.downloadPromptTitle}>{attachment.filename}</Text>
            <Text style={styles.downloadPromptText}>
              This file type cannot be previewed on mobile.
            </Text>
            <TouchableOpacity style={styles.downloadButton} onPress={onDownload}>
              <Text style={styles.downloadButtonText}>Download File</Text>
            </TouchableOpacity>
          </View>
        );
      }
    }

    // Text files
    if (
      contentType.startsWith("text/") ||
      contentType.includes("json") ||
      contentType.includes("xml")
    ) {
      try {
        const textContent = atob(base64Data);
        return (
          <ScrollView style={styles.textContainer}>
            <Text style={styles.textContent} selectable>
              {textContent}
            </Text>
          </ScrollView>
        );
      } catch (e) {
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Failed to decode text content</Text>
          </View>
        );
      }
    }

    // Default: show download prompt for other file types
    return (
      <View style={styles.downloadPromptContainer}>
        <Text style={styles.downloadPromptIcon}>📎</Text>
        <Text style={styles.downloadPromptTitle}>{attachment.filename}</Text>
        <Text style={styles.downloadPromptText}>
          This file type cannot be previewed.
        </Text>
        <TouchableOpacity style={styles.downloadButton} onPress={onDownload}>
          <Text style={styles.downloadButtonText}>Download File</Text>
        </TouchableOpacity>
      </View>
    );
  }, [isLoading, data, contentType, attachment.filename, onDownload]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={onClose}>
            <Text style={styles.headerButtonText}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {attachment.filename}
          </Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onDownload}
            disabled={isLoading || !data}
          >
            <Text
              style={[
                styles.headerButtonText,
                (isLoading || !data) && styles.headerButtonDisabled,
              ]}
            >
              ⬇️ Download
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>{renderContent}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
    backgroundColor: "#fff",
    ...Platform.select({
      ios: {
        paddingTop: 50,
      },
      android: {
        paddingTop: 16,
      },
    }),
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6366F1",
  },
  headerButtonDisabled: {
    opacity: 0.4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    textAlign: "center",
    marginHorizontal: 16,
  },
  content: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: "#666",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  image: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_HEIGHT - 150,
  },
  textContainer: {
    flex: 1,
    padding: 16,
  },
  textContent: {
    fontSize: 14,
    lineHeight: 20,
    color: "#1a1a1a",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
  downloadPromptContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  downloadPromptIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  downloadPromptTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
  },
  downloadPromptText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  downloadButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorText: {
    fontSize: 14,
    color: "#EF4444",
    textAlign: "center",
  },
});
