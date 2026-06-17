/**
 * Componente raiz da aplicação React.
 * Define o layout fixo e delega o conteúdo scrollável às rotas via Outlet.
 */

import { Route, Routes } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { PollingIndicator } from '@/components/layout/PollingIndicator';
import { DashboardPage } from '@/pages/DashboardPage';
import { AlertsPage } from '@/pages/AlertsPage';
import { AlertEventsPage } from '@/pages/AlertEventsPage';

function App() {
  return (
    // Container raiz: full viewport height, sem overflow no body
    <div className="flex flex-col h-screen bg-app overflow-hidden">
      <TopBar />

      {/* Área central: sidebar + conteúdo principal side-by-side */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Área de conteúdo principal: scrollável */}
        <main
          className="flex-1 overflow-y-auto"
          id="main-content"
          aria-label="Conteúdo principal da dashboard"
        >
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/alert-events" element={<AlertEventsPage />} />
          </Routes>
        </main>
      </div>

      {/* Barra de polling —> posicção fixa no fundo, nunca faz scroll */}
      <PollingIndicator />
    </div>
  );
}

export default App;
