/**
 * Componente raiz da aplicação React.
 * Define apenas as rotas — o layout (TopBar/Sidebar/PollingIndicator) vive em AppLayout,
 * para não aparecer nas rotas de auth (/login, /register).
 */

import { Route, Routes } from 'react-router-dom';
import { DashboardPage } from '@/pages/DashboardPage';
import { AlertsPage } from '@/pages/AlertsPage';
import { AlertEventsPage } from '@/pages/AlertEventsPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { ApiKeysPage } from '@/pages/ApiKeysPage';
import { SettingsPage } from '@/pages/SettingsPage';

function App() {
  return (
    <Routes>
      {/* Rotas auth — SEM TopBar/Sidebar */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Rotas app — layout dashboard completo */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/alerts/events" element={<AlertEventsPage />} />
          <Route path="/api-keys" element={<ApiKeysPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
