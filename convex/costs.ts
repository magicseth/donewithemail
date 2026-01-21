/**
 * Usage tracking with neutral-cost component.
 * Tracks AI token usage and tool costs per user.
 */

import { CostComponent } from "neutral-cost";
import { components } from "./_generated/api";
import { internalAction, query } from "./_generated/server";

// Initialize the cost tracking component
export const costs = new CostComponent(components.neutralCost, {
  // Add markup multipliers if needed for billing
  // providerMarkupMultiplier: [
  //   { providerId: "anthropic", multiplier: 1.0 }
  // ],
});

// Re-export for use in actions
export { costs as usageCosts };

// Export client API for querying costs
export const {
  getAICostsByThread,
  getAICostsByUser,
  getTotalAICostsByUser,
  getTotalAICostsByThread,
  getToolCostsByThread,
  getToolCostsByUser,
  getTotalToolCostsByUser,
  getTotalToolCostsByThread,
  getAllPricing,
  updatePricingData,
  getAllToolPricing,
  getToolPricingByProvider,
  getMarkupMultiplier,
  getMarkupMultiplierById,
  getPricingByProvider,
  searchPricingByModelName,
  getAICostByMessageId,
} = costs.clientApi();

// Internal action to update pricing data (for cron jobs)
export const refreshPricingData = internalAction({
  args: {},
  handler: async (ctx): Promise<{ updatedModels: number }> => {
    const result = await costs.updatePricingData(ctx);
    console.log(`[Costs] Updated pricing data: ${result.updatedModels} models`);
    return { updatedModels: result.updatedModels };
  },
});

// Query to get total costs for the authenticated user
export const getMyTotalCosts = query({
  args: {},
  handler: async (ctx): Promise<{
    aiCosts: { count: number; totalRawCost: number; totalUserCost: number } | null;
    toolCosts: { count: number; totalRawCost: number; totalUserCost: number } | null;
    totalCost: number;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { aiCosts: null, toolCosts: null, totalCost: 0 };
    }

    // Get user from database
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
      .first();

    if (!user) {
      return { aiCosts: null, toolCosts: null, totalCost: 0 };
    }

    // Get total AI costs using component directly
    const aiCosts = await costs.getTotalAICostsByUser(ctx, user._id);

    // Get total tool costs (embeddings, etc.)
    const toolCosts = await costs.getTotalToolCostsByUser(ctx, user._id);

    const totalCost = (aiCosts?.totalRawCost ?? 0) + (toolCosts?.totalRawCost ?? 0);

    return { aiCosts, toolCosts, totalCost };
  },
});
