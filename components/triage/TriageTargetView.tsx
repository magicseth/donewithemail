import * as React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";

import { TRIAGE_CONFIG } from "./triageConfig";
import { useTriageContext } from "./TriageProvider";
import type { TriageTarget } from "./triageTypes";

interface TriageTargetViewProps {
  target: TriageTarget;
}

/**
 * Renders a single triage target button.
 * Scales and changes color based on ball proximity.
 */
export const TriageTargetView = React.memo(function TriageTargetView({
  target,
}: TriageTargetViewProps) {
  const { proximities, activeTarget, centerX } = useTriageContext();
  const targetX = centerX + target.position;

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
    <View style={[styles.container, { left: targetX, top: TRIAGE_CONFIG.targetTopOffset }]}>
      <Animated.View style={scaleStyle}>
        <Animated.View style={[styles.button, bgStyle]}>
          <Text style={styles.icon}>{target.icon}</Text>
          <Text style={styles.label}>{target.label}</Text>
        </Animated.View>
      </Animated.View>
    </View>
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
