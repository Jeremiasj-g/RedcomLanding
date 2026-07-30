'use client';

import { useCallback } from 'react';
import type { Task } from '@/lib/tasks';
import { updateTaskScheduledAt } from '@/lib/tasks';
import { useTasks } from '../TasksContext';
import { buildISOFromLocal } from '../date';

function getHHmm(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

function sortByScheduledAt(tasks: Task[]) {
  return [...tasks].sort(
    (a, b) =>
      new Date(a.scheduled_at).getTime() -
      new Date(b.scheduled_at).getTime(),
  );
}

export function useTaskRescheduler() {
  const { setTasks } = useTasks();

  const moveTaskToDay = useCallback(
    async (task: Task, targetDayYMD: string) => {
      const time = getHHmm(task.scheduled_at);
      const nextScheduledAt = buildISOFromLocal(targetDayYMD, time);
      const optimisticTask: Task = {
        ...task,
        scheduled_at: nextScheduledAt,
      };

      // La tarjeta cambia de columna de forma instantánea. DragOverlay evita que
      // dnd-kit pierda la referencia del nodo durante este cambio optimista.
      setTasks((prev) =>
        sortByScheduledAt(
          prev.map((current) =>
            current.id === task.id ? optimisticTask : current,
          ),
        ),
      );

      try {
        const updated = (await updateTaskScheduledAt(
          task.id,
          nextScheduledAt,
        )) as Task;

        setTasks((prev) =>
          sortByScheduledAt(
            prev.map((current) =>
              current.id === task.id ? updated : current,
            ),
          ),
        );

        return updated;
      } catch (error) {
        // Si Supabase rechaza el cambio, restauramos la tarea sin obligar a
        // recargar la página.
        setTasks((prev) =>
          sortByScheduledAt(
            prev.map((current) =>
              current.id === task.id ? task : current,
            ),
          ),
        );
        throw error;
      }
    },
    [setTasks],
  );

  return { moveTaskToDay };
}
