'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Loader2,
  Search,
  Target,
  TrendingUp,
  UserRound,
  UsersRound,
} from 'lucide-react';

import {
  CATEGORY_COLORS,
  CATEGORY_LABEL,
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

function branchLabel(branchKey: string) {
  return BRANCHES.find((branch) => branch.key === branchKey)?.label ?? branchKey;
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

        const responses = await Promise.all(
          BRANCHES.map(async (branch) => {
            const response = await fetch(
              `/api/categorias/history?branch_key=${branch.key}`,
              { cache: 'no-store' },
            );
            const json = (await response.json()) as HistoryResponse;
            if (!response.ok) {
              throw new Error(json.error || `No se pudo cargar ${branch.label}.`);
            }
            return json;
          }),
        );

        if (cancelled) return;

        const sellers = responses.flatMap((response) =>
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

        setCatalog(sellers);

        const saved = await fetchProjectTaskActionPlan(taskId);
        if (cancelled || !saved) return;

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

  const latest = history.length ? history[history.length - 1] : null;

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
    setFrom(nextFrom);
    setTo(nextTo);
    await fetchHistory(selected.branchKey, selected.id, nextFrom, nextTo);
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
                <div className="mt-0.5 truncate text-[10px] text-white/[0.42]">
                  {seller.name}
                </div>

                <div className="mt-3 border-t border-white/[0.055] pt-2.5">
                  <div className="inline-flex items-center gap-1.5 text-[9px] text-white/[0.30]">
                    <Building2 className="h-3 w-3" />
                    {branchLabel(seller.branchKey)}
                  </div>
                  <div className="mt-1 text-[9px] text-white/[0.24]">
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
                <span className="text-[15px] font-medium text-white/[0.94]">
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
              <div className="mt-1 truncate text-[10px] text-white/[0.34]">
                {summary?.sellerName || selected.name}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-[12px] border border-white/[0.07] bg-[#1c1c1e] px-3 py-2">
              <CalendarRange className="h-3.5 w-3.5 text-[#5ac8fa]" />
              <select
                value={from}
                onChange={(event) => void applyRange(event.target.value, to)}
                className="bg-transparent text-[10px] text-white/[0.68] outline-none"
              >
                {periods.map((period) => (
                  <option key={`from-${period.value}`} value={period.value}>
                    Desde {period.value}
                  </option>
                ))}
              </select>
              <span className="text-white/[0.18]">→</span>
              <select
                value={to}
                onChange={(event) => void applyRange(from, event.target.value)}
                className="bg-transparent text-[10px] text-white/[0.68] outline-none"
              >
                {periods.map((period) => (
                  <option key={`to-${period.value}`} value={period.value}>
                    Hasta {period.value}
                  </option>
                ))}
              </select>
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
        ) : !summary || !latest ? (
          <div className="mt-5 rounded-[18px] border border-dashed border-white/[0.07] py-12 text-center text-[11px] text-white/[0.28]">
            No hay información del vendedor para el rango seleccionado.
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                icon={<BadgeCheck className="h-4 w-4" />}
                label="Categoría actual"
                value={summary.currentCategoriaLabel ?? '—'}
                detail={`${summary.months} período${summary.months === 1 ? '' : 's'} analizado${summary.months === 1 ? '' : 's'}`}
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
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[9px] font-medium uppercase tracking-[0.10em] text-white/[0.30]">
                    Trayectoria de categoría
                  </div>
                  <div className="mt-1 text-[11px] text-white/[0.48]">
                    Evolución mensual del vendedor dentro del rango seleccionado.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {history.map((point) => (
                    <div
                      key={point.period}
                      className="min-w-[74px] rounded-[10px] border border-white/[0.06] bg-white/[0.025] px-2 py-1.5"
                      title={`${point.periodLabel}: ${point.categoriaLabel}`}
                    >
                      <div className="text-[8px] text-white/[0.24]">
                        {point.periodLabel}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[point.categoria] }}
                        />
                        <span className="truncate text-[9px] font-medium text-white/[0.62]">
                          {point.categoriaLabel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="mt-3 grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-[18px] border border-white/[0.07] bg-[#1c1c1e] p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#5ac8fa]" />
                  <div>
                    <div className="text-[11px] font-medium text-white/[0.82]">
                      Último período disponible
                    </div>
                    <div className="text-[9px] text-white/[0.28]">
                      {latest.periodLabel} · {latest.supervisor}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <DataTile label="Facturación" value={formatMoney(latest.facturacion)} />
                  <DataTile label="Facturación promedio" value={formatMoney(latest.facturacionPromedio)} />
                  <DataTile label="Ticket promedio" value={formatMoney(latest.promedioBoletas)} />
                  <DataTile label="Cobertura" value={formatNumber(latest.cobertura)} />
                  <DataTile label="Volumen" value={formatNumber(latest.volumen)} />
                  <DataTile label="Boletas diarias" value={formatNumber(latest.promedioBoletasDiarias, 1)} />
                  <DataTile label="Visitados" value={formatNumber(latest.visitados)} />
                  <DataTile label="Visitas planeadas" value={formatNumber(latest.visitasPlaneadas)} />
                  <DataTile label="Ventas totales" value={formatNumber(latest.totalVentas)} />
                  <DataTile label="Venta PDV" value={formatNumber(latest.ventaPdv)} />
                  <DataTile label="Venta distancia" value={formatNumber(latest.ventaDistancia)} />
                  <DataTile label="Horas de ruta" value={secondsToHoursLabel(latest.horasRutaSeconds)} />
                  <DataTile label="% PDV" value={formatPercent(latest.porcentajePdv)} />
                  <DataTile label="% distancia" value={formatPercent(latest.porcentajeDistancia)} />
                  <DataTile label="POP" value={formatPercent(latest.pop)} />
                  <DataTile label="Exhibición" value={formatPercent(latest.exhibicion)} />
                  <DataTile label="MIX" value={formatPercent(latest.mix)} />
                  <DataTile
                    label="Cumple horario"
                    value={
                      latest.cumpleHorario === null
                        ? '—'
                        : latest.cumpleHorario
                          ? 'Sí'
                          : 'No'
                    }
                  />
                </div>
              </section>

              <section className="rounded-[18px] border border-white/[0.07] bg-[#1c1c1e] p-4">
                <div className="text-[11px] font-medium text-white/[0.82]">
                  Lectura del rango
                </div>
                <div className="mt-4 space-y-3">
                  <InsightRow
                    label="Categoría inicial"
                    value={summary.initialCategoriaLabel ?? '—'}
                  />
                  <InsightRow
                    label="Categoría actual"
                    value={summary.currentCategoriaLabel ?? '—'}
                  />
                  <InsightRow
                    label="Mejor categoría"
                    value={summary.bestCategoriaLabel ?? '—'}
                  />
                  <InsightRow
                    label="Variación"
                    value={
                      summary.categoryDelta === null
                        ? '—'
                        : summary.categoryDelta > 0
                          ? `+${summary.categoryDelta} nivel${summary.categoryDelta === 1 ? '' : 'es'}`
                          : summary.categoryDelta < 0
                            ? `${summary.categoryDelta} nivel${summary.categoryDelta === -1 ? '' : 'es'}`
                            : 'Sin cambios'
                    }
                  />
                  <InsightRow
                    label="Mejor facturación"
                    value={formatMoney(summary.bestFacturacion)}
                  />
                </div>

                <div className="mt-4 rounded-[13px] border border-[#0a84ff]/12 bg-[#0a84ff]/[0.045] px-3 py-3 text-[10px] leading-4 text-[#8bc7ff]/70">
                  Este vendedor queda vinculado a la tarea como foco del plan de
                  acción. Podés cambiar el rango para analizar distintos momentos
                  sin alterar esa vinculación.
                </div>
              </section>
            </div>

            <section className="mt-3 overflow-hidden rounded-[18px] border border-white/[0.07] bg-[#1c1c1e]">
              <div className="border-b border-white/[0.06] px-4 py-3">
                <div className="text-[11px] font-medium text-white/[0.82]">
                  Histórico del vendedor
                </div>
                <div className="mt-0.5 text-[9px] text-white/[0.28]">
                  Los cálculos superiores se actualizan con este mismo rango.
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left">
                  <thead className="bg-white/[0.025] text-[9px] uppercase tracking-[0.08em] text-white/[0.28]">
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
                        className="border-t border-white/[0.05] text-[10px] text-white/[0.56]"
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
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  progress?: number | null;
}) {
  return (
    <div className="rounded-[16px] border border-white/[0.07] bg-[#1c1c1e] p-3.5">
      <div className="flex items-center gap-2 text-white/[0.30]">
        {icon}
        <span className="text-[9px] font-medium uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>
      <div className="mt-2 text-[17px] font-medium tracking-[-0.02em] text-white/[0.90]">
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
        <div className="mt-1.5 text-[9px] text-white/[0.26]">{detail}</div>
      ) : null}
    </div>
  );
}

function DataTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-white/[0.055] bg-white/[0.025] px-3 py-2.5">
      <div className="text-[8px] font-medium uppercase tracking-[0.08em] text-white/[0.24]">
        {label}
      </div>
      <div className="mt-1 text-[11px] font-medium text-white/[0.68]">{value}</div>
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.055] pb-2.5 last:border-b-0">
      <span className="text-[10px] text-white/[0.34]">{label}</span>
      <span className="text-[10px] font-medium text-white/[0.72]">{value}</span>
    </div>
  );
}
