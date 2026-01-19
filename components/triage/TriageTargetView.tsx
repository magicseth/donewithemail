import * as React from "react";
import { Text, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

import { TRIAGE_CONFIG } from "./triageConfig";
import { useTriageContext } from "./TriageProvider";
import { isTargetVisibleForEmail } from "./triageTargets";
import type { TriageTarget } from "./triageTypes";

interface TriageTargetViewProps {
  target: TriageTarget;
}

/**
 * Renders a single triage target button.
 * Position, visibility, scale and color are all dynamic based on email context.
 */
export const TriageTargetView = React.memo(function TriageTargetView({
  target,
}: TriageTargetViewProps) {
  const {
    proximities,
    activeTarget,
    effectivePositions,
    centerX,
    isSubscription,
    hasCalendarEvent,
    shouldAcceptCalendar,
  } = useTriageContext();

  // Position style with dynamic X position and visibility
  const positionStyle = useAnimatedStyle(() => {
    const effectivePos = effectivePositions.value[target.id] ?? target.position;
    const isVisible = isTargetVisibleForEmail(
      target,
      isSubscription.value,
      hasCalendarEvent.value,
      shouldAcceptCalendar.value
    );

    return {
      left: centerX + effectivePos,
      top: TRIAGE_CONFIG.targetTopOffset,
      opacity: isVisible ? 1 : 0,
      // Also hide from layout when not visible
      pointerEvents: isVisible ? "auto" : "none",
    };
  });

  // Scale based on proximity
  const scaleStyle = useAnimatedStyle(() => {
    const proximity = proximities.value[target.id] ?? 0;
    const scale = 1 + proximity * 0.4;
    return {
      transform: [{ scale: withSpring(scale) }],
    };
  });

  // Background color based on activation
  const bgStyle = useAnimatedStyle(() => {
    const proximity = proximities.value[target.id] ?? 0;
    const isActive = activeTarget.value === target.id;

    if (isActive) {
      return { backgroundColor: target.color };
    }

    // Compute opacity (30% base + up to 70% based on proximity)
    const opacity = Math.round(30 + proximity * 70) / 100;
    const r = parseInt(target.color.slice(1, 3), 16);
    const g = parseInt(target.color.slice(3, 5), 16);
    const b = parseInt(target.color.slice(5, 7), 16);

    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})`,
    };
  });

  return (
    <Animated.View style={[styles.container, positionStyle]}>
      <Animated.View style={scaleStyle}>
        <Animated.View style={[styles.button, bgStyle]}>
          <Text style={styles.icon}>{target.icon}</Text>
          <Text style={styles.label}>{target.label}</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    transform: [{ translateX: -40 }], // Center the button
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  icon: {
    fontSize: 14,
    color: "#fff",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
});
