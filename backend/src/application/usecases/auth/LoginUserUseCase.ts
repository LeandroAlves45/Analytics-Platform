/**
 * Autentica utilizador com email/password e emite tokens.
 */

import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { UserRepository, WorkspaceRepository } from '@application/contracts/repositories';
import type { RefreshTokenStore } from '@application/contracts/gateways';
import type { LoginInputDTO, AuthTokensOutputDTO } from '@application/dto/AuthDTO';
import { JwtService } from '@infra/services/JwtService';
import { UnauthorizedError, NotFoundError } from '@shared/errors';
import { logger } from '@infra/frameworks/logging';

export class LoginUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly jwtService: JwtService,
    private readonly refreshTokenStore: RefreshTokenStore,
    private readonly refreshTokenTtlSeconds: number
  ) {}

  async execute(input: LoginInputDTO): Promise<AuthTokensOutputDTO> {
    const user = await this.userRepository.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const workspace = await this.workspaceRepository.findByUserId(user.id);
    if (!workspace) {
      throw new NotFoundError('Workspace', user.id, { identifierLabel: 'userId' });
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      workspaceId: workspace.id,
      email: user.email.value,
    });

    const refreshTokenId = randomUUID();
    const refreshToken = `rt_${refreshTokenId}`;
    await this.refreshTokenStore.store(
      refreshTokenId,
      { userId: user.id, workspaceId: workspace.id },
      this.refreshTokenTtlSeconds
    );

    logger.info('user_logged_in', { userId: user.id, workspaceId: workspace.id });

    return {
      accessToken,
      refreshToken,
      expiresIn: '24h',
      user: {
        id: user.id,
        email: user.email.value,
        name: user.name?.trim() ?? '',
        initials: user.getInitials(),
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: workspace.plan,
      },
    };
  }
}
