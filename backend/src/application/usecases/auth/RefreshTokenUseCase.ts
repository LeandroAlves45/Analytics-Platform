/**
 * Rotação de refresh token — invalida antigo, emite novo par.
 */

import { randomUUID } from 'node:crypto';
import type { UserRepository } from '@application/contracts/repositories';
import type { RefreshTokenStore } from '@application/contracts/gateways';
import type { RefreshTokenInputDTO, AuthTokensOutputDTO } from '@application/dto/AuthDTO';
import { JwtService } from '@infra/services/JwtService';
import { UnauthorizedError } from '@shared/errors';
import { logger } from '@infra/frameworks/logging';

export class RefreshTokenUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly refreshTokenStore: RefreshTokenStore,
    private readonly refreshTokenTtlSeconds: number
  ) {}

  async execute(
    input: RefreshTokenInputDTO
  ): Promise<Omit<AuthTokensOutputDTO, 'user' | 'workspace'>> {
    if (!input.refreshToken.startsWith('rt_')) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const tokenId = input.refreshToken.slice(3);
    const stored = await this.refreshTokenStore.get(tokenId);
    if (!stored) {
      throw new UnauthorizedError('Refresh token expired or revoked');
    }

    const user = await this.userRepository.findById(stored.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Rotação: Invalida token antigo antes de emitir novo
    await this.refreshTokenStore.revoke(tokenId);

    const accessToken = this.jwtService.sign({
      sub: user.id,
      workspaceId: stored.workspaceId,
      email: user.email.value,
    });

    const newTokenId = randomUUID();
    const refreshToken = `rt_${newTokenId}`;
    await this.refreshTokenStore.store(newTokenId, stored, this.refreshTokenTtlSeconds);

    logger.info('refresh_token_refreshed', { userId: user.id, workspaceId: stored.workspaceId });

    return {
      accessToken,
      refreshToken,
      expiresIn: '24h',
    };
  }
}
