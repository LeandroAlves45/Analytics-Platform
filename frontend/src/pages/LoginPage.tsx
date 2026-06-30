/**
 * Página de login — formulário email/password.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

import { AuthField } from '@/components/auth/AuthField';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { useLogin } from '@/hooks/useLogin';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Acede ao teu workspace e continua de onde paraste."
      footer={
        <p className="text-label">
          Ainda não tens conta?{' '}
          <Link
            to="/register"
            className="font-medium text-purple hover:text-purple-dark transition-colors underline-offset-4 hover:underline"
          >
            Criar conta
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tua@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <AuthField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {loginMutation.isError && (
          <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {(loginMutation.error as Error).message}
          </p>
        )}

        <Button type="submit" className="w-full h-10" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? 'A entrar...' : 'Entrar'}
        </Button>
      </form>
    </AuthLayout>
  );
}
