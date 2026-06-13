/**
 * Topbar do dashboard —> barra superior fixa com logo, indicador live,
 * seletores de intervalo e avatar do utilizador.
 *
 * Os seletores de intervalo estão ligados directamente ao Zustand store.
 * Quando o utilizador clica em "5m", "1h" ou "1d", o store atualiza
 * o intervalo e o from/to, e os hooks React Query reagem automaticamente.
 */

import { useDashboardStore } from '@/stores/dashboardStore';
import { cn } from '@/lib/utils';
import type { AggregationInterval } from '@/types/metrics';

/**
 * Configuração dos chips de intervalo
 */
const INTERVAL_OPTIONS: { value: AggregationInterval; label: string }[] = [
  { value: '5m', label: '5m' },
  { value: '1h', label: '1h' },
  { value: '1d', label: '1d' },
];

/**
 * SVG do logo extraído do design system —> barras + linha de tendência
 * com o gradiente de marca (purple → blue → orange)
 */
function LogoIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <defs>
        <linearGradient
          id="logo-gradient"
          x1="0"
          y1="26"
          x2="26"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#7055cc" />
          <stop offset="50%" stopColor="#5bbcf7" />
          <stop offset="100%" stopColor="#f97a4a" />
        </linearGradient>
      </defs>

      {/* Três barras com alturas crescentes —> representam dados de série temporal */}
      <rect x="3" y="10" width="5" height="13" rx="1.5" fill="url(#logo-gradient)" opacity="0.7" />
      <rect x="10" y="6" width="5" height="17" rx="1.5" fill="url(#logo-gradient)" opacity="0.85" />
      <rect x="17" y="2" width="5" height="21" rx="1.5" fill="url(#logo-gradient)" />

      {/* Linha de tendência -> o "insight" por cima dos dados brutos */}
      <path d="M4 20 L13 10 L22 4" stroke="#f97a4a" strokeWidth="1.5" fill="none" opacity="0.9" />
    </svg>
  );
}

export function TopBar() {
  // Lê o intervalo ativo e a ação atualizados do store
  const { interval, setInterval } = useDashboardStore();

  return (
    <header
      className="
        flex items-center justify-between
        h-[52px] px-5
        bg-app
        border-b border-border-default
        flex-shrink-0
      "
    >
      {/* ── Lado esquerdo: logo ── */}
      <div className="flex items-center gap-2.5">
        <LogoIcon />

        {/* Texto "ANALYTICS" com gradiente de marca via classe CSS utility */}
        <span className="text-md font-semibold tracking-tight text-gradient">ANALYTICS</span>

        {/* "Platform" em texto muito subtil —> hierarquia visual do nome do produto */}
        <span className="text-xs text-faint font-normal">Platform</span>
      </div>

      {/* ── Lado direito: controlos ── */}
      <div className="flex items-center gap-3">
        {/* Indicador live: dot verde pulsante + label */}
        {/* O box-shadow cria o efeito de glow —> não existe token Tailwind para isso */}
        <div className="flex items-center gap-1.5">
          <span
            className="block w-1.5 h-1.5 rounded-full bg-success animate-pulse"
            style={{ boxShadow: '0 0 6px rgba(61, 214, 140, 0.6)' }}
            aria-label="sistema activo"
          />
          <span className="text-xs text-success font-medium">Live</span>
        </div>

        {/* Seletores de intervalo —> chips que atualizam o Zustand store */}
        <div className="flex items-center gap-1" role="group" aria-label="Intervalo de agregação">
          {INTERVAL_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setInterval(value)}
              aria-pressed={interval === value}
              className={cn(
                // Base: dimensões e tipografia iguais em todos os chips
                'px-2.5 py-1 rounded-sm text-[11px] border transition-colors duration-150',
                // Estado ativo: borda e fundo azul subtil
                interval === value
                  ? 'border-blue/40 bg-blue/10 text-blue'
                  : // Estado inativo: apenas borda subtil
                    'border-border-default bg-transparent text-label hover:bg-surface-card hover:text-copy'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Avatar do utilizador — gradiente de marca como fundo */}
        {/* TODO: Sprint 6 vai substituir "LA" por iniciais do JWT */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white select-none"
          style={{ background: 'linear-gradient(135deg, #9b7fe8, #5bbcf7)' }}
          aria-label="Utilizador: Leandro Alves"
        >
          LA
        </div>
      </div>
    </header>
  );
}
