import * as React from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { TRIAGE_TARGETS } from "./triageTargets";
import { useTriageContext } from "./TriageProvider";
import { TriageBall } from "./TriageBall";
import type { TriageTargetId } from "./triageTypes";

interface TriageRowWrapperProps {
  index: number;
  children: React.ReactNode;
}

/**
 * Get target colors by ID. Works in worklets.
 */
function getTargetColors(id: TriageTargetId): { color: string; bgColor: string } {
  "worklet";
  for (let i = 0; i < TRIAGE_TARGETS.length; i++) {
    if (TRIAGE_TARGETS[i].id === id) {
      return {
        color: TRIAGE_TARGETS[i].color,
        bgColor: TRIAGE_TARGETS[i].bgColor,
      };
    }
  }
  return { color: "#9CA3AF", bgColor: "#F3F4F6" };
}

/**
 * Wraps an email row with:
 * - The triage ball
 * - Background highlighting based on triage state
 */
export const TriageRowWrapper = React.memo(function TriageRowWrapper({
  index,
  children,
}: TriageRowWrapperProps) {
  const { activeIndex, activeTarget } = useTriageContext();

  const rowStyle = useAnimatedStyle(() => {
    const isTopRow = activeIndex.value === index;
    const isNextRow = activeIndex.value === index - 1;

    if (isTopRow) {
      const targetId = activeTarget.value;

      if (targetId !== null) {
        // Ball is at a target - use target colors
        const { color, bgColor } = getTargetColors(targetId);
        return {
          backgroundColor: bgColor,
          borderLeftWidth: 4,
          borderLeftColor: color,
        };
      }

      // Active row but not at target - pending grey
      return {
        backgroundColor: "#F3F4F6",
        borderLeftWidth: 4,
        borderLeftColor: "#9CA3AF",
      };
    }

    if (isNextRow) {
      // Next row - subtle grey
      return {
        backgroundColor: "#F9FAFB",
        borderLeftWidth: 4,
        borderLeftColor: "#E5E7EB",
      };
    }

    // Default - white
    return {
      backgroundColor: "#FFFFFF",
      borderLeftWidth: 0,
      borderLeftColor: "transparent",
    };
  });

  return (
    <Animated.View style={[styles.row, rowStyle]}>
      <TriageBall rowIndex={index} />
      {children}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    position: "relative",
  },
});
