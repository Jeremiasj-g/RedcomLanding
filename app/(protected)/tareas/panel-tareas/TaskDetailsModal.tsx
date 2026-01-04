'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  CheckCircle2,
  StickyNote,
  Trash2,
  Users2,
  Loader2,
} from 'lucide-react';
import type { TaskWithOwner } from '@/lib/tasks';
import { STATUS_LABEL } from './supervisorTasksUtils';
import { fetchTaskItems } from '@/lib/tasks';
import TaskChecklistSection from '../TaskChecklistSection';

type TaskItem = {
  id: number;
  task_id: number;
  content: string;
  is_done: boolean;
  created_at: string;
};

type Props = {
  task: TaskWithOwner | null;
  onClose: () => void;
};

export default function TaskDetailsModal({ task, onClose }: Props) {
  return (
    <AnimatePresence>
      {task && (
        <motion.div
          key={task.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm"
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
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[11px]">
                    <Users2 className="h-3 w-3" />
                    {task.owner_full_name ?? '—'}
                  </span>
                  {task.owner_branches && task.owner_branches.length > 0 && (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px]">
                      {task.owner_branches
                        .map(
                          (b) => b.charAt(0).toUpperCase() + b.slice(1),
                        )
                        .join(' · ')}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500">
                    Estado: {STATUS_LABEL[task.status]}
                  </span>
                </div>
                <h2 className="pt-6 text-lg font-semibold leading-tight">
                  {task.title}
                </h2>
                {task.description && (
                  <p className="text-xs text-slate-400">{task.description}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="rounded-full bg-slate-900 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                Cerrar
              </button>
            </div>

            {/* <TaskItemsReadOnly taskId={task.id} notes={task.notes} /> */}
            <TaskChecklistSection
              taskId={task.id}
              notes={task.notes}
              editable={false}
              variant="supervisor"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
