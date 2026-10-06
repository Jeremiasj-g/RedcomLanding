'use client';

import { addDays } from 'date-fns';
import {
  createTask,
  type Task,
  type TaskRecurrenceType,
} from '@/lib/tasks';
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
    recurrenceType?: TaskRecurrenceType | null;
    recurrenceIntervalDays?: number | null;
  }) {
    const {
      title,
      description,
      time,
      recurrenceType,
      recurrenceIntervalDays,
    } = opts;

    const from = opts.from <= opts.to ? opts.from : opts.to;
    const to = opts.from <= opts.to ? opts.to : opts.from;

    // Una tarea recurrente representa una sola serie. Si el usuario dejó un
    // rango seleccionado, usamos el primer día como inicio para no generar
    // series paralelas que luego se solapen.
    const effectiveTo = recurrenceType ? from : to;

    const created: Task[] = [];
    let current = new Date(from);

    while (current <= effectiveTo) {
      const dateStr = toYMD(current);
      const scheduled_at = buildISOFromLocal(dateStr, time);

      const task = await createTask({
        title,
        description,
        scheduled_at,
        recurrence_type: recurrenceType ?? null,
        recurrence_interval_days:
          recurrenceType === 'every_n_days'
            ? (recurrenceIntervalDays ?? 15)
            : null,
      });

      created.push(task);
      current = addDays(current, 1);
    }

    setTasks((prev) =>
      [...prev, ...created].sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() -
          new Date(b.scheduled_at).getTime(),
      ),
    );

    return created;
  }

  return { createByRange };
}
