// Helpers compartidos para tareas de supervisores

import type { TaskStatus } from '@/lib/tasks';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  done: 'Completada',
  cancelled: 'Cancelada',
};

export const STATUS_BADGE_CLASSES: Record<TaskStatus, string> = {
  pending: 'bg-slate-700/70 text-slate-100',
  in_progress: 'bg-sky-500/15 text-sky-300',
  done: 'bg-emerald-500/15 text-emerald-300',
  cancelled: 'bg-rose-500/15 text-rose-300',
};

export function formatDate(d: Date) {
  return d.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export function formatTimeFromISO(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
