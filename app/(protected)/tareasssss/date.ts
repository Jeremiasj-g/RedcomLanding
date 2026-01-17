import { format, parseISO, set as setDateFns } from 'date-fns';

export function toYMD(d: Date) {
  return format(d, 'yyyy-MM-dd');
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
