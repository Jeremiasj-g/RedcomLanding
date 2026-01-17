'use client';

import 'react-day-picker/dist/style.css';
import React, { useMemo, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Loader2,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { es } from 'date-fns/locale';
import { format } from 'date-fns';
import { useDraggable } from '@dnd-kit/core';

import type { Task } from '@/lib/tasks';
import TaskChecklistIndicator from '../TaskChecklistIndicator';
import { toYMD } from '../date';

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

  /** 👇 nuevo: duplicado por rango */
  onDuplicateRange: (
    task: Task,
    fromYMD: string,
    toYMD: string,
    timeHHmm: string,
  ) => Promise<void>;

  onOpenDetail: () => void;
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
  onDuplicateRange,
  onOpenDetail,
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

  /* =======================
     Estado existente
     ======================= */
  const [notes, setNotes] = useState(task.notes ?? '');

  const [dupOpen, setDupOpen] = useState(false);
  const [dupCalendarOpen, setDupCalendarOpen] = useState(false);
  const [dupTimeOpen, setDupTimeOpen] = useState(false);

  const baseDate = useMemo(() => new Date(task.scheduled_at), [task.scheduled_at]);

  const [dupRange, setDupRange] = useState<DateRange | undefined>({
    from: baseDate,
    to: baseDate,
  });

  const [dupTime, setDupTime] = useState(() => format(baseDate, 'HH:mm'));
  const [duplicating, setDuplicating] = useState(false);

  const timeOptions = useMemo(
    () =>
      Array.from({ length: 24 * 2 }, (_, i) => {
        const h = String(Math.floor(i / 2)).padStart(2, '0');
        const m = i % 2 === 0 ? '00' : '30';
        return `${h}:${m}`;
      }),
    [],
  );

  const rangeLabel = useMemo(() => {
    if (!dupRange?.from) return 'Seleccionar días';
    const fmt = (d: Date) =>
      d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    if (!dupRange.to) return fmt(dupRange.from);
    return `${fmt(dupRange.from)} – ${fmt(dupRange.to)}`;
  }, [dupRange]);

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
      // ✅ evita seleccionar texto durante drag
      className={[
        'group select-none rounded-xl border border-slate-800 bg-gray-700/70 p-2 text-xs text-slate-100',
        'shadow-sm shadow-slate-950/60 hover:border-sky-500/70 hover:bg-gray-700',
        'cursor-grab active:cursor-grabbing',
        // ✅ sin transition-all que a veces “estira”
        'transition-colors',
      ].join(' ')}
      onClick={() => {
        // ✅ si estás arrastrando, no abras detalle
        if (isDragging) return;
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
        <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
          {task.description}
        </div>
      )}

      {/* Notes */}
      <div
        className="mt-2 flex items-center gap-1"
        // ✅ no dispara click/drag raro sobre inputs/botones
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

        <button
          data-no-dnd
          onClick={() => {
            setDupOpen((v) => !v);
            setDupCalendarOpen(false);
            setDupTimeOpen(false);
          }}
          className="rounded-lg bg-slate-900/80 p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          title="Duplicar"
        >
          <Copy className="h-3 w-3" />
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

      {/* Duplicate panel */}
      {dupOpen && (
        <div
          className="mt-2 rounded-lg border border-slate-800 bg-slate-950/80 p-2 text-[11px] text-slate-200"
          onClick={(e) => e.stopPropagation()}
          data-no-dnd
        >
          <div className="mb-1 text-[10px] text-slate-400">Duplicar tarea en otro rango</div>

          <div className="flex flex-wrap gap-2">
            {/* Fecha rango */}
            <div className="relative flex-1 min-w-[140px]">
              <button
                type="button"
                onClick={() => {
                  setDupCalendarOpen((v) => !v);
                  setDupTimeOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-700/70 bg-gray-700/70 px-3 py-1.5 text-left text-[11px] text-slate-100"
              >
                <span className="truncate">{rangeLabel}</span>
                <CalendarDays className="ml-2 h-3 w-3 text-slate-400" />
              </button>

              {dupCalendarOpen && (
                <div className="absolute z-50 mt-2 rounded-2xl border border-slate-800 bg-slate-950/95 p-3 shadow-xl">
                  <DayPicker
                    mode="range"
                    selected={dupRange}
                    onSelect={setDupRange}
                    locale={es}
                    weekStartsOn={1}
                    numberOfMonths={1}
                    showOutsideDays
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => setDupCalendarOpen(false)}
                      className="rounded-full bg-sky-500 px-3 py-1 text-[11px] font-medium text-slate-950"
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Hora */}
            <div className="relative w-[110px]">
              <button
                type="button"
                onClick={() => {
                  setDupTimeOpen((v) => !v);
                  setDupCalendarOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-700/70 bg-gray-700/70 px-3 py-1.5 text-left text-[11px] text-slate-100"
              >
                <span>{dupTime}</span>
                <Clock3 className="ml-2 h-3 w-3 text-slate-400" />
              </button>

              {dupTimeOpen && (
                <div className="absolute right-0 z-50 mt-2 w-[170px] rounded-2xl border border-slate-800 bg-slate-950/95 p-2">
                  {timeOptions.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setDupTime(t);
                        setDupTimeOpen(false);
                      }}
                      className={`block w-full rounded-lg px-2 py-1 text-[11px] ${
                        dupTime === t ? 'bg-sky-500 text-slate-950' : 'hover:bg-slate-800'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={async () => {
                if (!dupRange?.from) return;
                try {
                  setDuplicating(true);
                  await onDuplicateRange(
                    task,
                    toYMD(dupRange.from),
                    toYMD(dupRange.to ?? dupRange.from),
                    dupTime,
                  );
                  setDupOpen(false);
                } finally {
                  setDuplicating(false);
                }
              }}
              disabled={duplicating}
              className="inline-flex items-center rounded-lg bg-emerald-500/90 px-3 py-1 text-[11px] font-medium text-emerald-950"
            >
              {duplicating ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Duplicando...
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" /> Duplicar
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
