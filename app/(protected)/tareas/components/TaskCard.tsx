'use client';

import React, { useState } from 'react';
import { Loader2, StickyNote, Trash2, Pencil } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';

import type { Task } from '@/lib/tasks';
import TaskChecklistIndicator from '../TaskChecklistIndicator';
import { RedcomSelect } from '@/components/ui/redcom-select';

type Props = {
  dndId: string;

  task: Task;
  BRIEF_STATUS: Record<Task['status'], string>;
  changingStatusId: number | null;
  savingNotesId: number | null;
  deletingId: number | null;

  onStatusChange: (task: Task, status: Task['status']) => Promise<Task>;
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
  onStatusChange,
  onSaveNotes,
  onDelete,
  onOpenDetail,
  onQuickCopy,
}: Props) {
  /* =======================
     Drag & Drop (toda la card)
     ======================= */
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: dndId,
  });

  // El movimiento visual lo realiza DragOverlay desde TasksGrid.
  // Mantener la tarjeta original quieta evita que React la cambie de columna
  // mientras dnd-kit todavía conserva referencias al nodo arrastrado.
  const dragStyle: React.CSSProperties = {
    transform: undefined,
    transformOrigin: '0 0',
    willChange: isDragging ? 'opacity' : undefined,
    opacity: isDragging ? 0 : 1,
  };

  const [notes, setNotes] = useState(task.notes ?? '');

  const statusPill =
    task.status === 'done'
      ? 'border border-emerald-400/15 bg-emerald-400/10 text-emerald-300'
      : task.status === 'in_progress'
      ? 'border border-[#0a84ff]/15 bg-[#0a84ff]/10 text-[#5ac8fa]'
      : task.status === 'cancelled'
      ? 'border border-rose-400/15 bg-rose-400/10 text-rose-300'
      : 'border border-white/[0.08] bg-white/[0.045] text-white/[0.64]';

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      // ✅ listeners/attributes en TODA la card
      {...attributes}
      {...listeners}
      className={[
        'group select-none rounded-[14px] border border-white/[0.075] bg-[#1c1c1e] p-2.5 text-xs text-white/[0.86]',
        'shadow-[0_7px_18px_rgba(0,0,0,.12)] hover:border-[#0a84ff]/25 hover:bg-[#202023]',
        'cursor-grab active:cursor-grabbing',
        'transition',
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
          <div
            data-no-dnd
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="min-w-[126px]"
          >
            <RedcomSelect
              value={task.status}
              options={[
                { value: 'pending', label: BRIEF_STATUS.pending },
                { value: 'in_progress', label: BRIEF_STATUS.in_progress },
                { value: 'done', label: BRIEF_STATUS.done },
                { value: 'cancelled', label: BRIEF_STATUS.cancelled },
              ]}
              onValueChange={(value) => {
                void onStatusChange(task, value as Task['status']);
              }}
              disabled={changingStatusId === task.id}
              surface="dark"
              triggerTone={
                task.status === 'done'
                  ? 'green'
                  : task.status === 'in_progress'
                    ? 'blue'
                    : task.status === 'cancelled'
                      ? 'red'
                      : 'neutral'
              }
              aria-label={`Cambiar estado de ${task.title}`}
              className={`h-7 rounded-full px-2 text-[9px] font-medium ${statusPill}`}
              contentClassName="text-[11px]"
            />
            {changingStatusId === task.id ? (
              <span className="sr-only">Actualizando estado...</span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <TaskChecklistIndicator taskId={task.id} size={6} />
          <span className="text-[9px] text-white/[0.36]">
            {new Date(task.scheduled_at).toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="text-[11px] font-medium leading-[1.35] text-white/[0.90]">{task.title}</div>

      {task.description && (
        <div className="mt-1 line-clamp-2 text-[10px] font-normal leading-4 text-white/[0.42]">{task.description}</div>
      )}

      {/* Notes */}
      <div
        className="mt-2 flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
        data-no-dnd
      >
        <StickyNote className="h-3 w-3 text-white/[0.28]" />
        <input
          className="w-full rounded-[8px] border border-white/[0.07] bg-white/[0.035] px-2 py-1 text-[10px] font-normal text-white/[0.78] outline-none placeholder:text-white/[0.25] focus:border-[#0a84ff]/35 focus:ring-2 focus:ring-[#0a84ff]/10"
          placeholder="Notas / observaciones..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          data-no-dnd
        />

        <button
          data-no-dnd
          onClick={() => onSaveNotes(task, notes)}
          disabled={savingNotesId === task.id}
          className="rounded-[8px] bg-white/[0.065] px-2 py-1 text-[9px] font-medium text-white/[0.64] transition hover:bg-white/[0.10] hover:text-white disabled:opacity-35"
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
          className="rounded-[8px] bg-white/[0.035] p-1 text-white/[0.36] transition hover:bg-white/[0.075] hover:text-white/[0.82]"
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
          className="rounded-[8px] bg-white/[0.035] p-1 text-white/[0.28] transition hover:bg-rose-500/10 hover:text-rose-300"
          title="Eliminar"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
