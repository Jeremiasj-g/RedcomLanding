'use client';

import { useMemo } from 'react';
import { addDays } from 'date-fns';
import type { Task } from '@/lib/tasks';
import { useTasks } from '../TasksContext';

export function useTasksGrouping(range: { from: Date; to: Date }) {
  const { tasks } = useTasks();

  const daysInRange = useMemo(() => {
    const days: Date[] = [];
    let current = new Date(range.from);
    const end = new Date(range.to);
    while (current <= end) {
      days.push(new Date(current));
      current = addDays(current, 1);
    }
    return days;
  }, [range.from, range.to]);

  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const day of daysInRange) {
      const key = day.toISOString().slice(0, 10);
      map[key] = [];
    }

    for (const task of tasks) {
      const key = task.scheduled_at.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(task);
    }

    return map;
  }, [daysInRange, tasks]);

  return { daysInRange, tasksByDay };
}
