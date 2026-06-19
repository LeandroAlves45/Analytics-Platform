/**
 * Tracking mensal de requests por workspace — upsert atómico.
 */

import { eq, and, sql } from 'drizzle-orm';
import type { Database } from '@infra/frameworks/database/connection';
import { usageTracking } from '@infra/frameworks/database/schema';
import type { UsageTrackingRepository } from '@application/contracts/repositories';

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export class DrizzleUsageTrackingRepository implements UsageTrackingRepository {
  constructor(private readonly db: Database) {}

  /** Incrementa contador do mês corrente e devolve total atual */
  async increment(workspaceId: string, month: Date): Promise<number> {
    const monthDate = startOfMonth(month);
    const [row] = await this.db
      .insert(usageTracking)
      .values({
        workspaceId,
        month: monthDate.toISOString().slice(0, 10),
        requestsTracked: 1,
      })
      .onConflictDoUpdate({
        target: [usageTracking.workspaceId, usageTracking.month],
        set: {
          requestsTracked: sql`${usageTracking.requestsTracked} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning({ count: usageTracking.requestsTracked });

    return row?.count ?? 0;
  }

  /** Devolve total de requests do mês corrente */
  async getCurrentMonthUsage(workspaceId: string): Promise<number> {
    const monthStr = startOfMonth(new Date()).toISOString().slice(0, 10);

    const [row] = await this.db
      .select({ count: usageTracking.requestsTracked })
      .from(usageTracking)
      .where(and(eq(usageTracking.workspaceId, workspaceId), eq(usageTracking.month, monthStr)))
      .limit(1);

    return row?.count ?? 0;
  }
}
