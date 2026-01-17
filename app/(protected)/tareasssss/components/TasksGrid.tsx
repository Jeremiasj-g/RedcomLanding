'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Trash2 } from 'lucide-react';

import type { Task } from '@/lib/tasks';
import { useTasksGrouping } from '../hooks/useTasksGrouping';
import { useTaskActions } from '../hooks/useTaskActions';
import { useTaskDuplicator } from '../hooks/useTaskDuplicator';
import TaskCard from './TaskCard';

type Props = {
  range: { from: Date; to: Date };
  loading: boolean;
  onSelectTask: (task: Task) => void;
};

export default function TasksGrid({ range, loading, onSelectTask }: Props) {
  const { daysInRange, tasksByDay } = useTasksGrouping(range);
  const {
    BRIEF_STATUS,
    savingNotesId,
    changingStatusId,
    deletingId,
    deletingDayKey,
    toggleStatus,
    saveNotes,
    removeTask,
    removeDay,
  } = useTaskActions();
  const { duplicate } = useTaskDuplicator();

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {daysInRange.map((day) => {
        const key = day.toISOString().slice(0, 10);
        const list = tasksByDay[key] || [];

        const label = day.toLocaleDateString('es-AR', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
        });

        const isToday = new Date().toISOString().slice(0, 10) === key;

        return (
          <div
            key={key}
            className={`group flex min-h-[180px] flex-col rounded-2xl border border-slate-800/80 bg-gray-900/95 p-3 shadow-lg shadow-slate-950/40 ${
              isToday ? 'ring-1 ring-sky-500/60' : ''
            }`}
          >
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-300">
              <span className="uppercase tracking-wide">{label.replace('.', '')}</span>
              {isToday && (
                <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">Hoy</span>
              )}
            </div>

            <div className="flex-1 space-y-2">
              {loading && list.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-500">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Cargando...
                </div>
              ) : list.length === 0 ? (
                <div className="flex h-full items-center justify-center text-[11px] text-gray-400">Sin tareas</div>
              ) : (
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
                        task={task}
                        BRIEF_STATUS={BRIEF_STATUS}
                        changingStatusId={changingStatusId}
                        savingNotesId={savingNotesId}
                        deletingId={deletingId}
                        onToggleStatus={toggleStatus}
                        onSaveNotes={saveNotes}
                        onDelete={removeTask}
                        onDuplicate={async (t, dateYMD, timeHHmm) => {
                          await duplicate(t, dateYMD, timeHHmm);
                        }}
                        onOpenDetail={() => onSelectTask(task)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {list.length > 0 && (
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => removeDay(key, list)}
                  disabled={deletingDayKey === key}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 text-[10px] text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed"
                >
                  {deletingDayKey === key ? (
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
      })}
    </section>
  );
}
