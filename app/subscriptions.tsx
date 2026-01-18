import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "../lib/authContext";
import { Id } from "../convex/_generated/dataModel";

// Cross-platform alert
function showAlert(
  title: string,
  message: string,
  buttons?: Array<{ text: string; onPress?: () => void; style?: "cancel" | "destructive" | "default" }>
) {
  if (Platform.OS === "web") {
    if (buttons && buttons.length > 1) {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        buttons.find(b => b.style !== "cancel")?.onPress?.();
      }
    } else {
      window.alert(`${title}: ${message}`);
    }
  } else {
    Alert.alert(title, message, buttons);
  }
}

// Format date relative to now
function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

// Get status badge color
function getStatusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case "subscribed":
      return { bg: "#E5E7EB", text: "#374151" };
    case "pending":
    case "processing":
      return { bg: "#FEF3C7", text: "#92400E" };
    case "unsubscribed":
      return { bg: "#D1FAE5", text: "#065F46" };
    case "failed":
      return { bg: "#FEE2E2", text: "#991B1B" };
    case "manual_required":
      return { bg: "#DBEAFE", text: "#1E40AF" };
    default:
      return { bg: "#E5E7EB", text: "#374151" };
  }
}

// Get unsubscribe method label
function getMethodLabel(method: string | undefined): string {
  switch (method) {
    case "http_post":
      return "One-click";
    case "mailto":
      return "Email";
    case "http_get":
      return "Manual";
    default:
      return "Unknown";
  }
}

interface Subscription {
  _id: Id<"subscriptions">;
  senderEmail: string;
  senderName?: string;
  emailCount: number;
  lastEmailAt: number;
  unsubscribeStatus: string;
  unsubscribeMethod?: string;
  listUnsubscribe?: string;
  mostRecentSubject?: string;
}

interface SubscriptionRowProps {
  subscription: Subscription;
  isSelected: boolean;
  onToggle: () => void;
  disabled: boolean;
}

const SubscriptionRow = React.memo(function SubscriptionRow({
  subscription,
  isSelected,
  onToggle,
  disabled,
}: SubscriptionRowProps) {
  const statusColors = getStatusColor(subscription.unsubscribeStatus);
  const isActionable = subscription.unsubscribeStatus === "subscribed" ||
                       subscription.unsubscribeStatus === "failed" ||
                       subscription.unsubscribeStatus === "manual_required";

  return (
    <TouchableOpacity
      style={[
        styles.row,
        isSelected && styles.rowSelected,
        !isActionable && styles.rowDisabled,
      ]}
      onPress={isActionable ? onToggle : undefined}
      disabled={disabled || !isActionable}
      activeOpacity={0.7}
    >
      {/* Checkbox */}
      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </View>

      {/* Sender Info */}
      <View style={styles.senderInfo}>
        <Text style={styles.senderName} numberOfLines={1}>
          {subscription.senderName || subscription.senderEmail.split("@")[0]}
        </Text>
        {subscription.emailCount === 1 && subscription.mostRecentSubject ? (
          <Text style={styles.subjectText} numberOfLines={1}>
            {subscription.mostRecentSubject}
          </Text>
        ) : (
          <Text style={styles.senderEmail} numberOfLines={1}>
            {subscription.senderEmail}
          </Text>
        )}
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <Text style={styles.emailCount}>
          {subscription.emailCount} {subscription.emailCount === 1 ? "email" : "emails"}
        </Text>
        <Text style={styles.lastReceived}>{formatRelativeDate(subscription.lastEmailAt)}</Text>
      </View>

      {/* Status Badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
        <Text style={[styles.statusText, { color: statusColors.text }]}>
          {subscription.unsubscribeStatus === "subscribed"
            ? getMethodLabel(subscription.unsubscribeMethod)
            : subscription.unsubscribeStatus.replace("_", " ")}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export default function SubscriptionsScreen() {
  const { user } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Fetch subscriptions (query is in subscriptionsHelpers, actions in subscriptions)
  const subscriptions = useQuery(
    api.subscriptionsHelpers.getSubscriptions,
    user?.email ? { userEmail: user.email } : "skip"
  );

  // Actions
  const batchUnsubscribe = useAction(api.subscriptions.batchUnsubscribe);
  const scanExistingEmails = useAction(api.subscriptions.scanExistingEmails);
  const forceRescan = useAction(api.subscriptions.forceRescan);

  // Filter to only actionable subscriptions for selection
  const actionableSubscriptions = useMemo(() => {
    if (!subscriptions) return [];
    return subscriptions.filter(
      (s) =>
        s.unsubscribeStatus === "subscribed" ||
        s.unsubscribeStatus === "failed" ||
        s.unsubscribeStatus === "manual_required"
    );
  }, [subscriptions]);

  // Toggle selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select all actionable
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(actionableSubscriptions.map((s) => s._id)));
  }, [actionableSubscriptions]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Handle unsubscribe
  const handleUnsubscribe = useCallback(async () => {
    if (!user?.email || selectedIds.size === 0) return;

    const selectedArray = Array.from(selectedIds) as Id<"subscriptions">[];

    showAlert(
      "Confirm Unsubscribe",
      `Unsubscribe from ${selectedIds.size} subscription${selectedIds.size > 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unsubscribe",
          style: "destructive",
          onPress: async () => {
            setIsUnsubscribing(true);
            try {
              const result = await batchUnsubscribe({
                userEmail: user.email,
                subscriptionIds: selectedArray,
              });

              // Clear selection
              setSelectedIds(new Set());

              // Show results
              const messages: string[] = [];
              if (result.completed.length > 0) {
                messages.push(`${result.completed.length} completed automatically`);
              }
              if (result.manualRequired.length > 0) {
                messages.push(`${result.manualRequired.length} need manual confirmation`);
              }
              if (result.failed.length > 0) {
                messages.push(`${result.failed.length} failed`);
              }

              showAlert("Unsubscribe Results", messages.join("\n"));

              // Open manual URLs in browser
              if (result.manualRequired.length > 0) {
                showAlert(
                  "Manual Confirmation Needed",
                  `${result.manualRequired.length} subscription${result.manualRequired.length > 1 ? "s" : ""} require${result.manualRequired.length === 1 ? "s" : ""} manual confirmation. Open them in your browser?`,
                  [
                    { text: "Not Now", style: "cancel" },
                    {
                      text: "Open",
                      onPress: () => {
                        for (const item of result.manualRequired) {
                          Linking.openURL(item.url);
                        }
                      },
                    },
                  ]
                );
              }
            } catch (error) {
              console.error("Unsubscribe error:", error);
              showAlert("Error", "Failed to process unsubscribe requests. Please try again.");
            } finally {
              setIsUnsubscribing(false);
            }
          },
        },
      ]
    );
  }, [user?.email, selectedIds, batchUnsubscribe]);

  // Handle scan inbox
  const handleScanInbox = useCallback(async () => {
    if (!user?.email) return;

    setIsScanning(true);
    try {
      const result = await scanExistingEmails({ userEmail: user.email });
      showAlert(
        "Scan Complete",
        `Scanned ${result.scanned} emails, found ${result.found} subscriptions`
      );
    } catch (error) {
      console.error("Scan error:", error);
      showAlert("Error", "Failed to scan inbox. Please try again.");
    } finally {
      setIsScanning(false);
    }
  }, [user?.email, scanExistingEmails]);

  // Handle force rescan (resets all subscription data first)
  const handleForceRescan = useCallback(async () => {
    if (!user?.email) return;

    showAlert(
      "Force Rescan",
      "This will delete all subscription data and rescan your entire inbox. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Rescan All",
          style: "destructive",
          onPress: async () => {
            setIsScanning(true);
            try {
              const result = await forceRescan({ userEmail: user.email });
              showAlert(
                "Rescan Complete",
                `Reset ${result.reset.deletedSubscriptions} subscriptions.\nScanned ${result.scan.scanned} emails, found ${result.scan.found} subscriptions.`
              );
            } catch (error) {
              console.error("Force rescan error:", error);
              showAlert("Error", "Failed to rescan inbox. Please try again.");
            } finally {
              setIsScanning(false);
            }
          },
        },
      ]
    );
  }, [user?.email, forceRescan]);

  // Render subscription row
  const renderItem = useCallback(
    ({ item }: { item: Subscription }) => (
      <SubscriptionRow
        subscription={item}
        isSelected={selectedIds.has(item._id)}
        onToggle={() => toggleSelection(item._id)}
        disabled={isUnsubscribing}
      />
    ),
    [selectedIds, toggleSelection, isUnsubscribing]
  );

  // Key extractor
  const keyExtractor = useCallback((item: Subscription) => item._id, []);

  // Loading state
  if (subscriptions === undefined) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen
          options={{
            title: "Manage Subscriptions",
            headerBackTitle: "Settings",
            headerShown: false,
          }}
        />
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Settings</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>Manage Subscriptions</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading subscriptions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen
        options={{
          title: "Manage Subscriptions",
          headerBackTitle: "Settings",
          headerShown: false,
        }}
      />

      {/* Navigation Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Settings</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Manage Subscriptions</Text>
        <View style={styles.backButton} />
      </View>

      {/* Header Actions */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>
            {subscriptions.length} subscription{subscriptions.length !== 1 ? "s" : ""}
          </Text>
          {selectedIds.size > 0 && (
            <Text style={styles.selectedCount}>
              {selectedIds.size} selected
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={isScanning ? undefined : handleForceRescan}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <Text style={styles.headerButtonText}>Rescan All</Text>
            )}
          </TouchableOpacity>
          {selectedIds.size > 0 ? (
            <TouchableOpacity style={styles.headerButton} onPress={clearSelection}>
              <Text style={styles.headerButtonText}>Clear</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={selectAll}
              disabled={actionableSubscriptions.length === 0}
            >
              <Text
                style={[
                  styles.headerButtonText,
                  actionableSubscriptions.length === 0 && styles.headerButtonDisabled,
                ]}
              >
                Select All
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Subscription List */}
      {subscriptions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No subscriptions found</Text>
          <Text style={styles.emptyText}>
            Tap "Scan Inbox" to detect newsletters and mailing lists from your existing emails.
          </Text>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={handleForceRescan}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.scanButtonText}>Scan Inbox</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={subscriptions}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Bottom Action Bar */}
      {selectedIds.size > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.unsubscribeButton, isUnsubscribing && styles.unsubscribeButtonDisabled]}
            onPress={handleUnsubscribe}
            disabled={isUnsubscribing}
          >
            {isUnsubscribing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.unsubscribeButtonText}>
                Unsubscribe from {selectedIds.size} selected
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    minWidth: 80,
  },
  backButtonText: {
    fontSize: 16,
    color: "#6366F1",
    fontWeight: "500",
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  selectedCount: {
    fontSize: 14,
    color: "#6366F1",
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerButtonText: {
    fontSize: 14,
    color: "#6366F1",
    fontWeight: "500",
  },
  headerButtonDisabled: {
    color: "#9CA3AF",
  },
  listContent: {
    paddingBottom: 100,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  rowSelected: {
    backgroundColor: "#EEF2FF",
  },
  rowDisabled: {
    opacity: 0.6,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkboxSelected: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  checkmark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  senderInfo: {
    flex: 1,
    marginRight: 12,
  },
  senderName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  senderEmail: {
    fontSize: 13,
    color: "#6B7280",
  },
  subjectText: {
    fontSize: 13,
    color: "#4B5563",
    fontStyle: "italic",
  },
  stats: {
    alignItems: "flex-end",
    marginRight: 12,
  },
  emailCount: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
  },
  lastReceived: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 70,
    alignItems: "center",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  scanButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 140,
    alignItems: "center",
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  unsubscribeButton: {
    backgroundColor: "#EF4444",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  unsubscribeButtonDisabled: {
    backgroundColor: "#FCA5A5",
  },
  unsubscribeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
