import { Globe2, LockKeyhole, MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import type { Board } from '../../types/trello';
import { getBoardCoverStyle } from '../../utils/trelloDesignData';

interface BoardCardProps {
  board: Board;
  onOpen: (boardId: string) => void;
  onRename: (boardId: string, title: string) => Promise<void>;
  onDelete: (boardId: string) => Promise<void>;
}

export function BoardCard({ board, onOpen, onRename, onDelete }: BoardCardProps) {
  const VisibilityIcon = board.visibility === 'publico' ? Globe2 : LockKeyhole;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(board.title);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setDraft(board.title), [board.title]);
  useEffect(() => {
    if (editing) window.setTimeout(() => inputRef.current?.select(), 0);
  }, [editing]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOptionsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (editing || optionsOpen) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(board.id);
    }
  };

  const saveTitle = async () => {
    const cleanTitle = draft.trim();
    if (!cleanTitle) {
      window.alert('El nombre del tablero no puede quedar vacío.');
      setDraft(board.title);
      setEditing(false);
      return;
    }

    if (cleanTitle !== board.title) await onRename(board.id, cleanTitle);
    setEditing(false);
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(`¿Querés eliminar el tablero "${board.title}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    setOptionsOpen(false);
    await onDelete(board.id);
  };

  return (
    <article
      className="group relative h-[120px] cursor-pointer overflow-visible rounded-lg border border-black/30 bg-[#242528] shadow-[0_1px_0_rgba(255,255,255,.04)] transition hover:-translate-y-0.5 hover:shadow-trello focus-within:ring-2 focus-within:ring-trello-blue"
      role="button"
      tabIndex={0}
      aria-label={`Abrir tablero ${board.title}`}
      onClick={() => {
        if (!editing && !optionsOpen) onOpen(board.id);
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="relative h-[78px] overflow-hidden rounded-t-lg" style={getBoardCoverStyle(board.cover, { overlay: true, contain: board.cover.value.startsWith('/trello-backgrounds/') })}>
        <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-black/35 px-2 py-1 text-[11px] font-semibold text-white/85 backdrop-blur">
          <VisibilityIcon size={12} />
          {board.visibility === 'publico' ? 'Público' : 'Privado'}
        </div>
        <button
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-black/20 text-white/0 transition hover:bg-black/35 group-hover:text-white/85"
          type="button"
          aria-label="Marcar como favorito"
          onClick={(event) => event.stopPropagation()}
        >
          <Star size={16} />
        </button>
      </div>

      <div className="flex h-[42px] items-center justify-between gap-2 px-2.5" onClick={(event) => event.stopPropagation()}>
        {editing ? (
          <input
            ref={inputRef}
            className="min-w-0 flex-1 rounded border border-[#85b8ff] bg-[#1f2024] px-2 py-1 text-base font-semibold text-[#d7d9df] outline-none ring-1 ring-[#579dff]"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void saveTitle()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void saveTitle();
              if (event.key === 'Escape') {
                setDraft(board.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            className="min-w-0 flex-1 truncate rounded px-1 py-1 text-left text-base font-semibold text-[#d7d9df] transition hover:bg-white/10"
            type="button"
            onClick={() => setEditing(true)}
            title="Click para editar el nombre del tablero"
          >
            {board.title}
          </button>
        )}

        <div ref={menuRef} className="relative shrink-0">
          <button
            className="grid h-7 w-7 place-items-center rounded-md text-transparent transition hover:bg-white/10 group-hover:text-[#b7bac3]"
            type="button"
            aria-label="Más opciones"
            onClick={(event) => {
              event.stopPropagation();
              setOptionsOpen((current) => !current);
            }}
          >
            <MoreHorizontal size={18} />
          </button>

          {optionsOpen && (
            <div className="absolute right-0 top-8 z-30 w-48 rounded-lg border border-[#3b4048] bg-[#282a2f] p-2 text-[#d7dce5] shadow-[0_14px_38px_rgba(0,0,0,.55)]">
              <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-bold transition hover:bg-white/10" type="button" onClick={() => { setOptionsOpen(false); setEditing(true); }}>
                <Pencil size={15} /> Editar nombre
              </button>
              <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-bold text-red-200 transition hover:bg-red-500/15" type="button" onClick={() => void handleDelete()}>
                <Trash2 size={15} /> Eliminar
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
