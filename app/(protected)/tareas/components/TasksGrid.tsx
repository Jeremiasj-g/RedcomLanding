'use client';

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Trash2 } from 'lucide-react';
import type { Task } from '@/lib/tasks';
import TaskCard from './TaskCard';
import { useTasksGrouping } from '../hooks/useTasksGrouping';
import { useTaskDuplicator } from '../hooks/useTaskDuplicator';
import { useTaskRescheduler } from '../hooks/useTaskRescheduler';

type Props = {
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

export default function TasksGrid({
  range,
  loading,
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
  const { daysInRange, tasksByDay } = useTasksGrouping(range);
  const { duplicateRange } = useTaskDuplicator();
  const { moveTaskToDay } = useTaskRescheduler();

  // ✅ mapa id->task (sin depender del hook)
  const allTasksById = buildTasksById(tasksByDay);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragEnd = async (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    if (!activeId.startsWith('task:')) return;

    const taskId = Number(activeId.replace('task:', ''));
    const activeTask = allTasksById[taskId];
    if (!activeTask) return;

    // ✅ si soltás sobre columna: day:YYYY-MM-DD
    // ✅ si soltás sobre otra tarea: task:ID -> tomamos el día de esa tarea
    let targetDayKey: string | null = null;

    if (overId.startsWith('day:')) {
      targetDayKey = overId.replace('day:', '');
    } else if (overId.startsWith('task:')) {
      const overTaskId = Number(overId.replace('task:', ''));
      const overTask = allTasksById[overTaskId];
      if (overTask) targetDayKey = overTask.scheduled_at.slice(0, 10);
    }

    if (!targetDayKey) return;

    if (activeTask.scheduled_at.slice(0, 10) === targetDayKey) return;

    try {
      await moveTaskToDay(activeTask, targetDayKey);
    } catch (err) {
      console.error('Error moving task via DnD', err);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
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
                      onDelete={onDelete}
                      onDuplicateRange={async (
                        t: Task,
                        fromYMD: string,
                        toYMD: string,
                        timeHHmm: string,
                      ) => {
                        await duplicateRange(t, fromYMD, toYMD, timeHHmm);
                      }}
                      onOpenDetail={() => onSelectTask(task)}
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
}: any) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  return (
    <div
      ref={setNodeRef}
      className={[
        'group flex min-h-[180px] flex-col rounded-2xl border border-slate-800/80 bg-gray-900/95 p-3 shadow-lg shadow-slate-950/40',
        isToday ? 'ring-1 ring-sky-500/60' : '',
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

      <div className="flex-1 space-y-2">
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

/** Construye un map id->task a partir de tasksByDay */
function buildTasksById(tasksByDay: Record<string, Task[]>) {
  const map: Record<number, Task> = {};
  for (const arr of Object.values(tasksByDay)) {
    for (const t of arr) map[t.id] = t;
  }
  return map;
}
