import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../../lib/authContext";

type ActionableItem = {
  type: 'link' | 'attachment';
  label: string;
  url?: string;
  attachmentId?: string;
};

type DebugEmail = {
  _id: string;
  externalId: string;
  subject: string | null;
  receivedAt: number;
  direction: string;
  isTriaged: boolean;
  triageAction?: string;
  triagedAt?: number;
  isPunted?: boolean;
  isSubscription?: boolean;
  gmailAccountId?: string;
  fromEmail: string;
  hasActionableItems?: boolean;
  actionableItemsCount?: number;
  actionableItems?: ActionableItem[] | null;
  hasSummary?: boolean;
};

type SyncStat = {
  email: string;
  lastSyncAt?: number;
  tokenExpiresAt?: number;
  source?: string;
};

type LegacySyncStat = {
  email: string;
  lastSyncAt?: number;
  tokenExpiresAt?: number;
  source: string;
  hasToken: boolean;
  hasRefreshToken: boolean;
};

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getStatusBadge(email: DebugEmail): { text: string; color: string } {
  if (!email.isTriaged) {
    return { text: "INBOX", color: "#3B82F6" };
  }
  if (email.triageAction === "reply_needed") {
    return { text: "TODO", color: "#F59E0B" };
  }
  if (email.triageAction === "done") {
    return { text: "DONE", color: "#10B981" };
  }
  if (email.triageAction === "delegated") {
    return { text: "DELEGATED", color: "#8B5CF6" };
  }
  return { text: "TRIAGED", color: "#6B7280" };
}

function EmailRow({ email }: { email: DebugEmail }) {
  const status = getStatusBadge(email);

  return (
    <View style={styles.emailRow}>
      <View style={styles.emailHeader}>
        <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
          <Text style={styles.statusText}>{status.text}</Text>
        </View>
        <Text style={styles.emailDate}>{formatDate(email.receivedAt)}</Text>
      </View>
      <Text style={styles.emailSubject} numberOfLines={1}>
        {email.subject || "(no subject)"}
      </Text>
      <Text style={styles.emailFrom} numberOfLines={1}>
        From: {email.fromEmail}
      </Text>
      <View style={styles.emailMeta}>
        <Text style={styles.metaText}>
          {email.direction === "outgoing" ? "↑ Sent" : "↓ Received"}
        </Text>
        {email.isSubscription && (
          <Text style={[styles.metaText, styles.metaTag]}>Newsletter</Text>
        )}
        {email.isPunted && (
          <Text style={[styles.metaText, styles.metaTag]}>Punted</Text>
        )}
        {email.hasSummary && (
          <Text style={[styles.metaText, styles.metaTag, styles.summaryTag]}>AI Processed</Text>
        )}
        {email.hasActionableItems && (
          <Text style={[styles.metaText, styles.metaTag, styles.actionTag]}>
            {email.actionableItemsCount} Action{email.actionableItemsCount !== 1 ? 's' : ''}
          </Text>
        )}
      </View>
      {/* Show actionable items if present */}
      {email.actionableItems && email.actionableItems.length > 0 && (
        <View style={styles.actionableSection}>
          <Text style={styles.actionableLabel}>Actionable Items:</Text>
          {email.actionableItems.map((item, idx) => (
            <Text key={idx} style={styles.actionableItem}>
              {item.type === 'link' ? '🔗' : '📎'} {item.label}
              {item.url && <Text style={styles.actionableUrl}> ({item.url.slice(0, 50)}...)</Text>}
            </Text>
          ))}
        </View>
      )}
      <Text style={styles.emailId}>ID: {email.externalId?.slice(0, 16)}...</Text>
    </View>
  );
}

function SyncStatus({ stats, legacyStats }: { stats: SyncStat[]; legacyStats?: LegacySyncStat | null }) {
  return (
    <View style={styles.syncSection}>
      <Text style={styles.syncTitle}>Sync Status</Text>

      {/* Legacy WorkOS account */}
      {legacyStats && (
        <View style={styles.syncRow}>
          <Text style={styles.syncEmail}>
            {legacyStats.email} <Text style={styles.sourceTag}>(WorkOS)</Text>
          </Text>
          <Text style={styles.syncTime}>
            Last sync: {legacyStats.lastSyncAt ? formatDate(legacyStats.lastSyncAt) : "never"}
          </Text>
          <Text style={[
            styles.syncToken,
            !legacyStats.hasToken ? styles.tokenExpired : undefined,
            legacyStats.tokenExpiresAt && legacyStats.tokenExpiresAt < Date.now() ? styles.tokenExpired : undefined,
          ]}>
            Token: {!legacyStats.hasToken ? "NO TOKEN" :
              (legacyStats.tokenExpiresAt && legacyStats.tokenExpiresAt < Date.now()) ? "EXPIRED" : "valid"}
            {legacyStats.hasToken && !legacyStats.hasRefreshToken && " (no refresh!)"}
          </Text>
        </View>
      )}

      {/* Linked Gmail accounts */}
      {stats.map((stat, i) => {
        const isExpired = stat.tokenExpiresAt && stat.tokenExpiresAt < Date.now();
        return (
          <View key={i} style={styles.syncRow}>
            <Text style={styles.syncEmail}>
              {stat.email} <Text style={styles.sourceTag}>(Linked)</Text>
            </Text>
            <Text style={styles.syncTime}>
              Last sync: {stat.lastSyncAt ? formatDate(stat.lastSyncAt) : "never"}
            </Text>
            <Text style={[styles.syncToken, isExpired ? styles.tokenExpired : undefined]}>
              Token: {isExpired ? "EXPIRED" : stat.tokenExpiresAt ? "valid" : "unknown"}
            </Text>
          </View>
        );
      })}

      {!legacyStats?.hasToken && stats.length === 0 && (
        <Text style={styles.noAccountsText}>No Gmail accounts configured</Text>
      )}
    </View>
  );
}

export default function DebugScreen() {
  const { isAuthenticated } = useAuth();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allEmails, setAllEmails] = useState<DebugEmail[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const result = useQuery(
    api.emails.getMyAllEmailsDebug,
    isAuthenticated ? { cursor, limit: 50 } : "skip"
  );

  // Merge new results with existing
  React.useEffect(() => {
    if (result?.emails) {
      if (!cursor) {
        // First page - replace all
        setAllEmails(result.emails as DebugEmail[]);
      } else {
        // Subsequent pages - append
        setAllEmails((prev) => {
          const existingIds = new Set(prev.map((e) => e._id));
          const newEmails = (result.emails as DebugEmail[]).filter(
            (e) => !existingIds.has(e._id)
          );
          return [...prev, ...newEmails];
        });
      }
    }
  }, [result?.emails, cursor]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setCursor(undefined);
    setAllEmails([]);
    // The query will automatically refetch
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (result?.hasMore && result?.nextCursor) {
      setCursor(result.nextCursor);
    }
  }, [result?.hasMore, result?.nextCursor]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.message}>Sign in to view debug info</Text>
      </SafeAreaView>
    );
  }

  const loading = !result;
  const totalCount = result?.totalCount ?? 0;
  const syncStats = (result?.syncStats ?? []) as SyncStat[];
  const legacySyncStats = result?.legacySyncStats as LegacySyncStat | null | undefined;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Debug: All Emails</Text>
        <Text style={styles.subtitle}>
          Showing {allEmails.length} of {totalCount} total emails
        </Text>
      </View>

      <SyncStatus stats={syncStats} legacyStats={legacySyncStats} />

      {loading && allEmails.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading emails...</Text>
        </View>
      ) : (
        <FlatList
          data={allEmails}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <EmailRow email={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            result?.hasMore ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color="#6366F1" />
                <Text style={styles.footerText}>Loading more...</Text>
              </View>
            ) : allEmails.length > 0 ? (
              <Text style={styles.footerText}>End of emails</Text>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No emails found</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  syncSection: {
    padding: 12,
    backgroundColor: "#FEF3C7",
    borderBottomWidth: 1,
    borderBottomColor: "#FCD34D",
  },
  syncTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 8,
  },
  syncRow: {
    marginBottom: 6,
  },
  syncEmail: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  syncTime: {
    fontSize: 12,
    color: "#666",
  },
  syncToken: {
    fontSize: 12,
    color: "#10B981",
  },
  tokenExpired: {
    color: "#EF4444",
    fontWeight: "600",
  },
  sourceTag: {
    fontSize: 11,
    color: "#888",
    fontWeight: "400",
  },
  noAccountsText: {
    fontSize: 13,
    color: "#EF4444",
    fontStyle: "italic",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  listContent: {
    padding: 12,
  },
  emailRow: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  emailDate: {
    fontSize: 12,
    color: "#666",
  },
  emailSubject: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  emailFrom: {
    fontSize: 13,
    color: "#666",
    marginBottom: 6,
  },
  emailMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 11,
    color: "#888",
  },
  metaTag: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  summaryTag: {
    backgroundColor: "#DBEAFE",
    color: "#1D4ED8",
  },
  actionTag: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
  },
  actionableSection: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#FEF9C3",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FDE047",
  },
  actionableLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 4,
  },
  actionableItem: {
    fontSize: 12,
    color: "#78350F",
    marginBottom: 2,
  },
  actionableUrl: {
    fontSize: 10,
    color: "#A16207",
    fontFamily: "monospace",
  },
  emailId: {
    fontSize: 10,
    color: "#aaa",
    fontFamily: "monospace",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    padding: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    padding: 32,
  },
  message: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    padding: 32,
  },
});
