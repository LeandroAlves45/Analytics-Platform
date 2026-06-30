/**
 * HTTP handlers de autenticação — validação Zod na fronteira; lógica nos use cases.
 *
 * Migração httpOnly cookie:
 * - login/register definem cookie refreshToken em Set-Cookie (httpOnly, SameSite=Strict)
 * - refresh lê cookie em vez do body — sem refreshToken no body de resposta
 * - logout revoga token no Redis e limpa cookie — não requer JWT
 * - Corpo de resposta nunca inclui refreshToken
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { RegisterUserUseCase } from '@application/usecases/auth/RegisterUserUseCase';
import { LoginUserUseCase } from '@application/usecases/auth/LoginUserUseCase';
import { RefreshTokenUseCase } from '@application/usecases/auth/RefreshTokenUseCase';
import type { UserRepository } from '@application/contracts/repositories';
import type { RefreshTokenStore } from '@application/contracts/gateways';
import type { AuthenticatedRequest } from './authenticatedRequest';
import { resolveDashboardContext } from './resolveTenantContext';
import { formatValidationError } from './formatValidationError';
import { UnauthorizedError } from '@shared/errors';

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

/** Opções partilhadas do cookie de refresh token. */
function refreshCookieOptions(ttlSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/auth',
    maxAge: ttlSeconds * 1000,
  };
}

export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly userRepository: UserRepository,
    private readonly refreshTokenStore: RefreshTokenStore,
    private readonly refreshTokenTtlSeconds: number
  ) {}

  /**
   * POST /api/auth/register — cria conta e workspace.
   *
   * @returns 201 `{ data: { accessToken, expiresIn, user, workspace } }` — sem refreshToken.
   * @returns Set-Cookie refreshToken httpOnly.
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
      res.cookie(
        'refreshToken',
        result.refreshToken,
        refreshCookieOptions(this.refreshTokenTtlSeconds)
      );
      res.status(201).json({
        data: {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
          user: result.user,
          workspace: result.workspace,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/login — autenticação email/password.
   *
   * @returns 200 `{ data: { accessToken, expiresIn, user, workspace } }` — sem refreshToken.
   * @returns Set-Cookie refreshToken httpOnly.
   */
  login = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(422).json(formatValidationError(parsed.error));
      return;
    }

    try {
      const result = await this.loginUserUseCase.execute(parsed.data);
      res.cookie(
        'refreshToken',
        result.refreshToken,
        refreshCookieOptions(this.refreshTokenTtlSeconds)
      );
      res.status(200).json({
        data: {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
          user: result.user,
          workspace: result.workspace,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/refresh — rotação via httpOnly cookie.
   *
   * Lê o refresh token do cookie — sem body necessário.
   *
   * @returns 200 `{ data: { accessToken, expiresIn } }`.
   * @returns Set-Cookie com token rotado.
   * @throws 401 se cookie ausente, token inválido ou expirado.
   */
  refresh = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const cookies = req.cookies;
    const refreshToken = cookies?.refreshToken;

    if (!refreshToken?.startsWith('rt_')) {
      next(new UnauthorizedError('Refresh token not found'));
      return;
    }

    try {
      const result = await this.refreshTokenUseCase.execute({ refreshToken });
      res.cookie(
        'refreshToken',
        result.refreshToken,
        refreshCookieOptions(this.refreshTokenTtlSeconds)
      );
      res.status(200).json({
        data: {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/logout — revoga refresh token e limpa cookie.
   *
   * Não requer JWT — lê o cookie directamente.
   * Idempotente: sem cookie → 204 sem erro.
   *
   * @returns 204 No Content.
   */
  logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cookies = req.cookies;
      const refreshToken = cookies?.refreshToken;

      if (refreshToken?.startsWith('rt_')) {
        const tokenId = refreshToken.slice(3);
        await this.refreshTokenStore.revoke(tokenId);
      }

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        path: '/api/auth',
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/auth/me — perfil do utilizador autenticado (requer JWT no router).
   *
   * @returns 200 `{ data: { user, workspaceId } }`.
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
