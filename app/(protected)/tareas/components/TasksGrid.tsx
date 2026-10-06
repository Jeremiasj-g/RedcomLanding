'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useDroppable,
} from '@dnd-kit/core';
import { CheckCircle2, Loader2, Pencil, StickyNote, Trash2 } from 'lucide-react';
import { deleteTask } from '@/lib/tasks';
import { useTasks } from '../TasksContext';
import type { Task } from '@/lib/tasks';
import TaskCard from './TaskCard';
import { useTasksGrouping } from '../hooks/useTasksGrouping';
import { useTaskDuplicator } from '../hooks/useTaskDuplicator';
import { useTaskRescheduler } from '../hooks/useTaskRescheduler';
import { isoToLocalYMD, toYMD } from '../date';
import { notify } from '@/lib/notifications';

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

  onStatusChange: (task: Task, status: Task['status']) => Promise<Task>;
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
  onStatusChange,
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
  const todayKey = toYMD(new Date());
  const fromKey = toYMD(range.from);
  const toKey = toYMD(range.to);
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
const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);
const [activeDragWidth, setActiveDragWidth] = useState<number | null>(null);

function isEditableTarget(el: EventTarget | null) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.isContentEditable) return true;
  // por si el click cae dentro de un editor rich-text
  if (el.closest?.('[contenteditable="true"]')) return true;
  return false;
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
  const fromKey = toYMD(range.from);
  const toKey = toYMD(range.to);
  if (!activeDayKey) {
    setActiveDayKey(fromKey);
    return;
  }
  if (activeDayKey < fromKey || activeDayKey > toKey) {
    const todayKey = toYMD(new Date());
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
      notify.info('Tarea copiada');
      return;
    }

    // Paste
    if (key === 'v') {
      if (!clipboardRef.current) return;
      ev.preventDefault();

      const { task, timeHHmm } = clipboardRef.current;

      // destino: día activo (si no hay, usamos el día del task copiado)
      const fallbackDayKey = isoToLocalYMD(task.scheduled_at);
      const targetDayKey = activeDayKey ?? fallbackDayKey;

      try {
        const created = await duplicate(task, targetDayKey, timeHHmm);
        // para poder deshacer
        undoStackRef.current.push({ type: 'paste', taskId: created.id });
        // buena UX: “seleccionamos” la nueva
        setSelectedTaskId(created.id);
        // también activamos la columna destino
        setActiveDayKey(targetDayKey);
        notify.success(`Tarea pegada en ${targetDayKey}`);
      } catch (err) {
        console.error('Error pasting task', err);
      notify.error('No se pudo pegar la tarea.');
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
        notify.info('Pegado deshecho');
      } catch (err) {
        console.error('Error undo paste', err);
        notify.error('No se pudo deshacer el pegado.');
      }
    }
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [activeDayKey, selectedTaskId, allTasksById]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const dayKeysInRange = daysInRange.map(toYMD);

  const resolveDayKeyFromOverId = (overId: string | null) => {
    if (!overId) return null;
    if (overId.startsWith('day:')) return overId.replace('day:', '');
    if (overId.startsWith('task:')) {
      const overTaskId = Number(overId.replace('task:', ''));
      const overTask = allTasksById[overTaskId];
      return overTask ? isoToLocalYMD(overTask.scheduled_at) : null;
    }
    return null;
  };

  const onDragStart = (e: DragStartEvent) => {
    const activeId = String(e.active.id);
    if (!activeId.startsWith('task:')) return;
    const taskId = Number(activeId.replace('task:', ''));
    const t = allTasksById[taskId];
    if (!t) return;

    // Guardamos una instantánea estable para el overlay y para onDragEnd.
    // Así no dependemos de que la lista filtrada cambie mientras arrastramos.
    setActiveDragTask(t);
    setActiveDragWidth(e.active.rect.current.initial?.width ?? null);

    if (ctrlPressedRef.current) {
      setDragCopyTaskId(taskId);
      dragCopyStartDayRef.current = isoToLocalYMD(t.scheduled_at);
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

  const clearDragState = () => {
    setActiveDragTask(null);
    setActiveDragWidth(null);
    setDragCopyTaskId(null);
    dragCopyStartDayRef.current = null;
    setDragCopyDays(new Set());
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;

    if (!activeId.startsWith('task:') || !overId) {
      clearDragState();
      return;
    }

    const taskId = Number(activeId.replace('task:', ''));
    const activeTask =
      activeDragTask?.id === taskId
        ? activeDragTask
        : allTasksById[taskId];
    const targetDayKey = resolveDayKeyFromOverId(overId);

    if (!activeTask || !targetDayKey) {
      clearDragState();
      return;
    }

    const sourceDayKey = isoToLocalYMD(activeTask.scheduled_at);
    const sameDay = sourceDayKey === targetDayKey;
    const copyMode = ctrlPressedRef.current;
    const copyDaysSnapshot = dragCopyDays.size
      ? Array.from(dragCopyDays)
      : [targetDayKey].filter((dayKey) => dayKey !== sourceDayKey);

    // DragOverlay mantiene estable el nodo arrastrado. Podemos cerrar el drag
    // y actualizar el estado optimista de inmediato, sin la demora visual anterior.
    clearDragState();

    try {
      if (copyMode) {
        const timeHHmm = hhmmFromISO(activeTask.scheduled_at);
        let createdLast: Task | null = null;
        let createdCount = 0;

        for (const dayKey of copyDaysSnapshot) {
          if (dayKey === sourceDayKey) continue;
          const created = await duplicate(activeTask, dayKey, timeHHmm);
          undoStackRef.current.push({ type: 'paste', taskId: created.id });
          createdLast = created;
          createdCount += 1;
        }

        if (createdLast) {
          setSelectedTaskId(createdLast.id);
          setActiveDayKey(targetDayKey);
        }

        if (createdCount > 0) {
          notify.success(
            createdCount === 1
              ? `Tarea copiada a ${targetDayKey}`
              : `Tarea copiada en ${createdCount} días`,
          );
        }
        return;
      }

      if (sameDay) return;

      await moveTaskToDay(activeTask, targetDayKey);
      setActiveDayKey(targetDayKey);
      notify.success(`Tarea movida a ${targetDayKey}`);
    } catch (err) {
      console.error('Error moving task via DnD', err);
      notify.error('No se pudo mover la tarea. Se restauró su ubicación anterior.');
    }
  };


  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragCancel={clearDragState}
      onDragEnd={onDragEnd}
    >

      <DragOverlay dropAnimation={null} zIndex={80}>
        {activeDragTask ? (
          <TaskDragOverlayCard task={activeDragTask} width={activeDragWidth} />
        ) : null}
      </DragOverlay>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {daysInRange.map((day) => {
          const dayKey = toYMD(day);
          const list = tasksByDay[dayKey] || [];

          const label = day.toLocaleDateString('es-AR', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
          });

          const isToday = toYMD(new Date()) === dayKey;

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
              {list.map((task) => (
                <div key={task.id}>
                  <TaskCard
                    dndId={taskDragId(task.id)}
                    task={task}
                    BRIEF_STATUS={BRIEF_STATUS}
                    changingStatusId={changingStatusId}
                    savingNotesId={savingNotesId}
                    deletingId={deletingId}
                    onStatusChange={onStatusChange}
                    onSaveNotes={onSaveNotes}
                    onDelete={onDelete}
                    onOpenDetail={() => {
                      setSelectedTaskId(task.id);
                      onSelectTask(task);
                    }}
                    onQuickCopy={(t: Task) => {
                      clipboardRef.current = {
                        task: t,
                        timeHHmm: hhmmFromISO(t.scheduled_at),
                      };
                      setSelectedTaskId(t.id);
                      notify.info('Tarea copiada');
                    }}
                  />
                </div>
              ))}
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
        'group flex min-h-[205px] flex-col rounded-[20px] border border-white/[0.08] bg-[#151517] p-3.5 shadow-[0_14px_35px_rgba(0,0,0,.12)] transition',
        isToday ? 'border-[#0a84ff]/35 ring-1 ring-[#0a84ff]/18' : '',
        isActive ? 'ring-2 ring-[#5ac8fa]/25' : '',
        isOver ? 'ring-2 ring-emerald-400/20' : '',
      ].join(' ')}
    >
      <div className="mb-3 flex items-center justify-between text-[10px] font-medium text-white/[0.62]">
        <span className="uppercase tracking-[0.09em]">{String(label).replace('.', '')}</span>
        {isToday && (
          <span className="rounded-full border border-[#0a84ff]/15 bg-[#0a84ff]/10 px-2 py-0.5 text-[9px] font-medium text-[#5ac8fa]">
            Hoy
          </span>
        )}
      </div>

      <div className="relative flex-1 space-y-2">
        {loading && list.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[10px] text-white/[0.32]">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Cargando...
          </div>
        ) : list.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[10px] font-normal text-white/[0.28]">
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
            className="inline-flex items-center gap-1 rounded-[9px] bg-white/[0.035] px-2 py-1 text-[9px] text-white/[0.34] opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed"
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

function TaskDragOverlayCard({
  task,
  width,
}: {
  task: Task;
  width: number | null;
}) {
  const statusPill =
    task.status === 'done'
      ? 'border border-emerald-400/15 bg-emerald-400/10 text-emerald-300'
      : task.status === 'in_progress'
        ? 'border border-[#0a84ff]/15 bg-[#0a84ff]/10 text-[#5ac8fa]'
        : task.status === 'cancelled'
          ? 'border border-rose-400/15 bg-rose-400/10 text-rose-300'
          : 'border border-white/[0.08] bg-white/[0.05] text-white/[0.64]';

  const statusLabel =
    task.status === 'done'
      ? 'Completada'
      : task.status === 'in_progress'
        ? 'En progreso'
        : task.status === 'cancelled'
          ? 'Cancelada'
          : 'Pendiente';

  return (
    <div
      style={{ width: width ?? 260 }}
      className="pointer-events-none select-none rounded-[14px] border border-white/[0.10] bg-[#242426] p-2.5 text-xs text-white/[0.88] opacity-90 shadow-[0_18px_45px_rgba(0,0,0,.36)]"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusPill}`}
        >
          <CheckCircle2 className="h-3 w-3" />
          {statusLabel}
        </span>
        <span className="text-[10px] text-white/[0.38]">
          {hhmmFromISO(task.scheduled_at)}
        </span>
      </div>

      <div className="text-[11px] font-medium leading-tight">{task.title}</div>
      {task.description ? (
        <div className="mt-0.5 line-clamp-2 text-[11px] text-white/[0.46]">
          {task.description}
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-1">
        <StickyNote className="h-3 w-3 text-slate-500" />
        <div className="min-w-0 flex-1 truncate rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-[11px] text-white/[0.46]">
          {task.notes?.trim() || 'Notas / observaciones...'}
        </div>
        <span className="rounded-[8px] bg-white/[0.06] px-2 py-1 text-[10px] text-white/[0.64]">
          OK
        </span>
        <span className="rounded-[8px] bg-white/[0.035] p-1 text-white/[0.42]">
          <Pencil className="h-3 w-3" />
        </span>
        <span className="rounded-[8px] bg-white/[0.035] p-1 text-white/[0.30]">
          <Trash2 className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

function GhostTaskCard({ task }: { task: Task }) {
  const statusLabel = task.status === 'done' ? 'Completada' : task.status === 'in_progress' ? 'En progreso' : 'Pendiente';
  const time = hhmmFromISO(task.scheduled_at);
  return (
    <div className="pointer-events-none rounded-[14px] border border-dashed border-white/[0.16] bg-white/[0.025] p-3 opacity-45 backdrop-blur">
      <div className="mb-1 flex items-center justify-between text-[11px] text-white/[0.54]">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/[0.58]">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300/70" />
          {statusLabel}
        </span>
        <span className="text-[10px] text-white/[0.38]">{time}</span>
      </div>
      <div className="text-xs font-medium tracking-[-0.01em] text-white/[0.86]">
        {task.title}
      </div>
      {!!task.description && (
        <div className="mt-1 line-clamp-2 text-[11px] text-white/[0.42]">
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
