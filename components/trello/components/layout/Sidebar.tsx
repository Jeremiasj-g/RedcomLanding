import { ChevronDown, ChevronUp, LayoutGrid, Plus, Settings, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { useBoards } from '../../context/BoardContext';
import { WorkspaceAvatar } from '../ui/WorkspaceAvatar';
import type { AppView } from '../../types/trello';
import { CreateWorkspaceModal } from '../modals/CreateWorkspaceModal';

export function Sidebar() {
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const {
    activeView,
    workspaces,
    selectedWorkspaceId,
    setActiveView,
    setSelectedWorkspaceId,
    toggleWorkspaceExpanded,
  } = useBoards();

  const handleWorkspaceMenuClick = (workspaceId: string, view: AppView) => {
    setSelectedWorkspaceId(workspaceId);
    setActiveView(view);
  };

  return (
    <>
    <aside className="h-full min-h-0 border-r border-[#2d2e33] bg-[#1f1f22]">
      <div className="h-full px-[17px] py-[18px]">
        <div className="mb-4 ml-[18px] mr-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#a6a8b0]">Espacios de trabajo</h2>
          <button
            className="grid h-7 w-7 place-items-center rounded text-[#c3c5cc] transition hover:bg-white/10 hover:text-white"
            type="button"
            onClick={() => setIsCreateWorkspaceOpen(true)}
            aria-label="Crear espacio de trabajo"
            title="Crear espacio de trabajo"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {workspaces.map((workspace) => {
            const isSelectedWorkspace = selectedWorkspaceId === workspace.id;
            const isBoardsActive = isSelectedWorkspace && activeView === 'boards';
            const isMembersActive = isSelectedWorkspace && activeView === 'members';
            const isSettingsActive = isSelectedWorkspace && activeView === 'settings';

            return (
              <section key={workspace.id}>
                <button
                  className="grid min-h-9 w-full grid-cols-[26px_minmax(0,1fr)_20px] items-center gap-2.5 rounded-lg bg-transparent px-[11px] py-0.5 text-left text-[#d7d9df] transition hover:bg-white/[.055]"
                  type="button"
                  onClick={() => {
                    setSelectedWorkspaceId(workspace.id);
                    void toggleWorkspaceExpanded(workspace.id);
                  }}
                >
                  <WorkspaceAvatar workspace={workspace} />
                  <span className="line-clamp-2 text-base font-bold leading-snug text-[#c9cbd2]">{workspace.name}</span>
                  <span className="inline-flex justify-center text-[#cbccd1]">
                    {workspace.expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                  </span>
                </button>

                {workspace.expanded && (
                  <nav className="mt-2 flex flex-col gap-1" aria-label={`Menú de ${workspace.name}`}>
                    <button
                      className={`grid min-h-9 w-full grid-cols-[24px_minmax(0,1fr)_24px] items-center gap-[7px] rounded-lg px-3.5 py-0 pl-[49px] text-left text-base font-semibold transition hover:bg-white/[.055] ${
                        isBoardsActive ? 'bg-trello-active text-trello-blue' : 'text-[#c3c5cc]'
                      }`}
                      type="button"
                      onClick={() => handleWorkspaceMenuClick(workspace.id, 'boards')}
                    >
                      <LayoutGrid size={16} />
                      <span>Tableros</span>
                      <span />
                    </button>

                    <button
                      className={`grid min-h-9 w-full grid-cols-[24px_minmax(0,1fr)_24px] items-center gap-[7px] rounded-lg px-3.5 py-0 pl-[49px] text-left text-base font-semibold transition hover:bg-white/[.055] ${
                        isMembersActive ? 'bg-trello-active text-trello-blue' : 'text-[#c3c5cc]'
                      }`}
                      type="button"
                      onClick={() => handleWorkspaceMenuClick(workspace.id, 'members')}
                    >
                      <UsersRound size={16} />
                      <span>Miembros</span>
                      <Plus className="justify-self-end" size={20} />
                    </button>

                    <button
                      className={`grid min-h-9 w-full grid-cols-[24px_minmax(0,1fr)_24px] items-center gap-[7px] rounded-lg px-3.5 py-0 pl-[49px] text-left text-base font-semibold transition hover:bg-white/[.055] ${
                        isSettingsActive ? 'bg-trello-active text-trello-blue' : 'text-[#c3c5cc]'
                      }`}
                      type="button"
                      onClick={() => handleWorkspaceMenuClick(workspace.id, 'settings')}
                    >
                      <Settings size={16} />
                      <span>Configuración</span>
                      <span />
                    </button>
                  </nav>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </aside>
    <CreateWorkspaceModal open={isCreateWorkspaceOpen} onClose={() => setIsCreateWorkspaceOpen(false)} />
    </>
  );
}
