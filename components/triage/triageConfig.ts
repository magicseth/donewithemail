import { Dimensions } from "react-native";

/**
 * Get current screen dimensions.
 * Call this when needed rather than caching at module load.
 */
export function getScreenDimensions() {
  const { width, height } = Dimensions.get("window");
  return { width, height, centerX: width / 2 };
}

/**
 * Static configuration for the triage UI.
 * Screen-dependent values are computed via getScreenDimensions().
 */
export const TRIAGE_CONFIG = {
  // Row dimensions
  rowHeight: 140,
  headerOffset: 86, // Height above the list (swipe hint + search)

  // Ball
  ballSize: 32,
  ballTopInRow: 4, // Ball's top offset within row
  ballTravelMultiplier: 1.5, // How much ball moves relative to finger

  // Targets
  targetTopOffset: 30, // Y position of targets in overlay
  targetCenterOffset: 20, // Offset to center of target button
  get targetYCenter() {
    return this.targetTopOffset + this.targetCenterOffset;
  },

  // Detection
  activationRadius: 30, // Distance to trigger action
  proximityRadius: 50, // Distance for visual feedback

  // Scroll navigation
  scrollBackThreshold: 0.6, // Fraction of rowHeight to trigger scroll-back

  // Derived
  get listTopPadding() {
    return this.rowHeight;
  },
  get halfBall() {
    return this.ballSize / 2;
  },
} as const;

export type TriageConfig = typeof TRIAGE_CONFIG;
