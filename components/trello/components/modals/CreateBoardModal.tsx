import { Globe2, LockKeyhole, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useBoards } from '../../context/BoardContext';
import type { BoardCover, BoardVisibility } from '../../types/trello';
import { boardCovers } from '../../utils/trelloDesignData';

interface CreateBoardModalProps {
  open: boolean;
  onClose: () => void;
}

const visibilityOptions: Array<{
  value: BoardVisibility;
  title: string;
  description: string;
  icon: typeof LockKeyhole;
}> = [
  {
    value: 'privado',
    title: 'Privado',
    description: 'Solo las personas invitadas podrán ver y editar este tablero.',
    icon: LockKeyhole,
  },
  {
    value: 'publico',
    title: 'Público',
    description: 'Los miembros del espacio podrán encontrarlo y unirse al trabajo.',
    icon: Globe2,
  },
];

export function CreateBoardModal({ open, onClose }: CreateBoardModalProps) {
  const {
    workspaces,
    selectedWorkspaceId,
    createBoard,
    openBoard,
    setSelectedWorkspaceId,
    selectedCover,
    setSelectedCover,
  } = useBoards();
  const [title, setTitle] = useState('');
  const [workspaceId, setWorkspaceId] = useState(selectedWorkspaceId);
  const [visibility, setVisibility] = useState<BoardVisibility>('privado');
  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId),
    [workspaceId, workspaces],
  );

  useEffect(() => {
    if (open) {
      setWorkspaceId(selectedWorkspaceId);
      setVisibility('privado');
    }
  }, [open, selectedWorkspaceId]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim()) return;

    const newBoard = await createBoard({ title, workspaceId, cover: selectedCover, visibility });
    setTitle('');
    onClose();
    setSelectedWorkspaceId(newBoard.workspaceId);
    openBoard(newBoard.id);
  };

  const handleCoverSelection = (cover: BoardCover) => {
    setSelectedCover(cover);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-16 z-50 grid place-items-start bg-black/55 px-4 py-10 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="mx-auto w-full max-w-[390px] rounded-xl border border-[#323338] bg-[#25262a] p-4 text-[#d7d9df] shadow-trello"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-board-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="create-board-title" className="text-base font-bold">
            Crear tablero
          </h2>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-md text-[#a6a8b0] transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-5 grid h-[112px] place-items-center rounded-lg" style={{ background: selectedCover.value }}>
          <div className="grid h-[68px] w-[112px] grid-cols-3 gap-2 rounded bg-black/25 p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]">
            <span className="rounded bg-white/70" />
            <span className="rounded bg-white/45" />
            <span className="rounded bg-white/55" />
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[#d7d9df]">Fondo</span>
            <div className="grid grid-cols-6 gap-2">
              {boardCovers.map((cover) => (
                <button
                  className={`h-9 rounded-md border-2 transition hover:opacity-90 ${
                    cover.value === selectedCover.value ? 'border-trello-blue' : 'border-transparent'
                  }`}
                  key={cover.value}
                  type="button"
                  style={{ background: cover.value }}
                  onClick={() => handleCoverSelection(cover)}
                  aria-label="Seleccionar fondo"
                />
              ))}
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[#d7d9df]">Título del tablero</span>
            <input
              autoFocus
              className="h-10 w-full rounded border border-[#6a6f7a] bg-[#1f2024] px-3 text-sm text-[#d7d9df] outline-none transition placeholder:text-[#878a93] focus:border-trello-blue focus:ring-1 focus:ring-trello-blue"
              type="text"
              placeholder="Ej. Proyecto Taller 2"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[#d7d9df]">Espacio de trabajo</span>
            <select
              className="h-10 w-full rounded border border-[#6a6f7a] bg-[#1f2024] px-3 text-sm text-[#d7d9df] outline-none transition focus:border-trello-blue focus:ring-1 focus:ring-trello-blue"
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="mb-2 block text-sm font-bold text-[#d7d9df]">Visibilidad del tablero</legend>
            <div className="grid gap-2">
              {visibilityOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = visibility === option.value;

                return (
                  <button
                    key={option.value}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                      isSelected
                        ? 'border-trello-blue bg-[#1f3555] text-white'
                        : 'border-[#3b3d43] bg-[#1f2024] text-[#c9cbd2] hover:border-[#6a6f7a] hover:bg-[#292b30]'
                    }`}
                    type="button"
                    onClick={() => setVisibility(option.value)}
                  >
                    <Icon className="mt-0.5 shrink-0" size={18} />
                    <span>
                      <span className="block text-sm font-bold">{option.title}</span>
                      <span className="mt-1 block text-xs leading-snug text-[#aeb2bc]">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {selectedWorkspace && <p className="text-sm text-[#a6a8b0]">Se creará dentro de “{selectedWorkspace.name}”.</p>}

          <button
            className="h-10 w-full rounded bg-trello-blue font-semibold text-[#092957] transition hover:bg-[#85b8ff] disabled:cursor-not-allowed disabled:bg-[#3b587a] disabled:text-[#a6a8b0]"
            type="submit"
            disabled={!title.trim()}
          >
            Crear tablero
          </button>
        </form>
      </div>
    </div>
  );
}
