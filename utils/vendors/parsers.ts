export const parseBoolTF = (v: unknown) =>
  String(v ?? '').trim().toUpperCase() === 'TRUE';

export const parseIntSafe = (v: unknown) => {
  const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

export const parseFloatSafe = (v: unknown) => {
  // soporta "61,25%" "61.25%" "61,25"
  const s = String(v ?? '')
    .trim()
    .replace(/\./g, '')      // por si viene "1.234,56"
    .replace(',', '.')
    .replace('%', '')
    .replace(/[^\d.-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
