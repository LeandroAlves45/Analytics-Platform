/**
 * Componente Badge — usado para method badges (GET, POST, PUT, DELETE),
 * contadores de endpoints activos, e labels de estado.
 * CVA gere as variantes de cor sem condicionais manuais.
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-badge px-1.5 py-0.5 text-[9px] font-medium font-mono transition-colors',
  {
    variants: {
      variant: {
        // Method badges -> cores semânticas por método HTTP
        // GET: verde (operação segura, sem side effects)
        get: 'bg-sucess/12 text-sucess',

        // POST: azul (criação de recursos)
        post: 'bg-blue/12 text-blue',

        // PUT/PATCH: laranja (atualização de recursos)
        put: 'bg-orange/12 text-orange',

        // DELETE: vermelho (remoção de recursos)
        delete: 'bg-danger/12 text-danger',

        // Badge de contagem -> ex: "8 active"
        count: 'bg-purple/15 text-purple rounded-sm text-[10px] font-sans font-medium px-2 py-0.5',

        // Badge de status — ex: "Live", "Degraded"
        success: 'bg-sucess/12 text-sucess rounded-sm text-[10px] font-sans font-sans',

        warning: 'bg-orange/12 text-orange rounded-sm text-[10px] font-sans font-sans',

        danger: 'bg-danger/12 text-danger rounded-sm text-[10px] font-sans font-sans',

        // Badge de intervalo ativo nos filtros do dashboard
        active:
          'border border-blue/40 bg-blue/8 text-blue text-[11px] font-sans font-normal rounded-sm px-2.5 py-1',

        // Badge de intervalo inativo
        inactive:
          'border border-border-default bg-transparent text-label text-[11px] font-sans font-normal rounded-sm px-2.5 py-1 hover:bg-surface-card hover:text-copy cursor-pointer',
      },
    },
    defaultVariants: {
      variant: 'count',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
