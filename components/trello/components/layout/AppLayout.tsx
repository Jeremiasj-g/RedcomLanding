import { useEffect, useState } from 'react';
import { useBoards } from '../../context/BoardContext';
import { BoardDetailPage } from '../pages/BoardDetailPage';
import { BoardsPage } from '../pages/BoardsPage';
import { MembersPage } from '../pages/MembersPage';
import { SettingsPage } from '../pages/SettingsPage';
import { TrelloGridLoader } from '../ui/TrelloGridLoader';
import { Sidebar } from './Sidebar';

function PageLoader() {
  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-[220] grid place-items-center bg-[#1d1d1f]/72 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[240px]">
        <TrelloGridLoader label="Cargando..." />
      </div>
    </div>
  );
}

export function AppLayout() {
  const { activeView } = useBoards();
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    setTransitioning(true);
    const timeoutId = window.setTimeout(() => setTransitioning(false), 260);
    return () => window.clearTimeout(timeoutId);
  }, [activeView]);

  if (activeView === 'board') {
    return (
      <>
        <BoardDetailPage />
        {transitioning && <PageLoader />}
      </>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)] bg-[#1d1d1f] font-sans text-[#d7d9df]">
      <Sidebar />
      {activeView === 'boards' && <BoardsPage />}
      {activeView === 'members' && <MembersPage />}
      {activeView === 'settings' && <SettingsPage />}
      {transitioning && <PageLoader />}
    </div>
  );
}
