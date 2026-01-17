'use client';

import { useCallback, useState } from 'react';
import {
  deleteTask,
  type Task,
  updateTaskNotes,
  updateTaskStatus,
} from '@/lib/tasks';
import { useTasks } from '../TasksContext';

const BRIEF_STATUS: Record<Task['status'], string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  done: 'Completada',
  cancelled: 'Cancelada',
};

function nextStatus(status: Task['status']): Task['status'] {
  if (status === 'pending') return 'in_progress';
  if (status === 'in_progress') return 'done';
  if (status === 'done') return 'cancelled';
  if (status === 'cancelled') return 'pending';
  return 'pending';
}

export function useTaskActions() {
  const { setTasks } = useTasks();

  const [savingNotesId, setSavingNotesId] = useState<number | null>(null);
  const [changingStatusId, setChangingStatusId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingDayKey, setDeletingDayKey] = useState<string | null>(null);

  const toggleStatus = useCallback(
    async (task: Task) => {
      const newStatus = nextStatus(task.status);
      try {
        setChangingStatusId(task.id);
        const updated = await updateTaskStatus(task.id, newStatus);
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
        return updated;
      } finally {
        setChangingStatusId(null);
      }
    },
    [setTasks],
  );

  const saveNotes = useCallback(
    async (task: Task, notes: string) => {
      try {
        setSavingNotesId(task.id);
        const updated = await updateTaskNotes(task.id, notes);
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
        return updated;
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
        return true;
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
        return true;
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
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
        return updated;
      } finally {
        setChangingStatusId(null);
      }
    },
    [setTasks],
  );

  return {
    BRIEF_STATUS,
    savingNotesId,
    changingStatusId,
    deletingId,
    deletingDayKey,
    toggleStatus,
    saveNotes,
    removeTask,
    removeDay,
    markDoneIfNeeded,
  };
}
