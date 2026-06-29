/**
 * TODO: Implementar JSDoc
 *
 *
 *import { jwtDecode } from 'jwt-decode';
 *
 *interface JwtClaims {
 *exp: number;
  *sub: string;
  *workspaceId: string;
  *email: string;
*}

 *Verifica se o access token está expirado (com margem de 30s)
function isTokenExpired(token: string): boolean {
  try {
    const { exp } = jwtDecode<JwtClaims>(token);
    // Margem de 30s para evitar rece condition entre validação e request
    return Date.now() / 1000 > exp - 30;
  } catch {
    return true;
  }
}
*/
