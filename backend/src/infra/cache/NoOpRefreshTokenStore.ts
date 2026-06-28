/**
 * Implementação in-memory de RefreshTokenStore para testes e dev sem Redis.
 *
 * Não aplica TTL real — tokens persistem até `revoke` ou `NoOpRefreshTokenStore.clear()`.
 * Substituir por RedisRefreshTokenStore em produção via bootstrap.
 */

import type { RefreshTokenStore } from '@application/contracts/gateways';

const store = new Map<string, { userId: string; workspaceId: string }>();
const revokedMarkers = new Map<string, { userId: string }>();
const userTokenIndex = new Map<string, Set<string>>();

function addToUserIndex(userId: string, tokenId: string): void {
  const tokens = userTokenIndex.get(userId) ?? new Set<string>();
  tokens.add(tokenId);
  userTokenIndex.set(userId, tokens);
}

function removeFromUserIndex(userId: string, tokenId: string): void {
  const tokens = userTokenIndex.get(userId);
  if (!tokens) {
    return;
  }
  tokens.delete(tokenId);
  if (tokens.size === 0) {
    userTokenIndex.delete(userId);
  }
}

export class NoOpRefreshTokenStore implements RefreshTokenStore {
  async store(
    tokenId: string,
    payload: { userId: string; workspaceId: string },
    _ttlSeconds: number
  ): Promise<void> {
    store.set(tokenId, payload);
    addToUserIndex(payload.userId, tokenId);
  }

  async get(tokenId: string) {
    return store.get(tokenId) ?? null;
  }

  async revoke(tokenId: string): Promise<void> {
    const payload = store.get(tokenId);
    if (payload) {
      revokedMarkers.set(tokenId, { userId: payload.userId });
      removeFromUserIndex(payload.userId, tokenId);
    }
    store.delete(tokenId);
  }

  async wasRecentlyRevoked(tokenId: string): Promise<boolean> {
    return revokedMarkers.has(tokenId);
  }

  async getRevokedUserId(tokenId: string): Promise<string | null> {
    return revokedMarkers.get(tokenId)?.userId ?? null;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const tokenIds = userTokenIndex.get(userId);
    if (!tokenIds) {
      return;
    }

    for (const tokenId of tokenIds) {
      store.delete(tokenId);
    }
    userTokenIndex.delete(userId);
  }

  /** Limpa todo o store — chamar em `afterEach` de testes de auth. */
  static clear(): void {
    store.clear();
    revokedMarkers.clear();
    userTokenIndex.clear();
  }
}
