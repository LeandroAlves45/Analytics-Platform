/**
 * Contratos de entrada/saída para autenticação (register, login, refresh, me).
 */

/** Dados para registo de novo utilizador e workspace inicial. */
export interface RegisterInputDTO {
  /** Email único; validado no controller com zod `.email()`. */
  email: string;
  /** Mínimo 8 caracteres; hash bcrypt no use case. */
  password: string;
  /** Nome de exibição do utilizador. */
  name: string;
  /** Nome do workspace; default: `{name}'s Workspace`. */
  workspaceName?: string;
}

/** Credenciais para login email/password. */
export interface LoginInputDTO {
  email: string;
  password: string;
}

/** Body de POST /api/auth/refresh — refresh token opaco emitido no login/register. */
export interface RefreshTokenInputDTO {
  /** Formato `rt_<uuid>`; o UUID é a chave no Redis, não o valor completo. */
  refreshToken: string;
}

/** Perfil público do utilizador devolvido nas respostas de auth. */
export interface AuthUserOutputDTO {
  id: string;
  email: string;
  name: string;
  initials: string;
}

/** Workspace activo do utilizador no momento da autenticação. */
export interface AuthWorkspaceOutputDTO {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

/**
 * Par de tokens emitido em register/login; parcial em refresh (sem user/workspace).
 *
 * - `accessToken`: JWT stateless — transportar em `Authorization: Bearer <jwt>`.
 * - `refreshToken`: opaco `rt_<uuid>` — transportar no body JSON; armazenado em Redis.
 * - `expiresIn`: duração do access token (ex.: `'24h'`); deve reflectir `JWT_EXPIRES_IN`.
 */
export interface AuthTokensOutputDTO {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: AuthUserOutputDTO;
  workspace: AuthWorkspaceOutputDTO;
}

/**
 * Claims do JWT access token (payload após verificação).
 *
 * `sub` = userId; `workspaceId` = tenant activo; `email` para auditoria/UI.
 */
export interface JwtPayload {
  /** Subject — ID do utilizador. */
  sub: string;
  workspaceId: string;
  email: string;
  iat?: number;
  exp?: number;
}
