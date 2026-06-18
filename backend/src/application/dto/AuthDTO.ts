/**
 * DTOs para autenticação — register, login, refresh, me.
 */

export interface RegisterInputDTO {
  email: string;
  password: string;
  name: string;
  workspaceName?: string;
}

export interface LoginInputDTO {
  email: string;
  password: string;
}

export interface RefreshTokenInputDTO {
  refreshToken: string;
}

export interface AuthUserOutputDTO {
  id: string;
  email: string;
  name: string;
  initials: string;
}

export interface AuthWorkspaceOutputDTO {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export interface AuthTokenOutputDTO {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: AuthUserOutputDTO;
  workspace: AuthWorkspaceOutputDTO;
}

export interface JwtPayload {
  sub: string;
  workspaceId: string;
  email: string;
  iat?: number;
  exp?: number;
}
