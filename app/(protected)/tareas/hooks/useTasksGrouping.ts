'use client';

import { useMemo } from 'react';
import { addDays } from 'date-fns';
import type { Task } from '@/lib/tasks';
import { useTasks } from '../TasksContext';
import { isoToLocalYMD, toYMD } from '../date';

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
      map[toYMD(day)] = [];
    }

    for (const task of tasks) {
      const key = isoToLocalYMD(task.scheduled_at);
      if (!map[key]) map[key] = [];
      map[key].push(task);
    }

    for (const list of Object.values(map)) {
      list.sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() -
          new Date(b.scheduled_at).getTime(),
      );
    }

    return map;
  }, [daysInRange, tasks]);

  return { daysInRange, tasksByDay };
}
