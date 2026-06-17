/**
 * Testes de integração para alert rules e events.
 */

import type { Express } from 'express';
import request from 'supertest';
import { eq } from 'drizzle-orm';

import { getTestApp } from './setup';
import { getDatabase } from '@infra/frameworks/database';
import { alertRules, endpoints } from '@infra/frameworks/database/schema';
import { VALID_CREATE_ALERT_RULE_PAYLOAD } from '../fixtures/alerts';
import { TEST_WORKSPACE_ID } from '../fixtures/metrics';

async function createTestAlertRule(app: Express) {
  const response = await request(app)
    .post('/api/alert-rules')
    .send(VALID_CREATE_ALERT_RULE_PAYLOAD)
    .set('Content-Type', 'application/json');

  expect(response.status).toBe(201);
  return response.body.data;
}

describe('Alert Rules API -> integration', () => {
  describe('POST /api/alert-rules', () => {
    it('should create an alert rule and upsert endpoint metadata', async () => {
      const app = getTestApp();

      const response = await request(app)
        .post('/api/alert-rules')
        .send(VALID_CREATE_ALERT_RULE_PAYLOAD)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        name: VALID_CREATE_ALERT_RULE_PAYLOAD.name,
        condition: 'latency_p95',
        threshold: 500,
        endpoint: '/api/users',
        method: 'GET',
      });

      const db = getDatabase();
      const endpointRows = await db
        .select()
        .from(endpoints)
        .where(eq(endpoints.workspaceId, TEST_WORKSPACE_ID));

      expect(endpointRows).toHaveLength(1);
      expect(endpointRows[0].endpoint).toBe('/api/users');
    });

    it('should return 422 for a invalid payload', async () => {
      const app = getTestApp();

      const response = await request(app)
        .post('/api/alert-rules')
        .send({ name: '', condition: 'invalid' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(422);
    });
  });

  describe('GET /api/alert-rules', () => {
    it('should list alert rules for a workspace', async () => {
      const app = getTestApp();

      await createTestAlertRule(app);

      const response = await request(app).get('/api/alert-rules');

      expect(response.status).toBe(200);
      expect(response.body.data.rules).toHaveLength(1);
    });
  });

  describe('PUT /api/alert-rules/:id', () => {
    it('should update an existing alert rule', async () => {
      const app = getTestApp();

      const createdRule = await createTestAlertRule(app);
      const ruleId = createdRule.id;

      const updateRes = await request(app)
        .put(`/api/alert-rules/${ruleId}`)
        .send({ name: 'Updated rule name', threshold: 750 })
        .set('Content-Type', 'application/json');

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.name).toBe('Updated rule name');
      expect(updateRes.body.data.threshold).toBe(750);
    });
  });

  describe('DELETE /api/alert-rules/:id', () => {
    it('should delete an alert rule', async () => {
      const app = getTestApp();

      const createdRule = await createTestAlertRule(app);
      const ruleId = createdRule.id;

      const deleteRes = await request(app).delete(`/api/alert-rules/${ruleId}`);
      expect(deleteRes.status).toBe(204);

      const db = getDatabase();
      const rows = await db.select().from(alertRules).where(eq(alertRules.id, ruleId));
      expect(rows).toHaveLength(0);
    });
  });

  describe('GET /api/alert-rules/:id', () => {
    it('should return the rule when it exists', async () => {
      const app = getTestApp();

      const createdRule = await createTestAlertRule(app);
      const ruleId = createdRule.id;

      const getRes = await request(app).get(`/api/alert-rules/${ruleId}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.id).toBe(ruleId);
    });

    it('should return 422 when id is not a valid UUID', async () => {
      const app = getTestApp();

      const response = await request(app).get('/api/alert-rules/not-a-uuid');

      expect(response.status).toBe(422);
    });

    it('should return 404 when rule does not exist', async () => {
      const app = getTestApp();

      const response = await request(app).get(
        '/api/alert-rules/00000000-0000-4000-8000-000000000099'
      );

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/alert-rules/:id — edge cases', () => {
    it('should return 422 when id is not a valid UUID', async () => {
      const app = getTestApp();

      const response = await request(app).delete('/api/alert-rules/not-a-uuid');

      expect(response.status).toBe(422);
    });
  });

  describe('GET /api/alert-events', () => {
    it('should return empty events list initially', async () => {
      const app = getTestApp();

      const response = await request(app).get('/api/alert-events');

      expect(response.status).toBe(200);
      expect(response.body.data.events).toEqual([]);
    });

    it('should accept status=open filter without error', async () => {
      const app = getTestApp();

      const response = await request(app).get('/api/alert-events?status=open');

      expect(response.status).toBe(200);
      expect(response.body.data.events).toEqual([]);
    });

    it('should accept alertRuleId filter without error', async () => {
      const app = getTestApp();

      const createdRule = await createTestAlertRule(app);
      const ruleId = createdRule.id;

      const response = await request(app).get(`/api/alert-events?alertRuleId=${ruleId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.events).toEqual([]);
    });

    it('should accept limit filter without error', async () => {
      const app = getTestApp();

      const response = await request(app).get('/api/alert-events?limit=1');

      expect(response.status).toBe(200);
    });
  });
});
