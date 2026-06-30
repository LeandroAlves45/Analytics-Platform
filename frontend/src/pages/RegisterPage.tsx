/**
 * Página de registo — cria user + workspace default.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

import { AuthField } from '@/components/auth/AuthField';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { useRegister } from '@/hooks/useRegister';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const registerMutation = useRegister();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({ email, password, name, workspaceName: workspaceName || undefined });
  };

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Configura o teu workspace e começa a monitorizar APIs hoje."
      footer={
        <p className="text-label">
          Já tens conta?{' '}
          <Link
            to="/login"
            className="font-medium text-purple hover:text-purple-dark transition-colors underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          label="Nome"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Ex: João Silva"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
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
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <AuthField
          label="Nome do workspace"
          name="workspaceName"
          type="text"
          placeholder="Opcional — ex. Acme API"
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
        />

        {registerMutation.isError && (
          <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {(registerMutation.error as Error).message}
          </p>
        )}

        <Button type="submit" className="w-full h-10" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? 'A criar...' : 'Criar conta'}
        </Button>
      </form>
    </AuthLayout>
  );
}
