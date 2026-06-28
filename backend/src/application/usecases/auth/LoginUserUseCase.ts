/**
 * Autentica utilizador com email/password e emite par access + refresh token.
 *
 * Side-effects: grava refresh token em Redis; log `user_logged_in`.
 */

import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { UserRepository, WorkspaceRepository } from '@application/contracts/repositories';
import type { RefreshTokenStore } from '@application/contracts/gateways';
import type { LoginInputDTO, AuthTokensOutputDTO } from '@application/dto/AuthDTO';
import { JwtService } from '@infra/services/JwtService';
import { UnauthorizedError, NotFoundError } from '@shared/errors';
import { logger } from '@infra/frameworks/logging';
import { assertActiveUser } from './assertActiveUser';

export class LoginUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly jwtService: JwtService,
    private readonly refreshTokenStore: RefreshTokenStore,
    private readonly refreshTokenTtlSeconds: number,
    private readonly jwtExpiresIn: string
  ) {}

  /**
   * Valida credenciais e devolve tokens + perfil user/workspace.
   *
   * @param input - Email e password em plaintext (hash comparado com bcrypt).
   * @returns Par JWT + refresh opaco + metadados user/workspace.
   * @throws {UnauthorizedError} Email inexistente ou password incorrecta (mensagem genérica).
   * @throws {NotFoundError} Utilizador sem workspace associado.
   */
  async execute(input: LoginInputDTO): Promise<AuthTokensOutputDTO> {
    const user = await this.userRepository.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    assertActiveUser(user);

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
      expiresIn: this.jwtExpiresIn,
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
