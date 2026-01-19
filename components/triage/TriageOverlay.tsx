import * as React from "react";
import { View, StyleSheet } from "react-native";

import { TRIAGE_TARGETS } from "./triageTargets";
import { TriageTargetView } from "./TriageTargetView";

/**
 * Overlay that renders all triage targets.
 * Positioned absolutely to cover the inbox area.
 * Each TriageTargetView handles its own visibility based on email context.
 */
export const TriageOverlay = React.memo(function TriageOverlay() {
  return (
    <View style={styles.overlay} pointerEvents="none">
      {TRIAGE_TARGETS.map((target) => (
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
