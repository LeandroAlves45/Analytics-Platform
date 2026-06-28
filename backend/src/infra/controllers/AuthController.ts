/**
 * HTTP handlers de autenticação — validação Zod na fronteira; lógica nos use cases.
 *
 * Todas as respostas de sucesso usam envelope `{ data: ... }`.
 * Erros de validação: 422 com `formatValidationError`. Erros de domínio via `next(error)`.
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { RegisterUserUseCase } from '@application/usecases/auth/RegisterUserUseCase';
import { LoginUserUseCase } from '@application/usecases/auth/LoginUserUseCase';
import { RefreshTokenUseCase } from '@application/usecases/auth/RefreshTokenUseCase';
import type { UserRepository } from '@application/contracts/repositories';
import type { AuthenticatedRequest } from './authenticatedRequest';
import { resolveDashboardContext } from './resolveTenantContext';
import { formatValidationError } from './formatValidationError';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  workspaceName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly userRepository: UserRepository
  ) {}

  /**
   * POST /api/auth/register — cria conta e workspace.
   *
   * @returns 201 `{ data: AuthTokensOutputDTO }` — accessToken, refreshToken, user, workspace.
   * @returns 422 body inválido.
   * @throws via next — ConflictError (409) se email duplicado.
   */
  register = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const parsed = registerSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(422).json(formatValidationError(parsed.error));
      return;
    }

    try {
      const result = await this.registerUserUseCase.execute(parsed.data);
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/login — autenticação email/password.
   *
   * @returns 200 `{ data: AuthTokensOutputDTO }`.
   * @returns 422 body inválido.
   * @throws via next — UnauthorizedError (401) credenciais incorrectas.
   */
  login = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(422).json(formatValidationError(parsed.error));
      return;
    }

    try {
      const result = await this.loginUserUseCase.execute(parsed.data);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/refresh — rotação de refresh token.
   *
   * Body: `{ refreshToken: "rt_<uuid>" }`.
   *
   * @returns 200 `{ data: { accessToken, refreshToken, expiresIn } }` (sem user/workspace).
   * @returns 422 body inválido.
   * @throws via next — UnauthorizedError (401) token inválido ou expirado.
   */
  refresh = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const parsed = refreshSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(422).json(formatValidationError(parsed.error));
      return;
    }

    try {
      const result = await this.refreshTokenUseCase.execute(parsed.data);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/auth/me — perfil do utilizador autenticado (requer JWT no router).
   *
   * @returns 200 `{ data: { user, workspaceId } }`.
   * @returns 404 se userId do JWT não existir na BD.
   * @throws via next — UnauthorizedError (401) sem JWT válido.
   */
  me = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, workspaceId } = resolveDashboardContext(req);
      const user = await this.userRepository.findById(userId);
      if (!user) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
        return;
      }

      res.status(200).json({
        data: {
          user: {
            id: user.id,
            email: user.email.value,
            name: user.name,
            initials: user.getInitials(),
          },
          workspaceId,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
