/**
 * Regex de validação UUID v1–v5 (RFC 4122).
 *
 * Cobre os formatos gerados por `crypto.randomUUID()` (v4) e pela maioria das libs.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Verifica se uma string é um UUID válido (v1–v5, RFC 4122).
 *
 * Defensiva: retorna false para null/undefined/non-string em vez de lançar erro.
 * Isto previne crashes em sites de chamada que casteiem ou ignorem type safety.
 *
 * @param value - A string a validar (defensivamente também aceita non-string)
 * @returns `true` se for uma string UUID válida, `false` caso contrário
 *
 * @example
 * isValidUuid('550e8400-e29b-41d4-a716-446655440000') // true  — válido
 * isValidUuid('ws-550e8400-e29b-41d4-a716-446655440000') // false — tem prefixo
 * isValidUuid('req-123') // false — não é UUID
 * isValidUuid('') // false — vazio
 * isValidUuid(null as any) // false — defensiva contra non-string
 * isValidUuid(undefined as any) // false — defensiva contra non-string
 */
export function isValidUuid(value: string): boolean {
  // Defensiva: se value não é string, retorna false em vez de lançar TypeError.
  // Isto protege contra chamadas de sites que bypassed type safety via casting.
  if (typeof value !== 'string') {
    return false;
  }
  return UUID_REGEX.test(value);
}
