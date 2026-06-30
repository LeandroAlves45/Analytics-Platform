/**
 * Testes unitários para o hook useLogout.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLogout } from '@/hooks/useLogout';
import { useAuthStore } from '@/stores/authStore';
import apiClient from '@/api/client';

vi.mock('@/api/client', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

Object.defineProperty(window, 'location', {
  value: {
    href: '',
  },
  writable: true,
});

describe('useLogout', () => {
  const clearAuth = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockImplementation((selector) => selector({ clearAuth } as never));
  });

  it('should call POST /api/auth/logout without body (cookie automatic) and clearAuth', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({});

    const { result } = renderHook(() => useLogout());
    await act(async () => {
      await result.current();
    });

    // Sem body -> cookie httpOnly enviado automaticamente pelo browser
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/logout');
    expect(clearAuth).toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });

  it('should still call clearAuth when server logout fails (network error)', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useLogout());
    await act(async () => {
      await result.current();
    });

    expect(clearAuth).toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });
});
