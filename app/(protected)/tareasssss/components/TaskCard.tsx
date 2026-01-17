'use client';

import 'react-day-picker/dist/style.css';
import { useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { CalendarDays, CheckCircle2, Clock3, Copy, Loader2, StickyNote, Trash2 } from 'lucide-react';
import { es } from 'date-fns/locale';
import { format } from 'date-fns';

import type { Task } from '@/lib/tasks';
import TaskChecklistIndicator from '../TaskChecklistIndicator';
import { toYMD } from '../date';

type Props = {
  task: Task;
  BRIEF_STATUS: Record<Task['status'], string>;
  changingStatusId: number | null;
  savingNotesId: number | null;
  deletingId: number | null;
  onToggleStatus: (task: Task) => Promise<Task>;
  onSaveNotes: (task: Task, notes: string) => Promise<Task>;
  onDelete: (task: Task) => Promise<boolean>;
  onDuplicate: (task: Task, dateYMD: string, timeHHmm: string) => Promise<void>;
  onOpenDetail: () => void;
};

export default function TaskCard({
  task,
  BRIEF_STATUS,
  changingStatusId,
  savingNotesId,
  deletingId,
  onToggleStatus,
  onSaveNotes,
  onDelete,
  onDuplicate,
  onOpenDetail,
}: Props) {
  const [notes, setNotes] = useState(task.notes ?? '');

  // duplicado (local, por card)
  const [dupOpen, setDupOpen] = useState(false);
  const [dupCalendarOpen, setDupCalendarOpen] = useState(false);
  const [dupTimeOpen, setDupTimeOpen] = useState(false);
  const [dupDate, setDupDate] = useState(() => toYMD(new Date(task.scheduled_at)));
  const [dupTime, setDupTime] = useState(() => format(new Date(task.scheduled_at), 'HH:mm'));
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

  const dupDateObj = useMemo(() => new Date(`${dupDate}T00:00:00`), [dupDate]);

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
      onClick={onOpenDetail}
      className="group cursor-pointer rounded-xl border border-slate-800 bg-gray-700/70 p-2 text-xs text-slate-100 shadow-sm shadow-slate-950/60 hover:border-sky-500/70 hover:bg-gray-700"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <button
          onClick={async (e) => {
            e.stopPropagation();
            await onToggleStatus(task);
          }}
          disabled={changingStatusId === task.id}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusPill}`}
        >
          {changingStatusId === task.id ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          {BRIEF_STATUS[task.status]}
        </button>

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

      <div className="text-[11px] font-medium leading-tight">{task.title}</div>
      {task.description && (
        <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{task.description}</div>
      )}

      <div className="mt-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <StickyNote className="h-3 w-3 text-slate-500" />
        <input
          className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          placeholder="Notas / observaciones..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <button
          onClick={async () => {
            await onSaveNotes(task, notes);
          }}
          disabled={savingNotesId === task.id}
          className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-900"
        >
          {savingNotesId === task.id ? 'Guardando...' : 'OK'}
        </button>

        <button
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
          onClick={async (e) => {
            e.stopPropagation();
            await onDelete(task);
          }}
          disabled={deletingId === task.id}
          className="rounded-lg bg-slate-900/80 p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed"
          title="Eliminar"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {dupOpen && (
        <div
          className="mt-2 rounded-lg border border-slate-800 bg-slate-950/80 p-2 text-[11px] text-slate-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1 text-[10px] text-slate-400">Duplicar tarea en otra fecha/hora</div>

          <div className="flex flex-wrap gap-2">
            {/* Fecha */}
            <div className="relative flex-1 min-w-[140px]">
              <button
                type="button"
                onClick={() => {
                  setDupCalendarOpen((v) => !v);
                  setDupTimeOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-700/70 bg-gray-700/70 px-3 py-1.5 text-left text-[11px] text-slate-100 hover:border-sky-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <span className="truncate">
                  {dupDateObj.toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <CalendarDays className="ml-2 h-3 w-3 text-slate-400" />
              </button>

              {dupCalendarOpen && (
                <div className="absolute z-50 mt-2 w-max max-w-[90vw] rounded-2xl border border-slate-800 bg-slate-950/95 p-3 text-[11px] text-slate-100 shadow-xl shadow-slate-950/60">
                  <DayPicker
                    mode="single"
                    selected={dupDateObj}
                    onSelect={(d) => {
                      if (!d) return;
                      setDupDate(toYMD(d));
                    }}
                    locale={es}
                    weekStartsOn={1}
                    numberOfMonths={1}
                    showOutsideDays
                    pagedNavigation
                    modifiersClassNames={{
                      selected: 'bg-sky-500 text-slate-950',
                      today: 'border border-sky-400',
                    }}
                  />

                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setDupCalendarOpen(false)}
                      className="rounded-full bg-sky-500 px-3 py-1 text-[11px] font-medium text-slate-950 hover:bg-sky-400"
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
                className="flex w-full items-center justify-between rounded-xl border border-slate-700/70 bg-gray-700/70 px-3 py-1.5 text-left text-[11px] text-slate-100 hover:border-sky-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <span>{dupTime}</span>
                <Clock3 className="ml-2 h-3 w-3 text-slate-400" />
              </button>

              {dupTimeOpen && (
                <div className="absolute right-0 z-50 mt-2 w-[170px] rounded-2xl border border-slate-800 bg-slate-950/95 p-2 text-xs text-slate-100 shadow-xl shadow-slate-950/60">
                  <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Seleccionar hora</span>
                  </div>
                  <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                    {timeOptions.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setDupTime(t);
                          setDupTimeOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-[11px] ${
                          dupTime === t ? 'bg-sky-500 text-slate-950' : 'text-slate-100 hover:bg-slate-800'
                        }`}
                      >
                        <span>{t}</span>
                        {dupTime === t && (
                          <span className="text-[9px] font-semibold uppercase">Seleccionado</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={async () => {
                try {
                  setDuplicating(true);
                  await onDuplicate(task, dupDate, dupTime);
                  setDupOpen(false);
                  setDupCalendarOpen(false);
                  setDupTimeOpen(false);
                } finally {
                  setDuplicating(false);
                }
              }}
              disabled={duplicating}
              className="inline-flex items-center rounded-lg bg-emerald-500/90 px-3 py-1 text-[11px] font-medium text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700/60"
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
