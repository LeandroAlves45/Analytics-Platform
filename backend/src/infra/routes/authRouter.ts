/**
 * Router de autenticação.
 *
 * Rotas públicas: register, login, refresh.
 * Rota protegida (JWT obrigatório): GET /me.
 *
 * @param controller - AuthController com handlers de autenticação
 * @param jwtAuth    - Middleware JWT aplicado apenas ao endpoint /me
 * @param loginRateLimit    - Rate limit para POST /login
 * @param registerRateLimit - Rate limit para POST /register
 * @param refreshRateLimit  - Rate limit para POST /refresh
 */

import { Router, RequestHandler } from 'express';
import { AuthController } from '@infra/controllers/AuthController';

export function createAuthRouter(
  controller: AuthController,
  jwtAuth: RequestHandler,
  loginRateLimit: RequestHandler,
  registerRateLimit: RequestHandler,
  refreshRateLimit: RequestHandler
): Router {
  const router = Router();

  router.post('/register', registerRateLimit, controller.register);
  router.post('/login', loginRateLimit, controller.login);
  router.post('/refresh', refreshRateLimit, controller.refresh);
  router.get('/me', jwtAuth, controller.me);

  return router;
}
