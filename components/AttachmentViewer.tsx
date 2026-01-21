import React, { useMemo, useCallback } from "react";
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
  Alert,
} from "react-native";
import { WebViewWrapper } from "./WebViewWrapper";
import { Paths, File as ExpoFile } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";

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
  onDownload?: () => void;
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

  // Handle share functionality
  const handleShare = useCallback(async () => {
    if (!data) return;

    try {
      const base64Data = base64UrlToBase64(data);

      if (Platform.OS === "web") {
        // Web: Use Web Share API if available
        if (navigator.share) {
          // Convert base64 to blob
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: contentType });
          const file = new File([blob], attachment.filename, { type: contentType });

          await navigator.share({
            files: [file],
            title: attachment.filename,
          });
        } else {
          Alert.alert("Share not supported", "Sharing is not supported in this browser. Please use the download button instead.");
        }
      } else {
        // Mobile: Save to file system and use expo-sharing
        const file = new ExpoFile(Paths.cache, attachment.filename);

        // Convert base64 to Uint8Array
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        // Write file
        await file.write(byteArray);

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, {
            mimeType: contentType,
            dialogTitle: `Share ${attachment.filename}`,
          });
        } else {
          Alert.alert("Share not available", "Sharing is not available on this device.");
        }
      }
    } catch (error) {
      console.error("Share error:", error);
      const message = error instanceof Error ? error.message : "Failed to share file";
      Alert.alert("Share Error", message);
    }
  }, [data, contentType, attachment.filename]);

  // Handle print functionality
  const handlePrint = useCallback(async () => {
    if (!data) return;

    try {
      const base64Data = base64UrlToBase64(data);

      if (Platform.OS === "web") {
        // Web: Use browser print for PDFs, open in new window for images
        if (contentType.includes("pdf")) {
          const pdfWindow = window.open("", "_blank");
          if (pdfWindow) {
            pdfWindow.document.write(`
              <html>
                <head><title>Print ${attachment.filename}</title></head>
                <body style="margin:0">
                  <embed src="data:${contentType};base64,${base64Data}"
                         width="100%" height="100%" type="${contentType}" />
                </body>
              </html>
            `);
            pdfWindow.document.close();
            setTimeout(() => {
              pdfWindow.print();
            }, 500);
          }
        } else if (contentType.startsWith("image/")) {
          const printWindow = window.open("", "_blank");
          if (printWindow) {
            printWindow.document.write(`
              <html>
                <head>
                  <title>Print ${attachment.filename}</title>
                  <style>
                    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    img { max-width: 100%; height: auto; }
                  </style>
                </head>
                <body>
                  <img src="data:${contentType};base64,${base64Data}" onload="window.print()" />
                </body>
              </html>
            `);
            printWindow.document.close();
          }
        } else {
          Alert.alert("Print not supported", "This file type cannot be printed directly.");
        }
      } else {
        // Mobile: Use expo-print
        if (contentType.includes("pdf")) {
          // For PDFs, we can print directly
          const file = new ExpoFile(Paths.cache, attachment.filename);

          // Convert base64 to Uint8Array
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);

          // Write file
          await file.write(byteArray);
          await Print.printAsync({ uri: file.uri });
        } else if (contentType.startsWith("image/")) {
          // For images, wrap in HTML for printing
          const html = `
            <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                  img { max-width: 100%; height: auto; }
                </style>
              </head>
              <body>
                <img src="data:${contentType};base64,${base64Data}" />
              </body>
            </html>
          `;
          await Print.printAsync({ html });
        } else {
          Alert.alert("Print not supported", "This file type cannot be printed on mobile.");
        }
      }
    } catch (error) {
      console.error("Print error:", error);
      const message = error instanceof Error ? error.message : "Failed to print file";
      Alert.alert("Print Error", message);
    }
  }, [data, contentType, attachment.filename]);

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

    // PDFs and documents - show in iframe/webview
    if (
      contentType.includes("pdf") ||
      contentType.includes("word") ||
      contentType.includes("document") ||
      contentType.includes("sheet") ||
      contentType.includes("excel") ||
      contentType.includes("presentation") ||
      contentType.includes("powerpoint")
    ) {
      // Embed the PDF or document in WebView (works on both web and mobile)
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
            <Text style={styles.headerButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {attachment.filename}
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handlePrint}
              disabled={isLoading || !data}
            >
              <Text
                style={[
                  styles.actionIcon,
                  (isLoading || !data) && styles.headerButtonDisabled,
                ]}
              >
                🖨️
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleShare}
              disabled={isLoading || !data}
            >
              <Text
                style={[
                  styles.actionIcon,
                  (isLoading || !data) && styles.headerButtonDisabled,
                ]}
              >
                📤
              </Text>
            </TouchableOpacity>
            {onDownload && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={onDownload}
                disabled={isLoading || !data}
              >
                <Text
                  style={[
                    styles.actionIcon,
                    (isLoading || !data) && styles.headerButtonDisabled,
                  ]}
                >
                  ⬇️
                </Text>
              </TouchableOpacity>
            )}
          </View>
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
    fontSize: 20,
    fontWeight: "600",
    color: "#6366F1",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  actionIcon: {
    fontSize: 20,
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
