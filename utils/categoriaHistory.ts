import { CATEGORIA_RANK, normalizeCategoriaKey, type CategoriaKey } from '@/utils/categories';

export type CategoriaSnapshotRow = {
  id: number;
  branch_key: string;
  branch?: string | null;
  period_year: number;
  period_month: number;
  closed_at?: string | null;
  payload?: unknown;
};

export type CategoriaHistorySeller = {
  id: string;
  name: string;
  branchKey: string;
  months: number;
  firstPeriod: string;
  lastPeriod: string;
  lastCategoria: CategoriaKey;
  lastCategoriaLabel: string;
};

export type CategoriaHistoryPoint = {
  period: string;
  periodLabel: string;
  year: number;
  month: number;
  branchKey: string;
  snapshotId: number;
  closedAt: string | null;

  sellerId: string;
  vendedor: string;
  supervisor: string;

  categoria: CategoriaKey;
  categoriaLabel: string;
  categoriaRank: number;
  proyeccion: CategoriaKey;
  proyeccionLabel: string;
  proyeccionRank: number;

  eficiencia: number | null;
  efectividad: number | null;
  facturacion: number | null;
  facturacionPromedio: number | null;
  promedioBoletas: number | null;
  promedioBoletasDiarias: number | null;
  volumen: number | null;
  cobertura: number | null;
  visitados: number | null;
  visitasPlaneadas: number | null;
  totalVentas: number | null;
  ventaPdv: number | null;
  ventaDistancia: number | null;
  porcentajePdv: number | null;
  porcentajeDistancia: number | null;
  pop: number | null;
  exhibicion: number | null;
  mix: number | null;
  horasRuta: string;
  horasRutaSeconds: number | null;
  cumpleHorario: boolean | null;
  cumpleEfectividad: boolean | null;

  raw: Record<string, any>;
};

export type CategoriaHistorySummary = {
  sellerId: string;
  sellerName: string;
  branchKey: string;
  months: number;
  firstPeriod: string | null;
  lastPeriod: string | null;
  initialCategoria: CategoriaKey | null;
  currentCategoria: CategoriaKey | null;
  bestCategoria: CategoriaKey | null;
  bestCategoriaLabel: string | null;
  currentCategoriaLabel: string | null;
  initialCategoriaLabel: string | null;
  avgEficiencia: number | null;
  avgEfectividad: number | null;
  avgFacturacion: number | null;
  bestFacturacion: number | null;
  bestFacturacionPeriod: string | null;
  categoryDelta: number | null;
  improved: boolean | null;
};

export const CATEGORY_LABEL: Record<CategoriaKey, string> = {
  PLAN_MEJORA: 'Plan de Mejora',
  JUNIOR: 'Junior',
  SEMI_SENIOR: 'Semi Senior',
  SENIOR: 'Senior',
};

export const CATEGORY_COLORS: Record<CategoriaKey, string> = {
  PLAN_MEJORA: '#ef4444',
  JUNIOR: '#eab308',
  SEMI_SENIOR: '#10b981',
  SENIOR: '#047857',
};

const INVALID_STRINGS = new Set(['', '#DIV/0!', '#N/A', '#REF!', 'NULL', 'FALSE', 'NaN']);

export function makePeriod(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function formatPeriodLabel(year: number, month: number) {
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${monthNames[Math.max(0, Math.min(11, month - 1))]} ${year}`;
}

export function periodToNumber(period: string) {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return 0;
  return year * 100 + month;
}

export function isValidPeriod(period?: string | null) {
  return Boolean(period && /^\d{4}-\d{2}$/.test(period));
}

export function parseNullableNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const raw = String(value ?? '').trim();
  if (INVALID_STRINGS.has(raw.toUpperCase())) return null;

  let s = raw
    .replace(/\s/g, '')
    .replace(/[$%]/g, '')
    .replace(/[^\d,.-]/g, '');

  if (!s || s === '-' || s === ',' || s === '.') return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');

    if (lastComma > lastDot) {
      // Formato AR: 1.234.567,89
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato US: 1,234,567.89
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    const commaParts = s.split(',');
    if (commaParts.length > 2) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  } else if (hasDot) {
    const parts = s.split('.');
    const last = parts[parts.length - 1] ?? '';
    if (parts.length > 2 || (last.length === 3 && !raw.includes('%'))) {
      s = s.replace(/\./g, '');
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseNullableInt(value: unknown): number | null {
  const n = parseNullableNumber(value);
  return n === null ? null : Math.round(n);
}

export function parseNullableBool(value: unknown): boolean | null {
  const v = String(value ?? '').trim().toUpperCase();
  if (v === 'TRUE') return true;
  if (v === 'FALSE') return false;
  return null;
}

export function hmsToSecondsNullable(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw || INVALID_STRINGS.has(raw.toUpperCase())) return null;
  const parts = raw.split(':').map((n) => Number(n));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

export function secondsToHoursLabel(seconds: number | null) {
  if (seconds === null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatMoney(value: number | null) {
  if (value === null) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number | null, digits = 1) {
  if (value === null) return '—';
  return `${value.toFixed(digits).replace('.', ',')}%`;
}

export function formatNumber(value: number | null, digits = 0) {
  if (value === null) return '—';
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function getMixValue(row: Record<string, any>) {
  return row.Mix ?? row.mix ?? row['%_Mix'] ?? row['% Mix'] ?? row['%_MIX'];
}

export function cleanSellerName(value: unknown, fallbackId?: string) {
  const name = String(value ?? '').trim();
  if (!name || name.toUpperCase() === 'NULL') return fallbackId ? `ID ${fallbackId}` : 'Sin nombre';
  return name;
}

function isMeaningfulSellerName(name: string) {
  const v = name.trim().toUpperCase();
  if (!v || v === 'NULL' || v === 'SIN NOMBRE') return false;
  if (v.includes('VACANTE')) return false;
  return true;
}

function snapshotPeriod(snapshot: CategoriaSnapshotRow) {
  return makePeriod(Number(snapshot.period_year), Number(snapshot.period_month));
}

export function normalizeSnapshots(snapshots: CategoriaSnapshotRow[]) {
  const sorted = [...snapshots].sort((a, b) => {
    const ap = periodToNumber(snapshotPeriod(a));
    const bp = periodToNumber(snapshotPeriod(b));
    if (ap !== bp) return ap - bp;
    const at = new Date(a.closed_at ?? 0).getTime();
    const bt = new Date(b.closed_at ?? 0).getTime();
    return bt - at;
  });

  const latestByPeriod = new Map<string, CategoriaSnapshotRow>();
  for (const snap of sorted) {
    const key = `${snap.branch_key}:${snapshotPeriod(snap)}`;
    if (!latestByPeriod.has(key)) latestByPeriod.set(key, snap);
  }

  return Array.from(latestByPeriod.values()).sort((a, b) => {
    const ap = periodToNumber(snapshotPeriod(a));
    const bp = periodToNumber(snapshotPeriod(b));
    return ap - bp;
  });
}

export function buildSellerCatalog(snapshots: CategoriaSnapshotRow[]): CategoriaHistorySeller[] {
  const normalized = normalizeSnapshots(snapshots);
  const map = new Map<string, CategoriaHistorySeller>();

  for (const snapshot of normalized) {
    const payload = Array.isArray(snapshot.payload) ? snapshot.payload : [];
    const period = snapshotPeriod(snapshot);

    for (const raw of payload) {
      const row = (raw ?? {}) as Record<string, any>;
      const id = String(row.id ?? '').trim();
      if (!id) continue;

      const currentName = cleanSellerName(row.vendedor, id);
      const categoria = normalizeCategoriaKey(row.Categoria_alcanzada);
      const key = `${snapshot.branch_key}:${id}`;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, {
          id,
          name: currentName,
          branchKey: snapshot.branch_key,
          months: 1,
          firstPeriod: period,
          lastPeriod: period,
          lastCategoria: categoria,
          lastCategoriaLabel: CATEGORY_LABEL[categoria],
        });
        continue;
      }

      existing.months += 1;
      if (periodToNumber(period) < periodToNumber(existing.firstPeriod)) existing.firstPeriod = period;
      if (periodToNumber(period) >= periodToNumber(existing.lastPeriod)) {
        existing.lastPeriod = period;
        existing.lastCategoria = categoria;
        existing.lastCategoriaLabel = CATEGORY_LABEL[categoria];
        if (isMeaningfulSellerName(currentName)) existing.name = currentName;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const ai = Number(a.id);
    const bi = Number(b.id);
    if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
    return a.id.localeCompare(b.id);
  });
}

export function buildHistoryForSeller({
  snapshots,
  branchKey,
  sellerId,
  from,
  to,
}: {
  snapshots: CategoriaSnapshotRow[];
  branchKey: string;
  sellerId: string;
  from?: string | null;
  to?: string | null;
}): CategoriaHistoryPoint[] {
  const fromNumber = isValidPeriod(from) ? periodToNumber(from!) : Number.NEGATIVE_INFINITY;
  const toNumber = isValidPeriod(to) ? periodToNumber(to!) : Number.POSITIVE_INFINITY;

  return normalizeSnapshots(snapshots)
    .filter((snapshot) => snapshot.branch_key === branchKey)
    .filter((snapshot) => {
      const p = periodToNumber(snapshotPeriod(snapshot));
      return p >= fromNumber && p <= toNumber;
    })
    .map((snapshot) => {
      const payload = Array.isArray(snapshot.payload) ? snapshot.payload : [];
      const raw = payload.find((item: any) => String(item?.id ?? '').trim() === String(sellerId).trim());
      if (!raw) return null;

      const row = raw as Record<string, any>;
      const categoria = normalizeCategoriaKey(row.Categoria_alcanzada);
      const proyeccion = normalizeCategoriaKey(row.Categoria_segun_proyeccion);
      const year = Number(snapshot.period_year);
      const month = Number(snapshot.period_month);
      const period = makePeriod(year, month);
      const horasRuta = String(row.horas_promedio_ruta ?? '').trim();

      return {
        period,
        periodLabel: formatPeriodLabel(year, month),
        year,
        month,
        branchKey: snapshot.branch_key,
        snapshotId: snapshot.id,
        closedAt: snapshot.closed_at ?? null,
        sellerId: String(sellerId),
        vendedor: cleanSellerName(row.vendedor, String(sellerId)),
        supervisor: String(row.Supervisor ?? '').trim() || '—',
        categoria,
        categoriaLabel: CATEGORY_LABEL[categoria],
        categoriaRank: CATEGORIA_RANK[categoria],
        proyeccion,
        proyeccionLabel: CATEGORY_LABEL[proyeccion],
        proyeccionRank: CATEGORIA_RANK[proyeccion],
        eficiencia: parseNullableNumber(row.eficiencia),
        efectividad: parseNullableNumber(row.efectividad),
        facturacion: parseNullableNumber(row.facturacion),
        facturacionPromedio: parseNullableNumber(row.facturacion_promedio),
        promedioBoletas: parseNullableNumber(row['promedio_$_boletas']),
        promedioBoletasDiarias: parseNullableNumber(row.promedio_boletas_diarias),
        volumen: parseNullableInt(row.volumen),
        cobertura: parseNullableInt(row.cobertura),
        visitados: parseNullableInt(row.visitados),
        visitasPlaneadas: parseNullableInt(row.visitas_planeadas),
        totalVentas: parseNullableInt(row.total_de_ventas),
        ventaPdv: parseNullableInt(row.venta_en_el_pdv),
        ventaDistancia: parseNullableInt(row.venta_a_distancia),
        porcentajePdv: parseNullableNumber(row.porcentaje_de_ventas_en_el_PDV),
        porcentajeDistancia: parseNullableNumber(row.porcentaje_de_ventas_a_distancia),
        pop: parseNullableNumber(row['%_POP']),
        exhibicion: parseNullableNumber(row['%_Exhibición']),
        mix: parseNullableNumber(getMixValue(row)),
        horasRuta,
        horasRutaSeconds: hmsToSecondsNullable(horasRuta),
        cumpleHorario: parseNullableBool(row.cumple_horario_ruta),
        cumpleEfectividad: parseNullableBool(row.cumple_efectividad),
        raw: row,
      } satisfies CategoriaHistoryPoint;
    })
    .filter(Boolean) as CategoriaHistoryPoint[];
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!valid.length) return null;
  return valid.reduce((acc, v) => acc + v, 0) / valid.length;
}

export function summarizeHistory(history: CategoriaHistoryPoint[]): CategoriaHistorySummary | null {
  if (!history.length) return null;

  const first = history[0];
  const last = history[history.length - 1];
  const bestCategory = history.reduce((best, item) =>
    item.categoriaRank > best.categoriaRank ? item : best
  , first);
  const bestBilling = history.reduce<CategoriaHistoryPoint | null>((best, item) => {
    if (item.facturacion === null) return best;
    if (!best || (best.facturacion ?? 0) < item.facturacion) return item;
    return best;
  }, null);

  const categoryDelta = last.categoriaRank - first.categoriaRank;

  return {
    sellerId: last.sellerId,
    sellerName: last.vendedor,
    branchKey: last.branchKey,
    months: history.length,
    firstPeriod: first.period,
    lastPeriod: last.period,
    initialCategoria: first.categoria,
    currentCategoria: last.categoria,
    bestCategoria: bestCategory.categoria,
    initialCategoriaLabel: first.categoriaLabel,
    currentCategoriaLabel: last.categoriaLabel,
    bestCategoriaLabel: bestCategory.categoriaLabel,
    avgEficiencia: average(history.map((i) => i.eficiencia)),
    avgEfectividad: average(history.map((i) => i.efectividad)),
    avgFacturacion: average(history.map((i) => i.facturacion)),
    bestFacturacion: bestBilling?.facturacion ?? null,
    bestFacturacionPeriod: bestBilling?.period ?? null,
    categoryDelta,
    improved: categoryDelta === 0 ? null : categoryDelta > 0,
  };
}
