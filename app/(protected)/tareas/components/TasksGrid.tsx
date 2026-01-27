'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useDroppable,
} from '@dnd-kit/core';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Copy, Loader2, Trash2 } from 'lucide-react';
import { deleteTask } from '@/lib/tasks';
import { useTasks } from '../TasksContext';
import type { Task } from '@/lib/tasks';
import TaskCard from './TaskCard';
import { useTasksGrouping } from '../hooks/useTasksGrouping';
import { useTaskDuplicator } from '../hooks/useTaskDuplicator';
import { useTaskRescheduler } from '../hooks/useTaskRescheduler';

type Props = {
  statusFilter: 'all' | Task['status'];
  search: string;

  range: { from: Date; to: Date };
  loading: boolean;
  onSelectTask: (t: Task) => void;

  // ✅ props que TaskCard necesita (antes las tenía tu board)
  BRIEF_STATUS: Record<Task['status'], string>;
  changingStatusId: number | null;
  savingNotesId: number | null;
  deletingId: number | null;

  onToggleStatus: (task: Task) => Promise<Task>;
  onSaveNotes: (task: Task, notes: string) => Promise<Task>;
  onDelete: (task: Task) => Promise<boolean>;

  // opcional: borrar día
  onDeleteDay?: (dayKey: string, dayTasks: Task[]) => Promise<void> | void;
  deletingDayKey?: string | null;
};

function dayDropId(dayKey: string) {
  return `day:${dayKey}`;
}
function taskDragId(taskId: number) {
  return `task:${taskId}`;
}

// helper: extrae HH:mm de un ISO
// helper: HH:mm LOCAL (lo mismo que ve el usuario en pantalla)
function hhmmFromISO(iso: string) {
  const d = new Date(iso);
  // Forzamos 2 dígitos y formato 24h
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function TasksGrid({
  range,
  loading,
  statusFilter,
  search,
  onSelectTask,
  BRIEF_STATUS,
  changingStatusId,
  savingNotesId,
  deletingId,
  onToggleStatus,
  onSaveNotes,
  onDelete,
  onDeleteDay,
  deletingDayKey,
}: Props) {
  const { daysInRange, tasksByDay: tasksByDayAll } = useTasksGrouping(range);

  const tasksByDay = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map: Record<string, Task[]> = {};
    for (const dayKey of Object.keys(tasksByDayAll)) {
      const list = tasksByDayAll[dayKey] ?? [];
      map[dayKey] = list.filter((t) => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        if (!q) return true;
        const hay = `${t.title ?? ''} ${t.description ?? ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return map;
  }, [tasksByDayAll, statusFilter, search]);
  const { duplicate, duplicateRange } = useTaskDuplicator();
  const { moveTaskToDay } = useTaskRescheduler();

  // ✅ mapa id->task (sin depender del hook)
  const allTasksById = buildTasksById(tasksByDay);
const { setTasks } = useTasks();

// ====== Copy/Paste UX ======
const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

// Columna (día) activa para pegar (click en el contenedor/encabezado)
const [activeDayKey, setActiveDayKey] = useState<string | null>(() => {
  const todayKey = new Date().toISOString().slice(0, 10);
  const fromKey = range.from.toISOString().slice(0, 10);
  const toKey = range.to.toISOString().slice(0, 10);
  if (todayKey >= fromKey && todayKey <= toKey) return todayKey;
  return fromKey;
});

const clipboardRef = useRef<{ task: Task; timeHHmm: string } | null>(null);
const undoStackRef = useRef<Array<{ type: 'paste'; taskId: number }>>([]);

const ctrlPressedRef = useRef(false);

// ====== Ctrl + Drag Copy trail ======
const [dragCopyTaskId, setDragCopyTaskId] = useState<number | null>(null);
const [dragCopyDays, setDragCopyDays] = useState<Set<string>>(() => new Set());
const dragCopyStartDayRef = useRef<string | null>(null);

const [toastMsg, setToastMsg] = useState<string | null>(null);
const toastTimerRef = useRef<number | null>(null);

function showToast(msg: string) {
  setToastMsg(msg);
  if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 2400);
}

function isEditableTarget(el: EventTarget | null) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.isContentEditable) return true;
  // por si el click cae dentro de un editor rich-text
  if (el.closest?.('[contenteditable="true"]')) return true;
  return false;
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function isSameYMD(a: string, b: string) {
  return a === b;
}

function betweenInclusive(dayKeys: string[], a: string, b: string) {
  const ia = dayKeys.indexOf(a);
  const ib = dayKeys.indexOf(b);
  if (ia === -1 || ib === -1) return [] as string[];
  const [from, to] = ia <= ib ? [ia, ib] : [ib, ia];
  return dayKeys.slice(from, to + 1);
}



useEffect(() => {
  // Si cambia el rango y el día activo queda fuera, lo reubicamos
  const fromKey = range.from.toISOString().slice(0, 10);
  const toKey = range.to.toISOString().slice(0, 10);
  if (!activeDayKey) {
    setActiveDayKey(fromKey);
    return;
  }
  if (activeDayKey < fromKey || activeDayKey > toKey) {
    const todayKey = new Date().toISOString().slice(0, 10);
    if (todayKey >= fromKey && todayKey <= toKey) setActiveDayKey(todayKey);
    else setActiveDayKey(fromKey);
  }
}, [range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps

useEffect(() => {
  const onKey = (ev: KeyboardEvent) => {
    ctrlPressedRef.current = !!(ev.ctrlKey || ev.metaKey);
  };
  const onKeyUp = (ev: KeyboardEvent) => {
    // cuando soltás Ctrl/Cmd
    if (!(ev.ctrlKey || ev.metaKey)) ctrlPressedRef.current = false;
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
  };
}, []);

useEffect(() => {
  const onKeyDown = async (ev: KeyboardEvent) => {
    const mod = ev.ctrlKey || ev.metaKey;
    if (!mod) return;

    // no interceptar si el user está escribiendo en inputs/editores
    if (isEditableTarget(ev.target)) return;

    const key = ev.key.toLowerCase();

    // Copy
    if (key === 'c') {
      const t = selectedTaskId ? allTasksById[selectedTaskId] : null;
      if (!t) return;
      ev.preventDefault();
      clipboardRef.current = { task: t, timeHHmm: hhmmFromISO(t.scheduled_at) };
      showToast('Tarea copiada');
      return;
    }

    // Paste
    if (key === 'v') {
      if (!clipboardRef.current) return;
      ev.preventDefault();

      const { task, timeHHmm } = clipboardRef.current;

      // destino: día activo (si no hay, usamos el día del task copiado)
      const fallbackDayKey = task.scheduled_at.slice(0, 10);
      const targetDayKey = activeDayKey ?? fallbackDayKey;

      try {
        const created = await duplicate(task, targetDayKey, timeHHmm);
        // para poder deshacer
        undoStackRef.current.push({ type: 'paste', taskId: created.id });
        // buena UX: “seleccionamos” la nueva
        setSelectedTaskId(created.id);
        // también activamos la columna destino
        setActiveDayKey(targetDayKey);
        showToast(`Tarea pegada en ${targetDayKey}`);
      } catch (err) {
        console.error('Error pasting task', err);
      }
      return;
    }

    // Undo (solo para "paste" local)
    if (key === 'z' && !ev.shiftKey) {
      const last = undoStackRef.current.pop();
      if (!last) return;
      if (last.type !== 'paste') return;

      ev.preventDefault();
      try {
        await deleteTask(last.taskId);
        setTasks((prev) => prev.filter((t) => t.id !== last.taskId));
        showToast('Pegado deshecho');
      } catch (err) {
        console.error('Error undo paste', err);
      }
    }
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [activeDayKey, selectedTaskId, allTasksById]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const dayKeysInRange = daysInRange.map(ymd);

  const resolveDayKeyFromOverId = (overId: string | null) => {
    if (!overId) return null;
    if (overId.startsWith('day:')) return overId.replace('day:', '');
    if (overId.startsWith('task:')) {
      const overTaskId = Number(overId.replace('task:', ''));
      const overTask = allTasksById[overTaskId];
      return overTask ? overTask.scheduled_at.slice(0, 10) : null;
    }
    return null;
  };

  const onDragStart = (e: DragStartEvent) => {
    const activeId = String(e.active.id);
    if (!activeId.startsWith('task:')) return;
    const taskId = Number(activeId.replace('task:', ''));
    const t = allTasksById[taskId];
    if (!t) return;

    if (ctrlPressedRef.current) {
      setDragCopyTaskId(taskId);
      dragCopyStartDayRef.current = t.scheduled_at.slice(0, 10);
      setDragCopyDays(new Set());
    }
  };

  const onDragOver = (e: DragOverEvent) => {
    if (!ctrlPressedRef.current) return;
    if (!dragCopyTaskId) return;
    const startDay = dragCopyStartDayRef.current;
    if (!startDay) return;
    const overId = e.over?.id ? String(e.over.id) : null;
    const overDay = resolveDayKeyFromOverId(overId);
    if (!overDay) return;

    // ✅ armamos el "rastro" como rango inclusivo desde el día de origen hasta el día actual
    const inclusive = betweenInclusive(dayKeysInRange, startDay, overDay);
    const next = new Set(inclusive.filter((k) => !isSameYMD(k, startDay)));
    setDragCopyDays(next);
  };

  const clearDragCopy = () => {
    setDragCopyTaskId(null);
    dragCopyStartDayRef.current = null;
    setDragCopyDays(new Set());
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) {
      clearDragCopy();
      return;
    }

    if (!activeId.startsWith('task:')) {
      clearDragCopy();
      return;
    }

    const taskId = Number(activeId.replace('task:', ''));
    const activeTask = allTasksById[taskId];
    if (!activeTask) {
      clearDragCopy();
      return;
    }

    const targetDayKey = resolveDayKeyFromOverId(overId);

    if (!targetDayKey) {
      clearDragCopy();
      return;
    }

    const sameDay = activeTask.scheduled_at.slice(0, 10) === targetDayKey;

    try {
      // ✅ Ctrl/Cmd + Drag => copiar al soltar (la original queda)
      if (ctrlPressedRef.current) {
        const timeHHmm = hhmmFromISO(activeTask.scheduled_at);

        // Si construimos rastro (range), copiamos a todos esos días.
        const startDay = activeTask.scheduled_at.slice(0, 10);
        const daysToCopy = dragCopyDays.size
          ? Array.from(dragCopyDays)
          : [targetDayKey].filter((k) => !isSameYMD(k, startDay));

        let createdLast: Task | null = null;
        for (const dayKey of daysToCopy) {
          // evitamos duplicar en el mismo día de origen
          if (isSameYMD(dayKey, startDay)) continue;
          const created = await duplicate(activeTask, dayKey, timeHHmm);
          undoStackRef.current.push({ type: 'paste', taskId: created.id });
          createdLast = created;
        }

        if (createdLast) {
          setSelectedTaskId(createdLast.id);
          setActiveDayKey(targetDayKey);
        }

        const n = daysToCopy.length;
        showToast(
          n <= 1
            ? `Tarea copiada a ${targetDayKey}`
            : `Tarea copiada en ${n} días`,
        );
        return;
      }

      // normal: mover
      if (sameDay) return;
      await moveTaskToDay(activeTask, targetDayKey);
    } catch (err) {
      console.error('Error moving task via DnD', err);
    } finally {
      clearDragCopy();
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragCancel={clearDragCopy}
      onDragEnd={onDragEnd}
    >
      <AnimatePresence initial={false}>
        {toastMsg && (
          <motion.div
            key="toast"
            aria-live="polite"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed left-1/2 top-5 z-[70] -translate-x-1/2"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-950/90 to-slate-900/80 px-4 py-2 text-sm text-slate-50 shadow-2xl shadow-black/50 backdrop-blur">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/30">
                {toastMsg.toLowerCase().includes('copiad') ? (
                  <Copy className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
              </span>
              <span className="font-medium">{toastMsg}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {daysInRange.map((day) => {
          const dayKey = day.toISOString().slice(0, 10);
          const list = tasksByDay[dayKey] || [];

          const label = day.toLocaleDateString('es-AR', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
          });

          const isToday = new Date().toISOString().slice(0, 10) === dayKey;

          return (
            <DayColumn
              key={dayKey}
              droppableId={dayDropId(dayKey)}
              label={label}
              isToday={isToday}
              loading={loading}
              list={list}
              onDeleteDay={onDeleteDay}
              deletingDayKey={deletingDayKey}
              dayKey={dayKey}
              isActive={activeDayKey === dayKey}
              onActivate={() => setActiveDayKey(dayKey)}
              ghostTask={
                dragCopyTaskId ? allTasksById[dragCopyTaskId] : null
              }
              showGhost={
                !!dragCopyTaskId && dragCopyDays.has(dayKey)
              }
            >
              <AnimatePresence initial={false}>
                {list.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                  >
                    <TaskCard
                      dndId={taskDragId(task.id)}
                      task={task}
                      BRIEF_STATUS={BRIEF_STATUS}
                      changingStatusId={changingStatusId}
                      savingNotesId={savingNotesId}
                      deletingId={deletingId}
                      onToggleStatus={onToggleStatus}
                      onSaveNotes={onSaveNotes}
                      onDelete={onDelete}onOpenDetail={() => { setSelectedTaskId(task.id); onSelectTask(task); }}
                      onQuickCopy={(t: Task) => {
                        clipboardRef.current = { task: t, timeHHmm: hhmmFromISO(t.scheduled_at) };
                        setSelectedTaskId(t.id);
                        showToast('Tarea copiada');
                      }}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </DayColumn>
          );
        })}
      </section>
    </DndContext>
  );
}

function DayColumn({
  droppableId,
  label,
  isToday,
  loading,
  list,
  children,
  onDeleteDay,
  deletingDayKey,
  dayKey,
  isActive,
  onActivate,
  ghostTask,
  showGhost,
}: any) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  return (
    <div
      ref={setNodeRef}
      tabIndex={0}
      onMouseDown={() => onActivate?.()}
      onFocus={() => onActivate?.()}
      className={[
        'group flex min-h-[180px] flex-col rounded-2xl border border-slate-800/80 bg-gray-900/95 p-3 shadow-lg shadow-slate-950/40',
        isToday ? 'ring-1 ring-sky-500/60' : '',
        isActive ? 'ring-2 ring-sky-400/50' : '',
        isOver ? 'ring-1 ring-emerald-500/40' : '',
      ].join(' ')}
    >
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-300">
        <span className="uppercase tracking-wide">{String(label).replace('.', '')}</span>
        {isToday && (
          <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">
            Hoy
          </span>
        )}
      </div>

      <div className="relative flex-1 space-y-2">
        {loading && list.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Cargando...
          </div>
        ) : list.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[11px] text-gray-400">
            Sin tareas
          </div>
        ) : (
          children
        )}

        {/* ✅ rastro fantasma para Ctrl+Drag-copy */}
        {showGhost && ghostTask && (
          list.length === 0 ? (
            <div className="pointer-events-none absolute inset-x-0 top-0">
              <GhostTaskCard task={ghostTask} />
            </div>
          ) : (
            <GhostTaskCard task={ghostTask} />
          )
        )}
      </div>

      {!!onDeleteDay && list.length > 0 && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={() => onDeleteDay(dayKey, list)}
            disabled={deletingDayKey === dayKey}
            className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 text-[10px] text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed"
          >
            {deletingDayKey === dayKey ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            <span>Eliminar día</span>
          </button>
        </div>
      )}
    </div>
  );
}

function GhostTaskCard({ task }: { task: Task }) {
  const statusLabel = task.status === 'done' ? 'Completada' : task.status === 'in_progress' ? 'En progreso' : 'Pendiente';
  const time = hhmmFromISO(task.scheduled_at);
  return (
    <div className="pointer-events-none rounded-2xl border border-dashed border-slate-500/50 bg-slate-950/20 p-3 opacity-35 shadow-sm backdrop-blur">
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-200">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300/70" />
          {statusLabel}
        </span>
        <span className="text-[10px] text-slate-400">{time}</span>
      </div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-100">
        {task.title}
      </div>
      {!!task.description && (
        <div className="mt-1 line-clamp-2 text-[11px] text-slate-300/80">
          {task.description}
        </div>
      )}
    </div>
  );
}

/** Construye un map id->task a partir de tasksByDay */
function buildTasksById(tasksByDay: Record<string, Task[]>) {
  const map: Record<number, Task> = {};
  for (const arr of Object.values(tasksByDay)) {
    for (const t of arr) map[t.id] = t;
  }
  return map;
}
