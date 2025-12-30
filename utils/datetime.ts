// Convierte "YYYY-MM-DDTHH:mm" (datetime-local) a ISO UTC correcto
export function datetimeLocalToISO(value: string) {
  if (!value) return null;
  // new Date("YYYY-MM-DDTHH:mm") se interpreta como LOCAL del navegador
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Convierte ISO (ej "2025-12-30T18:42:00.000Z") a "YYYY-MM-DDTHH:mm" (para datetime-local)
export function isoToDatetimeLocal(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');

  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());

  // datetime-local NO lleva zona ni segundos
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
