/**
 * DTOs para gestão de workspaces e API keys.
 */

export interface CreateApiKeyInputDTO {
  workspaceId: string;
  userId: string;
  name: string;
}

export interface ApiKeyOutputDTO {
  id: string;
  workspaceId: string;
  name: string;
  keyPreview: string;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

/** Resposta única na criação — inclui plaintext key. */
export interface CreateApiKeyOutputDTO extends ApiKeyOutputDTO {
  plaintextKey: string;
}

export interface ListApiKeysInputDTO {
  workspaceId: string;
  userId: string;
}

export interface RevokeApiKeyInputDTO {
  apiKeyId: string;
  workspaceId: string;
  userId: string;
}
