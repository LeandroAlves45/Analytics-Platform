/**
 * Testes unitários do helper extractBearerToken.
 * Cobre: header válido, ausente, esquema errado, Bearer vazio e lowercase.
 */

import { extractBearerToken } from '@infra/middleware/extractBearerToken';
import { UnauthorizedError } from '@shared/errors';

/** Cria um Request simulado com o header Authorization dado*/
function makeRequest(authorization?: string) {
  return {
    headers: authorization !== undefined ? { authorization } : {},
  } as never;
}

describe('extractBearerToken', () => {
  it('should return the token when Authorization header is valid', () => {
    const token = extractBearerToken(makeRequest('Bearer apk_test123'));
    expect(token).toBe('apk_test123');
  });

  it('should throw UnauthorizedError when Authorization header is absent', () => {
    expect(() => extractBearerToken(makeRequest(''))).toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when scheme is not Bearer', () => {
    expect(() => extractBearerToken(makeRequest('Basic dXN1cjpwYXNz'))).toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when Bearer token is empty', () => {
    expect(() => extractBearerToken(makeRequest('Bearer '))).toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when Bearer keyword is lowercase', () => {
    // Axios envia sempre "Bearer" com B maiúsculo — header case-insensitive é tratado pelo Express,
    // mas o token em si deve ter o formato correcto
    expect(() => extractBearerToken(makeRequest('bearer token123'))).toThrow(UnauthorizedError);
  });
});
