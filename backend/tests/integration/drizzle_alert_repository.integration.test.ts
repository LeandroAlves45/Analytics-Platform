/**
 * Testes de integração directos ao DrizzleAlertRepository.
 * Cobrem JOINs com endpoints, filtros de eventos, snapshots de métricas
 * e cenários edge de update/delete.
 */

import { randomUUID } from 'node:crypto';

import { AlertRule } from '@domain/entities/AlertRule';
import { getDatabase } from '@infra/frameworks/database';
import { endpoints, metrics5min } from '@infra/frameworks/database/schema';
import { DrizzleAlertRepository } from '@infra/repositories/DrizzleAlertRepository';

import { BASE_ALERT_RULE_INPUT } from '../fixtures/alerts';
import { TEST_WORKSPACE_ID } from '../fixtures/metrics';

function createRepository(): DrizzleAlertRepository {
  return new DrizzleAlertRepository(getDatabase());
}

function createAlertRule(overrides?: Partial<typeof BASE_ALERT_RULE_INPUT>): AlertRule {
  return new AlertRule({ ...BASE_ALERT_RULE_INPUT, ...overrides });
}

describe('DrizzleAlertRepository -> integration', () => {
  describe('save / findById with endpoint join', () => {
    it('should persist rule and enrich output with endpoint metadata from join', async () => {
      const db = getDatabase();
      const repo = createRepository();

      const [endpointRow] = await db
        .insert(endpoints)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/orders',
          method: 'POST',
        })
        .returning();

      const rule = createAlertRule({ endpointId: endpointRow.id });
      const saved = await repo.save(rule);

      expect(saved.endpoint).toBe('/api/orders');
      expect(saved.method).toBe('POST');
      expect(saved.endpointId).toBe(endpointRow.id);

      const found = await repo.findById(saved.id, TEST_WORKSPACE_ID);
      expect(found).toMatchObject({
        id: saved.id,
        endpoint: '/api/orders',
        method: 'POST',
      });
    });
  });

  describe('update edge cases', () => {
    it('should throw AppError when update targets wrong workspaceId', async () => {
      const repo = createRepository();
      const saved = await repo.save(createAlertRule());

      const wrongWorkspaceRule = AlertRule.reconstitute({
        ...BASE_ALERT_RULE_INPUT,
        id: saved.id,
        workspaceId: randomUUID(),
        name: 'Renamed',
        createdAt: saved.createdAt,
        updatedAt: new Date(),
      });

      await expect(repo.update(wrongWorkspaceRule)).rejects.toMatchObject({
        message: 'Failed to update alert rule',
        statusCode: 500,
      });
    });
  });

  describe('delete edge cases', () => {
    it('should be idempotent when deleting a non-existent rule', async () => {
      const repo = createRepository();

      await expect(
        repo.delete('00000000-0000-4000-8000-000000000099', TEST_WORKSPACE_ID)
      ).resolves.toBeUndefined();
    });

    it('should not delete rule when workspaceId does not match', async () => {
      const repo = createRepository();
      const saved = await repo.save(createAlertRule());

      await repo.delete(saved.id, randomUUID());

      const stillExists = await repo.findById(saved.id, TEST_WORKSPACE_ID);
      expect(stillExists).not.toBeNull();
    });
  });

  describe('listEvents filters', () => {
    it('should filter open and resolved events by status', async () => {
      const repo = createRepository();
      const saved = await repo.save(createAlertRule());

      const openEvent = await repo.createEvent({
        alertRuleId: saved.id,
        workspaceId: TEST_WORKSPACE_ID,
        ruleName: saved.name,
        value: 600,
        message: 'threshold exceeded',
        slackSent: false,
        emailSent: false,
      });

      const resolvedEvent = await repo.createEvent({
        alertRuleId: saved.id,
        workspaceId: TEST_WORKSPACE_ID,
        ruleName: saved.name,
        value: 700,
        message: 'resolved case',
        slackSent: false,
        emailSent: false,
      });
      await repo.resolveEvent(resolvedEvent.id, new Date());

      const openOnly = await repo.listEvents({
        workspaceId: TEST_WORKSPACE_ID,
        eventStatus: 'open',
      });
      expect(openOnly).toHaveLength(1);
      expect(openOnly[0].id).toBe(openEvent.id);

      const resolvedOnly = await repo.listEvents({
        workspaceId: TEST_WORKSPACE_ID,
        eventStatus: 'resolved',
      });
      expect(resolvedOnly).toHaveLength(1);
      expect(resolvedOnly[0].id).toBe(resolvedEvent.id);

      const byRule = await repo.listEvents({
        workspaceId: TEST_WORKSPACE_ID,
        alertRuleId: saved.id,
        limit: 10,
      });
      expect(byRule).toHaveLength(2);
    });
  });

  describe('findEvaluationSnapshot', () => {
    it('should aggregate workspace-wide metrics when rule has no endpoint filter', async () => {
      const db = getDatabase();
      const repo = createRepository();
      const saved = await repo.save(createAlertRule());

      await db.insert(metrics5min).values({
        time: new Date(),
        workspaceId: TEST_WORKSPACE_ID,
        endpoint: '/api/a',
        method: 'GET',
        count: 50,
        latencyP95: 400,
        status4xxCount: 2,
        status5xxCount: 3,
      });

      await db.insert(metrics5min).values({
        time: new Date(),
        workspaceId: TEST_WORKSPACE_ID,
        endpoint: '/api/b',
        method: 'POST',
        count: 50,
        latencyP95: 600,
        status4xxCount: 1,
        status5xxCount: 2,
      });

      const snapshot = await repo.findEvaluationSnapshot(saved, saved.windowMinutes);

      expect(snapshot.sampleCount).toBe(100);
      expect(snapshot.status5xxCount).toBe(5);
      expect(snapshot.latencyP95).toBe(500);
      expect(snapshot.errorRate).toBeCloseTo(0.08);
    });

    it('should filter metrics by endpoint and method when rule is scoped', async () => {
      const db = getDatabase();
      const repo = createRepository();

      const [endpointRow] = await db
        .insert(endpoints)
        .values({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/scoped',
          method: 'PUT',
        })
        .returning();

      const saved = await repo.save(createAlertRule({ endpointId: endpointRow.id }));

      await db.insert(metrics5min).values({
        time: new Date(),
        workspaceId: TEST_WORKSPACE_ID,
        endpoint: '/api/scoped',
        method: 'PUT',
        count: 20,
        latencyP95: 900,
        status4xxCount: 0,
        status5xxCount: 4,
      });

      await db.insert(metrics5min).values({
        time: new Date(),
        workspaceId: TEST_WORKSPACE_ID,
        endpoint: '/api/other',
        method: 'GET',
        count: 80,
        latencyP95: 100,
        status4xxCount: 0,
        status5xxCount: 0,
      });

      const scopedRule = (await repo.findById(saved.id, TEST_WORKSPACE_ID))!;
      const snapshot = await repo.findEvaluationSnapshot(scopedRule, scopedRule.windowMinutes);

      expect(snapshot.sampleCount).toBe(20);
      expect(snapshot.latencyP95).toBe(900);
      expect(snapshot.status5xxCount).toBe(4);
    });
  });

  describe('batch helpers', () => {
    it('should return empty maps for empty rule id lists', async () => {
      const repo = createRepository();

      expect(await repo.findOpenEventsBatch([])).toEqual(new Map());
      expect(await repo.findEvaluationSnapshotsBatch([])).toEqual(new Map());
    });

    it('should return latest open event per rule in findOpenEventsBatch', async () => {
      const repo = createRepository();
      const saved = await repo.save(createAlertRule());

      await repo.createEvent({
        alertRuleId: saved.id,
        workspaceId: TEST_WORKSPACE_ID,
        ruleName: saved.name,
        value: 100,
        message: 'older',
        slackSent: false,
        emailSent: false,
      });

      const latest = await repo.createEvent({
        alertRuleId: saved.id,
        workspaceId: TEST_WORKSPACE_ID,
        ruleName: saved.name,
        value: 200,
        message: 'latest',
        slackSent: false,
        emailSent: false,
      });

      const batch = await repo.findOpenEventsBatch([saved.id]);

      expect(batch.size).toBe(1);
      expect(batch.get(saved.id)?.id).toBe(latest.id);
    });
  });

  describe('findActiveRules', () => {
    it('should return only active rules', async () => {
      const repo = createRepository();
      const active = await repo.save(createAlertRule({ status: 'active' }));
      const inactive = await repo.save(
        createAlertRule({ name: 'Inactive rule', status: 'inactive' })
      );

      const activeRules = await repo.findActiveRules();
      const ids = activeRules.map((r) => r.id);

      expect(ids).toContain(active.id);
      expect(ids).not.toContain(inactive.id);
    });
  });

  describe('updateNotificationStatus', () => {
    it('should persist slack and email delivery flags on event', async () => {
      const repo = createRepository();
      const saved = await repo.save(createAlertRule());

      const event = await repo.createEvent({
        alertRuleId: saved.id,
        workspaceId: TEST_WORKSPACE_ID,
        ruleName: saved.name,
        value: 500,
        message: 'notify',
        slackSent: false,
        emailSent: false,
      });

      await repo.updateNotificationStatus(event.id, true, true);

      const events = await repo.listEvents({
        workspaceId: TEST_WORKSPACE_ID,
        alertRuleId: saved.id,
      });

      expect(events[0].slackSent).toBe(true);
      expect(events[0].emailSent).toBe(true);
    });
  });
});
