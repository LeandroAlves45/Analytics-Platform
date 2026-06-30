/**
 * Layout partilhado para login e registo — painel de marca + cartão de formulário.
 */

import type { ReactNode } from 'react';
import { BarChart3, Shield, Zap } from 'lucide-react';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

const highlights = [
  { icon: BarChart3, text: 'Dashboards em tempo real para cada endpoint' },
  { icon: Zap, text: 'Integração em minutos com a tua stack' },
  { icon: Shield, text: 'Dados isolados por workspace' },
] as const;

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth-shell min-h-screen flex">
      <aside
        className="auth-brand-panel hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col p-10 xl:p-14 relative overflow-hidden"
        aria-hidden="true"
      >
        <div className="auth-brand-glow auth-grid absolute inset-0 pointer-events-none" />

        <div className="relative z-10 flex flex-1 flex-col justify-center gap-10 xl:gap-12 py-6">
          <div className="auth-fade-in auth-fade-in-1">
            <img
              src="/logo.png"
              alt="Analytics Platform"
              className="h-[164px] w-auto max-w-[min(100%,520px)] object-contain object-left"
            />
          </div>

          <div className="space-y-8 auth-fade-in auth-fade-in-2">
            <div className="space-y-3 max-w-md">
              <p className="text-2xs font-mono uppercase tracking-[0.2em] text-purple/80">
                Analytics Platform
              </p>
              <h2 className="text-2xl xl:text-[1.75rem] font-semibold text-copy leading-snug">
                Vê o que as tuas APIs fazem,{' '}
                <span className="text-gradient">antes dos teus utilizadores reclamarem.</span>
              </h2>
              <p className="text-sm text-label leading-relaxed">
                Latência, erros e tráfego num só lugar. Feito para equipas que vivem de métricas.
              </p>
            </div>

            <ul className="space-y-4">
              {highlights.map(({ icon: Icon, text }, index) => (
                <li key={text} className="flex items-start gap-3 text-sm text-label">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-default bg-surface-card/60">
                    <Icon className="h-3.5 w-3.5 text-purple" strokeWidth={1.75} />
                  </span>
                  <span className="pt-1">
                    <span className="font-mono text-2xs text-meta mr-2">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="relative z-10 text-2xs text-meta auth-fade-in auth-fade-in-3 shrink-0">
          © {new Date().getFullYear()} Analytics Platform
        </p>
      </aside>

      <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[420px] auth-fade-in auth-fade-in-2">
          <div className="lg:hidden mb-8 flex justify-center">
            <img
              src="/logo.png"
              alt="Analytics Platform"
              className="h-[112px] sm:h-[112px] w-auto max-w-[min(100%,360px)] object-contain"
            />
          </div>

          <div className="relative rounded-card border border-border-default bg-surface-card/90 backdrop-blur-sm shadow-[0_24px_64px_rgba(0,0,0,0.45)] overflow-hidden">
            <div
              className="auth-card-accent absolute top-0 left-0 right-0 h-px"
              aria-hidden="true"
            />

            <div className="p-6 sm:p-8 space-y-6">
              <header className="space-y-1.5">
                <h1 className="text-lg font-semibold text-copy tracking-tight">{title}</h1>
                <p className="text-sm text-label">{subtitle}</p>
              </header>

              {children}

              <footer className="pt-2 text-center text-sm">{footer}</footer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
