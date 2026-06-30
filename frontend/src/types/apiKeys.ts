/**
 * Contratos TypeScript para API keys.
 */

export interface ApiKey {
  id: string;
  workspaceId: string;
  name: string;
  keyPreview: string;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyResponse extends ApiKey {
  plaintextKey: string;
}
