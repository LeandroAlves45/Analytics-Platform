/**
 * Componente Card do shadcn/ui
 * Um Card é um container com fundo surface-card, borda subtil e border-radius card (10px).
 * É o bloco de construção dos KPI cards, painéis de gráficos e tabelas.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative rounded-card border border-border-default bg-surface-card text-copy overflow-hidden',
        className
      )}
      {...props}
    />
  )
);

Card.displayName = 'Card';

// Card Header -> secção superior do card com espaçamento padrão
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1 p-4 pb-0', className)} {...props} />
  )
);

CardHeader.displayName = 'CardHeader';

// Card Title -> título do card
const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-sm font-medium text-[#c8c6d8] leading-none', className)}
      {...props}
    />
  )
);

CardTitle.displayName = 'CardTitle';

// Card Description -> subtítulo ou descrição do card
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-xs text-label', className)} {...props} />
));

CardDescription.displayName = 'CardDescription';

// Card Content -> corpo principal do card
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-4', className)} {...props} />
);

CardContent.displayName = 'CardContent';

// Card Footer -> rodapé do card, alinhado horizontalmente
const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-4 pt-0', className)} {...props} />
  )
);

CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
