/**
 * Layout dashboard —> TopBar + Sidebar + Outlet + PollingIndicator.
 * Extraído de App.tsx para não renderizar em /login e /register.
 */

import { Outlet } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { PollingIndicator } from '@/components/layout/PollingIndicator';

export function AppLayout() {
  return (
    <div className="flex flex-col h-screen bg-app overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto" id="main-content">
          <Outlet />
        </main>
      </div>
      <PollingIndicator />
    </div>
  );
}
