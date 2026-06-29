'use client';

import { useEffect } from 'react';
import { BoardProvider } from './context/BoardContext';
import { AppLayout } from './components/layout/AppLayout';

export default function TrelloApp() {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="trello-root fixed inset-x-0 bottom-0 top-16 z-[30] bg-[#1d1d1f] text-[#d7d9df]">
      <BoardProvider>
        <AppLayout />
      </BoardProvider>
    </div>
  );
}
