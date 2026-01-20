/**
 * TriageListWrapper - FlatList wrapper with triage gesture/scroll handling.
 */
import React, { useCallback, useRef } from "react";
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import Animated from "react-native-reanimated";
import { useTriageContext } from "../triage";
import type { InboxEmail } from "./types";
import { TRIAGE_CONFIG } from "./types";

interface TriageListWrapperProps {
  flatListRef: React.RefObject<FlatList | null>;
  emails: InboxEmail[];
  renderItem: ({ item, index }: { item: InboxEmail; index: number }) => React.ReactElement;
  extraData: unknown;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  searchQuery: string;
  isSyncing: boolean;
  isSummarizing: boolean;
  onTouchEnd?: () => void;
}

export const TriageListWrapper = React.memo(function TriageListWrapper({
  flatListRef,
  emails,
  renderItem,
  extraData,
  refreshing,
  onRefresh,
  onEndReached,
  searchQuery,
  isSyncing,
  isSummarizing,
  onTouchEnd,
}: TriageListWrapperProps) {
  const triage = useTriageContext();

  // Update scroll position in new context
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    triage.setScrollY(y);
  }, [triage]);

  // Track first visible item - handles varying row heights correctly
  const handleViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    // Find the first visible item
    const firstVisible = viewableItems.find(item => item.index !== null);
    if (firstVisible && firstVisible.index !== null) {
      triage.setActiveIndex(firstVisible.index);
    }
  }, [triage]);

  // Viewability config - item is "viewable" when 50% visible
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 0,
  }).current;

  // Handle touch end - reset phase to idle
  const handleTouchEnd = useCallback(() => {
    if (triage.phase.value === "dragging") {
      triage.phase.value = "idle";
    }
    onTouchEnd?.();
  }, [triage.phase, onTouchEnd]);

  return (
    <View
      style={styles.container}
      onStartShouldSetResponderCapture={(e) => {
        // Capture phase - fires before scroll takes over
        const x = e.nativeEvent.pageX;
        triage.fingerX.value = x;
        triage.startX.value = x;
        // Start dragging phase
        if (triage.phase.value === "idle") {
          triage.phase.value = "dragging";
        }
        return false; // Don't claim responder - let scroll work
      }}
      onMoveShouldSetResponderCapture={(e) => {
        // Capture phase for moves - fires at full frequency!
        triage.fingerX.value = e.nativeEvent.pageX;
        return false; // Don't claim responder - let scroll work
      }}
    >
      <Animated.View
        style={styles.container}
        onTouchEnd={handleTouchEnd}
      >
        <FlatList
            ref={flatListRef}
            data={emails}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            extraData={extraData}
            contentContainerStyle={styles.listContent}
            refreshControl={
              Platform.OS !== "web" ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#6366F1"
                />
              ) : undefined
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>{searchQuery ? "\uD83D\uDD0D" : "\uD83D\uDCED"}</Text>
                <Text style={styles.emptyText}>
                  {searchQuery ? "No results found" : "No emails yet"}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery
                    ? `No emails matching "${searchQuery}"`
                    : Platform.OS === "web"
                      ? "Click refresh to sync"
                      : "Pull down to sync"}
                </Text>
              </View>
            }
            ListFooterComponent={
              isSyncing || isSummarizing ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Text style={styles.loadingMoreText}>
                    {isSyncing ? "Syncing..." : "Summarizing with AI..."}
                  </Text>
                </View>
              ) : null
            }
          />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: TRIAGE_CONFIG.listTopPadding,
    paddingBottom: 800,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  loadingMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 14,
    color: "#666",
  },
});
