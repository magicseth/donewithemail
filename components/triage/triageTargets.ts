import type { TriageTarget, TriageTargetId } from "./triageTypes";

/**
 * All triage targets.
 * Positions are X offset from screen center (negative = left).
 *
 * IMPORTANT: This array is used in worklets. Keep it simple and immutable.
 */
export const TRIAGE_TARGETS: readonly TriageTarget[] = [
  {
    id: "unsubscribe",
    position: -100,
    color: "#F59E0B",
    bgColor: "#FFFBEB",
    icon: "🚫",
    label: "Unsub",
    subscriptionOnly: true,
  },
  {
    id: "done",
    position: -20,
    color: "#10B981",
    bgColor: "#ECFDF5",
    icon: "✓",
    label: "Done",
  },
  {
    id: "reply",
    position: 80,
    color: "#6366F1",
    bgColor: "#EEF2FF",
    icon: "↩",
    label: "Reply",
  },
  {
    id: "mic",
    position: 160,
    color: "#EF4444",
    bgColor: "#FEF2F2",
    icon: "🎤",
    label: "Mic",
  },
] as const;

/**
 * Targets that are always visible (not subscription-only).
 * Use this for hit detection to avoid closure capture issues.
 */
export const ALWAYS_VISIBLE_TARGETS: readonly TriageTarget[] = TRIAGE_TARGETS.filter(
  (t) => !t.subscriptionOnly
);

/**
 * Find target by ID. Works in worklets.
 */
export function getTargetById(id: TriageTargetId): TriageTarget | undefined {
  "worklet";
  // Manual loop for worklet compatibility
  for (let i = 0; i < TRIAGE_TARGETS.length; i++) {
    if (TRIAGE_TARGETS[i].id === id) {
      return TRIAGE_TARGETS[i];
    }
  }
  return undefined;
}

/**
 * Check if a target should be visible for the given email.
 * Works in worklets.
 */
export function isTargetVisible(target: TriageTarget, isSubscription: boolean): boolean {
  "worklet";
  if (target.subscriptionOnly) {
    return isSubscription;
  }
  return true;
}
