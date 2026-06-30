/**
 * Testes unitários para o ProtectedRoute.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuthStore } from '@/stores/authStore';

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when authenticated', () => {
    vi.mocked(useAuthStore).mockImplementation((selector) =>
      selector({ isAuthenticated: true } as never)
    );

    const { getByText } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<span>Dashboard</span>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(getByText('Dashboard')).toBeDefined();
  });

  it('should redirect to /login when not authenticated', () => {
    vi.mocked(useAuthStore).mockImplementation((selector) =>
      selector({ isAuthenticated: false } as never)
    );

    const { queryByText } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<span>Login Page</span>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<span>Dashboard</span>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(queryByText('Dashboard')).toBeNull();
    expect(queryByText('Login Page')).toBeDefined();
  });
});
