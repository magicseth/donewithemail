import React, { useState, useCallback, memo, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  Image,
  SectionList,
} from "react-native";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { BatchEmailRow, QuickReplyOption } from "./BatchEmailRow";
import type { BatchEmailPreview, BatchCategory } from "../../hooks/useBatchTriage";

// Get initials from name for avatar placeholder
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Sender group header component
interface SenderGroupHeaderProps {
  senderName: string;
  senderEmail: string;
  avatarUrl?: string;
  emailCount: number;
  /** Number of emails flagged for this sender */
  flaggedCount?: number;
  /** Mark all emails from this sender as done */
  onMarkAllDone?: () => void;
  /** Toggle flag on all emails from this sender */
  onToggleFlagAll?: () => void;
}

function SenderGroupHeader({
  senderName,
  senderEmail,
  avatarUrl,
  emailCount,
  flaggedCount = 0,
  onMarkAllDone,
  onToggleFlagAll,
}: SenderGroupHeaderProps) {
  const initials = getInitials(senderName || senderEmail.split("@")[0]);
  const allFlagged = flaggedCount === emailCount;

  return (
    <View style={senderStyles.container}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={senderStyles.avatar} />
      ) : (
        <View style={[senderStyles.avatar, senderStyles.avatarPlaceholder]}>
          <Text style={senderStyles.avatarText}>{initials}</Text>
        </View>
      )}
      <View style={senderStyles.info}>
        <Text style={senderStyles.name} numberOfLines={1}>{senderName || senderEmail}</Text>
        <Text style={senderStyles.count}>
          {emailCount} email{emailCount !== 1 ? "s" : ""}
          {flaggedCount > 0 && ` · ${flaggedCount} flagged`}
        </Text>
      </View>
      {/* Bulk action icons */}
      <View style={senderStyles.actions}>
        {onMarkAllDone && (
          <TouchableOpacity
            style={senderStyles.iconButton}
            onPress={onMarkAllDone}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={senderStyles.checkmarkIcon}>✓</Text>
          </TouchableOpacity>
        )}
        {onToggleFlagAll && (
          <TouchableOpacity
            style={[senderStyles.iconButton, allFlagged && senderStyles.iconButtonActive]}
            onPress={onToggleFlagAll}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[senderStyles.flagIcon, allFlagged && senderStyles.flagIconActive]}>
              {allFlagged ? "🚩" : "⚑"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const senderStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: "#F9FAFB",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    // Sticky positioning for web
    ...(Platform.OS === "web" ? {
      position: "sticky" as const,
      top: 0,
      zIndex: 10,
    } : {}),
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  info: {
    marginLeft: 10,
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  count: {
    fontSize: 12,
    color: "#6B7280",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E5E7EB",
  },
  iconButtonActive: {
    backgroundColor: "#FEF3C7",
  },
  checkmarkIcon: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9CA3AF",  // Gray until clicked
  },
  flagIcon: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  flagIconActive: {
    color: "#F59E0B",
  },
});

// Group emails by sender
interface SenderGroup {
  senderEmail: string;
  senderName: string;
  avatarUrl?: string;
  emails: BatchEmailPreview[];
  flaggedCount: number;
}

// Category configuration
interface CategoryConfig {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  backgroundColor: string;
}

const CATEGORY_CONFIG: Record<BatchCategory, CategoryConfig> = {
  done: {
    icon: "📬",
    title: "FYI",
    subtitle: "Newsletters, FYIs, receipts",
    color: "#10B981",
    backgroundColor: "#ECFDF5",
  },
  humanWaiting: {
    icon: "👤",
    title: "HUMAN WAITING",
    subtitle: "Someone is waiting for your reply",
    color: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  actionNeeded: {
    icon: "📋",
    title: "ACTION NEEDED",
    subtitle: "Tasks to complete (not replies)",
    color: "#6366F1",
    backgroundColor: "#EEF2FF",
  },
  calendar: {
    icon: "📅",
    title: "ADD TO CALENDAR",
    subtitle: "Meeting invites AI recommends",
    color: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },
  lowConfidence: {
    icon: "⚠️",
    title: "NEEDS REVIEW",
    subtitle: "AI uncertain - check these",
    color: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  pending: {
    icon: "⏳",
    title: "ANALYZING",
    subtitle: "Waiting for AI processing",
    color: "#6B7280",
    backgroundColor: "#F9FAFB",
  },
};

interface BatchCategoryCardProps {
  category: BatchCategory;
  emails: BatchEmailPreview[];
  puntedEmails: Set<string>;
  onPuntEmail: (emailId: string) => void;
  /** Mark a single email as done */
  onMarkEmailDone?: (emailId: string) => void;
  /** Mark all non-flagged emails in category as done */
  onMarkAllDone: () => void;
  /** Mark all emails from a specific sender as done */
  onMarkSenderDone?: (senderEmail: string) => void;
  /** Toggle flag on all emails from a specific sender */
  onToggleSenderFlag?: (senderEmail: string) => void;
  onAcceptCalendar?: (emailId: string) => void;
  onQuickReply?: (emailId: string, reply: QuickReplyOption) => void;
  onMicPressIn?: (emailId: string) => void;
  onMicPressOut?: (emailId: string) => void;
  onSendTranscript?: (emailId: string) => void;
  onUnsubscribe?: (emailId: string) => void;
  onNeedsReplyPress?: (emailId: string) => void;
  acceptingIds?: Set<string>;
  unsubscribingIds?: Set<string>;
  isProcessing?: boolean;
  /** ID of email currently being recorded for */
  recordingForId?: string | null;
  /** Whether deepgram is connected and streaming */
  isRecordingConnected?: boolean;
  /** ID of email that has a pending transcript to send */
  pendingTranscriptForId?: string | null;
  /** Live transcript while recording or pending */
  transcript?: string;
  /** Controlled expanded state (for single-expand mode) */
  isExpanded?: boolean;
  /** Callback when expand is toggled */
  onToggleExpand?: () => void;
}

export const BatchCategoryCard = memo(function BatchCategoryCard({
  category,
  emails,
  puntedEmails,
  onPuntEmail,
  onMarkEmailDone,
  onMarkAllDone,
  onMarkSenderDone,
  onToggleSenderFlag,
  onAcceptCalendar,
  onQuickReply,
  onMicPressIn,
  onMicPressOut,
  onSendTranscript,
  onUnsubscribe,
  onNeedsReplyPress,
  acceptingIds,
  unsubscribingIds,
  isProcessing,
  recordingForId,
  isRecordingConnected,
  pendingTranscriptForId,
  transcript,
  isExpanded: controlledIsExpanded,
  onToggleExpand,
}: BatchCategoryCardProps) {
  // Support both controlled and uncontrolled modes
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : internalIsExpanded;

  // Track if this is the first time expanding (for animation trigger)
  const [hasExpandedOnce, setHasExpandedOnce] = useState(false);
  const config = CATEGORY_CONFIG[category];

  // Track email count to animate removal
  const prevEmailCount = useRef(emails.length);
  useEffect(() => {
    // Animate when emails are removed (count decreases)
    if (emails.length < prevEmailCount.current) {
      LayoutAnimation.configureNext({
        duration: 250,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      });
    }
    prevEmailCount.current = emails.length;
  }, [emails.length]);

  // Group emails by sender
  const senderGroups = useMemo((): SenderGroup[] => {
    const groups = new Map<string, SenderGroup>();

    for (const email of emails) {
      const senderEmail = email.fromContact?.email || "unknown";
      const existing = groups.get(senderEmail);
      const isFlagged = puntedEmails.has(email._id) || !!email.isInTodo;

      if (existing) {
        existing.emails.push(email);
        if (isFlagged) existing.flaggedCount++;
      } else {
        groups.set(senderEmail, {
          senderEmail,
          senderName: email.fromContact?.name || email.fromName || senderEmail,
          avatarUrl: email.fromContact?.avatarUrl,
          emails: [email],
          flaggedCount: isFlagged ? 1 : 0,
        });
      }
    }

    // Sort groups by most recent email
    return Array.from(groups.values()).sort((a, b) => {
      const aTime = Math.max(...a.emails.map(e => e.receivedAt));
      const bTime = Math.max(...b.emails.map(e => e.receivedAt));
      return bTime - aTime;
    });
  }, [emails, puntedEmails]);

  // Flatten sender groups into a list with headers for FlatList (native)
  type FlatListItem =
    | { type: "header"; senderEmail: string; senderName: string; avatarUrl?: string; emailCount: number }
    | { type: "email"; email: BatchEmailPreview; globalIndex: number };

  const flattenedItems = useMemo((): FlatListItem[] => {
    const items: FlatListItem[] = [];
    let globalIndex = 0;
    for (const group of senderGroups) {
      items.push({
        type: "header",
        senderEmail: group.senderEmail,
        senderName: group.senderName,
        avatarUrl: group.avatarUrl,
        emailCount: group.emails.length,
      });
      for (const email of group.emails) {
        items.push({ type: "email", email, globalIndex });
        globalIndex++;
      }
    }
    return items;
  }, [senderGroups]);

  const handleToggleExpand = useCallback(() => {
    if (onToggleExpand) {
      // Controlled mode - use parent's handler
      if (!isExpanded && !hasExpandedOnce) {
        setHasExpandedOnce(true);
      }
      onToggleExpand();
    } else {
      // Uncontrolled mode - use internal state
      setInternalIsExpanded(prev => {
        if (!prev && !hasExpandedOnce) {
          setHasExpandedOnce(true);
        }
        return !prev;
      });
    }
  }, [hasExpandedOnce, isExpanded, onToggleExpand]);

  // Count how many are NOT punted (will be marked done)
  // Include isInTodo emails as "punted" since they're already in TODO
  const unpuntedCount = emails.filter(e => !puntedEmails.has(e._id) && !e.isInTodo).length;
  const puntedCount = emails.length - unpuntedCount;

  // Don't render if category is empty
  if (emails.length === 0) {
    return null;
  }

  return (
    <View style={[
      styles.container,
      { backgroundColor: config.backgroundColor },
      // When expanded (rendered outside ScrollView), fill available space
      isExpanded && { flex: 1 },
    ]}>
      {/* Header - always visible */}
      <TouchableOpacity style={styles.header} onPress={handleToggleExpand} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <Text style={[styles.icon, { color: config.color }]}>{config.icon}</Text>
          <View style={styles.headerText}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: config.color }]}>{config.title}</Text>
              <View style={[styles.countBadge, { backgroundColor: config.color }]}>
                <Text style={styles.countText}>{emails.length}</Text>
              </View>
              {puntedCount > 0 && (
                <View style={styles.savedBadge}>
                  <Text style={styles.savedBadgeText}>{puntedCount} saved</Text>
                </View>
              )}
            </View>
            <Text style={styles.subtitle}>{config.subtitle}</Text>
          </View>
        </View>

        <Text style={[styles.chevron, { color: config.color }]}>
          {isExpanded ? "▲" : "▼"}
        </Text>
      </TouchableOpacity>

      {/* Email list - expanded, grouped by sender with sticky headers */}
      {isExpanded && (
        <View style={[styles.emailList, Platform.OS !== "web" && { flex: 1 }]}>
          {/* On web, render directly with CSS sticky; on native, use SectionList */}
          {Platform.OS === "web" ? (
            <>
              {senderGroups.map((group, sectionIndex) => {
                const prevItemsCount = senderGroups.slice(0, sectionIndex).reduce((sum, g) => sum + g.emails.length, 0);
                return (
                  <View key={group.senderEmail}>
                    <SenderGroupHeader
                      senderName={group.senderName}
                      senderEmail={group.senderEmail}
                      avatarUrl={group.avatarUrl}
                      emailCount={group.emails.length}
                      flaggedCount={group.flaggedCount}
                      onMarkAllDone={onMarkSenderDone ? () => onMarkSenderDone(group.senderEmail) : undefined}
                      onToggleFlagAll={onToggleSenderFlag ? () => onToggleSenderFlag(group.senderEmail) : undefined}
                    />
                    {group.emails.map((email, index) => {
                      const globalIndex = prevItemsCount + index;
                      return (
                        <BatchEmailRow
                          key={email._id}
                          email={email}
                          isPunted={puntedEmails.has(email._id) || !!email.isInTodo}
                          isSubscription={email.isSubscription}
                          expandReplyByDefault={category === "humanWaiting"}
                          isRecording={recordingForId === email._id}
                          isRecordingConnected={isRecordingConnected}
                          transcript={(recordingForId === email._id || pendingTranscriptForId === email._id) ? transcript : undefined}
                          switchAnimationDelay={200 + globalIndex * 150}
                          triggerSwitchAnimation={isExpanded}
                          onPunt={() => onPuntEmail(email._id)}
                          onMarkDone={onMarkEmailDone ? () => onMarkEmailDone(email._id) : undefined}
                          onAccept={onAcceptCalendar ? () => onAcceptCalendar(email._id) : undefined}
                          onQuickReply={onQuickReply ? (reply) => onQuickReply(email._id, reply) : undefined}
                          onMicPressIn={onMicPressIn ? () => onMicPressIn(email._id) : undefined}
                          onMicPressOut={onMicPressOut ? () => onMicPressOut(email._id) : undefined}
                          onSendTranscript={onSendTranscript ? () => onSendTranscript(email._id) : undefined}
                          onUnsubscribe={onUnsubscribe ? () => onUnsubscribe(email._id) : undefined}
                          onNeedsReplyPress={onNeedsReplyPress ? () => onNeedsReplyPress(email._id) : undefined}
                          isAccepting={acceptingIds?.has(email._id)}
                          isUnsubscribing={unsubscribingIds?.has(email._id)}
                          compact={true}
                        />
                      );
                    })}
                  </View>
                );
              })}
              {/* Footer for web */}
              {unpuntedCount > 0 && (
                <TouchableOpacity
                  style={[styles.markDoneButton, isProcessing && styles.markDoneButtonDisabled]}
                  onPress={onMarkAllDone}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.markDoneButtonText}>
                      Done with {unpuntedCount} emails
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              {unpuntedCount === 0 && (
                <View style={styles.allSavedMessage}>
                  <Text style={styles.allSavedText}>All emails saved to TODO</Text>
                </View>
              )}
            </>
          ) : (
            <SectionList
              sections={senderGroups.map(group => ({
                ...group,
                data: group.emails,
              }))}
              keyExtractor={(item) => item._id}
              stickySectionHeadersEnabled={true}
              renderSectionHeader={({ section }) => (
                <SenderGroupHeader
                  senderName={section.senderName}
                  senderEmail={section.senderEmail}
                  avatarUrl={section.avatarUrl}
                  emailCount={section.emails.length}
                  flaggedCount={section.flaggedCount}
                  onMarkAllDone={onMarkSenderDone ? () => onMarkSenderDone(section.senderEmail) : undefined}
                  onToggleFlagAll={onToggleSenderFlag ? () => onToggleSenderFlag(section.senderEmail) : undefined}
                />
              )}
              renderItem={({ item: email, index, section }) => {
                const sectionIndex = senderGroups.findIndex(g => g.senderEmail === section.senderEmail);
                const prevItemsCount = senderGroups.slice(0, sectionIndex).reduce((sum, g) => sum + g.emails.length, 0);
                const globalIndex = prevItemsCount + index;
                return (
                  <BatchEmailRow
                    email={email}
                    isPunted={puntedEmails.has(email._id) || !!email.isInTodo}
                    isSubscription={email.isSubscription}
                    expandReplyByDefault={category === "humanWaiting"}
                    isRecording={recordingForId === email._id}
                    isRecordingConnected={isRecordingConnected}
                    transcript={(recordingForId === email._id || pendingTranscriptForId === email._id) ? transcript : undefined}
                    switchAnimationDelay={200 + globalIndex * 150}
                    triggerSwitchAnimation={isExpanded}
                    onPunt={() => onPuntEmail(email._id)}
                    onMarkDone={onMarkEmailDone ? () => onMarkEmailDone(email._id) : undefined}
                    onAccept={onAcceptCalendar ? () => onAcceptCalendar(email._id) : undefined}
                    onQuickReply={onQuickReply ? (reply) => onQuickReply(email._id, reply) : undefined}
                    onMicPressIn={onMicPressIn ? () => onMicPressIn(email._id) : undefined}
                    onMicPressOut={onMicPressOut ? () => onMicPressOut(email._id) : undefined}
                    onSendTranscript={onSendTranscript ? () => onSendTranscript(email._id) : undefined}
                    onUnsubscribe={onUnsubscribe ? () => onUnsubscribe(email._id) : undefined}
                    onNeedsReplyPress={onNeedsReplyPress ? () => onNeedsReplyPress(email._id) : undefined}
                    isAccepting={acceptingIds?.has(email._id)}
                    isUnsubscribing={unsubscribingIds?.has(email._id)}
                    compact={true}
                  />
                );
              }}
              ListFooterComponent={
                <>
                  {unpuntedCount > 0 && (
                    <TouchableOpacity
                      style={[styles.markDoneButton, isProcessing && styles.markDoneButtonDisabled]}
                      onPress={onMarkAllDone}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.markDoneButtonText}>
                          Done with {unpuntedCount} emails
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                  {unpuntedCount === 0 && (
                    <View style={styles.allSavedMessage}>
                      <Text style={styles.allSavedText}>All emails saved to TODO</Text>
                    </View>
                  )}
                </>
              }
              style={{ flex: 1 }}
            />
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    // overflow: hidden clips sticky headers on web, only use on native
    ...(Platform.OS !== "web" ? { overflow: "hidden" as const } : {}),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  icon: {
    fontSize: 18,
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  countBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  savedBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#6366F1",
    borderRadius: 10,
  },
  savedBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  chevron: {
    fontSize: 12,
    marginLeft: 4,
  },
  emailList: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  markDoneButton: {
    backgroundColor: "#10B981",
    marginHorizontal: 12,
    marginVertical: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  markDoneButtonDisabled: {
    opacity: 0.6,
  },
  markDoneButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  allSavedMessage: {
    paddingVertical: 12,
    alignItems: "center",
  },
  allSavedText: {
    fontSize: 13,
    color: "#6366F1",
    fontWeight: "500",
  },
});
