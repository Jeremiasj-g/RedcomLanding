import { format, parseISO, set as setDateFns } from 'date-fns';

/** Fecha calendario local (sin convertirla primero a UTC). */
export function toYMD(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

/** Día calendario local correspondiente a un ISO almacenado en la base. */
export function isoToLocalYMD(iso: string) {
  return format(parseISO(iso), 'yyyy-MM-dd');
}

export function buildISOFromLocal(date: Date | string, time: string) {
  const base =
    typeof date === 'string'
      ? parseISO(`${date}T00:00:00`)
      : parseISO(`${toYMD(date)}T00:00:00`);

  const [hh, mm] = time.split(':').map(Number);

  return setDateFns(base, {
    hours: hh,
    minutes: mm,
    seconds: 0,
    milliseconds: 0,
  }).toISOString();
}
