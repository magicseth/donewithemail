import type { TriageTarget, TriageTargetId } from "./triageTypes";

/**
 * All triage targets.
 * Positions are X offset from screen center (negative = left).
 *
 * IMPORTANT: This array is used in worklets. Keep it simple and immutable.
 */
/**
 * Visual Layout (dynamic based on calendar context):
 *
 * When NO calendar event:
 *   Unsub      Reply      Done       Mic
 *     |          |          |          |
 *  -160px     -80px        0px      +80px
 *    🚫          ↩          ✓         🎤
 *
 * When calendar event (all 4 main targets visible):
 *   Unsub      Done      Accept     Reply       Mic
 *     |          |          |          |          |
 *  -200px     -80px        0px      +80px     +160px
 *    🚫          ✓          📅         ↩         🎤
 *
 * Note: Accept is centered when shouldAcceptCalendar=true (AI predicts accept)
 */
export const TRIAGE_TARGETS: readonly TriageTarget[] = [
  {
    id: "unsubscribe",
    position: -200, // Far left (subscription-only)
    color: "#F59E0B",
    bgColor: "#FFFBEB",
    icon: "🚫",
    label: "Unsub",
    subscriptionOnly: true,
  },
  {
    id: "reply",
    position: -80, // 80px left of center (hidden when shouldAcceptCalendar=true)
    color: "#6366F1",
    bgColor: "#EEF2FF",
    icon: "↩",
    label: "Reply",
  },
  {
    id: "done",
    position: 0, // Default center (moves to -80 when shouldAcceptCalendar=true)
    color: "#10B981",
    bgColor: "#ECFDF5",
    icon: "✓",
    label: "Done",
  },
  {
    id: "accept",
    position: 0, // Center when shouldAcceptCalendar=true, +80 when false
    color: "#10B981",
    bgColor: "#ECFDF5",
    icon: "📅",
    label: "Accept",
    calendarOnly: true, // Only visible when email has calendar event
  },
  {
    id: "mic",
    position: 80, // 80px right of center (moves to +160 when shouldAcceptCalendar=false)
    color: "#EF4444",
    bgColor: "#FEF2F2",
    icon: "🎤",
    label: "Mic",
  },
] as const;

/**
 * Targets that are always visible (not subscription-only or calendar-only).
 * Use this for hit detection to avoid closure capture issues.
 */
export const ALWAYS_VISIBLE_TARGETS: readonly TriageTarget[] = TRIAGE_TARGETS.filter(
  (t) => !t.subscriptionOnly && !t.calendarOnly
);

/**
 * Compute effective position of a target based on email context.
 * Works in worklets.
 *
 * @param target The target to position
 * @param hasCalendarEvent Whether the email has a calendar event
 * @param shouldAccept AI prediction for calendar acceptance (only relevant if hasCalendarEvent)
 */
export function getEffectiveTargetPosition(
  target: TriageTarget,
  hasCalendarEvent: boolean,
  shouldAccept: boolean
): number {
  "worklet";

  // If no calendar event, use default positions (accept is hidden anyway)
  if (!hasCalendarEvent) {
    return target.position;
  }

  // Calendar event present - show all 4 targets: Done, Accept, Reply, Mic
  // Layout: Done(-80) Accept(0) Reply(+80) Mic(+160)
  switch (target.id) {
    case "done":
      return -80;

    case "accept":
      // Accept at center (0) - this is the primary action for calendar emails
      return 0;

    case "reply":
      // Reply moves to +80 (right of Accept)
      return 80;

    case "mic":
      // Mic moves to +160 (far right)
      return 160;

    case "unsubscribe":
      // Unsubscribe stays at -200 (far left, only for subscriptions)
      return -200;

    default:
      return target.position;
  }
}

/**
 * Check if a target should be visible for the given email.
 * Works in worklets.
 */
export function isTargetVisibleForEmail(
  target: TriageTarget,
  isSubscription: boolean,
  hasCalendarEvent: boolean,
  _shouldAccept: boolean
): boolean {
  "worklet";

  // Subscription-only targets only visible for subscriptions
  if (target.subscriptionOnly && !isSubscription) {
    return false;
  }

  // Calendar-only targets only visible when email has calendar event
  if (target.calendarOnly && !hasCalendarEvent) {
    return false;
  }

  // All other targets are always visible
  return true;
}

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
 * Check if a target should be visible (legacy, use isTargetVisibleForEmail for full context).
 * Works in worklets.
 */
export function isTargetVisible(target: TriageTarget, isSubscription: boolean): boolean {
  "worklet";
  if (target.subscriptionOnly && !isSubscription) {
    return false;
  }
  // Calendar-only targets require additional context - return false by default
  if (target.calendarOnly) {
    return false;
  }
  return true;
}
