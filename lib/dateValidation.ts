export function localTodayIso(reference = new Date()) {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, '0');
  const day = String(reference.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isPastIsoDate(value: string | null | undefined, today = localTodayIso()) {
  if (!value) return false;
  return value.slice(0, 10) < today;
}

export function laterIsoDate(a: string | null | undefined, b: string | null | undefined) {
  if (!a) return b ?? '';
  if (!b) return a;
  return a >= b ? a : b;
}
