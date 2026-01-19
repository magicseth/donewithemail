import * as React from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { TRIAGE_CONFIG } from "./triageConfig";
import { TRIAGE_TARGETS } from "./triageTargets";
import { useTriageContext } from "./TriageProvider";
import type { TriageTargetId } from "./triageTypes";

interface TriageBallProps {
  /** Index of the row this ball belongs to */
  rowIndex: number;
}

/**
 * Get target color by ID. Works in worklets.
 */
function getTargetColor(id: TriageTargetId): string {
  "worklet";
  for (let i = 0; i < TRIAGE_TARGETS.length; i++) {
    if (TRIAGE_TARGETS[i].id === id) {
      return TRIAGE_TARGETS[i].color;
    }
  }
  return "#9CA3AF";
}

/**
 * The draggable triage ball rendered in each email row.
 * Only the ball in the active row moves with gestures.
 */
export const TriageBall = React.memo(function TriageBall({
  rowIndex,
}: TriageBallProps) {
  const { activeIndex, ballX, closestTarget, centerX } = useTriageContext();
  const { ballSize, halfBall } = TRIAGE_CONFIG;

  // Position style - only active row's ball moves
  const positionStyle = useAnimatedStyle(() => {
    const isActive = activeIndex.value === rowIndex;
    const x = isActive ? ballX.value : centerX;
    return {
      transform: [{ translateX: x - halfBall }],
    };
  });

  // Color style - changes based on proximity to targets
  const colorStyle = useAnimatedStyle(() => {
    const isActive = activeIndex.value === rowIndex;

    if (!isActive) {
      return { backgroundColor: "#D1D5DB" }; // Grey for inactive
    }

    const closest = closestTarget.value;
    if (closest && closest.proximity > 0.5) {
      return { backgroundColor: getTargetColor(closest.id) };
    }
    return { backgroundColor: "#9CA3AF" }; // Neutral grey
  });

  // Scale style - larger when near target
  const scaleStyle = useAnimatedStyle(() => {
    const isActive = activeIndex.value === rowIndex;
    if (!isActive) {
      return { transform: [{ scale: 0.8 }] };
    }

    const closest = closestTarget.value;
    const isNear = closest !== null && closest.proximity > 0.5;
    return { transform: [{ scale: isNear ? 1.2 : 1 }] };
  });

  return (
    <Animated.View style={[styles.container, positionStyle]}>
      <Animated.View style={[styles.ball, scaleStyle]}>
        <Animated.View style={[styles.inner, colorStyle]} />
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: TRIAGE_CONFIG.ballTopInRow,
    left: 0,
    zIndex: 100,
  },
  ball: {
    width: TRIAGE_CONFIG.ballSize,
    height: TRIAGE_CONFIG.ballSize,
    borderRadius: TRIAGE_CONFIG.ballSize / 2,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  inner: {
    width: TRIAGE_CONFIG.ballSize - 8,
    height: TRIAGE_CONFIG.ballSize - 8,
    borderRadius: (TRIAGE_CONFIG.ballSize - 8) / 2,
  },
});
