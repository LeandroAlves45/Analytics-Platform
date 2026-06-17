/**
 * Sidebar do dashboard — navegação lateral com ícones.
 * Largura fixa de 52px: icon-only, sem labels.
 * NavLink activa estado visual purple sem lógica manual de `active`.
 *
 * NavItem.to: presente → NavLink com routing activo.
 * NavItem.sprint: presente → item desativado com tooltip "Label → Sprint N".
 * Itens sem to e sem sprint são spans estáticos sem acção (estado futuro não planeado).
 *
 * end: true no Dashboard evita match parcial quando a rota começa por "/".
 * Alerts não usa end: true —> fica activo em /alerts e /alerts/events (sub-rota da secção).
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BarChart2, Activity, Bell, Key, Settings } from 'lucide-react';

/**
 * Definição dos itens de navegação.
 */
interface NavItem {
  icon: React.ElementType;
  label: string;
  /** Rota para NavLink. Ausente em itens desactivados ou sem rota definida. */
  to?: string;
  sprint?: number;
  /** Passa end ao NavLink para evitar match parcial (necessário para "/"). */
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: BarChart2, label: 'Dashboard', to: '/', end: true },
  { icon: Activity, label: 'Endpoints', sprint: 4 },
  { icon: Bell, label: 'Alerts', to: '/alerts' },
  { icon: Key, label: 'API Keys', sprint: 6 },
];

const BOTTOM_ITEMS: NavItem[] = [{ icon: Settings, label: 'Settings', sprint: 6 }];

/**
 * Constrói as classes do botão de navegação conforme o estado activo e desactivado.
 * Extraído para função pura para reutilização entre NavLink e span.
 */
function navLinkClassName(isActive: boolean, isDisabled: boolean): string {
  return cn(
    'w-[34px] h-[34px] rounded flex items-center justify-center',
    'transition-colors duration-150',
    isActive && 'bg-purple/15 text-purple',
    !isActive && !isDisabled && 'text-faint hover:bg-surface-card hover:text-label',
    isDisabled && 'text-faint/40 cursor-not-allowed opacity-40 pointer-events-none'
  );
}

/**
 * Botão individual da sidebar.
 * Renderiza NavLink quando to está definido; span desactivado quando sprint está definido.
 */
function NavButton({ icon: Icon, label, to, sprint, end }: NavItem) {
  const isDisabled = Boolean(sprint);

  if (to && !isDisabled) {
    return (
      <NavLink
        to={to}
        end={end}
        title={label}
        aria-label={label}
        className={({ isActive }) => navLinkClassName(isActive, isDisabled)}
      >
        <Icon size={15} strokeWidth={1.8} />
      </NavLink>
    );
  }

  return (
    <span
      title={sprint ? `${label} → Sprint ${sprint}` : label}
      aria-label={label}
      aria-disabled={isDisabled}
      className={navLinkClassName(false, isDisabled)}
    >
      <Icon size={15} strokeWidth={1.8} />
    </span>
  );
}

export function Sidebar() {
  return (
    <aside
      className="
        w-[52px] flex-shrink-0
        bg-sidebar
        border-r border-border-default
        flex flex-col items-center
        py-3 gap-1
      "
      aria-label="Navegação principal"
    >
      {/* Itens de navegação principais —> topo da sidebar */}
      <nav className="flex flex-col items-center gap-1 w-full px-[9px]">
        {NAV_ITEMS.map((item) => (
          <NavButton key={item.label} {...item} />
        ))}
      </nav>

      {/* Espaço que empurra os itens de baixo para o fundo */}
      <div className="flex-1" />

      {/* Itens de navegação secundários —> fundo da sidebar */}
      <div className="flex flex-col items-center gap-1 w-full px-[9px]">
        {BOTTOM_ITEMS.map((item) => (
          <NavButton key={item.label} {...item} />
        ))}
      </div>
    </aside>
  );
}
