import React, { useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  Platform,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  MouseButton,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = Math.min(SCREEN_WIDTH * 0.25, 150); // Max 150px for large screens
const VELOCITY_THRESHOLD = 500; // Pixels per second

export type SwipeDirection = "left" | "right" | "up" | "down";

export interface SwipeStackProps<T> {
  data: T[];
  renderCard: (item: T, index: number) => React.ReactNode;
  onSwipe: (item: T, direction: SwipeDirection) => void;
  onSwipeStart?: (item: T, direction: SwipeDirection) => void;
  keyExtractor: (item: T) => string;
  emptyComponent?: React.ReactNode;
}

export function SwipeStack<T>({
  data,
  renderCard,
  onSwipe,
  onSwipeStart,
  keyExtractor,
  emptyComponent,
}: SwipeStackProps<T>) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardRotate = useSharedValue(0);
  const isSwipingRef = useRef(false);

  const handleSwipeComplete = useCallback(
    (direction: SwipeDirection) => {
      if (data.length > 0 && !isSwipingRef.current) {
        isSwipingRef.current = true;
        onSwipe(data[0], direction);
        // Reset after animation completes (animation is 200ms, wait a bit longer)
        setTimeout(() => {
          isSwipingRef.current = false;
          translateX.value = 0;
          translateY.value = 0;
          cardRotate.value = 0;
        }, 300);
      }
    },
    [data, onSwipe, translateX, translateY, cardRotate]
  );

  const panGesture = Gesture.Pan()
    .enableTrackpadTwoFingerGesture(true)
    .mouseButton(MouseButton.LEFT)
    .minDistance(10)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      cardRotate.value = interpolate(
        event.translationX,
        [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        [-15, 0, 15],
        Extrapolation.CLAMP
      );
    })
    .onEnd((event) => {
      // Use both distance and velocity to detect swipes
      const swipedRight =
        event.translationX > SWIPE_THRESHOLD ||
        (event.translationX > 50 && event.velocityX > VELOCITY_THRESHOLD);
      const swipedLeft =
        event.translationX < -SWIPE_THRESHOLD ||
        (event.translationX < -50 && event.velocityX < -VELOCITY_THRESHOLD);
      const swipedUp =
        event.translationY < -SWIPE_THRESHOLD ||
        (event.translationY < -50 && event.velocityY < -VELOCITY_THRESHOLD);

      if (swipedRight) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 200 });
        runOnJS(handleSwipeComplete)("right");
      } else if (swipedLeft) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 200 });
        runOnJS(handleSwipeComplete)("left");
      } else if (swipedUp) {
        translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 200 });
        runOnJS(handleSwipeComplete)("up");
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        cardRotate.value = withSpring(0);
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${cardRotate.value}deg` },
    ],
  }));

  const leftIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  const rightIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        {emptyComponent || (
          <Text style={styles.emptyText}>No more emails to triage!</Text>
        )}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.cardsContainer}>
        {/* Background cards */}
        {data.slice(1, 3).map((item, index) => (
          <View
            key={keyExtractor(item)}
            style={[
              styles.card,
              styles.backgroundCard,
              {
                transform: [
                  { scale: 1 - (index + 1) * 0.05 },
                  { translateY: (index + 1) * 10 },
                ],
                zIndex: -index - 1,
              },
            ]}
          >
            {renderCard(item, index + 1)}
          </View>
        ))}

        {/* Top card (swipeable) */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.card, animatedCardStyle]}>
            {/* Swipe indicators */}
            <Animated.View style={[styles.indicator, styles.leftIndicator, leftIndicatorStyle]}>
              <Text style={styles.indicatorText}>NEEDS REPLY</Text>
            </Animated.View>
            <Animated.View style={[styles.indicator, styles.rightIndicator, rightIndicatorStyle]}>
              <Text style={styles.indicatorText}>DONE</Text>
            </Animated.View>

            {renderCard(data[0], 0)}
          </Animated.View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardsContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    position: "absolute",
    width: SCREEN_WIDTH - 40,
    height: SCREEN_HEIGHT * 0.7,
    borderRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: "hidden",
    // Web-specific: enable drag and prevent text selection
    ...(Platform.OS === "web" && {
      cursor: "grab",
      userSelect: "none",
    }),
  } as any,
  backgroundCard: {
    opacity: 0.8,
  },
  indicator: {
    position: "absolute",
    top: 40,
    padding: 10,
    borderWidth: 3,
    borderRadius: 10,
    zIndex: 100,
  },
  leftIndicator: {
    left: 20,
    borderColor: "#FF6B6B",
  },
  rightIndicator: {
    right: 20,
    borderColor: "#4ECDC4",
  },
  indicatorText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
  },
});
