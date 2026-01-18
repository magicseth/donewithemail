import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import {
  Gesture,
  PanGesture,
  MouseButton,
} from "react-native-gesture-handler";

import { ACTIVATION_THRESHOLD } from "../components/PullToRevealHeader";

// Spring config for smooth animations
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.5,
};

interface UsePullToReplyGestureOptions {
  onStartRecording: () => void;
  onStopRecording: () => Promise<string>;
  onRecordingComplete: (transcript: string) => void;
  enabled?: boolean;
}

interface UsePullToReplyGestureResult {
  pullDistance: ReturnType<typeof useSharedValue<number>>;
  isPulling: boolean;
  scrollEnabled: boolean;
  panGesture: PanGesture;
  resetPull: () => void;
}

export function usePullToReplyGesture({
  onStartRecording,
  onStopRecording,
  onRecordingComplete,
  enabled = true,
}: UsePullToReplyGestureOptions): UsePullToReplyGestureResult {
  const pullDistance = useSharedValue(0);

  // Use React state for scroll control so component can read it properly
  const [isPulling, setIsPulling] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  // Track if we've crossed the recording threshold during this gesture
  const hasActivatedRecording = useRef(false);

  // Callbacks wrapped for runOnJS
  const startRecordingJS = useCallback(() => {
    if (!hasActivatedRecording.current) {
      hasActivatedRecording.current = true;
      onStartRecording();
    }
  }, [onStartRecording]);

  const stopRecordingJS = useCallback(async () => {
    if (hasActivatedRecording.current) {
      hasActivatedRecording.current = false;
      const transcript = await onStopRecording();
      onRecordingComplete(transcript);
    }
  }, [onStopRecording, onRecordingComplete]);

  // Gesture state callbacks
  const onGestureStart = useCallback(() => {
    setIsPulling(true);
    setScrollEnabled(false);
  }, []);

  const onGestureEnd = useCallback(() => {
    setIsPulling(false);
    setScrollEnabled(true);
  }, []);

  const resetPull = useCallback(() => {
    pullDistance.value = withSpring(0, SPRING_CONFIG);
    setIsPulling(false);
    setScrollEnabled(true);
    hasActivatedRecording.current = false;
  }, [pullDistance]);

  // Build pan gesture with platform-specific configuration
  let panGesture = Gesture.Pan()
    // Only activate on pull-down (positive Y translation)
    // The [10, 1000] means: activate after 10px down, but up to 1000px
    .activeOffsetY([10, 1000])
    // Fail on horizontal movement to allow horizontal scrolling/swiping
    .failOffsetX([-20, 20])
    // Enable when the feature is enabled
    .enabled(enabled)
    .onStart(() => {
      "worklet";
      runOnJS(onGestureStart)();
    })
    .onUpdate((event) => {
      "worklet";
      // Only track positive (downward) translation
      if (event.translationY > 0) {
        pullDistance.value = event.translationY;

        // Check if we've crossed the recording threshold
        if (event.translationY >= ACTIVATION_THRESHOLD && !hasActivatedRecording.current) {
          runOnJS(startRecordingJS)();
        }
      }
    })
    .onEnd(() => {
      "worklet";
      // Stop recording if it was started
      if (hasActivatedRecording.current) {
        runOnJS(stopRecordingJS)();
      }

      // Animate back to 0
      pullDistance.value = withSpring(0, SPRING_CONFIG);
      runOnJS(onGestureEnd)();
    })
    .onFinalize(() => {
      "worklet";
      // Ensure clean state on finalize (handles interrupted gestures)
      runOnJS(onGestureEnd)();
    });

  // Web-specific configuration
  if (Platform.OS === "web") {
    panGesture = panGesture
      .mouseButton(MouseButton.LEFT)
      .enableTrackpadTwoFingerGesture(true);
  }

  return {
    pullDistance,
    isPulling,
    scrollEnabled,
    panGesture,
    resetPull,
  };
}
