'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import type { Task } from '@/lib/tasks';
import TaskChecklistSection from '../TaskChecklistSection';

type Props = {
  task: Task | null;
  briefStatusLabel: (status: Task['status']) => string;
  onClose: () => void;
  onTaskUpdate: (next: Task) => void;
  onAllDone: (task: Task) => Promise<Task>;
};

export default function TaskDetailModal({
  task,
  briefStatusLabel,
  onClose,
  onTaskUpdate,
  onAllDone,
}: Props) {
  return (
    <AnimatePresence>
      {task && (
        <motion.div
          key={task.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-gray-800 text-slate-100 shadow-2xl shadow-slate-950/70"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5">
                    <CalendarDays className="mr-1 h-3 w-3" />
                    {new Date(task.scheduled_at).toLocaleString('es-AR', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="text-[11px] text-slate-500">Estado: {briefStatusLabel(task.status)}</span>
                </div>

                <h2 className="pt-6 text-lg font-semibold leading-tight">{task.title}</h2>
                {task.description && <p className="text-xs text-slate-400">{task.description}</p>}
              </div>

              <button
                onClick={onClose}
                className="rounded-full bg-slate-900 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                Cerrar
              </button>
            </div>

            <TaskChecklistSection
              taskId={task.id}
              notes={task.notes ?? null}
              editable={true}
              variant="owner"
              onAllDoneChange={async (allDone) => {
                if (!allDone) return;
                const updated = await onAllDone(task);
                onTaskUpdate(updated);
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
