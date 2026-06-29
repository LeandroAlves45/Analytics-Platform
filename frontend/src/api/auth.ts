/**
 * Funções HTTP para autenticação.
 *
 * httpOnly cookie:
 * refreshAccessToken não recebe argumento — o cookie é enviado automaticamente pelo browser.
 * O backend responde apenas com accessToken (refreshToken nunca no body).
 */

import apiClient from '@/api/client';
import type { AuthTokensResponse, LoginInput, RegisterInput, MeResponse } from '@/types/auth';

/**
 * POST /api/auth/register — cria conta e workspace.
 *
 * @returns 201 `{ data: { accessToken, expiresIn, user, workspace } }` — sem refreshToken.
 * @returns Set-Cookie refreshToken httpOnly.
 */
export async function registerUser(input: RegisterInput): Promise<AuthTokensResponse> {
  const response = await apiClient.post<{ data: AuthTokensResponse }>('/api/auth/register', input);
  return response.data.data;
}

/**
 * POST /api/auth/login — autenticação email/password.
 *
 * @returns 200 `{ data: { accessToken, expiresIn, user, workspace } }` — sem refreshToken.
 * @returns Set-Cookie refreshToken httpOnly.
 */
export async function loginUser(input: LoginInput): Promise<AuthTokensResponse> {
  const response = await apiClient.post<{ data: AuthTokensResponse }>('/api/auth/login', input);
  return response.data.data;
}

/** Troca o cookie httpOnly de refresh por novo access token. Sem argumento -> cookie vai automaticamente.*/
export async function refreshAccessToken(): Promise<{ accessToken: string; expiresIn: string }> {
  const response = await apiClient.post<{ data: { accessToken: string; expiresIn: string } }>(
    '/api/auth/refresh'
  );
  return response.data.data;
}

/** POST /api/auth/logout — revoga token no Redis e limpa cookie httpOnly. */
export async function logoutUser(): Promise<void> {
  await apiClient.post('/api/auth/logout');
}

/** GET /api/auth/me — verifica autenticação e devolve user/workspace. */
export async function getMe(): Promise<MeResponse> {
  const response = await apiClient.get<{ data: MeResponse }>('/api/auth/me');
  return response.data.data;
}
