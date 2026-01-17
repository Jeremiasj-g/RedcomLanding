import { AnimatePresence, motion } from 'framer-motion';
import type { TaskWithOwner } from '@/lib/tasks';
import {
  STATUS_BADGE_CLASSES,
  STATUS_LABEL,
  formatDate,
  formatTimeFromISO,
} from './supervisorTasksUtils';

type Props = {
  tasks: TaskWithOwner[];
  onSelectTask: (task: TaskWithOwner) => void;
};

export default function TasksTable({ tasks, onSelectTask }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/80">
      <div className="grid grid-cols-[1.3fr_1.1fr_0.8fr_0.8fr_1.2fr_1.4fr] border-b border-slate-800/80 bg-slate-900/80 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        <div>Supervisor</div>
        <div>Tarea</div>
        <div>Fecha</div>
        <div>Hora</div>
        <div>Sucursal</div>
        <div>Estado / Notas</div>
      </div>

      <AnimatePresence initial={false}>
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            onClick={() => onSelectTask(task)}
            className="grid cursor-pointer grid-cols-[1.3fr_1.1fr_0.8fr_0.8fr_1.2fr_1.4fr] border-t border-slate-900/70 px-3 py-2 text-[11px] text-slate-100 hover:bg-slate-900/70"
          >
            {/* Supervisor */}
            <div className="flex flex-col">
              <span className="font-medium">
                {task.owner_full_name ?? '—'}
              </span>
            </div>

            {/* Tarea */}
            <div className="flex flex-col">
              <span className="font-medium line-clamp-1">{task.title}</span>
              {task.description && (
                <span className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">
                  {task.description}
                </span>
              )}
            </div>

            {/* Fecha */}
            <div className="flex items-center text-[10px] text-slate-300">
              {formatDate(new Date(task.scheduled_at)).replace('.', '')}
            </div>

            {/* Hora */}
            <div className="flex items-center text-[10px] text-slate-400">
              {formatTimeFromISO(task.scheduled_at)}
            </div>

            {/* Sucursal */}
            <div className="flex items-center text-[10px] text-slate-300">
              {task.owner_branches && task.owner_branches.length > 0
                ? task.owner_branches
                    .map((b) => b.charAt(0).toUpperCase() + b.slice(1))
                    .join(' · ')
                : '—'}
            </div>

            {/* Estado / Notas */}
            <div className="flex flex-col gap-1">
              <div
                className={`inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  STATUS_BADGE_CLASSES[task.status]
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                {STATUS_LABEL[task.status]}
              </div>

              <div className="rounded-lg border border-slate-900 bg-slate-950/60 px-2 py-1 text-[10px] text-slate-200">
                {task.notes && task.notes.trim().length > 0
                  ? task.notes
                  : 'Sin notas registradas.'}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
