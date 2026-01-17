'use client';

import { createTask, type Task } from '@/lib/tasks';
import { useTasks } from '../TasksContext';
import { buildISOFromLocal } from '../date';

export function useTaskDuplicator() {
  const { setTasks } = useTasks();

  async function duplicate(task: Task, dateYMD: string, timeHHmm: string) {
    const scheduled_at = buildISOFromLocal(dateYMD, timeHHmm);
    const created = await createTask({
      title: task.title,
      description: task.description ?? undefined,
      scheduled_at,
    });
    setTasks((prev) => [...prev, created]);
    return created;
  }

  return { duplicate };
}
