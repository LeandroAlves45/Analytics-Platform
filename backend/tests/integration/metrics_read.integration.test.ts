/**
 * Testes de integração para Read API (GET aggregated + GET endpoints).
 */

import request from 'supertest';
import { getTestApp } from './setup';
import { getDatabase } from '@infra/frameworks/database';
import { metrics5min, metricsRaw } from '@infra/frameworks/database/schema';
import { TEST_WORKSPACE_ID, TEST_API_KEY_ID, createUniqueRequestId } from '../fixtures/metrics';

describe('Read API Integration Tests', () => {
  describe('GET /api/endpoints', () => {
    it('should return active endpoints for authenticated workspace', async () => {
      const app = getTestApp();
      const db = getDatabase();

      await db.insert(metricsRaw).values({
        time: new Date(),
        workspaceId: TEST_WORKSPACE_ID,
        apiKeyId: TEST_API_KEY_ID,
        endpoint: '/api/orders',
        method: 'POST',
        latencyMs: 120,
        statusCode: 201,
        requestId: createUniqueRequestId(),
      });

      const res = await request(app).get('/api/endpoints').query({ minutes: 1440 });

      expect(res.status).toBe(200);
      expect(res.body.data.endpoints).toEqual(
        expect.arrayContaining([{ endpoint: '/api/orders', method: 'POST' }])
      );
    });
  });

  describe('GET /api/metrics/aggregated', () => {
    it('should return aggregated series from metrics_5min', async () => {
      const app = getTestApp();
      const db = getDatabase();
      const windowStart = new Date('2026-06-01T10:00:00.000Z');

      await db.insert(metrics5min).values({
        time: windowStart,
        workspaceId: TEST_WORKSPACE_ID,
        endpoint: '/api/users',
        method: 'GET',
        count: 50,
        latencyP50: 20,
        latencyP75: 30,
        latencyP95: 100,
        latencyP99: 200,
        latencyAvg: 35,
        latencyMin: 5,
        latencyMax: 250,
        status2xxCount: 48,
        status3xxCount: 0,
        status4xxCount: 1,
        status5xxCount: 1,
      });

      const res = await request(app).get('/api/metrics/aggregated').query({
        from: '2026-06-01T10:00:00.000Z',
        to: '2026-06-01T10:05:00.000Z',
        interval: '5m',
        endpoint: '/api/users',
        method: 'GET',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.series).toHaveLength(1);
      expect(res.body.data.series[0]).toMatchObject({
        count: 50,
        errorRate: 0.04,
      });
    });

    it('should return 422 when from is after to', async () => {
      const app = getTestApp();

      const res = await request(app).get('/api/metrics/aggregated').query({
        from: '2026-06-02T00:00:00.000Z',
        to: '2026-06-01T00:00:00.000Z',
        interval: '5m',
      });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
