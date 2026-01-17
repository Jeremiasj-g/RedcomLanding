'use client';

import { addDays } from 'date-fns';
import { createTask, type Task } from '@/lib/tasks';
import { useTasks } from '../TasksContext';
import { buildISOFromLocal, toYMD } from '../date';

export function useTaskCreator() {
  const { setTasks } = useTasks();

  async function createByRange(opts: {
    title: string;
    description?: string;
    time: string;
    from: Date;
    to: Date;
  }) {
    const { title, description, time } = opts;
    const from = opts.from <= opts.to ? opts.from : opts.to;
    const to = opts.from <= opts.to ? opts.to : opts.from;

    const created: Task[] = [];
    let current = new Date(from);

    while (current <= to) {
      const dateStr = toYMD(current);
      const scheduled_at = buildISOFromLocal(dateStr, time);
      const task = await createTask({ title, description, scheduled_at });
      created.push(task);
      current = addDays(current, 1);
    }

    setTasks((prev) => [...prev, ...created]);
    return created;
  }

  return { createByRange };
}
