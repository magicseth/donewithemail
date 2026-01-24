import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Share,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../../lib/authContext";

type CalendarEvent = {
  title: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  notes?: string;
};

type ActionItem = {
  task: string;
  priority: "high" | "medium" | "low";
  dueDate?: string;
};

type ProcessResult = {
  summary: string;
  calendarEvents: CalendarEvent[];
  actionItems: ActionItem[];
  hasContent: boolean;
};

export default function ShortcutsProcessScreen() {
  const { text } = useLocalSearchParams<{ text?: string }>();
  const { isAuthenticated } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processText = useAction(api.shortcuts.processText);

  useEffect(() => {
    if (!text) {
      setError("No text provided");
      setIsProcessing(false);
      return;
    }

    if (!isAuthenticated) {
      setError("Please sign in to use this feature");
      setIsProcessing(false);
      return;
    }

    const process = async () => {
      try {
        const decodedText = decodeURIComponent(text);
        const response = await processText({ text: decodedText });
        setResult(response);
      } catch (err) {
        console.error("[Shortcuts] Processing failed:", err);
        setError(err instanceof Error ? err.message : "Failed to process text");
      } finally {
        setIsProcessing(false);
      }
    };

    process();
  }, [text, isAuthenticated, processText]);

  const handleShare = async () => {
    if (!result) return;

    let shareText = result.summary + "\n\n";

    if (result.calendarEvents.length > 0) {
      shareText += "Calendar Events:\n";
      result.calendarEvents.forEach((event) => {
        shareText += `- ${event.title}`;
        if (event.startDate) shareText += ` (${formatDate(event.startDate)})`;
        shareText += "\n";
      });
      shareText += "\n";
    }

    if (result.actionItems.length > 0) {
      shareText += "Action Items:\n";
      result.actionItems.forEach((item) => {
        shareText += `- [${item.priority.toUpperCase()}] ${item.task}`;
        if (item.dueDate) shareText += ` (due: ${formatDate(item.dueDate)})`;
        shareText += "\n";
      });
    }

    try {
      await Share.share({ message: shareText });
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "#EF4444";
      case "medium":
        return "#F59E0B";
      default:
        return "#10B981";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "Process Text",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backButtonText}>Done</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {isProcessing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Analyzing text...</Text>
          <Text style={styles.loadingSubtext}>
            Extracting calendar events and action items
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : result ? (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{result.summary}</Text>
          </View>

          {/* Calendar Events */}
          {result.calendarEvents.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Calendar Events</Text>
              {result.calendarEvents.map((event, index) => (
                <View key={index} style={styles.eventCard}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  {event.startDate && (
                    <Text style={styles.eventDate}>
                      {formatDate(event.startDate)}
                      {event.endDate && ` - ${formatDate(event.endDate)}`}
                    </Text>
                  )}
                  {event.location && (
                    <Text style={styles.eventLocation}>{event.location}</Text>
                  )}
                  {event.notes && (
                    <Text style={styles.eventNotes}>{event.notes}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Action Items */}
          {result.actionItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Action Items</Text>
              {result.actionItems.map((item, index) => (
                <View key={index} style={styles.actionCard}>
                  <View style={styles.actionHeader}>
                    <View
                      style={[
                        styles.priorityBadge,
                        { backgroundColor: getPriorityColor(item.priority) },
                      ]}
                    >
                      <Text style={styles.priorityText}>
                        {item.priority.toUpperCase()}
                      </Text>
                    </View>
                    {item.dueDate && (
                      <Text style={styles.actionDueDate}>
                        Due: {formatDate(item.dueDate)}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.actionTask}>{item.task}</Text>
                </View>
              ))}
            </View>
          )}

          {/* No Content */}
          {!result.hasContent && (
            <View style={styles.noContentContainer}>
              <Text style={styles.noContentText}>
                No calendar events or action items were found in the provided text.
              </Text>
            </View>
          )}

          {/* Share Button */}
          {result.hasContent && (
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Text style={styles.shareButtonText}>Share Results</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  backButton: {
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: "#6366F1",
    fontSize: 17,
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  errorIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FEE2E2",
    color: "#EF4444",
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 60,
    overflow: "hidden",
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#6366F1",
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryText: {
    fontSize: 16,
    color: "#1a1a1a",
    lineHeight: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  eventCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1",
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  eventDate: {
    marginTop: 4,
    fontSize: 14,
    color: "#6366F1",
  },
  eventLocation: {
    marginTop: 4,
    fontSize: 14,
    color: "#666",
  },
  eventNotes: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  actionCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  actionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  actionDueDate: {
    marginLeft: 12,
    fontSize: 13,
    color: "#666",
  },
  actionTask: {
    fontSize: 15,
    color: "#1a1a1a",
    lineHeight: 22,
  },
  noContentContainer: {
    padding: 40,
    alignItems: "center",
  },
  noContentText: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  shareButton: {
    backgroundColor: "#6366F1",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 40,
  },
  shareButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
