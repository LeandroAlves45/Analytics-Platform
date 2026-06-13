/**
 * Sidebar do dashboard — navegação lateral com ícones.
 * Largura fixa de 52px: icon-only, sem labels.
 * Mantém o foco visual na área de conteúdo principal.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, Activity, Bell, Key, Settings } from 'lucide-react';

/**
 * Definição dos itens de navegação.
 */
interface NavItem {
  icon: React.ElementType;
  label: string;
  sprint?: number;
  active?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: BarChart2, label: 'Dashboard', active: true },
  { icon: Activity, label: 'Endpoints' },
  { icon: Bell, label: 'Alerts', sprint: 5 },
  { icon: Key, label: 'API Keys', sprint: 6 },
];

const BOTTOM_ITEMS: NavItem[] = [{ icon: Settings, label: 'Settings' }];

/**
 * NavButton -> botão individual da sidebar.
 * Quando o item tem sprint futuro, mostra tooltip "Sprint N" e desabilita o clique
 */
function NavButton({ icon: Icon, label, sprint, active }: NavItem) {
  const isDisabled = !!sprint;

  return (
    <button
      disabled={isDisabled}
      title={sprint ? `${label} -> Sprint ${sprint}` : label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // Base: dimensões e border radius definidos no design system
        'w-[34px] h-[34px] rounded flex items-center justify-center',
        'transition-colors duration-150',
        // Estado ativo: fundo purple muito subtil + ícone purple
        active && 'bg-purple/15 text-purple',
        // Estado normal: ícone faint, hover com fundo subtil
        !active && !isDisabled && 'text-faint hover:bg-surface-card hover:text-label',
        // Estado desabilitado (sprint futuro): opacidade reduzida
        isDisabled && 'text-faint/40 cursor-not-allowed opacity-40'
      )}
    >
      <Icon size={15} strokeWidth={1.8} />
    </button>
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
