/**
 * Campo de formulário com label acessível para páginas de auth.
 */

import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function AuthField({ label, id, className, ...props }: AuthFieldProps) {
  const fieldId = id ?? props.name;

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-xs font-medium text-label">
        {label}
      </label>
      <input
        id={fieldId}
        className={cn(
          'w-full rounded-md border border-border-default bg-app/80 px-3 py-2.5 text-sm text-copy',
          'placeholder:text-meta transition-colors',
          'focus:outline-none focus:border-purple/50 focus:ring-1 focus:ring-purple/25',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
    </div>
  );
}
