// Configuration
export { TRIAGE_CONFIG, getScreenDimensions } from "./triageConfig";

// Types
export type {
  TriageTargetId,
  TriagePhase,
  TriageTarget,
  TriageableEmail,
  TriageHandler,
  TriageAction,
  Point2D,
  HitTestResult,
} from "./triageTypes";

// Targets
export {
  TRIAGE_TARGETS,
  ALWAYS_VISIBLE_TARGETS,
  getTargetById,
  isTargetVisible,
} from "./triageTargets";

// Detection
export {
  calculateBallScreenY,
  getTargetCenter,
  computeHitTest,
  computeActiveTarget,
} from "./useTriageDetection";

// Context & Provider
export { TriageProvider, useTriageContext } from "./TriageProvider";
export type { TriageControlRef } from "./TriageProvider";

// Gestures
export { useTriagePanGesture, useTriageWebPointerEvents } from "./useTriageGestures";

// Components
export { TriageOverlay } from "./TriageOverlay";
export { TriageTargetView } from "./TriageTargetView";
export { TriageBall } from "./TriageBall";
export { TriageRowWrapper } from "./TriageRowWrapper";
