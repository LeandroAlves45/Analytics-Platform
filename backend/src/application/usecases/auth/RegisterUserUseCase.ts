/**
 * Regista utilizador, cria workspace default e emite tokens.
 */

import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { User } from '@domain/entities/User';
import { Workspace } from '@domain/entities/Workspace';
import type { UserRepository, WorkspaceRepository } from '@application/contracts/repositories';
import type { RefreshTokenStore } from '@application/contracts/gateways';
import type { RegisterInputDTO, AuthTokensOutputDTO } from '@application/dto/AuthDTO';
import { JwtService } from '@infra/services/JwtService';
import { ConflictError } from '@shared/errors';
import { logger } from '@infra/frameworks/logging';

/** Rounds para hash de passwords */
const BCRYPT_ROUNDS = 12;
export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly jwtService: JwtService,
    private readonly refreshTokenStore: RefreshTokenStore,
    private readonly refreshTokenTtlSeconds: number
  ) {}

  async execute(input: RegisterInputDTO): Promise<AuthTokensOutputDTO> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = new User({ email: input.email, passwordHash, name: input.name });
    const savedUser = await this.userRepository.save(user);

    const workspaceName = input.workspaceName ?? `${input.name}'s Workspace`;
    const slug = Workspace.slugFromName(workspaceName);
    const workspace = new Workspace({
      userId: savedUser.id,
      name: workspaceName,
      slug,
      plan: 'free',
    });
    const savedWorkspace = await this.workspaceRepository.save(workspace);
    await this.workspaceRepository.addMember(savedWorkspace.id, savedUser.id, 'owner');

    const accessToken = this.jwtService.sign({
      sub: savedUser.id,
      workspaceId: savedWorkspace.id,
      email: savedUser.email,
    });

    const refreshTokenId = randomUUID();
    const refreshToken = `rt_${refreshTokenId}`;
    await this.refreshTokenStore.store(
      refreshTokenId,
      { userId: savedUser.id, workspaceId: savedWorkspace.id },
      this.refreshTokenTtlSeconds
    );

    logger.info('user_registered', { userId: savedUser.id, workspaceId: savedWorkspace.id });

    const hydratedUser = User.reconstitute({
      id: savedUser.id,
      email: savedUser.email,
      name: savedUser.name,
      passwordHash,
      emailVerified: false,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: '24h',
      user: {
        id: savedUser.id,
        email: savedUser.email,
        name: savedUser.name ?? '',
        initials: hydratedUser.getInitials(),
      },
      workspace: savedWorkspace,
    };
  }
}
