import * as React from "react";
import { View, StyleSheet } from "react-native";
import { useAnimatedReaction, runOnJS } from "react-native-reanimated";

import { TRIAGE_TARGETS, isTargetVisible } from "./triageTargets";
import { useTriageContext } from "./TriageProvider";
import { TriageTargetView } from "./TriageTargetView";
import type { TriageTarget } from "./triageTypes";

/**
 * Overlay that renders all visible triage targets.
 * Positioned absolutely to cover the inbox area.
 */
export const TriageOverlay = React.memo(function TriageOverlay() {
  const { isSubscription } = useTriageContext();

  // Track which targets to show (reacts to subscription changes)
  const [visibleTargets, setVisibleTargets] = React.useState<readonly TriageTarget[]>(() =>
    TRIAGE_TARGETS.filter((t) => isTargetVisible(t, false))
  );

  // Update visible targets when subscription status changes
  useAnimatedReaction(
    () => isSubscription.value,
    (isSub) => {
      const targets = [];
      for (let i = 0; i < TRIAGE_TARGETS.length; i++) {
        if (isTargetVisible(TRIAGE_TARGETS[i], isSub)) {
          targets.push(TRIAGE_TARGETS[i]);
        }
      }
      runOnJS(setVisibleTargets)(targets);
    }
  );

  return (
    <View style={styles.overlay} pointerEvents="none">
      {visibleTargets.map((target) => (
        <TriageTargetView key={target.id} target={target} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
});
