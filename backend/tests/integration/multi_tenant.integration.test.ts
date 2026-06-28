/**
 * Verifica isolamento de dados entre workspaces distintos.
 * Workspace A nunca deve ver dados de Workspace B.
 */

import request from 'supertest';
import { Express } from 'express';
import { randomUUID } from 'crypto';
import { createApp, registerRoutes } from '@infra/frameworks/express/app';
import { bootstrapForAuthTesting } from './bootstrapTest';
import { NoOpRefreshTokenStore } from '@infra/cache/NoOpRefreshTokenStore';
import { NoOpApiKeyAuthCache } from '../helpers/NoOpApiKeyAuthCache';
import { VALID_CREATE_ALERT_RULE_PAYLOAD } from '../fixtures/alerts';

let app: Express;

beforeAll(() => {
  app = createApp();
  registerRoutes(app, bootstrapForAuthTesting());
});

beforeEach(() => {
  NoOpRefreshTokenStore.clear();
  NoOpApiKeyAuthCache.clear();
});

/** Regista utilizador e devolve { accessToken, workspaceId } */
async function createTenant(suffix: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email: `tenant-${suffix}-${Date.now()}@example.com`,
      password: 'password123',
      name: `Tenant ${suffix} ${Date.now()}`,
    });
  return {
    accessToken: res.body.data.accessToken as string,
    workspaceId: res.body.data.workspace.id as string,
  };
}

describe('Multi-Tenant Isolation Tests', () => {
  it('should not list alert rules from another workspace', async () => {
    const tenantA = await createTenant('A-rules');
    const tenantB = await createTenant('B-rules');

    // Tenant B cria uma alert rule
    await request(app)
      .post('/api/alert-rules')
      .set('Authorization', `Bearer ${tenantB.accessToken}`)
      .send(VALID_CREATE_ALERT_RULE_PAYLOAD);

    // Tenant A lista as suas próprias rules -> não deve ver a rule de B
    const resA = await request(app)
      .get('/api/alert-rules')
      .set('Authorization', `Bearer ${tenantA.accessToken}`);

    expect(resA.status).toBe(200);
    expect(resA.body.data.rules).toHaveLength(0);
  });

  it('should not expose billing info from another workspace', async () => {
    const tenantA = await createTenant('A-billing');
    await createTenant('B-billing');

    const resA = await request(app)
      .get('/api/billing')
      .set('Authorization', `Bearer ${tenantA.accessToken}`);

    expect(resA.status).toBe(200);
    expect(resA.body.data.workspaceId).toBe(tenantA.workspaceId);
  });

  it('should not list api keys from another workspace via workspaceId param', async () => {
    const tenantA = await createTenant('A-keys');
    const tenantB = await createTenant('B-keys');

    // Tenant A tenta listar as chaves de Tenant B passando workspaceId de B no path
    // O controller deve resolver o workspaceId do JWT, ignorando o param do path
    const resA = await request(app)
      .get(`/api/workspaces/${tenantB.workspaceId}/api-keys`)
      .set('Authorization', `Bearer ${tenantA.accessToken}`);

    expect(resA.status).toBe(403);
  });

  it('should block api key creation in another tenant workspace via path tampering', async () => {
    const tenantA = await createTenant('A-create-idor');
    const tenantB = await createTenant('B-create-idor');

    const resA = await request(app)
      .post(`/api/workspaces/${tenantB.workspaceId}/api-keys`)
      .set('Authorization', `Bearer ${tenantA.accessToken}`)
      .send({ name: 'Should Fail' });

    expect(resA.status).toBe(403);
  });

  it('should not allow tenant A to revoke tenant B API key', async () => {
    const tenantA = await createTenant('A-revoke-idor');
    const tenantB = await createTenant('B-revoke-idor');

    const keyResB = await request(app)
      .post(`/api/workspaces/${tenantB.workspaceId}/api-keys`)
      .set('Authorization', `Bearer ${tenantB.accessToken}`)
      .send({ name: 'B Key' });

    expect(keyResB.status).toBe(201);
    const apiKeyIdB = keyResB.body.data.id as string;

    const revokeByA = await request(app)
      .delete(`/api/api-keys/${apiKeyIdB}`)
      .set('Authorization', `Bearer ${tenantA.accessToken}`);

    expect([403, 404]).toContain(revokeByA.status);
  });

  it('should not read tenant B alert rule by id from tenant A token', async () => {
    const tenantA = await createTenant('A-alert-idor');
    const tenantB = await createTenant('B-alert-idor');

    const ruleResB = await request(app)
      .post('/api/alert-rules')
      .set('Authorization', `Bearer ${tenantB.accessToken}`)
      .send(VALID_CREATE_ALERT_RULE_PAYLOAD);

    expect(ruleResB.status).toBe(201);
    const ruleIdB = ruleResB.body.data.id as string;

    const getByA = await request(app)
      .get(`/api/alert-rules/${ruleIdB}`)
      .set('Authorization', `Bearer ${tenantA.accessToken}`);

    expect([403, 404]).toContain(getByA.status);
  });

  it('should ingest metrics only to authenticated workspace via API key', async () => {
    const tenantA = await createTenant('A-ingest');

    // Cria API key para Tenant A
    const keyRes = await request(app)
      .post(`/api/workspaces/${tenantA.workspaceId}/api-keys`)
      .set('Authorization', `Bearer ${tenantA.accessToken}`)
      .send({ name: 'SDK Key' });

    expect(keyRes.status).toBe(201);
    const { plaintextKey } = keyRes.body.data;

    // Ingestão com a chave de A
    const ingestRes = await request(app)
      .post('/api/metrics')
      .set('Authorization', `Bearer ${plaintextKey}`)
      .send({
        endpoint: '/health',
        method: 'GET',
        latencyMs: 12,
        statusCode: 200,
        payloadSizeBytes: 1,
        requestId: randomUUID(),
      });

    expect(ingestRes.status).toBe(202);
  });

  it('should reject metrics ingest with revoked API key immediately', async () => {
    const tenant = await createTenant('revoke-key');

    const keyRes = await request(app)
      .post(`/api/workspaces/${tenant.workspaceId}/api-keys`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ name: 'Revoke Test Key' });

    const { plaintextKey, id: apiKeyId } = keyRes.body.data;

    await request(app)
      .delete(`/api/api-keys/${apiKeyId}`)
      .set('Authorization', `Bearer ${tenant.accessToken}`);

    const ingestRes = await request(app)
      .post('/api/metrics')
      .set('Authorization', `Bearer ${plaintextKey}`)
      .send({
        endpoint: '/health',
        method: 'GET',
        latencyMs: 12,
        statusCode: 200,
        payloadSizeBytes: 0,
        requestId: randomUUID(),
      });

    expect(ingestRes.status).toBe(401);
  });
});
