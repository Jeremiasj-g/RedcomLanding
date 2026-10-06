'use client';

import { useCallback, useState } from 'react';
import {
  deleteTask,
  type Task,
  ensureNextRecurringTask,
  updateTaskNotes,
  updateTaskStatus,
} from '@/lib/tasks';
import { useTasks } from '../TasksContext';
import { errorMessage, notify } from '@/lib/notifications';

const BRIEF_STATUS: Record<Task['status'], string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  done: 'Completada',
  cancelled: 'Cancelada',
};

export function useTaskActions(range?: { from: Date; to: Date }) {
  const { setTasks } = useTasks();

  const [savingNotesId, setSavingNotesId] = useState<number | null>(null);
  const [changingStatusId, setChangingStatusId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingDayKey, setDeletingDayKey] = useState<string | null>(null);

  const setStatus = useCallback(
    async (task: Task, newStatus: Task['status']) => {
      if (newStatus === task.status) return task;
      try {
        setChangingStatusId(task.id);
        const updated = await updateTaskStatus(task.id, newStatus);
        let nextRecurring: Task | null = null;
        if (newStatus === 'done') {
          nextRecurring = await ensureNextRecurringTask(updated);
        }

        setTasks((prev) => {
          const replaced = prev.map((t) => (t.id === task.id ? updated : t));
          const recurring = nextRecurring;
          const nextTime = recurring ? new Date(recurring.scheduled_at).getTime() : 0;
          const inVisibleRange =
            !range ||
            (nextTime >= range.from.getTime() && nextTime < range.to.getTime());
          if (
            !recurring ||
            !inVisibleRange ||
            replaced.some((t) => t.id === recurring.id)
          ) return replaced;
          return [...replaced, recurring].sort(
            (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
          );
        });

        notify.success(
          nextRecurring
            ? `Estado actualizado: ${BRIEF_STATUS[newStatus]}. Próxima tarea recurrente creada.`
            : `Estado actualizado: ${BRIEF_STATUS[newStatus]}.`,
        );
        return updated;
      } catch (error) {
        notify.error(errorMessage(error, 'No se pudo actualizar el estado.'));
        throw error;
      } finally {
        setChangingStatusId(null);
      }
    },
    [range, setTasks],
  );

  const saveNotes = useCallback(
    async (task: Task, notes: string) => {
      try {
        setSavingNotesId(task.id);
        const updated = await updateTaskNotes(task.id, notes);
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
        notify.success('Notas guardadas.');
        return updated;
      } catch (error) {
        notify.error(errorMessage(error, 'No se pudieron guardar las notas.'));
        throw error;
      } finally {
        setSavingNotesId(null);
      }
    },
    [setTasks],
  );

  const removeTask = useCallback(
    async (task: Task) => {
      if (!confirm('¿Eliminar esta tarea?')) return false;
      try {
        setDeletingId(task.id);
        await deleteTask(task.id);
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        notify.success('Tarea eliminada.');
        return true;
      } catch (error) {
        notify.error(errorMessage(error, 'No se pudo eliminar la tarea.'));
        return false;
      } finally {
        setDeletingId(null);
      }
    },
    [setTasks],
  );

  const removeDay = useCallback(
    async (dayKey: string, dayTasks: Task[]) => {
      if (dayTasks.length === 0) return false;
      if (
        !confirm(
          `¿Eliminar todas las ${dayTasks.length} tareas de este día? Esta acción no se puede deshacer.`,
        )
      )
        return false;

      try {
        setDeletingDayKey(dayKey);
        await Promise.all(dayTasks.map((t) => deleteTask(t.id)));
        setTasks((prev) => prev.filter((t) => t.scheduled_at.slice(0, 10) !== dayKey));
        notify.success(`${dayTasks.length} tarea${dayTasks.length === 1 ? '' : 's'} eliminada${dayTasks.length === 1 ? '' : 's'}.`);
        return true;
      } catch (error) {
        notify.error(errorMessage(error, 'No se pudieron eliminar las tareas del día.'));
        return false;
      } finally {
        setDeletingDayKey(null);
      }
    },
    [setTasks],
  );

  const markDoneIfNeeded = useCallback(
    async (task: Task) => {
      if (task.status === 'done') return task;
      try {
        setChangingStatusId(task.id);
        const updated = await updateTaskStatus(task.id, 'done');
        const nextRecurring = await ensureNextRecurringTask(updated);

        setTasks((prev) => {
          const replaced = prev.map((t) => (t.id === task.id ? updated : t));
          const recurring = nextRecurring;
          const nextTime = recurring ? new Date(recurring.scheduled_at).getTime() : 0;
          const inVisibleRange =
            !range ||
            (nextTime >= range.from.getTime() && nextTime < range.to.getTime());
          if (
            !recurring ||
            !inVisibleRange ||
            replaced.some((t) => t.id === recurring.id)
          ) return replaced;
          return [...replaced, recurring].sort(
            (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
          );
        });

        notify.success(
          nextRecurring
            ? 'Tarea completada. Próxima tarea recurrente creada.'
            : 'Tarea completada.',
        );
        return updated;
      } catch (error) {
        notify.error(errorMessage(error, 'No se pudo completar la tarea.'));
        throw error;
      } finally {
        setChangingStatusId(null);
      }
    },
    [range, setTasks],
  );

  return {
    BRIEF_STATUS,
    savingNotesId,
    changingStatusId,
    deletingId,
    deletingDayKey,
    setStatus,
    saveNotes,
    removeTask,
    removeDay,
    markDoneIfNeeded,
  };
}
