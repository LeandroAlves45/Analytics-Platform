/**
 * Limites por plano — requests/mês e rate limit req/min.
 */

export const PLANS_LIMITS = {
  free: { monthlyRequests: 100_000, rateLimitPerMinute: 100 },
  pro: { monthlyRequests: 1_000_000, rateLimitPerMinute: 1_000 },
  business: { monthlyRequests: 10_000_000, rateLimitPerMinute: 5_000 },
  enterprise: { monthlyRequests: Number.MAX_SAFE_INTEGER, rateLimitPerMinute: 10_000 },
} as const;

export type PlanName = keyof typeof PLANS_LIMITS;

export function getMonthlyLimit(plan: string): number {
  return PLANS_LIMITS[plan as PlanName]?.monthlyRequests ?? PLANS_LIMITS.free.monthlyRequests;
}

export function getRateLimitForPlan(plan: string): number {
  return PLANS_LIMITS[plan as PlanName]?.rateLimitPerMinute ?? PLANS_LIMITS.free.rateLimitPerMinute;
}
