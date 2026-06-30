/**
 * Funções HTTP para gestão de API keys.
 *
 * Rotas backend (montadas sob dashboardRouter /api):
 * - GET    /api/workspaces/:workspaceId/api-keys  → lista chaves do workspace
 * - POST   /api/workspaces/:workspaceId/api-keys  → cria nova chave (responde plaintextKey)
 * - DELETE /api/api-keys/:id                      → revoga chave por id
 */

import apiClient from '@/api/client';
import type { ApiKey, CreateApiKeyResponse } from '@/types/apiKeys';

export async function fetchApiKeys(workspaceId: string): Promise<ApiKey[]> {
  const response = await apiClient.get<{ data: { apiKeys: ApiKey[] } }>(
    `/api/workspaces/${workspaceId}/api-keys`
  );
  return response.data.data.apiKeys;
}

export async function createApiKey(
  workspaceId: string,
  name: string
): Promise<CreateApiKeyResponse> {
  const response = await apiClient.post<{ data: CreateApiKeyResponse }>(
    `/api/workspaces/${workspaceId}/api-keys`,
    { name }
  );
  return response.data.data;
}

export async function revokeApiKey(apiKeyId: string): Promise<void> {
  await apiClient.delete(`/api/api-keys/${apiKeyId}`);
}
