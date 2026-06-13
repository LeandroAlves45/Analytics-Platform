/**
 * Componente Button do shadcn/ui
 * Usa CVA (class-variance-authority) para gerir variantes de forma type-safe.
 * CVA permite definir "receitas" de classes — em vez de condicionais if/else,
 * declaramos as variantes e o CVA compõe as classes automaticamente.
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * buttonVariants define todas as combinações possíveis do botão.
 * base: classes sempre presentes
 * variants: classes adicionadas consoante o valor da prop
 */
const buttonVariants = cva(
  // Classes base -> presentes em todas as variantes
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Botão primário -> usa a cor de marca purple
        default: 'bg-purple text-white hover:bg-purple-dark shadow-sm',

        // Botão destrutivo -> para ações irreversíveis
        destructive: 'bg-danger text-white hover:opacity-90 shadow-sm',

        // Botão com borda -> para ações secundárias com menos peso visual
        outline:
          'border border-border-default bg-transparent text-label hover:bg-surface-card hover:text-copy',

        // Botão subtil -> baixo contraste, usado em toolbars
        secondary: 'bg-surface-card text-label hover:bg-surface-card-hover hover:text-copy',

        // Botão fantasma -> sem fundo, para ações terciárias
        ghost: 'text-label hover:bg-surface-card hover:text-copy',

        // Botão link -> parece um link, comporta-se como botão
        link: 'text-purple underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-8 px-4 py-2',
        sm: 'h-7 px-3 text-xs',
        lg: 'h-10 px-6',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/**
 * ButtonProps combina os props nativos do HTML com as variantes do CVA.
 * asChild: quando true, o Button não renderiza um <button> — em vez disso,
 * passa todas as props para o filho directo via Slot (padrão do Radix UI).
 * Útil quando precisas de um Link que visualmente parece um Button.
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // Se asChild for true, usa o Slot para passar todas as props para o filho
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
