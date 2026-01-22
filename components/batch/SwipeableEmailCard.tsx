import React, { useCallback, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { BatchEmailPreview } from "../../hooks/useBatchTriage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.4; // 40% of screen width to trigger action
const ROTATE_THRESHOLD = SCREEN_WIDTH * 0.3;

interface SwipeableEmailCardProps {
  email: BatchEmailPreview;
  children: React.ReactNode;
  onSwipeLeft: () => void; // Mark as done
  onSwipeRight: () => void; // Reply
  onPress?: () => void;
}

export const SwipeableEmailCard = memo(function SwipeableEmailCard({
  email,
  children,
  onSwipeLeft,
  onSwipeRight,
  onPress,
}: SwipeableEmailCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const handleSwipeComplete = useCallback((direction: "left" | "right") => {
    if (direction === "left") {
      onSwipeLeft();
    } else {
      onSwipeRight();
    }
  }, [onSwipeLeft, onSwipeRight]);

  // Pan gesture for swiping
  let panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15]) // Activation threshold
    .failOffsetY([-15, 15]); // Cancel if vertical movement

  if (Platform.OS === "web") {
    panGesture = panGesture
      .mouseButton(1) // Enable left-click drag on web
      .enableTrackpadTwoFingerGesture(true); // Trackpad support
  }

  panGesture = panGesture
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.2; // Slight vertical movement for effect
    })
    .onEnd((event) => {
      isDragging.value = false;

      // Check if swipe threshold was met
      if (Math.abs(translateX.value) > SWIPE_THRESHOLD) {
        // Animate off screen
        const direction = translateX.value < 0 ? "left" : "right";
        const targetX = translateX.value < 0 ? -SCREEN_WIDTH * 1.5 : SCREEN_WIDTH * 1.5;

        translateX.value = withSpring(targetX, {
          velocity: event.velocityX,
          damping: 20,
          stiffness: 90,
        }, () => {
          runOnJS(handleSwipeComplete)(direction);
        });
        translateY.value = withSpring(50, {
          damping: 20,
          stiffness: 90,
        });
      } else {
        // Return to center
        translateX.value = withSpring(0, {
          damping: 20,
          stiffness: 150,
        });
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 150,
        });
      }
    });

  // Animated styles for the card
  const animatedCardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-ROTATE_THRESHOLD, 0, ROTATE_THRESHOLD],
      [-10, 0, 10],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [1, 0.8],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
      opacity,
    };
  });

  // Animated style for left action indicator (mark as done - green)
  const leftActionStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, -50, 0],
      [1, 0.7, 0],
      Extrapolate.CLAMP
    );

    const scale = interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, -50, 0],
      [1.2, 0.9, 0.5],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  // Animated style for right action indicator (reply - blue)
  const rightActionStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [0, 50, SWIPE_THRESHOLD],
      [0, 0.7, 1],
      Extrapolate.CLAMP
    );

    const scale = interpolate(
      translateX.value,
      [0, 50, SWIPE_THRESHOLD],
      [0.5, 0.9, 1.2],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <View style={styles.container}>
      {/* Left action background (mark as done) */}
      <Animated.View style={[styles.actionBackground, styles.leftAction, leftActionStyle]}>
        <View style={styles.actionContent}>
          <Text style={styles.actionIcon}>✓</Text>
          <Text style={styles.actionText}>Done</Text>
        </View>
      </Animated.View>

      {/* Right action background (reply) */}
      <Animated.View style={[styles.actionBackground, styles.rightAction, rightActionStyle]}>
        <View style={styles.actionContent}>
          <Text style={styles.actionIcon}>↩</Text>
          <Text style={styles.actionText}>Reply</Text>
        </View>
      </Animated.View>

      {/* Swipeable card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.card, animatedCardStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "relative",
    marginVertical: 8,
    marginHorizontal: 16,
    height: 200, // Fixed height for TikTok-style cards
  },
  actionBackground: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "50%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
  },
  leftAction: {
    left: 0,
    backgroundColor: "#10B981", // Green for done
  },
  rightAction: {
    right: 0,
    backgroundColor: "#6366F1", // Blue for reply
  },
  actionContent: {
    alignItems: "center",
  },
  actionIcon: {
    fontSize: 48,
    color: "#fff",
    marginBottom: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  card: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: "hidden",
  },
});
