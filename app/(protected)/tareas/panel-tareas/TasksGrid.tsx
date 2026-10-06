'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Clock3, Repeat2, UserRound } from 'lucide-react';
import type { TaskWithOwner } from '@/lib/tasks';
import {
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

function statusClasses(status: TaskWithOwner['status']) {
  if (status === 'done') return 'bg-emerald-400/10 text-emerald-300';
  if (status === 'in_progress') return 'bg-sky-400/10 text-sky-300';
  if (status === 'cancelled') return 'bg-rose-400/10 text-rose-300';
  return 'bg-white/[0.05] text-white/[0.52]';
}

function recurrenceLabel(task: TaskWithOwner) {
  if (task.recurrence_type === 'daily') return 'Diaria';
  if (task.recurrence_type === 'weekly') return 'Semanal';
  if (task.recurrence_type === 'first_business_day_month') return 'Mensual';
  if (task.recurrence_type === 'every_n_days') {
    return `Cada ${task.recurrence_interval_days ?? 1} días`;
  }
  return null;
}

export default function TasksGrid({
  daysInRange,
  tasksByDay,
  onSelectTask,
}: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {daysInRange.map((day) => {
        const key = day.toISOString().slice(0, 10);
        const list = tasksByDay[key] || [];
        const label = formatDate(day);
        const isToday =
          new Date().toISOString().slice(0, 10) ===
          day.toISOString().slice(0, 10);

        return (
          <section
            key={key}
            className={[
              'flex min-h-[330px] flex-col rounded-[20px] border bg-[#151517] p-3.5 shadow-[0_14px_38px_rgba(0,0,0,.12)] transition',
              isToday
                ? 'border-[#0a84ff]/30 ring-1 ring-[#0a84ff]/10'
                : 'border-white/[0.08]',
            ].join(' ')}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-white/[0.60]">
                {label.replace('.', '')}
              </span>
              <div className="flex items-center gap-2">
                {list.length > 0 ? (
                  <span className="rounded-full bg-white/[0.045] px-2 py-0.5 text-[9px] text-white/[0.34]">
                    {list.length}
                  </span>
                ) : null}
                {isToday ? (
                  <span className="rounded-full bg-[#0a84ff]/12 px-2 py-0.5 text-[9px] font-medium text-[#8bc7ff]">
                    Hoy
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex-1 space-y-2">
              {list.length === 0 ? (
                <div className="grid h-full min-h-[240px] place-items-center rounded-[14px] border border-dashed border-white/[0.05]">
                  <span className="text-[10px] text-white/[0.20]">Sin tareas</span>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {list.map((task) => {
                    const repeat = recurrenceLabel(task);
                    return (
                      <motion.article
                        key={task.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => onSelectTask(task)}
                        className="group cursor-pointer rounded-[14px] border border-white/[0.07] bg-[#1c1c1e] p-3 transition hover:border-white/[0.13] hover:bg-[#202023]"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-medium ${statusClasses(task.status)}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {STATUS_LABEL[task.status]}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[9px] text-white/[0.28]">
                            <TaskChecklistIndicator taskId={task.id} size={6} />
                            <Clock3 className="h-3 w-3" />
                            {formatTimeFromISO(task.scheduled_at)}
                          </span>
                        </div>

                        <h3 className="line-clamp-2 text-[11px] font-medium leading-4 text-white/[0.88]">
                          {task.title}
                        </h3>

                        {task.description ? (
                          <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-white/[0.36]">
                            {task.description}
                          </p>
                        ) : null}

                        <div className="mt-2.5 flex min-w-0 items-center gap-1.5 text-[9px] text-white/[0.36]">
                          <UserRound className="h-3 w-3 shrink-0 text-white/[0.26]" />
                          <span className="truncate font-medium text-white/[0.54]">
                            {task.owner_full_name ?? 'Sin nombre'}
                          </span>
                        </div>

                        <div className="mt-1 truncate text-[9px] text-white/[0.26]">
                          {task.owner_branches?.length
                            ? task.owner_branches
                                .map((branch) =>
                                  branch.charAt(0).toUpperCase() + branch.slice(1),
                                )
                                .join(' · ')
                            : 'Sin sucursal'}
                        </div>

                        {repeat ? (
                          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#0a84ff]/10 px-2 py-0.5 text-[9px] text-[#5ac8fa]">
                            <Repeat2 className="h-3 w-3" />
                            {repeat}
                          </div>
                        ) : null}
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
