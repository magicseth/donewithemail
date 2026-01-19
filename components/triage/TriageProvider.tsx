import * as React from "react";
import { createContext, useContext, useCallback, useRef, useEffect, useImperativeHandle } from "react";
import { useWindowDimensions } from "react-native";
import {
  useSharedValue,
  useDerivedValue,
  useAnimatedReaction,
  runOnJS,
  SharedValue,
} from "react-native-reanimated";

import { TRIAGE_CONFIG } from "./triageConfig";
import { TRIAGE_TARGETS } from "./triageTargets";
import { calculateBallScreenY, computeHitTest } from "./useTriageDetection";
import type {
  TriagePhase,
  TriageTargetId,
  TriageableEmail,
  TriageHandler,
} from "./triageTypes";

// =============================================================================
// Context Type
// =============================================================================

interface TriageContextValue {
  // Shared values for worklets
  readonly fingerX: SharedValue<number>;
  readonly startX: SharedValue<number>;
  readonly scrollY: SharedValue<number>;
  readonly phase: SharedValue<TriagePhase>;
  readonly activeIndex: SharedValue<number>;
  readonly isSubscription: SharedValue<boolean>;

  // Derived values
  readonly ballX: SharedValue<number>;
  readonly ballY: SharedValue<number>;
  readonly activeTarget: SharedValue<TriageTargetId | null>;
  readonly proximities: SharedValue<Record<string, number>>;
  readonly closestTarget: SharedValue<{ id: TriageTargetId; proximity: number } | null>;

  // Screen dimensions
  readonly centerX: number;
  readonly screenWidth: number;

  // Actions (called from JS)
  readonly setScrollY: (y: number) => void;
  readonly setActiveIndex: (index: number) => void;
  readonly resetBall: () => void;
}

const TriageContext = createContext<TriageContextValue | null>(null);

/**
 * Access triage context. Must be within TriageProvider.
 */
export function useTriageContext(): TriageContextValue {
  const ctx = useContext(TriageContext);
  if (!ctx) {
    throw new Error("useTriageContext must be used within TriageProvider");
  }
  return ctx;
}

// =============================================================================
// Provider
// =============================================================================

/**
 * Methods exposed via triageRef for external control
 */
export interface TriageControlRef {
  /** Reset triage state to initial values */
  reset: () => void;
  /** Get the current active index */
  getActiveIndex: () => number;
}

interface TriageProviderProps {
  children: React.ReactNode;
  emails: readonly TriageableEmail[];
  onTriage: TriageHandler;
  /** Optional ref to access control methods from parent */
  triageRef?: React.Ref<TriageControlRef>;
}

/**
 * Module-level reference to emails array.
 * This avoids closure capture issues in worklets.
 */
let moduleEmails: readonly TriageableEmail[] = [];

export function TriageProvider({
  children,
  emails,
  onTriage,
  triageRef,
}: TriageProviderProps) {
  const { width: screenWidth } = useWindowDimensions();
  const centerX = screenWidth / 2;

  // Keep module-level emails in sync
  useEffect(() => {
    moduleEmails = emails;
  }, [emails]);

  // === Primary State ===
  const fingerX = useSharedValue(centerX);
  const startX = useSharedValue(centerX);
  const scrollY = useSharedValue(0);

  // === State Machine ===
  const phase = useSharedValue<TriagePhase>("idle");

  // === Active Index ===
  // Set externally via onViewableItemsChanged from FlatList
  // This handles varying row heights correctly
  const activeIndex = useSharedValue(0);

  // === Subscription status (shared value for worklet access) ===
  const isSubscription = useSharedValue(false);

  // Update isSubscription when activeIndex or emails change
  useAnimatedReaction(
    () => activeIndex.value,
    (idx) => {
      // Access module-level emails
      const email = moduleEmails[idx];
      isSubscription.value = email?.isSubscription ?? false;
    }
  );

  // Also update when emails array changes
  useEffect(() => {
    const email = emails[activeIndex.value];
    isSubscription.value = email?.isSubscription ?? false;
  }, [emails, activeIndex, isSubscription]);

  // === Derived: Ball Position ===
  const { ballTravelMultiplier } = TRIAGE_CONFIG;

  const ballX = useDerivedValue(() => {
    const delta = fingerX.value - startX.value;
    const newX = centerX + delta * ballTravelMultiplier;
    return Math.max(20, Math.min(screenWidth - 20, newX));
  });

  const ballY = useDerivedValue(() => {
    return calculateBallScreenY(scrollY.value, activeIndex.value);
  });

  // === Derived: Hit Detection ===
  const hitResult = useDerivedValue(() => {
    return computeHitTest(
      ballX.value,
      ballY.value,
      centerX,
      isSubscription.value
    );
  });

  const activeTarget = useDerivedValue(() => hitResult.value.hit);
  const proximities = useDerivedValue(() => hitResult.value.proximities);
  const closestTarget = useDerivedValue(() => hitResult.value.closestTarget);

  // === Handler ref (avoids stale closure) ===
  const onTriageRef = useRef(onTriage);
  onTriageRef.current = onTriage;

  const handleTrigger = useCallback((targetId: TriageTargetId, index: number) => {
    const email = moduleEmails[index];
    if (!email) {
      phase.value = "idle";
      return;
    }

    // Call handler - it returns false to prevent advancing (used for mic)
    Promise.resolve(onTriageRef.current(email, targetId, index))
      .then((_shouldAdvance) => {
        // Reset ball to center after action
        // activeIndex is derived from scroll - it will update when user scrolls to next email
        startX.value = fingerX.value;
      })
      .catch((err) => {
        console.error("[Triage] Handler error:", err);
      })
      .finally(() => {
        phase.value = "idle";
      });
  }, [phase, startX, fingerX]);

  // === Watch for target activation ===
  useAnimatedReaction(
    () => ({
      currentPhase: phase.value,
      target: activeTarget.value,
      idx: activeIndex.value,
    }),
    (current, prev) => {
      // Only trigger when entering a target while dragging
      if (
        current.currentPhase === "dragging" &&
        current.target !== null &&
        (prev === null || prev.target !== current.target)
      ) {
        phase.value = "processing";
        runOnJS(handleTrigger)(current.target, current.idx);
      }
    }
  );

  // Note: scroll-back navigation is no longer needed since activeIndex
  // is derived from scrollY - it automatically updates as user scrolls

  // === Actions ===
  const setScrollY = useCallback((y: number) => {
    scrollY.value = y;
  }, [scrollY]);

  const setActiveIndex = useCallback((index: number) => {
    activeIndex.value = index;
  }, [activeIndex]);

  const resetBall = useCallback(() => {
    fingerX.value = centerX;
    startX.value = centerX;
  }, [fingerX, startX, centerX]);

  // === Expose control methods via ref ===
  useImperativeHandle(triageRef, () => ({
    reset: () => {
      activeIndex.value = 0;
      phase.value = "idle";
      fingerX.value = centerX;
      startX.value = centerX;
      scrollY.value = 0;
    },
    getActiveIndex: () => activeIndex.value,
  }), [activeIndex, phase, fingerX, startX, scrollY, centerX]);

  // === Context Value ===
  const value: TriageContextValue = {
    fingerX,
    startX,
    scrollY,
    phase,
    activeIndex,
    isSubscription,
    ballX,
    ballY,
    activeTarget,
    proximities,
    closestTarget,
    centerX,
    screenWidth,
    setScrollY,
    setActiveIndex,
    resetBall,
  };

  return (
    <TriageContext.Provider value={value}>
      {children}
    </TriageContext.Provider>
  );
}
