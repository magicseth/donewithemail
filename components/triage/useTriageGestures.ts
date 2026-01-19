import { useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { Gesture, GestureType, MouseButton } from "react-native-gesture-handler";

import { useTriageContext } from "./TriageProvider";

/**
 * Hook that creates a pan gesture for dragging the triage ball.
 *
 * Usage:
 * ```tsx
 * const panGesture = useTriagePanGesture();
 *
 * return (
 *   <GestureDetector gesture={panGesture}>
 *     <View>...</View>
 *   </GestureDetector>
 * );
 * ```
 */
export function useTriagePanGesture(): GestureType {
  const { fingerX, startX, phase, centerX } = useTriageContext();

  const panGesture = Gesture.Pan()
    .onStart((e) => {
      "worklet";
      if (phase.value !== "idle") return;

      startX.value = e.absoluteX;
      fingerX.value = e.absoluteX;
      phase.value = "dragging";
    })
    .onUpdate((e) => {
      "worklet";
      if (phase.value !== "dragging") return;

      fingerX.value = e.absoluteX;
    })
    .onEnd(() => {
      "worklet";
      if (phase.value === "dragging") {
        // Didn't trigger - return to idle
        phase.value = "idle";
      }
    })
    .onFinalize(() => {
      "worklet";
      if (phase.value === "dragging") {
        phase.value = "idle";
      }
    });

  // Web-specific: enable mouse drag
  if (Platform.OS === "web") {
    panGesture
      .mouseButton(MouseButton.LEFT)
      .enableTrackpadTwoFingerGesture(true);
  }

  // Require horizontal movement to activate
  panGesture.activeOffsetX([-15, 15]);
  panGesture.failOffsetY([-15, 15]);

  return panGesture;
}

/**
 * Hook to set up web pointer events for full-frequency tracking.
 * Call this at the screen level.
 *
 * Usage:
 * ```tsx
 * useTriageWebPointerEvents(containerRef);
 * ```
 */
export function useTriageWebPointerEvents(
  containerRef: React.RefObject<HTMLElement | null>
) {
  const { fingerX, startX, phase } = useTriageContext();

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const container = containerRef.current;
    if (!container) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (phase.value !== "idle") return;

      startX.value = e.clientX;
      fingerX.value = e.clientX;
      phase.value = "dragging";
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.buttons === 0) return; // Not pressed
      if (phase.value !== "dragging") return;

      fingerX.value = e.clientX;
    };

    const handlePointerUp = () => {
      if (phase.value === "dragging") {
        phase.value = "idle";
      }
    };

    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerup", handlePointerUp);
    container.addEventListener("pointercancel", handlePointerUp);

    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerUp);
      container.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [containerRef, fingerX, startX, phase]);
}
