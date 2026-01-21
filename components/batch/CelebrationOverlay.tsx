/**
 * CelebrationOverlay - Shows a celebratory animation when emails are triaged.
 * Displays confetti-like particles, animated background waves, and a success message.
 */
import React, { useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
  withRepeat,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Confetti particle colors
const COLORS = ["#10B981", "#6366F1", "#F59E0B", "#EC4899", "#3B82F6"];

// Animated background wave ripple
interface BackgroundWaveProps {
  delay: number;
  size: number;
}

function BackgroundWave({ delay, size }: BackgroundWaveProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withTiming(size, { duration: 1200, easing: Easing.out(Easing.cubic) })
    );
    opacity.value = withDelay(
      delay,
      withTiming(0, { duration: 1200, easing: Easing.out(Easing.quad) })
    );
  }, [delay, size, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.wave, animatedStyle]} />;
}

// Animated gradient background that pulses
function AnimatedBackground() {
  const pulseValue = useSharedValue(0);

  useEffect(() => {
    pulseValue.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 800, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, [pulseValue]);

  const animatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolate(
      pulseValue.value,
      [0, 1],
      [0.85, 0.95],
      Extrapolation.CLAMP
    );

    return {
      opacity: backgroundColor,
    };
  });

  return <Animated.View style={[styles.backgroundGradient, animatedStyle]} />;
}

// Individual confetti particle
interface ParticleProps {
  delay: number;
  startX: number;
  color: string;
}

function Particle({ delay, startX, color }: ParticleProps) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(startX);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0);

  useEffect(() => {
    // Animate particle falling with more dynamic movement
    const randomBounce = Math.random() * 0.3 + 0.7;
    scale.value = withDelay(delay, withSpring(1, { damping: 8 }));
    translateY.value = withDelay(
      delay,
      withSequence(
        withTiming(SCREEN_HEIGHT * 0.3 * randomBounce, { duration: 1000, easing: Easing.out(Easing.quad) }),
        withSpring(SCREEN_HEIGHT * 0.4, { damping: 10 })
      )
    );
    translateX.value = withDelay(
      delay,
      withTiming(startX + (Math.random() - 0.5) * 150, { duration: 1500, easing: Easing.inOut(Easing.quad) })
    );
    rotate.value = withDelay(
      delay,
      withTiming(Math.random() * 1080 - 540, { duration: 1500 })
    );
    opacity.value = withDelay(delay + 800, withTiming(0, { duration: 700 }));
  }, [delay, startX, translateY, translateX, rotate, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.particle, { backgroundColor: color }, animatedStyle]} />
  );
}

interface CelebrationOverlayProps {
  count: number;
  visible: boolean;
  onComplete: () => void;
}

export function CelebrationOverlay({ count, visible, onComplete }: CelebrationOverlayProps) {
  const checkmarkScale = useSharedValue(0);
  const checkmarkOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);

  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (visible) {
      // Animate overlay and checkmark
      overlayOpacity.value = withTiming(1, { duration: 200 });
      checkmarkScale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 200 }),
        withSpring(1, { damping: 12 })
      );
      checkmarkOpacity.value = withTiming(1, { duration: 200 });
      textOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));

      // Fade out after delay
      overlayOpacity.value = withDelay(1800, withTiming(0, { duration: 400 }));
      checkmarkOpacity.value = withDelay(1800, withTiming(0, { duration: 400 }));
      textOpacity.value = withDelay(1600, withTiming(0, { duration: 400 }, () => {
        runOnJS(handleComplete)();
      }));
    } else {
      overlayOpacity.value = 0;
      checkmarkScale.value = 0;
      checkmarkOpacity.value = 0;
      textOpacity.value = 0;
    }
  }, [visible, overlayOpacity, checkmarkScale, checkmarkOpacity, textOpacity, handleComplete]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const checkmarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkmarkScale.value }],
    opacity: checkmarkOpacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  if (!visible) return null;

  // Generate confetti particles
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    delay: Math.random() * 400,
    startX: (SCREEN_WIDTH / 30) * i - SCREEN_WIDTH * 0.05,
    color: COLORS[i % COLORS.length],
  }));

  // Generate background waves
  const waves = Array.from({ length: 3 }, (_, i) => ({
    id: i,
    delay: i * 200,
    size: 2 + i * 0.5,
  }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="none">
      {/* Animated gradient background */}
      <AnimatedBackground />

      {/* Background waves */}
      <View style={styles.wavesContainer}>
        {waves.map((w) => (
          <BackgroundWave key={w.id} delay={w.delay} size={w.size} />
        ))}
      </View>

      {/* Confetti particles */}
      <View style={styles.particlesContainer}>
        {particles.map((p) => (
          <Particle key={p.id} delay={p.delay} startX={p.startX} color={p.color} />
        ))}
      </View>

      {/* Checkmark and text */}
      <View style={styles.centerContent}>
        <Animated.View style={[styles.checkmarkCircle, checkmarkStyle]}>
          <Text style={styles.checkmark}>✓</Text>
        </Animated.View>
        <Animated.Text style={[styles.celebrationText, textStyle]}>
          {count} email{count !== 1 ? "s" : ""} done!
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    zIndex: 1000,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  wavesContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  wave: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: "#10B981",
    backgroundColor: "transparent",
  },
  particlesContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  particle: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 2,
    top: 0,
  },
  centerContent: {
    alignItems: "center",
    zIndex: 10,
  },
  checkmarkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  checkmark: {
    fontSize: 40,
    color: "#fff",
    fontWeight: "700",
  },
  celebrationText: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: "700",
    color: "#10B981",
  },
});
