/**
 * Emissão e verificação de JWT access tokens.
 */

import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Config } from '@infra/frameworks/config';
import type { JwtPayload } from '@application/dto/AuthDTO';
import { UnauthorizedError } from '@shared/errors';

export class JwtService {
  constructor(private readonly config: Config) {}

  /**
   * Assina um access token JWT com os claims de sessão.
   *
   * @param payload - Claims sem `iat`/`exp` (adicionados pelo jsonwebtoken).
   * @returns JWT string para header `Authorization: Bearer`.
   */
  sign(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    const options: SignOptions = {
      expiresIn: this.config.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    };
    return jwt.sign(payload, this.config.JWT_SECRET, options);
  }

  /**
   * Verifica assinatura e expiração do access token.
   *
   * @param token - JWT raw (sem prefixo `Bearer`).
   * @returns Payload tipado com `sub`, `workspaceId`, `email`.
   * @throws {UnauthorizedError} Token inválido, expirado ou secret incorrecto.
   */
  verify(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.config.JWT_SECRET) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}
