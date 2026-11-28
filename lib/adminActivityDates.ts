// helpers fechas (exacto + relativo)
export const dtf = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
export function fromNow(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  const sec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(sec);
  const unit =
    abs < 60
      ? 'second'
      : abs < 3600
        ? 'minute'
        : abs < 86400
          ? 'hour'
          : abs < 2592000
            ? 'day'
            : abs < 31536000
              ? 'month'
              : 'year';
  const val =
    unit === 'second'
      ? sec
      : unit === 'minute'
        ? sec / 60
        : unit === 'hour'
          ? sec / 3600
          : unit === 'day'
            ? sec / 86400
            : unit === 'month'
              ? sec / 2592000
              : sec / 31536000;
  return rtf.format(Math.round(val), unit as Intl.RelativeTimeFormatUnit);
}

