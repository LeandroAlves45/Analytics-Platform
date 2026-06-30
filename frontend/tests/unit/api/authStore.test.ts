/**
 * Testes unitários para o store de autenticação.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/authStore';

const mockUser = {
  id: 'user-id',
  email: 'a@b.com',
  name: 'Test',
  initials: 'T',
};

const mockWorkspace = {
  id: 'ws-id',
  name: 'WS',
  slug: 'ws',
  plan: 'free',
};

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().clearAuth();
  });

  it('should set auth - persist metadata in localStorage, accessToken in memory only', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'token-in-memory',
      user: mockUser,
      workspace: mockWorkspace,
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe('token-in-memory');

    // LocalStorage guarda apenas metadata - nunca accessToken
    const stored = JSON.parse(localStorage.getItem('analytics_auth_meta')!);
    expect(stored.user.email).toBe('a@b.com');
    expect(stored.accessToken).toBeUndefined();
  });

  it('should clear auth and remove localStorage metadata', () => {
    useAuthStore.getState().setAuth({
      accessToken: 't',
      user: mockUser,
      workspace: mockWorkspace,
    });

    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(localStorage.getItem('analytics_auth_meta')).toBeNull();
  });

  it('should hydrate user/workspace from localStorage (accessToken stays null)', () => {
    localStorage.setItem(
      'analytics_auth_meta',
      JSON.stringify({
        user: mockUser,
        workspace: mockWorkspace,
      })
    );

    useAuthStore.getState().hydrateFromStorage();

    expect(useAuthStore.getState().user?.email).toBe('a@b.com');
    // accessToken=null -> será restaurado via interceptor no primeiro 401
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('should handle invalid JSON in localStorage gracefully', () => {
    localStorage.setItem('analytics_auth_meta', 'INVALID{{{');

    expect(() => useAuthStore.getState().hydrateFromStorage()).not.toThrow();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('should not authenticate when localStorage has no metadata', () => {
    useAuthStore.getState().hydrateFromStorage();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('should update only accessToken in memory via setAccessToken', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'old-token',
      user: mockUser,
      workspace: mockWorkspace,
    });

    useAuthStore.getState().setAccessToken('new-token');
    expect(useAuthStore.getState().accessToken).toBe('new-token');
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });
});
