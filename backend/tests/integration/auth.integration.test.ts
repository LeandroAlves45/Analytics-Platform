/**
 * Testes de integração para o router de autenticação.
 */

import request from 'supertest';
import { Express } from 'express';
import { createApp, registerRoutes } from '@infra/frameworks/express/app';
import { bootstrapForAuthTesting } from './bootstrapTest';
import { NoOpRefreshTokenStore } from '@infra/cache/NoOpRefreshTokenStore';
import { NoOpApiKeyAuthCache } from '../helpers/NoOpApiKeyAuthCache';

let app: Express;

beforeAll(() => {
  app = createApp();
  registerRoutes(app, bootstrapForAuthTesting());
});

beforeEach(() => {
  NoOpRefreshTokenStore.clear();
  NoOpApiKeyAuthCache.clear();
});

describe('Auth API Integration Tests', () => {
  // Helper para registar utilizador único por teste
  async function registerUser(suffix: string) {
    const now = Date.now();
    return request(app)
      .post('/api/auth/register')
      .send({
        email: `test-${suffix}-${now}@example.com`,
        password: 'password123',
        name: `Integration Test ${suffix} ${now}`,
      });
  }

  it('should register a new user and return 201 with tokens', async () => {
    const res = await registerUser('reg');

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toMatch(/^rt_/);
    expect(res.body.data.user.email).toContain('@example.com');
    expect(res.body.data.workspace.plan).toBe('free');
  });

  it('should return 409 when registering with duplicate email', async () => {
    const email = `dup-${Date.now()}@example.com`;
    const now = Date.now();
    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', name: `First ${now}` });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', name: `Second ${now + 1}` });

    expect(res.status).toBe(409);
  });

  it('should return 422 when registering with invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'invalid-email',
      password: 'password123',
      name: 'Invalid Email',
    });

    expect(res.status).toBe(422);
  });

  it('should return 422 when registering with password shorter than 8 chars', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `short-pass-${Date.now()}@example.com`,
        password: 'short',
        name: 'Short Pass',
      });

    expect(res.status).toBe(422);
  });

  it('should login with valid credentials and return tokens', async () => {
    const now = Date.now();
    const email = `login-${now}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', name: `Login Test ${now}` });

    const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(email);
  });

  it('should return 401 for wrong password', async () => {
    const now = Date.now();
    const email = `wrong-${now}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', name: `Wrong Test ${now}` });

    const res = await request(app).post('/api/auth/login').send({ email, password: 'wrong' });

    expect(res.status).toBe(401);
  });

  it('should return 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: `missing-${Date.now()}@example.com`,
        password: 'password123',
      });

    expect(res.status).toBe(401);
  });

  it('should rotate refresh token and return new pair', async () => {
    const regRes = await registerUser('refresh');
    const { refreshToken } = regRes.body.data;

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toMatch(/^rt_/);
    expect(res.body.data.refreshToken).not.toBe(refreshToken);
  });

  it('should return 422 when refresh token body is missing', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(422);
  });

  it('should return 200 on GET /api/auth/me with valid JWT', async () => {
    const regRes = await registerUser('me');
    const { accessToken } = regRes.body.data;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBeDefined();
    expect(res.body.data.workspaceId).toBeDefined();
  });

  it('should return 401 when reusing revoked refresh token (reuse detection)', async () => {
    const regRes = await registerUser('reuse');
    const { refreshToken } = regRes.body.data;

    // Primeira rotação - token antigo fica revogado
    await request(app).post('/api/auth/refresh').send({ refreshToken });

    // Reutlizar token antigo - deve falhar
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.error?.message ?? res.body.message).toMatch(/reuse|revoked|invalid/i);
  });

  it('should return 401 on GET /api/auth/me without JWT', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('should return 401 on GET /api/auth/me with malformed JWT', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid-jwt');
    expect(res.status).toBe(401);
  });

  it('should return 401 on refresh with invalid token format', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid-token' });
    expect(res.status).toBe(401);
  });
});
