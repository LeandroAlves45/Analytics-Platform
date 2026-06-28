/**
 * Rotação de refresh token — invalida o antigo e emite novo par access + refresh.
 *
 * O refresh token é opaco (`rt_<uuid>`); apenas o UUID é chave no Redis.
 * Resposta intencionalmente sem `user`/`workspace` — cliente já os possui.
 */

import { randomUUID } from 'node:crypto';
import type { UserRepository } from '@application/contracts/repositories';
import type { RefreshTokenStore } from '@application/contracts/gateways';
import type { RefreshTokenInputDTO, AuthTokensOutputDTO } from '@application/dto/AuthDTO';
import { JwtService } from '@infra/services/JwtService';
import { UnauthorizedError } from '@shared/errors';
import { logger } from '@infra/frameworks/logging';
import { assertActiveUser } from './assertActiveUser';

export class RefreshTokenUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly refreshTokenStore: RefreshTokenStore,
    private readonly refreshTokenTtlSeconds: number,
    private readonly jwtExpiresIn: string
  ) {}

  /**
   * Troca refresh token válido por novo par (rotação one-time use).
   *
   * @param input - `refreshToken` com prefixo `rt_`.
   * @returns Novo accessToken + refreshToken + expiresIn (sem user/workspace).
   * @throws {UnauthorizedError} Formato inválido, token expirado/revogado ou user inexistente.
   */
  async execute(
    input: RefreshTokenInputDTO
  ): Promise<Omit<AuthTokensOutputDTO, 'user' | 'workspace'>> {
    if (!input.refreshToken.startsWith('rt_')) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const tokenId = input.refreshToken.slice(3);
    const stored = await this.refreshTokenStore.get(tokenId);
    if (!stored) {
      if (await this.refreshTokenStore.wasRecentlyRevoked(tokenId)) {
        const userId = await this.refreshTokenStore.getRevokedUserId(tokenId);
        if (userId) {
          await this.refreshTokenStore.revokeAllForUser(userId);
          logger.warn('refresh_token_reuse_detected', { tokenId, userId });
        }
        throw new UnauthorizedError('Session invalidated due to token reuse');
      }
      throw new UnauthorizedError('Refresh token expired or revoked');
    }

    const user = await this.userRepository.findById(stored.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    assertActiveUser(user);

    const accessToken = this.jwtService.sign({
      sub: user.id,
      workspaceId: stored.workspaceId,
      email: user.email.value,
    });

    const newTokenId = randomUUID();
    const refreshToken = `rt_${newTokenId}`;

    // Store-before-revoke: se store falhar, token antigo permanece válido
    await this.refreshTokenStore.store(newTokenId, stored, this.refreshTokenTtlSeconds);
    await this.refreshTokenStore.revoke(tokenId);

    logger.info('refresh_token_refreshed', { userId: user.id, workspaceId: stored.workspaceId });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtExpiresIn,
    };
  }
}
