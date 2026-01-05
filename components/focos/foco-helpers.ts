import type { FocoSeverity, FocoType } from './types';

export const SEVERITY_META: Record<
  FocoSeverity,
  { label: string; badgeClass: string; borderClass: string; dotClass: string }
> = {
  info: {
    label: 'Info',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    borderClass: 'border-l-sky-500',
    dotClass: 'bg-sky-500',
  },
  warning: {
    label: 'Atención',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    borderClass: 'border-l-amber-500',
    dotClass: 'bg-amber-500',
  },
  critical: {
    label: 'Crítico',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    borderClass: 'border-l-rose-500',
    dotClass: 'bg-rose-500',
  },
};

export const TYPE_LABEL: Record<FocoType, string> = {
  foco: 'Foco',
  critico: 'Crítico',
  promo: 'Promo',
  capacitacion: 'Capacitación',
};

export function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function isWithinDays(dateStr: string, days: number) {
  const d = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = now - d;
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

export function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}
