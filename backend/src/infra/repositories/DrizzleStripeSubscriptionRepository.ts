/**
 * Persistência de subscrições Stripe — actualizada via webhooks.
 */

import { eq } from 'drizzle-orm';
import type { Database } from '@infra/frameworks/database/connection';
import { stripeSubscriptions } from '@infra/frameworks/database/schema';
import type { StripeSubscriptionRepository } from '@application/contracts/repositories';

export class DrizzleStripeSubscriptionRepository implements StripeSubscriptionRepository {
  constructor(private readonly db: Database) {}

  /** Upsert de subscrição */
  async upsert(data: {
    workspaceId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    stripeProductId?: string | null;
    plan: string;
    status: string;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    trialEnd?: Date | null;
  }): Promise<void> {
    await this.db
      .insert(stripeSubscriptions)
      .values({
        workspaceId: data.workspaceId,
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        stripeProductId: data.stripeProductId ?? null,
        plan: data.plan,
        status: data.status,
        currentPeriodStart: data.currentPeriodStart?.toISOString().slice(0, 10) ?? null,
        currentPeriodEnd: data.currentPeriodEnd?.toISOString().slice(0, 10) ?? null,
        trialEnd: data.trialEnd?.toISOString().slice(0, 10) ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: stripeSubscriptions.workspaceId,
        set: {
          stripeSubscriptionId: data.stripeSubscriptionId,
          stripeProductId: data.stripeProductId ?? null,
          plan: data.plan,
          status: data.status,
          currentPeriodStart: data.currentPeriodStart?.toISOString().slice(0, 10) ?? null,
          currentPeriodEnd: data.currentPeriodEnd?.toISOString().slice(0, 10) ?? null,
          trialEnd: data.trialEnd?.toISOString().slice(0, 10) ?? null,
          updatedAt: new Date(),
        },
      });
  }

  /** Lookup por workspace */
  async findByWorkspaceId(workspaceId: string) {
    const [row] = await this.db
      .select()
      .from(stripeSubscriptions)
      .where(eq(stripeSubscriptions.workspaceId, workspaceId))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      plan: row.plan,
      status: row.status,
      stripeCustomerId: row.stripeCustomerId,
      currentPeriodEnd: row.currentPeriodEnd ? new Date(row.currentPeriodEnd) : null,
    };
  }
}
