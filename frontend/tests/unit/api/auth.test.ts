/**
 * Testes unitários para a API de autenticação.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/api/client';
import { loginUser, registerUser } from '@/api/auth';

vi.mock('@/api/client', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should unwrap login response envelope', async () => {
    const mockData = {
      accessToken: 'token',
      expiresIn: '15m',
      user: {
        id: 'user-id',
        email: 'a@b.com',
        name: 'Test',
        initials: 'T',
      },
      workspace: {
        id: 'ws',
        name: 'WS',
        slug: 'ws',
        plan: 'free',
      },
    };

    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: mockData } });

    const result = await loginUser({ email: 'a@b.com', password: 'password123' });

    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/login', {
      email: 'a@b.com',
      password: 'password123',
    });

    expect(result.accessToken).toBe('token');
    // refreshToken nunca deve estar no resultado — está no cookie httpOnly
    expect((result as unknown as Record<string, unknown>).refreshToken).toBeUndefined();
  });

  it('should unwrap register response envelope', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { data: { accessToken: 't', expiresIn: '15m' } },
    });

    const result = await registerUser({
      email: 'new@test.com',
      password: 'password123',
      name: 'Test',
    });

    expect(result.accessToken).toBe('t');
    expect((result as unknown as Record<string, unknown>).refreshToken).toBeUndefined();
  });
});
