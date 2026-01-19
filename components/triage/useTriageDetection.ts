import { TRIAGE_CONFIG, getScreenDimensions } from "./triageConfig";
import {
  TRIAGE_TARGETS,
  isTargetVisible,
  isTargetVisibleForEmail,
  getEffectiveTargetPosition,
} from "./triageTargets";
import type { TriageTarget, TriageTargetId, Point2D } from "./triageTypes";

/**
 * Calculate 2D distance between two points.
 */
function distance2D(a: Point2D, b: Point2D): number {
  "worklet";
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate the ball's screen Y position from scroll state.
 *
 * This is THE key formula. All ball Y calculations go through here.
 */
export function calculateBallScreenY(
  scrollY: number,
  activeIndex: number
): number {
  "worklet";
  const {
    headerOffset,
    listTopPadding,
    rowHeight,
    ballTopInRow,
    halfBall,
  } = TRIAGE_CONFIG;

  const rowScreenY =
    headerOffset + listTopPadding + activeIndex * rowHeight - scrollY;
  return rowScreenY + ballTopInRow + halfBall;
}

/**
 * Calculate a target's center position on screen.
 * @param effectivePosition Optional dynamic position override (used for calendar-aware positioning)
 */
export function getTargetCenter(
  target: TriageTarget,
  centerX: number,
  effectivePosition?: number
): Point2D {
  "worklet";
  const position = effectivePosition ?? target.position;
  return {
    x: centerX + position,
    y: TRIAGE_CONFIG.targetYCenter,
  };
}

/**
 * Compute hit detection for all targets.
 *
 * IMPORTANT: Uses module-level TRIAGE_TARGETS to avoid closure capture bugs.
 * The parameters determine which targets are considered and their positions.
 *
 * @param ballX Ball's X position on screen
 * @param ballY Ball's Y position on screen
 * @param centerX Screen center X
 * @param isSubscription Whether the email is a subscription
 * @param hasCalendarEvent Whether the email has a calendar event
 * @param shouldAcceptCalendar AI prediction for calendar acceptance
 *
 * Returns:
 * - hit: The target ID if ball is within activation radius, null otherwise
 * - proximities: Map of target ID -> proximity (0-1) for visual feedback
 * - closestTarget: The closest target with non-zero proximity
 * - effectivePositions: Map of target ID -> effective X position (for rendering)
 */
export function computeHitTest(
  ballX: number,
  ballY: number,
  centerX: number,
  isSubscription: boolean,
  hasCalendarEvent: boolean = false,
  shouldAcceptCalendar: boolean = false
): {
  hit: TriageTargetId | null;
  proximities: Record<string, number>;
  closestTarget: { id: TriageTargetId; proximity: number } | null;
  effectivePositions: Record<string, number>;
} {
  "worklet";
  const { activationRadius, proximityRadius } = TRIAGE_CONFIG;

  let hit: TriageTargetId | null = null;
  const proximities: Record<string, number> = {};
  const effectivePositions: Record<string, number> = {};
  let closestTarget: { id: TriageTargetId; proximity: number } | null = null;

  // Use module-level constant - no closure capture
  for (let i = 0; i < TRIAGE_TARGETS.length; i++) {
    const target = TRIAGE_TARGETS[i];

    // Compute effective position for this target
    const effectivePosition = getEffectiveTargetPosition(
      target,
      hasCalendarEvent,
      shouldAcceptCalendar
    );
    effectivePositions[target.id] = effectivePosition;

    // Skip targets not visible for this email type
    if (!isTargetVisibleForEmail(target, isSubscription, hasCalendarEvent, shouldAcceptCalendar)) {
      proximities[target.id] = 0;
      continue;
    }

    const targetCenter = getTargetCenter(target, centerX, effectivePosition);
    const dist = distance2D({ x: ballX, y: ballY }, targetCenter);

    // Check for hit
    if (dist <= activationRadius && hit === null) {
      hit = target.id;
    }

    // Calculate proximity for visual feedback
    const proximity = dist > proximityRadius ? 0 : 1 - dist / proximityRadius;
    proximities[target.id] = proximity;

    // Track closest
    if (proximity > 0 && (closestTarget === null || proximity > closestTarget.proximity)) {
      closestTarget = { id: target.id, proximity };
    }
  }

  return { hit, proximities, closestTarget, effectivePositions };
}

/**
 * Convenience function: compute active target from scroll state.
 *
 * This is the main function called from useAnimatedReaction.
 */
export function computeActiveTarget(
  ballX: number,
  scrollY: number,
  activeIndex: number,
  centerX: number,
  isSubscription: boolean,
  hasCalendarEvent: boolean = false,
  shouldAcceptCalendar: boolean = false
): TriageTargetId | null {
  "worklet";
  const ballY = calculateBallScreenY(scrollY, activeIndex);
  const { hit } = computeHitTest(
    ballX,
    ballY,
    centerX,
    isSubscription,
    hasCalendarEvent,
    shouldAcceptCalendar
  );
  return hit;
}
