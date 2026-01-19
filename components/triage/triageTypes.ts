import type { SharedValue } from "react-native-reanimated";

/**
 * Triage target identifiers - exhaustive list of all possible actions
 */
export type TriageTargetId = "done" | "reply" | "mic" | "unsubscribe";

/**
 * State machine phases for the triage system.
 *
 * Flow: idle -> dragging -> (processing | idle)
 *
 * - idle: Waiting for user interaction
 * - dragging: User is moving the ball
 * - processing: Action triggered, executing handler
 */
export type TriagePhase = "idle" | "dragging" | "processing";

/**
 * Target definition - describes a single triage action
 */
export interface TriageTarget {
  readonly id: TriageTargetId;
  readonly position: number; // X offset from center (negative = left)
  readonly color: string; // Active color (hex)
  readonly bgColor: string; // Row highlight color (hex)
  readonly icon: string;
  readonly label: string;
  // If set, only show for subscription emails
  readonly subscriptionOnly?: boolean;
}

/**
 * Position in 2D space
 */
export interface Point2D {
  readonly x: number;
  readonly y: number;
}

/**
 * Result of hit detection for a single target
 */
export interface HitTestResult {
  readonly targetId: TriageTargetId | null;
  readonly distance: number;
  readonly proximity: number; // 0-1, for visual feedback
}

/**
 * Email data needed for triage actions
 */
export interface TriageableEmail {
  readonly _id: string;
  readonly subject: string;
  readonly isSubscription?: boolean;
  readonly fromContact?: {
    readonly email: string;
    readonly name?: string;
  } | null;
}

/**
 * Result of triaging an email
 */
export type TriageAction = "done" | "reply_needed" | "unsubscribe";

/**
 * Handler called when a target is activated.
 *
 * For "mic", this should start voice recording and return `false`
 * to prevent auto-advancing to the next email.
 *
 * For others, this should execute the triage action.
 * Return `true` or `undefined` to advance to next email (default).
 * Return `false` to stay on current email (used for mic recording).
 */
export type TriageHandler = (
  email: TriageableEmail,
  targetId: TriageTargetId,
  index: number
) => Promise<boolean | void> | boolean | void;

/**
 * Shared values exposed by the triage context.
 * All are SharedValue for use in worklets.
 */
export interface TriageSharedValues {
  // User input
  readonly fingerX: SharedValue<number>;
  readonly startX: SharedValue<number>;
  readonly scrollY: SharedValue<number>;

  // State
  readonly phase: SharedValue<TriagePhase>;
  readonly activeIndex: SharedValue<number>;

  // Derived (read-only in components)
  readonly ballX: SharedValue<number>;
}

/**
 * Actions that can be called from the UI
 */
export interface TriageActions {
  readonly setScrollY: (y: number) => void;
  readonly resetToIndex: (index: number) => void;
}
