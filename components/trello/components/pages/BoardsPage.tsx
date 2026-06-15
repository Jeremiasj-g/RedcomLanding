import { UserRound } from 'lucide-react';
import { useState } from 'react';
import { useBoards } from '../../context/BoardContext';
import { TopSearchBar } from '../layout/TopSearchBar';
import { CreateBoardModal } from '../modals/CreateBoardModal';
import { BoardCard } from '../ui/BoardCard';
import { EmptyBoardCard } from '../ui/EmptyBoardCard';

export function BoardsPage() {
  const { boards, filteredBoards, loading, search, openBoard, updateBoard, deleteBoard } = useBoards();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <main className="flex h-full min-h-0 overflow-y-auto min-w-0 flex-col bg-[#1e1e21]">
      <TopSearchBar onCreateBoard={() => setIsCreateModalOpen(true)} />

      <section className="px-6 py-[17px]">
        <div className="mb-[22px] flex items-center gap-3 text-[#d7d9df]">
          <UserRound size={30} />
          <h1 className="text-xl font-bold">Tus tableros</h1>
        </div>

        {loading ? (
          <div className="rounded-lg border border-[#323338] bg-[#242528] p-6 text-[#a6a8b0]">Cargando tableros...</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(238px,1fr))] gap-5">
            {filteredBoards.map((board) => (
              <BoardCard key={board.id} board={board} onOpen={openBoard} onRename={(boardId, title) => updateBoard(boardId, { title }).then(() => undefined)} onDelete={deleteBoard} />
            ))}

            {!search && <EmptyBoardCard boardsCount={boards.length} onClick={() => setIsCreateModalOpen(true)} />}
          </div>
        )}

        {!loading && filteredBoards.length === 0 && search && (
          <div className="mt-6 rounded-lg border border-[#323338] bg-[#242528] p-6 text-[#a6a8b0]">
            No encontramos tableros con “{search}”. Probá con otro nombre.
          </div>
        )}
      </section>

      <CreateBoardModal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </main>
  );
}
