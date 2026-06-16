import { useState } from 'react';
import { AlertTriangle, Globe2, LockKeyhole, Settings, ShieldCheck, Trash2, X } from 'lucide-react';
import { useBoards } from '../../context/BoardContext';
import { getBoardCoverStyle } from '../../utils/trelloDesignData';
import type { BoardVisibility, WorkspaceVisibility } from '../../types/trello';
import { getVisibilityDescription, getVisibilityLabel } from '../../utils/trelloUtils';

const visibilityOptions: Array<{ value: BoardVisibility; title: string; description: string; icon: typeof LockKeyhole }> = [
  {
    value: 'privado',
    title: 'Privado',
    description: 'Solo invitados y administradores pueden verlo.',
    icon: LockKeyhole,
  },
  {
    value: 'publico',
    title: 'Público',
    description: 'Los miembros del espacio pueden encontrarlo y unirse.',
    icon: Globe2,
  },
];

export function SettingsPage() {
  const {
    currentWorkspace,
    workspaceBoards,
    updateBoardVisibility,
    updateWorkspaceVisibility,
    deleteWorkspace,
    openBoard,
  } = useBoards();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const canDeleteWorkspace = Boolean(currentWorkspace && deleteConfirmation === currentWorkspace.name);

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace || !canDeleteWorkspace || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteWorkspace(currentWorkspace.id);
      setIsDeleteModalOpen(false);
      setDeleteConfirmation('');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="h-full min-h-0 overflow-y-auto min-w-0 bg-[#1e1e21] px-8 py-8 text-[#d7d9df]">
      <section className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#242528] text-[#579dff] ring-1 ring-[#323338]">
            <Settings size={25} />
          </span>
          <div>
            <h1 className="text-2xl font-black">Configuración</h1>
            <p className="mt-1 text-sm text-[#a6a8b0]">
              Ajustes del espacio “{currentWorkspace?.name ?? 'seleccionado'}” y visibilidad de sus tableros.
            </p>
          </div>
        </header>

        <article className="rounded-2xl border border-[#323338] bg-[#242528] p-6 shadow-trello">
          <div className="mb-5 flex items-start justify-between gap-5 border-b border-[#323338] pb-5 max-md:flex-col">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[#579dff]">
                <ShieldCheck size={20} />
                <h2 className="text-lg font-black text-white">Visibilidad del espacio de trabajo</h2>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-[#a6a8b0]">
                Este ajuste se guarda en Supabase para el espacio de trabajo seleccionado.
              </p>
            </div>
            <span className="rounded-full bg-[#1f3555] px-3 py-1 text-xs font-black text-[#9cc7ff]">
              {getVisibilityLabel(currentWorkspace?.visibility ?? 'privado')}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {visibilityOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = currentWorkspace?.visibility === option.value;

              return (
                <button
                  key={option.value}
                  className={`rounded-xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-[#579dff] bg-[#1f3555] text-white'
                      : 'border-[#3b3d43] bg-[#1f2024] text-[#c9cbd2] hover:border-[#6a6f7a] hover:bg-[#292b30]'
                  }`}
                  type="button"
                  onClick={() => {
                    if (currentWorkspace) {
                      void updateWorkspaceVisibility(currentWorkspace.id, option.value as WorkspaceVisibility);
                    }
                  }}
                >
                  <span className="mb-3 flex items-center gap-2 font-black">
                    <Icon size={18} />
                    {option.title}
                  </span>
                  <span className="block text-sm leading-snug text-[#aeb2bc]">{option.description}</span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="rounded-2xl border border-[#323338] bg-[#242528] p-6 shadow-trello">
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#323338] pb-5 max-md:flex-col">
            <div>
              <h2 className="text-lg font-black text-white">Visibilidad de tableros</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#a6a8b0]">
                Desde esta solapa podés cambiar si cada tablero será público o privado. Este valor se guarda como columna <span className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-xs">visibility</span> en la tabla <span className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-xs">trello_boards</span>.
              </p>
            </div>
            <span className="rounded-full bg-[#2d2f35] px-3 py-1 text-xs font-black text-[#c3c5cc]">
              {workspaceBoards.length} tableros
            </span>
          </div>

          <div className="divide-y divide-[#323338] overflow-hidden rounded-xl border border-[#323338]">
            {workspaceBoards.map((board) => {
              const VisibilityIcon = board.visibility === 'publico' ? Globe2 : LockKeyhole;

              return (
                <div key={board.id} className="grid grid-cols-[minmax(0,1fr)_220px_auto] items-center gap-4 bg-[#1f2024] p-4 max-lg:grid-cols-1">
                  <button className="flex min-w-0 items-center gap-3 text-left" type="button" onClick={() => openBoard(board.id)}>
                    <span className="h-12 w-16 shrink-0 rounded-lg shadow-inner" style={getBoardCoverStyle(board.cover, { overlay: true, contain: board.cover.value.startsWith('/trello-backgrounds/') })} />
                    <span className="min-w-0">
                      <span className="block truncate font-black text-white">{board.title}</span>
                      <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#a6a8b0]">
                        <VisibilityIcon size={13} />
                        {getVisibilityDescription(board.visibility)}
                      </span>
                    </span>
                  </button>

                  <select
                    className="h-10 rounded border border-[#6a6f7a] bg-[#17181b] px-3 text-sm font-bold text-[#d7d9df] outline-none transition focus:border-[#579dff] focus:ring-1 focus:ring-[#579dff]"
                    value={board.visibility}
                    onChange={(event) => void updateBoardVisibility(board.id, event.target.value as BoardVisibility)}
                  >
                    <option value="privado">Privado</option>
                    <option value="publico">Público</option>
                  </select>

                  <button
                    className="h-10 rounded bg-[#2d2f35] px-4 text-sm font-bold text-[#d7d9df] transition hover:bg-[#3a3d45]"
                    type="button"
                    onClick={() => openBoard(board.id)}
                  >
                    Abrir
                  </button>
                </div>
              );
            })}

            {workspaceBoards.length === 0 && (
              <div className="bg-[#1f2024] p-6 text-sm text-[#a6a8b0]">Este espacio todavía no tiene tableros.</div>
            )}
          </div>
        </article>


        <article className="rounded-2xl border border-red-500/25 bg-[#242528] p-6 shadow-trello">
          <div className="flex items-start justify-between gap-5 max-md:flex-col">
            <div>
              <div className="mb-2 flex items-center gap-2 text-red-300">
                <Trash2 size={20} />
                <h2 className="text-lg font-black text-white">Eliminar espacio de trabajo</h2>
              </div>
              <p className="max-w-3xl text-sm leading-relaxed text-[#a6a8b0]">
                Esta acción elimina el espacio, sus tableros, listas, tarjetas y miembros asociados en Supabase. Más adelante puede delegarse a un procedimiento almacenado transaccional.
              </p>
            </div>
            <button
              className="inline-flex h-10 items-center gap-2 rounded border border-red-500/30 bg-red-500/15 px-4 text-sm font-black text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!currentWorkspace}
              onClick={() => {
                setDeleteConfirmation('');
                setIsDeleteModalOpen(true);
              }}
            >
              <Trash2 size={16} />
              Eliminar espacio
            </button>
          </div>
        </article>

        {isDeleteModalOpen && currentWorkspace && (
          <div
            className="fixed inset-x-0 bottom-0 top-16 z-[220] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setIsDeleteModalOpen(false);
                setDeleteConfirmation('');
              }
            }}
          >
            <section className="w-full max-w-[540px] overflow-hidden rounded-2xl border border-red-500/25 bg-[#1f2024] text-[#dfe3ea] shadow-[0_24px_80px_rgba(0,0,0,.75)]">
              <header className="flex items-center justify-between border-b border-[#32363d] px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/15 text-red-200 ring-1 ring-red-500/25">
                    <AlertTriangle size={21} />
                  </span>
                  <div>
                    <h3 className="text-lg font-black text-white">Eliminar espacio de trabajo</h3>
                    <p className="mt-1 text-sm text-[#aeb6c2]">Esta acción no se puede deshacer.</p>
                  </div>
                </div>
                <button
                  className="grid h-9 w-9 place-items-center rounded-lg text-[#b6c2cf] transition hover:bg-white/10 hover:text-white"
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteConfirmation('');
                  }}
                  aria-label="Cerrar"
                >
                  <X size={21} />
                </button>
              </header>

              <div className="space-y-4 p-5">
                <p className="text-sm leading-relaxed text-[#c9d0dc]">
                  Para confirmar, escribí exactamente el nombre del espacio:
                </p>
                <div className="rounded-lg border border-[#3b4048] bg-[#17191c] px-3 py-2 font-mono text-sm font-bold text-red-100">
                  {currentWorkspace.name}
                </div>
                <input
                  className="h-11 w-full rounded-lg border border-[#7a818c] bg-[#17191c] px-3 text-sm text-[#f1f2f4] outline-none placeholder:text-[#aeb6c2] focus:border-red-300 focus:ring-1 focus:ring-red-300"
                  placeholder="Escribí el nombre exacto del espacio"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  autoFocus
                />
                <button
                  className="h-11 w-full rounded-lg bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-950/60 disabled:text-red-200/40"
                  type="button"
                  disabled={!canDeleteWorkspace || isDeleting}
                  onClick={() => void handleDeleteWorkspace()}
                >
                  {isDeleting ? 'Eliminando...' : 'Eliminar definitivamente'}
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
