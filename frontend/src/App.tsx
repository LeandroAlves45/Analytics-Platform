/**
 * Componente raiz da aplicação React
 */

import { TopBar } from '@/components/layout/TopBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { PollingIndicator } from '@/components/layout/PollingIndicator';
import { DashboardPage } from '@/pages/DashboardPage';

function App() {
  return (
    // Container raiz: full viewport height, sem overflow no body
    <div className="flex flex-col h-screen bg-app overflow-hidden">
      {/* TopBar —> posicção fixa no topo, nunca faz scroll */}
      <TopBar />

      {/* Área central: sidebar + conteúdo principal side-by-side */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar —> posicção fixa lateral, nunca faz scroll */}
        <Sidebar />

        {/* Área de conteúdo principal: scrollável */}
        <main
          className="flex-1 overflow-y-auto"
          id="main-content"
          aria-label="Conteúdo principal da dashboard"
        >
          <DashboardPage />
        </main>
      </div>

      {/* Barra de polling —> posicção fixa no fundo, nunca faz scroll */}
      <PollingIndicator />
    </div>
  );
}

export default App;
