/**
 * Emissão centralizada de par access (JWT) + refresh (opaco Redis).
 */

import { randomUUID } from 'node:crypto';
import type { RefreshTokenStore } from '@application/contracts/gateways';
import type { JwtService } from '@infra/services/JwtService';

export interface IssuedTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export class AuthTokenIssuer {
  constructor(
    private readonly jwtService: JwtService,
    private readonly refreshTokenStore: RefreshTokenStore,
    private readonly refreshTokenTtlSeconds: number,
    private readonly jwtExpiresIn: string
  ) {}

  async issue(params: {
    userId: string;
    workspaceId: string;
    email: string;
  }): Promise<IssuedTokenPair> {
    const accessToken = this.jwtService.sign({
      sub: params.userId,
      workspaceId: params.workspaceId,
      email: params.email,
    });

    const refreshTokenId = randomUUID();
    const refreshToken = `rt_${refreshTokenId}`;
    await this.refreshTokenStore.store(
      refreshTokenId,
      { userId: params.userId, workspaceId: params.workspaceId },
      this.refreshTokenTtlSeconds
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtExpiresIn,
    };
  }

  /**
   * Rotação: emite novo par e revoga o token antigo (store-before-revoke).
   */
  async rotate(params: {
    oldTokenId: string;
    userId: string;
    workspaceId: string;
    email: string;
  }): Promise<IssuedTokenPair> {
    const pair = await this.issue({
      userId: params.userId,
      workspaceId: params.workspaceId,
      email: params.email,
    });

    // issue() já fez store do novo token — só falta revogar o antigo
    await this.refreshTokenStore.revoke(params.oldTokenId);

    return pair;
  }
}
