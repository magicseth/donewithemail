/**
 * Usage tracking with neutral-cost component.
 * Tracks AI token usage and tool costs per user.
 */

import { CostComponent } from "neutral-cost";
import { components } from "./_generated/api";

// Initialize the cost tracking component
export const costs = new CostComponent(components.neutralCost, {
  // Add markup multipliers if needed for billing
  // providerMarkupMultiplier: [
  //   { providerId: "anthropic", multiplier: 1.0 }
  // ],
});

// Re-export for use in actions
export { costs as usageCosts };
