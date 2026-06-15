import { useEffect, useState } from 'react';
import { useBoards } from '../../context/BoardContext';
import { BoardDetailPage } from '../pages/BoardDetailPage';
import { BoardsPage } from '../pages/BoardsPage';
import { MembersPage } from '../pages/MembersPage';
import { SettingsPage } from '../pages/SettingsPage';
import { Sidebar } from './Sidebar';

function PageLoader() {
  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-[220] grid place-items-center bg-[#1d1d1f]/72 backdrop-blur-sm">
      <div className="grid h-14 w-14 grid-cols-2 grid-rows-2 gap-1.5 rounded-2xl border border-white/10 bg-[#22252b] p-2 shadow-2xl">
        <span className="animate-[trello-loader_1.1s_ease-in-out_infinite] rounded-md bg-[#579dff]" />
        <span className="animate-[trello-loader_1.1s_ease-in-out_.12s_infinite] rounded-md bg-[#85b8ff]" />
        <span className="animate-[trello-loader_1.1s_ease-in-out_.24s_infinite] rounded-md bg-[#9f8fef]" />
        <span className="animate-[trello-loader_1.1s_ease-in-out_.36s_infinite] rounded-md bg-[#4bce97]" />
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
