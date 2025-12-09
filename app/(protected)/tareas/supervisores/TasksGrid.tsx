import { AnimatePresence, motion } from 'framer-motion';
import type { TaskWithOwner } from '@/lib/tasks';
import {
  STATUS_BADGE_CLASSES,
  STATUS_LABEL,
  formatDate,
  formatTimeFromISO,
} from './supervisorTasksUtils';
import TaskChecklistIndicator from '../TaskChecklistIndicator';

type Props = {
  daysInRange: Date[];
  tasksByDay: Record<string, TaskWithOwner[]>;
  onSelectTask: (task: TaskWithOwner) => void;
};

export default function TasksGrid({
  daysInRange,
  tasksByDay,
  onSelectTask,
}: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {daysInRange.map((day) => {
        const key = day.toISOString().slice(0, 10);
        const list = tasksByDay[key] || [];
        const label = formatDate(day);
        const isToday =
          new Date().toISOString().slice(0, 10) ===
          day.toISOString().slice(0, 10);

        return (
          <div
            key={key}
            className={`flex min-h-[180px] flex-col rounded-2xl border border-slate-800/80 bg-gray-900/95 p-3 shadow-lg shadow-slate-950/40 ${isToday ? 'ring-1 ring-sky-500/60' : ''
              }`}
          >
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-300">
              <span className="uppercase tracking-wide">
                {label.replace('.', '')}
              </span>
              {isToday && (
                <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">
                  Hoy
                </span>
              )}
            </div>

            <div className="flex-1 space-y-2">
              {list.length === 0 ? (
                <div className="flex h-full items-center justify-center text-[11px] text-slate-600">
                  Sin tareas
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {list.map((task) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.16 }}
                      onClick={() => onSelectTask(task)}
                      className="group cursor-pointer rounded-xl border border-slate-800 bg-gray-700/70 p-2 text-xs text-slate-100 shadow-sm shadow-slate-950/60 hover:border-sky-500/70 hover:bg-gray-700"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE_CLASSES[task.status]
                            }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                          {STATUS_LABEL[task.status]}
                        </div>
                        <div className="flex items-center gap-1">
                          <TaskChecklistIndicator taskId={task.id} size={6} />
                          <span className="text-[10px] text-slate-400">
                            {formatTimeFromISO(task.scheduled_at)}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] font-semibold leading-tight">
                        {task.title}
                      </div>
                      {task.description && (
                        <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
                          {task.description}
                        </div>
                      )}

                      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                        <span className="font-medium text-slate-200">
                          {task.owner_full_name ?? '—'}
                        </span>
                        <span className="mx-1 text-slate-500">•</span>
                        <span>
                          {task.owner_branches &&
                            task.owner_branches.length > 0
                            ? task.owner_branches
                              .map(
                                (b) =>
                                  b.charAt(0).toUpperCase() + b.slice(1),
                              )
                              .join(' · ')
                            : 'Sin sucursal'}
                        </span>
                      </div>

                      <div className="mt-2 rounded-lg border border-slate-900 bg-slate-950/60 px-2 py-1 text-[10px] text-slate-500">
                        {task.notes && task.notes.trim().length > 0
                          ? task.notes
                          : 'Sin notas registradas.'}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
