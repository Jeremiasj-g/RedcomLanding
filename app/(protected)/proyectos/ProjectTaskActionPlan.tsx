'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  Search,
  Target,
  TrendingUp,
  UserRound,
} from 'lucide-react';

import {
  CATEGORY_COLORS,
  formatMoney,
  formatNumber,
  formatPercent,
  secondsToHoursLabel,
  type CategoriaHistoryPoint,
  type CategoriaHistorySeller,
  type CategoriaHistorySummary,
} from '@/utils/categoriaHistory';
import {
  fetchProjectTaskActionPlan,
  upsertProjectTaskActionPlan,
} from '@/lib/projectTaskActionPlan';
import { errorMessage, notify } from '@/lib/notifications';
import { RedcomSelect } from '@/components/ui/redcom-select';

const BRANCHES = [
  { key: 'corrientes_masivos', label: 'Corrientes · Masivos' },
  { key: 'corrientes_refrigerados', label: 'Corrientes · Refrigerados' },
  { key: 'chaco_masivos', label: 'Chaco' },
  { key: 'misiones_masivos', label: 'Misiones' },
  { key: 'obera_masivos', label: 'Oberá' },
] as const;

type BranchKey = (typeof BRANCHES)[number]['key'];

type SellerEntry = CategoriaHistorySeller & {
  identityKey: string;
};

type PeriodOption = {
  value: string;
  year: number;
  month: number;
};

type HistoryResponse = {
  branchKey: string;
  periods: PeriodOption[];
  sellers: CategoriaHistorySeller[];
  history: CategoriaHistoryPoint[];
  summary: CategoriaHistorySummary | null;
  error?: string;
};

const ACTION_PLAN_CACHE_VERSION = 'v1';
const SELLER_CATALOG_CACHE_KEY =
  `project-action-plan:${ACTION_PLAN_CACHE_VERSION}:seller-catalog`;

function sessionGet<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function sessionSet(key: string, value: unknown) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Si sessionStorage no está disponible, simplemente seguimos sin caché.
  }
}

function taskSelectionCacheKey(taskId: number) {
  return `project-action-plan:${ACTION_PLAN_CACHE_VERSION}:task:${taskId}:selection`;
}

function historyCacheKey(
  branchKey: string,
  sellerId: string,
  from?: string,
  to?: string,
) {
  return [
    'project-action-plan',
    ACTION_PLAN_CACHE_VERSION,
    'history',
    branchKey,
    sellerId,
    from || 'all',
    to || 'all',
  ].join(':');
}

function branchLabel(branchKey: string) {
  return BRANCHES.find((branch) => branch.key === branchKey)?.label ?? branchKey;
}

function periodLabel(period: PeriodOption) {
  const date = new Date(period.year, Math.max(0, period.month - 1), 1);
  return new Intl.DateTimeFormat('es-AR', {
    month: 'short',
    year: 'numeric',
  })
    .format(date)
    .replace('.', '');
}


function categoryTone(category: CategoriaHistorySummary['currentCategoria']) {
  if (!category) return 'border-white/[0.08] bg-white/[0.04] text-white/[0.58]';
  if (category === 'SENIOR') return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200';
  if (category === 'SEMI_SENIOR') return 'border-teal-300/20 bg-teal-300/10 text-teal-200';
  if (category === 'JUNIOR') return 'border-amber-300/20 bg-amber-300/10 text-amber-200';
  return 'border-rose-300/20 bg-rose-300/10 text-rose-200';
}

function safePercentBar(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
  );
  if (!valid.length) return null;
  return valid.reduce((total, value) => total + value, 0) / valid.length;
}


export default function ProjectTaskActionPlan({
  taskId,
  currentUserId,
  canEdit,
}: {
  taskId: number;
  currentUserId: string | null;
  canEdit: boolean;
}) {
  const [catalog, setCatalog] = useState<SellerEntry[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<'all' | BranchKey>('all');

  const [selected, setSelected] = useState<SellerEntry | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [history, setHistory] = useState<CategoriaHistoryPoint[]>([]);
  const [summary, setSummary] = useState<CategoriaHistorySummary | null>(null);
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [savingSelection, setSavingSelection] = useState(false);

  const fetchHistory = useCallback(
    async (
      branchKey: string,
      sellerId: string,
      nextFrom?: string,
      nextTo?: string,
    ) => {
      setLoadingHistory(true);
      setHistoryError(null);

      const cacheKey = historyCacheKey(
        branchKey,
        sellerId,
        nextFrom,
        nextTo,
      );
      const cached = sessionGet<HistoryResponse>(cacheKey);

      if (cached) {
        setHistory(cached.history ?? []);
        setSummary(cached.summary ?? null);
        setPeriods(cached.periods ?? []);

        if (!nextFrom && !nextTo && cached.periods?.length) {
          setFrom(cached.periods[0].value);
          setTo(cached.periods[cached.periods.length - 1].value);
        }

        setLoadingHistory(false);
        return;
      }

      try {
        const params = new URLSearchParams({
          branch_key: branchKey,
          seller_id: sellerId,
        });

        if (nextFrom) params.set('from', nextFrom);
        if (nextTo) params.set('to', nextTo);

        const response = await fetch(`/api/categorias/history?${params.toString()}`, {
          cache: 'no-store',
        });
        const json = (await response.json()) as HistoryResponse;

        if (!response.ok) {
          throw new Error(json.error || 'No se pudo cargar el histórico.');
        }

        sessionSet(cacheKey, json);

        setHistory(json.history ?? []);
        setSummary(json.summary ?? null);
        setPeriods(json.periods ?? []);

        if (!nextFrom && !nextTo && json.periods?.length) {
          setFrom(json.periods[0].value);
          setTo(json.periods[json.periods.length - 1].value);
        }
      } catch (error) {
        setHistory([]);
        setSummary(null);
        setHistoryError(errorMessage(error, 'No se pudo cargar el histórico.'));
      } finally {
        setLoadingHistory(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoadingCatalog(true);
        setCatalogError(null);

        let sellers = sessionGet<SellerEntry[]>(SELLER_CATALOG_CACHE_KEY);

        if (!sellers) {
          const responses = await Promise.all(
            BRANCHES.map(async (branch) => {
              const response = await fetch(
                `/api/categorias/history?branch_key=${branch.key}`,
                { cache: 'no-store' },
              );
              const json = (await response.json()) as HistoryResponse;
              if (!response.ok) {
                throw new Error(
                  json.error || `No se pudo cargar ${branch.label}.`,
                );
              }
              return json;
            }),
          );

          sellers = responses.flatMap((response) =>
            (response.sellers ?? []).map((seller) => ({
              ...seller,
              identityKey: `${seller.branchKey}:${seller.id}`,
            })),
          );

          sellers.sort((a, b) => {
            const branchCompare = branchLabel(a.branchKey).localeCompare(
              branchLabel(b.branchKey),
              'es',
            );
            if (branchCompare !== 0) return branchCompare;

            const aId = Number(a.id);
            const bId = Number(b.id);
            if (Number.isFinite(aId) && Number.isFinite(bId)) return aId - bId;
            return a.id.localeCompare(b.id);
          });

          sessionSet(SELLER_CATALOG_CACHE_KEY, sellers);
        }

        if (cancelled) return;
        setCatalog(sellers);

        const cachedSelection = sessionGet<{
          branchKey: string;
          sellerId: string;
        }>(taskSelectionCacheKey(taskId));

        if (cachedSelection) {
          const matched = sellers.find(
            (seller) =>
              seller.branchKey === cachedSelection.branchKey &&
              seller.id === cachedSelection.sellerId,
          );

          if (matched) {
            setSelected(matched);
            await fetchHistory(matched.branchKey, matched.id);
            return;
          }
        }

        const saved = await fetchProjectTaskActionPlan(taskId);
        if (cancelled || !saved) return;

        sessionSet(taskSelectionCacheKey(taskId), {
          branchKey: saved.branch_key,
          sellerId: saved.seller_id,
        });

        const matched = sellers.find(
          (seller) =>
            seller.branchKey === saved.branch_key &&
            seller.id === saved.seller_id,
        );

        if (matched) {
          setSelected(matched);
          await fetchHistory(matched.branchKey, matched.id);
        }
      } catch (error) {
        if (!cancelled) {
          setCatalogError(
            errorMessage(error, 'No se pudieron cargar los vendedores guardados.'),
          );
        }
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchHistory, taskId]);

  const visibleCatalog = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return catalog.filter((seller) => {
      if (branchFilter !== 'all' && seller.branchKey !== branchFilter) {
        return false;
      }

      if (!normalized) return true;

      return [
        seller.id,
        seller.name,
        branchLabel(seller.branchKey),
        seller.lastCategoriaLabel,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [branchFilter, catalog, query]);

  const rangeAverages = useMemo(
    () => ({
      cobertura: average(history.map((point) => point.cobertura)),
      volumen: average(history.map((point) => point.volumen)),
      visitados: average(history.map((point) => point.visitados)),
      visitasPlaneadas: average(history.map((point) => point.visitasPlaneadas)),
      ventas: average(history.map((point) => point.totalVentas)),
      boletasDiarias: average(history.map((point) => point.promedioBoletasDiarias)),
      ticket: average(history.map((point) => point.promedioBoletas)),
      horasRutaSeconds: average(history.map((point) => point.horasRutaSeconds)),
      pdv: average(history.map((point) => point.porcentajePdv)),
      distancia: average(history.map((point) => point.porcentajeDistancia)),
      pop: average(history.map((point) => point.pop)),
      exhibicion: average(history.map((point) => point.exhibicion)),
      mix: average(history.map((point) => point.mix)),
    }),
    [history],
  );

  async function chooseSeller(seller: SellerEntry) {
    try {
      if (canEdit) {
        setSavingSelection(true);
        await upsertProjectTaskActionPlan({
          taskId,
          branchKey: seller.branchKey,
          sellerId: seller.id,
          userId: currentUserId,
        });

        sessionSet(taskSelectionCacheKey(taskId), {
          branchKey: seller.branchKey,
          sellerId: seller.id,
        });
      }

      setSelected(seller);
      setFrom('');
      setTo('');
      await fetchHistory(seller.branchKey, seller.id);
    } catch (error) {
      notify.error(errorMessage(error, 'No se pudo iniciar el plan de acción.'));
    } finally {
      setSavingSelection(false);
    }
  }

  async function applyRange(nextFrom: string, nextTo: string) {
    if (!selected) return;

    let safeFrom = nextFrom;
    let safeTo = nextTo;

    if (safeFrom && safeTo && safeFrom > safeTo) {
      [safeFrom, safeTo] = [safeTo, safeFrom];
    }

    setFrom(safeFrom);
    setTo(safeTo);
    await fetchHistory(selected.branchKey, selected.id, safeFrom, safeTo);
  }

  if (loadingCatalog) {
    return (
      <div className="grid h-full place-items-center bg-[#151517]">
        <div className="flex items-center gap-2 text-[11px] text-white/[0.42]">
          <Loader2 className="h-4 w-4 animate-spin text-[#5ac8fa]" />
          Preparando vendedores e histórico...
        </div>
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="grid h-full place-items-center bg-[#151517] p-8">
        <div className="max-w-md rounded-[18px] border border-rose-300/15 bg-rose-300/[0.055] p-5 text-center">
          <div className="text-sm font-medium text-rose-200">
            No se pudo preparar el plan de acción
          </div>
          <p className="mt-2 text-[11px] leading-5 text-white/[0.38]">
            {catalogError}
          </p>
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="h-full overflow-y-auto bg-[#151517] px-6 py-5">
        <div className="mx-auto max-w-[1180px]">
          <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.10em] text-[#5ac8fa]">
                <Target className="h-4 w-4" />
                Plan de acción
              </div>
              <h2 className="mt-2 text-xl font-medium tracking-[-0.025em] text-white/[0.94]">
                Elegí el vendedor a trabajar
              </h2>
              <p className="mt-1 max-w-2xl text-[11px] leading-5 text-white/[0.38]">
                Los vendedores provienen de los cierres históricos de Categorías.
                La identidad se resuelve por sucursal + ID; el nombre se usa solo
                como referencia visual.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-[250px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/[0.28]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por ID o nombre..."
                  className="h-10 w-full rounded-[12px] border border-white/[0.08] bg-[#1c1c1e] pl-9 pr-3 text-[11px] text-white/[0.82] outline-none placeholder:text-white/[0.24] focus:border-[#0a84ff]/45 focus:ring-2 focus:ring-[#0a84ff]/10"
                />
              </div>

              <select
                value={branchFilter}
                onChange={(event) =>
                  setBranchFilter(event.target.value as 'all' | BranchKey)
                }
                className="h-10 min-w-[220px] rounded-[12px] border border-white/[0.08] bg-[#1c1c1e] px-3 text-[11px] text-white/[0.72] outline-none focus:border-[#0a84ff]/45"
              >
                <option value="all">Todas las sucursales</option>
                {BRANCHES.map((branch) => (
                  <option key={branch.key} value={branch.key}>
                    {branch.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-[10px] text-white/[0.30]">
              {visibleCatalog.length} vendedor
              {visibleCatalog.length === 1 ? '' : 'es'} disponible
              {visibleCatalog.length === 1 ? '' : 's'}
            </div>
            {!canEdit ? (
              <div className="text-[9px] text-amber-200/60">
                Solo lectura · podés analizar vendedores sin cambiar el foco guardado.
              </div>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleCatalog.map((seller) => (
              <button
                key={seller.identityKey}
                type="button"
                disabled={savingSelection}
                onClick={() => void chooseSeller(seller)}
                className="group rounded-[16px] border border-white/[0.07] bg-[#1c1c1e] p-3.5 text-left transition hover:border-[#0a84ff]/25 hover:bg-[#202023] disabled:opacity-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-white/[0.07] bg-white/[0.035] text-[#5ac8fa]">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <span
                    className="rounded-full border px-2 py-1 text-[9px] font-medium"
                    style={{
                      borderColor: `${CATEGORY_COLORS[seller.lastCategoria]}40`,
                      backgroundColor: `${CATEGORY_COLORS[seller.lastCategoria]}18`,
                      color: CATEGORY_COLORS[seller.lastCategoria],
                    }}
                  >
                    {seller.lastCategoriaLabel}
                  </span>
                </div>

                <div className="mt-3 text-[14px] font-medium text-white/[0.92]">
                  ID {seller.id}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-white/[0.46]">
                  {seller.name}
                </div>

                <div className="mt-3 border-t border-white/[0.055] pt-2.5">
                  <div className="inline-flex items-center gap-1.5 text-[10px] text-white/[0.34]">
                    <Building2 className="h-3 w-3" />
                    {branchLabel(seller.branchKey)}
                  </div>
                  <div className="mt-1 text-[10px] text-white/[0.28]">
                    {seller.months} período{seller.months === 1 ? '' : 's'} en histórico
                  </div>
                </div>
              </button>
            ))}
          </div>

          {visibleCatalog.length === 0 ? (
            <div className="mt-4 rounded-[18px] border border-dashed border-white/[0.07] py-12 text-center text-[11px] text-white/[0.28]">
              No hay vendedores que coincidan con los filtros.
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#151517]">
      <div className="mx-auto max-w-[1220px] px-6 py-5">
        <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-white/[0.08] bg-white/[0.035] text-white/[0.48] transition hover:bg-white/[0.07] hover:text-white"
              title="Volver a vendedores"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[17px] font-medium text-white/[0.94]">
                  ID {selected.id}
                </span>
                {summary?.currentCategoria ? (
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[9px] font-medium ${categoryTone(summary.currentCategoria)}`}
                  >
                    {summary.currentCategoriaLabel}
                  </span>
                ) : null}
                <span className="rounded-full bg-white/[0.045] px-2.5 py-1 text-[9px] text-white/[0.36]">
                  {branchLabel(selected.branchKey)}
                </span>
              </div>
              <div className="mt-1 truncate text-[12px] text-white/[0.42]">
                {summary?.sellerName || selected.name}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="rounded-[14px] border border-white/[0.07] bg-[#1c1c1e] p-2.5">
              <div className="mb-2 flex items-center gap-2 px-1">
                <CalendarRange className="h-4 w-4 text-[#5ac8fa]" />
                <span className="text-[11px] font-medium text-white/[0.58]">
                  Rango de análisis
                </span>
              </div>
              <div className="grid min-w-[390px] grid-cols-2 gap-2">
                <div>
                  <span className="mb-1 block px-1 text-[10px] font-medium uppercase tracking-[0.07em] text-white/[0.30]">
                    Desde
                  </span>
                  <RedcomSelect
                    value={from}
                    surface="dark"
                    accent="indigo"
                    className="h-10 rounded-[11px] text-[12px]"
                    onValueChange={(value) => void applyRange(value, to)}
                    options={periods.map((period) => ({
                      value: period.value,
                      label: periodLabel(period),
                    }))}
                    placeholder="Período inicial"
                    aria-label="Período inicial"
                  />
                </div>
                <div>
                  <span className="mb-1 block px-1 text-[10px] font-medium uppercase tracking-[0.07em] text-white/[0.30]">
                    Hasta
                  </span>
                  <RedcomSelect
                    value={to}
                    surface="dark"
                    accent="indigo"
                    className="h-10 rounded-[11px] text-[12px]"
                    onValueChange={(value) => void applyRange(from, value)}
                    options={periods.map((period) => ({
                      value: period.value,
                      label: periodLabel(period),
                    }))}
                    placeholder="Período final"
                    aria-label="Período final"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {loadingHistory ? (
          <div className="grid min-h-[420px] place-items-center">
            <div className="flex items-center gap-2 text-[11px] text-white/[0.36]">
              <Loader2 className="h-4 w-4 animate-spin text-[#5ac8fa]" />
              Recalculando el período...
            </div>
          </div>
        ) : historyError ? (
          <div className="mt-5 rounded-[16px] border border-rose-300/15 bg-rose-300/[0.055] p-4 text-[11px] text-rose-200">
            {historyError}
          </div>
        ) : !summary ? (
          <div className="mt-5 rounded-[18px] border border-dashed border-white/[0.07] py-12 text-center text-[11px] text-white/[0.28]">
            No hay información del vendedor para el rango seleccionado.
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                icon={<BadgeCheck className="h-4 w-4" />}
                label="Categoría actual"
                value={selected.lastCategoriaLabel ?? '—'}
                detail={`Último cierre: ${selected.lastPeriod}`}
              />
              <MetricCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Eficiencia promedio"
                value={formatPercent(summary.avgEficiencia)}
                progress={summary.avgEficiencia}
              />
              <MetricCard
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Efectividad promedio"
                value={formatPercent(summary.avgEfectividad)}
                progress={summary.avgEfectividad}
              />
              <MetricCard
                icon={<CircleDollarSign className="h-4 w-4" />}
                label="Facturación promedio"
                value={formatMoney(summary.avgFacturacion)}
                detail={
                  summary.bestFacturacionPeriod
                    ? `Mejor período: ${summary.bestFacturacionPeriod}`
                    : undefined
                }
              />
            </div>

            <section className="mt-3 rounded-[18px] border border-white/[0.07] bg-[#1c1c1e] p-4">
              <div>
                <div className="text-[13px] font-medium text-white/[0.86]">
                  Promedios del rango
                </div>
                <div className="mt-0.5 text-[11px] text-white/[0.34]">
                  Todos estos valores se recalculan al cambiar Desde / Hasta.
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                <DataTile label="Cobertura" value={formatNumber(rangeAverages.cobertura, 1)} />
                <DataTile label="Volumen" value={formatNumber(rangeAverages.volumen, 1)} />
                <DataTile label="Visitados" value={formatNumber(rangeAverages.visitados, 1)} />
                <DataTile label="Visitas planeadas" value={formatNumber(rangeAverages.visitasPlaneadas, 1)} />
                <DataTile label="Ventas" value={formatNumber(rangeAverages.ventas, 1)} />
                <DataTile label="Boletas diarias" value={formatNumber(rangeAverages.boletasDiarias, 1)} />
                <DataTile label="Ticket promedio" value={formatMoney(rangeAverages.ticket)} />
                <DataTile
                  label="Horas de ruta"
                  value={secondsToHoursLabel(
                    rangeAverages.horasRutaSeconds === null
                      ? null
                      : Math.round(rangeAverages.horasRutaSeconds),
                  )}
                />
                <DataTile label="% PDV" value={formatPercent(rangeAverages.pdv)} />
                <DataTile label="% distancia" value={formatPercent(rangeAverages.distancia)} />
                <DataTile label="POP" value={formatPercent(rangeAverages.pop)} />
                <DataTile label="Exhibición" value={formatPercent(rangeAverages.exhibicion)} />
                <DataTile label="MIX" value={formatPercent(rangeAverages.mix)} />
              </div>
            </section>

            <section className="mt-3 overflow-hidden rounded-[18px] border border-white/[0.07] bg-[#1c1c1e]">
              <div className="border-b border-white/[0.06] px-4 py-3">
                <div className="text-[13px] font-medium text-white/[0.86]">
                  Histórico del vendedor
                </div>
                <div className="mt-0.5 text-[11px] text-white/[0.34]">
                  Los cálculos superiores se actualizan con este mismo rango.
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left">
                  <thead className="bg-white/[0.025] text-[10px] uppercase tracking-[0.08em] text-white/[0.34]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Período</th>
                      <th className="px-4 py-3 font-medium">Categoría</th>
                      <th className="px-4 py-3 font-medium">Eficiencia</th>
                      <th className="px-4 py-3 font-medium">Efectividad</th>
                      <th className="px-4 py-3 font-medium">Facturación</th>
                      <th className="px-4 py-3 font-medium">Cobertura</th>
                      <th className="px-4 py-3 font-medium">Volumen</th>
                      <th className="px-4 py-3 font-medium">Ruta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((point) => (
                      <tr
                        key={point.period}
                        className="border-t border-white/[0.05] text-[12px] text-white/[0.62]"
                      >
                        <td className="px-4 py-3 font-medium text-white/[0.76]">
                          {point.periodLabel}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: CATEGORY_COLORS[point.categoria] }}
                            />
                            {point.categoriaLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3">{formatPercent(point.eficiencia)}</td>
                        <td className="px-4 py-3">{formatPercent(point.efectividad)}</td>
                        <td className="px-4 py-3">{formatMoney(point.facturacion)}</td>
                        <td className="px-4 py-3">{formatNumber(point.cobertura)}</td>
                        <td className="px-4 py-3">{formatNumber(point.volumen)}</td>
                        <td className="px-4 py-3">
                          {secondsToHoursLabel(point.horasRutaSeconds)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  progress,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  progress?: number | null;
}) {
  return (
    <div className="rounded-[16px] border border-white/[0.07] bg-[#1c1c1e] p-3.5">
      <div className="flex items-center gap-2 text-white/[0.30]">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>
      <div className="mt-2 text-[19px] font-medium tracking-[-0.02em] text-white/[0.90]">
        {value}
      </div>
      {typeof progress === 'number' ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-[#5ac8fa]"
            style={{ width: `${safePercentBar(progress)}%` }}
          />
        </div>
      ) : null}
      {detail ? (
        <div className="mt-1.5 text-[11px] text-white/[0.32]">{detail}</div>
      ) : null}
    </div>
  );
}

function DataTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-white/[0.055] bg-white/[0.025] px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.30]">
        {label}
      </div>
      <div className="mt-1 text-[13px] font-medium text-white/[0.76]">{value}</div>
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.055] pb-2.5 last:border-b-0">
      <span className="text-[12px] text-white/[0.42]">{label}</span>
      <span className="text-[10px] font-medium text-white/[0.72]">{value}</span>
    </div>
  );
}
