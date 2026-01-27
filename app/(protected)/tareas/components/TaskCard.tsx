'use client';

import React, { useState } from 'react';
import { CheckCircle2, Loader2, StickyNote, Trash2, Pencil } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';

import type { Task } from '@/lib/tasks';
import TaskChecklistIndicator from '../TaskChecklistIndicator';

type Props = {
  dndId: string;

  task: Task;
  BRIEF_STATUS: Record<Task['status'], string>;
  changingStatusId: number | null;
  savingNotesId: number | null;
  deletingId: number | null;

  onToggleStatus: (task: Task) => Promise<Task>;
  onSaveNotes: (task: Task, notes: string) => Promise<Task>;
  onDelete: (task: Task) => Promise<boolean>;

  onOpenDetail: () => void;

  /** Ctrl/Cmd + click para copiar rápido */
  onQuickCopy?: (task: Task) => void;
};

export default function TaskCard({
  dndId,
  task,
  BRIEF_STATUS,
  changingStatusId,
  savingNotesId,
  deletingId,
  onToggleStatus,
  onSaveNotes,
  onDelete,
  onOpenDetail,
  onQuickCopy,
}: Props) {
  /* =======================
     Drag & Drop (toda la card)
     ======================= */
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: dndId,
  });

  // ✅ SOLO translate: sin scale, sin deformación
  const dragStyle: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transformOrigin: '0 0',
    willChange: 'transform',
    opacity: isDragging ? 0.75 : 1,
  };

  const [notes, setNotes] = useState(task.notes ?? '');

  const statusPill =
    task.status === 'done'
      ? 'bg-emerald-500/15 text-emerald-300'
      : task.status === 'in_progress'
      ? 'bg-sky-500/15 text-sky-300'
      : task.status === 'cancelled'
      ? 'bg-rose-500/15 text-rose-300'
      : 'bg-slate-700/60 text-slate-200';

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      // ✅ listeners/attributes en TODA la card
      {...attributes}
      {...listeners}
      className={[
        'group select-none rounded-xl border border-slate-800 bg-gray-700/70 p-2 text-xs text-slate-100',
        'shadow-sm shadow-slate-950/60 hover:border-sky-500/70 hover:bg-gray-700',
        'cursor-grab active:cursor-grabbing',
        'transition-colors',
      ].join(' ')}
      onClick={(e) => {
        // ✅ si estás arrastrando, no abras detalle
        if (isDragging) return;

        // ✅ Ctrl/Cmd + click => copia rápida (sin abrir detalle)
        if ((e.ctrlKey || e.metaKey) && onQuickCopy) {
          e.preventDefault();
          e.stopPropagation();
          onQuickCopy(task);
          return;
        }

        onOpenDetail();
      }}
    >
      {/* Header */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            data-no-dnd
            onClick={async (e) => {
              e.stopPropagation();
              await onToggleStatus(task);
            }}
            disabled={changingStatusId === task.id}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusPill}`}
            title="Cambiar estado"
          >
            {changingStatusId === task.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            {BRIEF_STATUS?.[task.status] ?? task.status}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <TaskChecklistIndicator taskId={task.id} size={6} />
          <span className="text-[10px] text-slate-400">
            {new Date(task.scheduled_at).toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="text-[11px] font-medium leading-tight">{task.title}</div>

      {task.description && (
        <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{task.description}</div>
      )}

      {/* Notes */}
      <div
        className="mt-2 flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
        data-no-dnd
      >
        <StickyNote className="h-3 w-3 text-slate-500" />
        <input
          className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          placeholder="Notas / observaciones..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          data-no-dnd
        />

        <button
          data-no-dnd
          onClick={() => onSaveNotes(task, notes)}
          disabled={savingNotesId === task.id}
          className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-700 disabled:bg-slate-900"
        >
          {savingNotesId === task.id ? 'Guardando...' : 'OK'}
        </button>

        {/* ✅ reemplaza "Duplicar" por "Editar" */}
        <button
          data-no-dnd
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail();
          }}
          className="rounded-lg bg-slate-900/80 p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          title="Editar"
        >
          <Pencil className="h-3 w-3" />
        </button>

        <button
          data-no-dnd
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task);
          }}
          disabled={deletingId === task.id}
          className="rounded-lg bg-slate-900/80 p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
          title="Eliminar"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
