
'use client';
import { useCallback } from 'react';
import type { Task } from '@/lib/tasks';
import { updateTaskScheduledAt } from '@/lib/tasks';
import { useTasks } from '../TasksContext';
import { buildISOFromLocal } from '../date';

function getHHmm(iso: string) {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

export function useTaskRescheduler() {
  const { setTasks } = useTasks();

  const moveTaskToDay = useCallback(async (task: Task, targetDayYMD: string) => {
    const old = task.scheduled_at;
    const time = getHHmm(old);
    const next = buildISOFromLocal(targetDayYMD, time);

    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, scheduled_at: next } : t));
    const updated = await updateTaskScheduledAt(task.id, next);
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    return updated;
  }, [setTasks]);

  return { moveTaskToDay };
}
