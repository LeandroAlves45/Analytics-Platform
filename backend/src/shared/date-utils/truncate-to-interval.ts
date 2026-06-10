/**
 * Trunca um Date para o início do intervalo de agregação.
 *
 * Exemplos:
 *   truncateToInterval(14:07:33, 5)    → 14:05:00
 *   truncateToInterval(14:07:33, 60)   → 14:00:00
 *   truncateToInterval(14:07:33, 1440) → 00:00:00 (início do dia)
 */
export function truncateToInterval(date: Date, intervalMinutes: number): Date {
  const ms = date.getTime();
  const intervalMs = intervalMinutes * 60 * 1_000;
  return new Date(Math.floor(ms / intervalMs) * intervalMs);
}
