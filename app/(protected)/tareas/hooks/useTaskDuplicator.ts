'use client';

import { createTask, type Task } from '@/lib/tasks';
import { useTasks } from '../TasksContext';
import { buildISOFromLocal } from '../date';

export function useTaskDuplicator() {
  const { setTasks } = useTasks();

  async function duplicate(
    task: Task,
    dateYMD: string,
    timeHHmm: string,
  ): Promise<Task> {
    const scheduled_at = buildISOFromLocal(dateYMD, timeHHmm);

    const created = await createTask({
      title: task.title,
      description: task.description ?? undefined,
      scheduled_at,
    });

    setTasks((prev) => [...prev, created]);
    return created;
  }

  async function duplicateRange(
    task: Task,
    fromYMD: string,
    toYMD: string,
    timeHHmm: string,
  ): Promise<Task[]> {
    const start = new Date(`${fromYMD}T00:00:00`);
    const end = new Date(`${toYMD}T00:00:00`);

    const from = start <= end ? start : end;
    const to = start <= end ? end : start;

    const createdAll: Task[] = []; // ✅ TIPADO EXPLÍCITO

    let current = new Date(from);

    while (current <= to) {
      const ymd = current.toISOString().slice(0, 10);
      const scheduled_at = buildISOFromLocal(ymd, timeHHmm);

      const created = await createTask({
        title: task.title,
        description: task.description ?? undefined,
        scheduled_at,
      });

      createdAll.push(created);
      current.setDate(current.getDate() + 1);
    }

    setTasks((prev) => [...prev, ...createdAll]);
    return createdAll;
  }

  return { duplicate, duplicateRange };
}
