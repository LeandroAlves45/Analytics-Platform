/**
 * Contratos TypeScript para autenticação.
 *
 * httpOnly cookie:
 * refreshToken removido de AuthTokensResponse — o backend envia-o via Set-Cookie httpOnly,
 * nunca no corpo da resposta. O JS nunca tem acesso ao refresh token.
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  initials: string;
}

export interface AuthWorkspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export interface AuthTokensResponse {
  accessToken: string;
  expiresIn: string;
  user: AuthUser;
  workspace: AuthWorkspace;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  workspaceName?: string;
}

export interface MeResponse {
  user: AuthUser;
  workspaceId: string;
}
