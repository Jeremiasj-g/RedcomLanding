function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function parseDTLocal(dt: string): { date: Date | null; hour: string; minute: string } {
  if (!dt) return { date: null, hour: '09', minute: '00' };
  const [dPart, tPart] = dt.split('T');
  if (!dPart || !tPart) return { date: null, hour: '09', minute: '00' };
  const [y, m, d] = dPart.split('-').map(Number);
  const [hh, mm] = tPart.split(':').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return { date, hour: pad2(hh ?? 0), minute: pad2(mm ?? 0) };
}

export function buildDTLocal(date: Date | null, hour: string, minute: string) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(Number(hour || '0'));
  const mm = pad2(Number(minute || '0'));
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function makeHours() {
  return Array.from({ length: 24 }).map((_, i) => pad2(i));
}

export function makeMinutes() {
  return ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
}
