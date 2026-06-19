"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarRange,
  CheckCircle2,
  Loader2,
  PieChart as PieChartIcon,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";

import CategoriaVendorHistory from "@/components/categoria/CategoriaVendorHistory";
import {
  CATEGORY_COLORS,
  CATEGORY_LABEL,
  formatMoney,
  formatNumber,
  formatPercent,
  type CategoriaHistoryPoint,
  type CategoriaHistorySeller,
  type CategoriaHistorySummary,
} from "@/utils/categoriaHistory";
import { CATEGORIA_RANK, type CategoriaKey } from "@/utils/categories";

type BranchKey =
  | "corrientes_masivos"
  | "corrientes_refrigerados"
  | "chaco_masivos"
  | "misiones_masivos"
  | "obera_masivos";

type PeriodOption = {
  value: string;
  year: number;
  month: number;
  closedAt: string | null;
  snapshotId: number;
};

type RankingApiItem = {
  sellerId: string;
  sellerName: string;
  sellerCatalogName?: string;
  months: number;
  history: CategoriaHistoryPoint[];
  summary: CategoriaHistorySummary;
};

type ApiResponse = {
  branchKey: string;
  periods: PeriodOption[];
  sellers: CategoriaHistorySeller[];
  history: CategoriaHistoryPoint[];
  summary: CategoriaHistorySummary | null;
  ranking?: RankingApiItem[];
  error?: string;
};

type BranchMonthlyPoint = {
  period: string;
  periodLabel: string;
  vendedores: number;
  eficiencia: number | null;
  efectividad: number | null;
  facturacionTotal: number | null;
  facturacionPromedio: number | null;
  ventas: number | null;
  categoriaIndex: number | null;
  planMejoraPct: number | null;
};

type SupervisorBranchRow = {
  supervisor: string;
  sellersCount: number;
  avgEficiencia: number | null;
  avgEfectividad: number | null;
  totalFacturacion: number | null;
  avgFacturacion: number | null;
  avgCategoriaRank: number | null;
  planMejoraPct: number | null;
  bestSeller: string;
};

type BranchSummary = {
  branchKey: string;
  label: string;
  sellersCount: number;
  monthsCount: number;
  firstPeriod: string | null;
  lastPeriod: string | null;
  avgEficiencia: number | null;
  avgEfectividad: number | null;
  avgFacturacion: number | null;
  totalFacturacion: number | null;
  avgCategoriaRank: number | null;
  dominantCategoria: CategoriaKey | null;
  dominantCategoriaPct: number | null;
  planMejoraPct: number | null;
  seniorPct: number | null;
  healthScore: number | null;
  bestSeller: RankingApiItem | null;
  atRiskSeller: RankingApiItem | null;
  monthly: BranchMonthlyPoint[];
  supervisors: SupervisorBranchRow[];
  categoryDistribution: Array<{ name: string; value: number; categoria: CategoriaKey }>;
};

const BRANCH_OPTIONS: Array<{ key: BranchKey; label: string; description: string }> = [
  {
    key: "corrientes_masivos",
    label: "Corrientes · Masivos",
    description: "Histórico comercial de Corrientes Masivos",
  },
  {
    key: "corrientes_refrigerados",
    label: "Corrientes · Refrigerados",
    description: "Histórico comercial de Corrientes Refrigerados",
  },
  {
    key: "chaco_masivos",
    label: "Chaco · Masivos",
    description: "Histórico comercial de Chaco",
  },
  {
    key: "misiones_masivos",
    label: "Misiones · Masivos",
    description: "Histórico comercial de Misiones",
  },
  {
    key: "obera_masivos",
    label: "Oberá · Masivos",
    description: "Histórico comercial de Oberá",
  },
];

const CATEGORY_ORDER: CategoriaKey[] = ["PLAN_MEJORA", "JUNIOR", "SEMI_SENIOR", "SENIOR"];
const CATEGORY_TICKS: Record<number, string> = {
  0: "Mejora",
  1: "Junior",
  2: "Semi",
  3: "Senior",
};

function cls(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((acc, value) => acc + value, 0) / valid.length;
}

function sum(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((acc, value) => acc + value, 0);
}

function compactMoney(value: number | null) {
  if (value === null) return "—";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return formatMoney(value);
}

function compactNumber(value: number | null) {
  if (value === null) return "—";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1).replace(".", ",")}K`;
  return formatNumber(value);
}

function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  if (!year || !month) return period;
  return `${monthNames[Math.max(0, Math.min(11, month - 1))]} ${year}`;
}

function getBranchLabel(branchKey: string) {
  return BRANCH_OPTIONS.find((item) => item.key === branchKey)?.label ?? branchKey;
}

function getSellerPower(summary: CategoriaHistorySummary | null) {
  if (!summary) return Number.NEGATIVE_INFINITY;
  const category = summary.currentCategoria ? CATEGORIA_RANK[summary.currentCategoria] * 1000 : 0;
  const effect = summary.avgEfectividad ?? 0;
  const efficiency = summary.avgEficiencia ?? 0;
  const billing = summary.avgFacturacion ? Math.log10(Math.max(summary.avgFacturacion, 1)) * 12 : 0;
  return category + effect * 2 + efficiency + billing;
}

function getSellerRisk(summary: CategoriaHistorySummary | null) {
  if (!summary) return 100;
  let risk = 30;

  if (summary.currentCategoria === "PLAN_MEJORA") risk += 32;
  if (summary.currentCategoria === "JUNIOR") risk += 10;
  if (summary.currentCategoria === "SENIOR") risk -= 12;

  const delta = summary.categoryDelta ?? 0;
  if (delta <= -2) risk += 20;
  else if (delta === -1) risk += 10;
  else if (delta >= 1) risk -= 10;

  if ((summary.avgEfectividad ?? 0) < 89) risk += 14;
  if ((summary.avgEficiencia ?? 0) < 60) risk += 10;

  return Math.max(0, Math.min(100, Math.round(risk)));
}

function getBranchHealthScore(summary: BranchSummary) {
  const categoryRatio = summary.avgCategoriaRank === null ? 0 : summary.avgCategoriaRank / 3;
  const eficienciaRatio = summary.avgEficiencia === null ? 0 : Math.min(summary.avgEficiencia / 75, 1);
  const efectividadRatio = summary.avgEfectividad === null ? 0 : Math.min(summary.avgEfectividad / 95, 1);
  const seniorBoost = summary.seniorPct ?? 0;
  const planPenalty = summary.planMejoraPct ?? 0;

  const score =
    categoryRatio * 35 +
    eficienciaRatio * 22 +
    efectividadRatio * 22 +
    seniorBoost * 13 -
    planPenalty * 12 +
    8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildBranchSummary(branchKey: string, ranking: RankingApiItem[], periods: PeriodOption[]): BranchSummary {
  const label = getBranchLabel(branchKey);
  const rows = ranking.filter((item) => item.summary && Array.isArray(item.history) && item.history.length > 0);
  const allPoints = rows.flatMap((item) => item.history);
  const latestBySeller = rows
    .map((item) => ({ item, last: [...item.history].sort((a, b) => a.period.localeCompare(b.period)).at(-1) ?? null }))
    .filter((item): item is { item: RankingApiItem; last: CategoriaHistoryPoint } => Boolean(item.last));

  const categoryCounts = new Map<CategoriaKey, number>();
  for (const { last } of latestBySeller) {
    categoryCounts.set(last.categoria, (categoryCounts.get(last.categoria) ?? 0) + 1);
  }

  const categoryDistribution = CATEGORY_ORDER.map((categoria) => ({
    categoria,
    name: CATEGORY_LABEL[categoria],
    value: categoryCounts.get(categoria) ?? 0,
  })).filter((item) => item.value > 0);

  const dominant = categoryDistribution.reduce<typeof categoryDistribution[number] | null>(
    (best, item) => (!best || item.value > best.value ? item : best),
    null,
  );

  const periodMap = new Map<string, CategoriaHistoryPoint[]>();
  for (const point of allPoints) {
    const current = periodMap.get(point.period) ?? [];
    current.push(point);
    periodMap.set(point.period, current);
  }

  const monthly = Array.from(periodMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, points]) => {
      const facturacionTotal = sum(points.map((item) => item.facturacion));
      const planCount = points.filter((item) => item.categoria === "PLAN_MEJORA").length;

      return {
        period,
        periodLabel: periodLabel(period),
        vendedores: points.length,
        eficiencia: average(points.map((item) => item.eficiencia)),
        efectividad: average(points.map((item) => item.efectividad)),
        facturacionTotal,
        facturacionPromedio: average(points.map((item) => item.facturacion)),
        ventas: sum(points.map((item) => item.totalVentas)),
        categoriaIndex: average(points.map((item) => item.categoriaRank)),
        planMejoraPct: points.length ? (planCount / points.length) * 100 : null,
      } satisfies BranchMonthlyPoint;
    });

  const supervisorMap = new Map<string, RankingApiItem[]>();
  for (const item of rows) {
    const last = [...item.history].sort((a, b) => a.period.localeCompare(b.period)).at(-1);
    const supervisor = String(last?.supervisor ?? "").trim();
    const validSupervisor = supervisor && supervisor !== "—" && supervisor.toUpperCase() !== "NO";
    const key = validSupervisor ? supervisor : "Sin supervisor válido";
    const current = supervisorMap.get(key) ?? [];
    current.push(item);
    supervisorMap.set(key, current);
  }

  const supervisors = Array.from(supervisorMap.entries())
    .map(([supervisor, items]) => {
      const latest = items
        .map((item) => ({ item, last: [...item.history].sort((a, b) => a.period.localeCompare(b.period)).at(-1) ?? null }))
        .filter((item): item is { item: RankingApiItem; last: CategoriaHistoryPoint } => Boolean(item.last));
      const sellerNames = items.map((item) => item.summary.sellerName || `ID ${item.sellerId}`);
      const bestSeller = [...items].sort((a, b) => getSellerPower(b.summary) - getSellerPower(a.summary))[0];
      const planCount = latest.filter(({ last }) => last.categoria === "PLAN_MEJORA").length;

      return {
        supervisor,
        sellersCount: items.length,
        avgEficiencia: average(items.map((item) => item.summary.avgEficiencia)),
        avgEfectividad: average(items.map((item) => item.summary.avgEfectividad)),
        totalFacturacion: sum(items.flatMap((item) => item.history.map((point) => point.facturacion))),
        avgFacturacion: average(items.map((item) => item.summary.avgFacturacion)),
        avgCategoriaRank: average(latest.map(({ last }) => last.categoriaRank)),
        planMejoraPct: latest.length ? (planCount / latest.length) * 100 : null,
        bestSeller: bestSeller?.summary.sellerName ?? sellerNames[0] ?? "—",
      } satisfies SupervisorBranchRow;
    })
    .sort((a, b) => (b.avgCategoriaRank ?? 0) - (a.avgCategoriaRank ?? 0));

  const bestSeller = [...rows].sort((a, b) => getSellerPower(b.summary) - getSellerPower(a.summary))[0] ?? null;
  const atRiskSeller = [...rows].sort((a, b) => getSellerRisk(b.summary) - getSellerRisk(a.summary))[0] ?? null;

  const summary: BranchSummary = {
    branchKey,
    label,
    sellersCount: rows.length,
    monthsCount: periods.length || monthly.length,
    firstPeriod: periods[0]?.value ?? monthly[0]?.period ?? null,
    lastPeriod: periods.at(-1)?.value ?? monthly.at(-1)?.period ?? null,
    avgEficiencia: average(rows.map((item) => item.summary.avgEficiencia)),
    avgEfectividad: average(rows.map((item) => item.summary.avgEfectividad)),
    avgFacturacion: average(rows.map((item) => item.summary.avgFacturacion)),
    totalFacturacion: sum(allPoints.map((point) => point.facturacion)),
    avgCategoriaRank: average(latestBySeller.map(({ last }) => last.categoriaRank)),
    dominantCategoria: dominant?.categoria ?? null,
    dominantCategoriaPct: dominant && latestBySeller.length ? dominant.value / latestBySeller.length : null,
    planMejoraPct: latestBySeller.length ? (categoryCounts.get("PLAN_MEJORA") ?? 0) / latestBySeller.length : null,
    seniorPct: latestBySeller.length ? (categoryCounts.get("SENIOR") ?? 0) / latestBySeller.length : null,
    healthScore: null,
    bestSeller,
    atRiskSeller,
    monthly,
    supervisors,
    categoryDistribution,
  };

  summary.healthScore = getBranchHealthScore(summary);
  return summary;
}

async function fetchBranchRanking(branchKey: string, from?: string, to?: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ branch_key: branchKey, ranking: "1" });
  if (from) query.set("from", from);
  if (to) query.set("to", to);

  const res = await fetch(`/api/categorias/history?${query.toString()}`, {
    cache: "no-store",
    signal,
  });
  const json = (await res.json()) as ApiResponse;
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json;
}

function PeriodSelect({
  label,
  value,
  periods,
  onChange,
}: {
  label: string;
  value: string;
  periods: PeriodOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-100"
      >
        {periods.map((period) => (
          <option key={period.value} value={period.value}>
            {periodLabel(period.value)}
          </option>
        ))}
      </select>
    </label>
  );
}

function BranchKpiCard({
  title,
  value,
  hint,
  icon,
  featured = false,
}: {
  title: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <div
      className={cls(
        "group rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_60px_rgba(15,23,42,0.12)]",
        featured
          ? "border-slate-900 bg-slate-950 text-white md:col-span-2 md:row-span-2"
          : "border-slate-200 bg-white text-slate-900",
      )}
    >
      <div className="flex h-full min-h-[130px] flex-col justify-between gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className={cls("text-xs font-black uppercase tracking-[0.22em]", featured ? "text-white/55" : "text-slate-500")}>
            {title}
          </div>
          <div className={cls("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", featured ? "bg-white/10 text-white" : "bg-slate-50 text-slate-700")}>
            {icon}
          </div>
        </div>
        <div>
          <div className={cls("break-words font-black leading-none tracking-tight", featured ? "text-[clamp(3.4rem,6vw,5.5rem)] text-white" : "text-[clamp(2rem,4vw,3rem)] text-slate-950")}>
            {value}
          </div>
          {hint ? <div className={cls("mt-3 text-sm font-semibold leading-5", featured ? "text-white/65" : "text-slate-500")}>{hint}</div> : null}
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cls("rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]", className)}>
      <div className="mb-5">
        <h3 className="text-lg font-black text-slate-950">{title}</h3>
        {description ? <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function BranchCategoryBadge({ categoria }: { categoria: CategoriaKey | null }) {
  if (!categoria) return <span className="text-slate-400">—</span>;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-black text-white"
      style={{ backgroundColor: CATEGORY_COLORS[categoria] }}
    >
      {CATEGORY_LABEL[categoria]}
    </span>
  );
}

export default function GerenciaCategoriasDashboard() {
  const [selectedBranch, setSelectedBranch] = useState<BranchKey>("corrientes_masivos");
  const [activeView, setActiveView] = useState<"branch" | "detail">("branch");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ranking, setRanking] = useState<RankingApiItem[]>([]);
  const [globalSummaries, setGlobalSummaries] = useState<BranchSummary[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setError(null);
      setRanking([]);
      try {
        const json = await fetchBranchRanking(selectedBranch, undefined, undefined, controller.signal);
        const nextPeriods = Array.isArray(json.periods) ? json.periods : [];
        setPeriods(nextPeriods);
        setFrom(nextPeriods[0]?.value ?? "");
        setTo(nextPeriods.at(-1)?.value ?? "");
        setRanking(Array.isArray(json.ranking) ? json.ranking : []);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError(e?.message ?? "No se pudo cargar el dashboard gerencial");
          setPeriods([]);
          setRanking([]);
          setFrom("");
          setTo("");
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [selectedBranch]);

  useEffect(() => {
    if (!selectedBranch || !from || !to) return;
    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await fetchBranchRanking(selectedBranch, from, to, controller.signal);
        setRanking(Array.isArray(json.ranking) ? json.ranking : []);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError(e?.message ?? "No se pudo cargar el rango seleccionado");
          setRanking([]);
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [selectedBranch, from, to]);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      try {
        const responses = await Promise.all(
          BRANCH_OPTIONS.map(async (branch) => {
            try {
              const json = await fetchBranchRanking(branch.key, undefined, undefined, controller.signal);
              const summary = buildBranchSummary(branch.key, Array.isArray(json.ranking) ? json.ranking : [], Array.isArray(json.periods) ? json.periods : []);
              return summary.sellersCount > 0 ? summary : null;
            } catch {
              return null;
            }
          }),
        );
        setGlobalSummaries(responses.filter(Boolean) as BranchSummary[]);
      } catch {
        // Este bloque no debe romper la page gerencial: el detalle de sucursal ya informa errores propios.
      }
    };

    run();
    return () => controller.abort();
  }, []);

  const summary = useMemo(
    () => buildBranchSummary(selectedBranch, ranking, periods),
    [selectedBranch, ranking, periods],
  );

  const bestGlobalBranch = useMemo(
    () => [...globalSummaries].sort((a, b) => (b.healthScore ?? 0) - (a.healthScore ?? 0))[0] ?? null,
    [globalSummaries],
  );

  const selectedBranchInfo = BRANCH_OPTIONS.find((branch) => branch.key === selectedBranch);

  const topSellers = useMemo(
    () => [...ranking].sort((a, b) => getSellerPower(b.summary) - getSellerPower(a.summary)).slice(0, 5),
    [ranking],
  );

  const riskSellers = useMemo(
    () => [...ranking].sort((a, b) => getSellerRisk(b.summary) - getSellerRisk(a.summary)).slice(0, 5),
    [ranking],
  );

  return (
    <section className="mt-20">
      <div className="rounded-[2.25rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
        <div className="relative overflow-hidden rounded-t-[2.25rem] bg-slate-950 px-5 py-7 text-white md:px-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(239,68,68,0.30),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(14,165,233,0.28),transparent_36%),radial-gradient(circle_at_45%_110%,rgba(16,185,129,0.22),transparent_34%)]" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.20em] text-white/75">
                <Building2 className="h-3.5 w-3.5" /> Categorías históricas · Gerencia
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
                Dashboard histórico por sucursal
              </h2>
              <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-white/65 md:text-base">
                Seleccioná una sucursal para ver su rendimiento histórico completo, evolución mensual,
                composición de categorías, mesas de supervisión y análisis detallado de vendedores sin entrar a cada page individual.
              </p>
            </div>

            <div className="grid gap-3 rounded-[1.75rem] border border-white/10 bg-white/10 p-4 backdrop-blur md:min-w-[360px]">
              <label>
                <span className="text-xs font-black uppercase tracking-[0.18em] text-white/50">Sucursal a analizar</span>
                <select
                  value={selectedBranch}
                  onChange={(event) => setSelectedBranch(event.target.value as BranchKey)}
                  className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white px-4 text-sm font-black text-slate-900 outline-none"
                >
                  {BRANCH_OPTIONS.map((branch) => (
                    <option key={branch.key} value={branch.key}>
                      {branch.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-xs font-semibold leading-5 text-white/55">{selectedBranchInfo?.description}</div>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-5 md:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setActiveView("branch")}
                className={cls(
                  "rounded-xl px-4 py-2 text-sm font-black transition",
                  activeView === "branch" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
                )}
              >
                Resumen sucursal
              </button>
              <button
                type="button"
                onClick={() => setActiveView("detail")}
                className={cls(
                  "rounded-xl px-4 py-2 text-sm font-black transition",
                  activeView === "detail" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
                )}
              >
                Análisis detallado
              </button>
            </div>

            {periods.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                <PeriodSelect label="Desde" value={from} periods={periods} onChange={setFrom} />
                <PeriodSelect label="Hasta" value={to} periods={periods} onChange={setTo} />
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{error}</div>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center rounded-[2rem] border border-slate-200 bg-slate-50 py-14 text-sm font-black text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculando métricas históricas de sucursal...
            </div>
          ) : null}

          {!loading && !error && activeView === "branch" ? (
            summary.sellersCount > 0 ? (
              <div className="space-y-6">
                <div className="grid auto-rows-[minmax(150px,auto)] gap-4 md:grid-cols-2 xl:grid-cols-6">
                  <BranchKpiCard
                    featured
                    title="Índice de salud sucursal"
                    value={summary.healthScore !== null ? `${summary.healthScore}/100` : "—"}
                    hint={
                      <>
                        Combina categoría promedio, eficiencia, efectividad, peso de Senior y presencia de Plan de Mejora.
                      </>
                    }
                    icon={<ShieldAlert className="h-5 w-5" />}
                  />
                  <BranchKpiCard
                    title="Vendedores analizados"
                    value={summary.sellersCount}
                    hint={`${summary.monthsCount} meses con snapshots`}
                    icon={<Users className="h-5 w-5" />}
                  />
                  <BranchKpiCard
                    title="Categoría dominante"
                    value={<BranchCategoryBadge categoria={summary.dominantCategoria} />}
                    hint={summary.dominantCategoriaPct !== null ? `${formatPercent(summary.dominantCategoriaPct * 100, 0)} de la sucursal` : "Sin datos"}
                    icon={<PieChartIcon className="h-5 w-5" />}
                  />
                  <BranchKpiCard
                    title="Eficiencia promedio"
                    value={formatPercent(summary.avgEficiencia)}
                    hint={`Efectividad: ${formatPercent(summary.avgEfectividad)}`}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                  />
                  <BranchKpiCard
                    title="Facturación histórica"
                    value={compactMoney(summary.totalFacturacion)}
                    hint={`Promedio vendedor: ${compactMoney(summary.avgFacturacion)}`}
                    icon={<TrendingUp className="h-5 w-5" />}
                  />
                </div>

                {globalSummaries.length ? (
                  <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-lg font-black text-slate-950">Pulso general de sucursales</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          Comparativo rápido usando todos los snapshots disponibles por sucursal.
                        </p>
                      </div>
                      {bestGlobalBranch ? (
                        <div className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
                          Mejor índice actual: <span className="text-slate-950">{bestGlobalBranch.label}</span> · {bestGlobalBranch.healthScore}/100
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      {globalSummaries.map((branch) => (
                        <button
                          key={branch.branchKey}
                          type="button"
                          onClick={() => setSelectedBranch(branch.branchKey as BranchKey)}
                          className={cls(
                            "rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                            selectedBranch === branch.branchKey ? "border-red-200 ring-4 ring-red-50" : "border-slate-200",
                          )}
                        >
                          <div className="text-sm font-black text-slate-950">{branch.label}</div>
                          <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">{branch.healthScore ?? "—"}</div>
                          <div className="mt-1 text-xs font-bold text-slate-500">Índice sucursal /100</div>
                          <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                            <span>{branch.sellersCount} vendedores</span>
                            <span>{formatPercent((branch.planMejoraPct ?? 0) * 100, 0)} mejora</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-5 xl:grid-cols-2">
                  <ChartCard title="Evolución operativa" description="Eficiencia y efectividad promedio mensual de la sucursal.">
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={summary.monthly} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="periodLabel" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(value: any) => formatPercent(Number(value))} />
                          <Legend />
                          <Line type="monotone" dataKey="eficiencia" name="Eficiencia" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="efectividad" name="Efectividad" stroke="#16a34a" strokeWidth={3} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>

                  <ChartCard title="Facturación por mes" description="Facturación total acumulada por vendedores de la sucursal.">
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={summary.monthly} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="periodLabel" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => compactMoney(Number(value))} />
                          <Tooltip formatter={(value: any) => formatMoney(Number(value))} />
                          <Bar dataKey="facturacionTotal" name="Facturación total" fill="#ef4444" radius={[10, 10, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>

                  <ChartCard title="Composición actual de categorías" description="Distribución de la última categoría detectada por vendedor.">
                    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
                      <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={summary.categoryDistribution} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={4}>
                              {summary.categoryDistribution.map((entry) => (
                                <Cell key={entry.categoria} fill={CATEGORY_COLORS[entry.categoria]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-3">
                        {summary.categoryDistribution.map((entry) => (
                          <div key={entry.categoria} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[entry.categoria] }} />
                              <span className="text-sm font-black text-slate-800">{entry.name}</span>
                            </div>
                            <span className="text-sm font-black text-slate-950">{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ChartCard>

                  <ChartCard title="Índice de categoría mensual" description="Promedio mensual de categoría: Mejora 0, Junior 1, Semi 2, Senior 3.">
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={summary.monthly} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="categoriaIndexGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0f172a" stopOpacity={0.22} />
                              <stop offset="95%" stopColor="#0f172a" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="periodLabel" tick={{ fontSize: 12 }} />
                          <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tickFormatter={(value) => CATEGORY_TICKS[Number(value)] ?? String(value)} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(value: any) => CATEGORY_TICKS[Math.round(Number(value))] ?? formatNumber(Number(value), 1)} />
                          <Area type="monotone" dataKey="categoriaIndex" name="Índice categoría" stroke="#0f172a" strokeWidth={3} fill="url(#categoriaIndexGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <ChartCard title="Mesas de supervisión" description="Resumen ejecutivo por supervisor dentro de la sucursal." className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[860px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-black">Supervisor</th>
                            <th className="px-4 py-3 font-black">Vendedores</th>
                            <th className="px-4 py-3 font-black">Categoría prom.</th>
                            <th className="px-4 py-3 font-black">Eficiencia</th>
                            <th className="px-4 py-3 font-black">Efectividad</th>
                            <th className="px-4 py-3 font-black">Facturación total</th>
                            <th className="px-4 py-3 font-black">Plan mejora</th>
                            <th className="px-4 py-3 font-black">Mejor vendedor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {summary.supervisors.map((supervisor) => (
                            <tr key={supervisor.supervisor} className="hover:bg-slate-50/80">
                              <td className="px-4 py-3 font-black text-slate-950">{supervisor.supervisor}</td>
                              <td className="px-4 py-3 font-bold text-slate-600">{supervisor.sellersCount}</td>
                              <td className="px-4 py-3 font-bold text-slate-600">{supervisor.avgCategoriaRank === null ? "—" : formatNumber(supervisor.avgCategoriaRank, 1)}</td>
                              <td className="px-4 py-3 font-bold text-slate-600">{formatPercent(supervisor.avgEficiencia)}</td>
                              <td className="px-4 py-3 font-bold text-slate-600">{formatPercent(supervisor.avgEfectividad)}</td>
                              <td className="px-4 py-3 font-bold text-slate-600">{compactMoney(supervisor.totalFacturacion)}</td>
                              <td className="px-4 py-3 font-bold text-slate-600">{formatPercent(supervisor.planMejoraPct)}</td>
                              <td className="max-w-[220px] truncate px-4 py-3 font-bold text-slate-600">{supervisor.bestSeller}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ChartCard>

                  <div className="space-y-5">
                    <ChartCard title="Top vendedores" description="Mejor rendimiento histórico dentro del rango.">
                      <div className="space-y-3">
                        {topSellers.map((seller, index) => (
                          <div key={seller.sellerId} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="min-w-0">
                              <div className="text-sm font-black text-slate-950">#{index + 1} · ID {seller.sellerId}</div>
                              <div className="truncate text-xs font-semibold text-slate-500">{seller.summary.sellerName}</div>
                            </div>
                            <BranchCategoryBadge categoria={seller.summary.currentCategoria} />
                          </div>
                        ))}
                      </div>
                    </ChartCard>

                    <ChartCard title="Alertas a revisar" description="Vendedores con mayor riesgo relativo.">
                      <div className="space-y-3">
                        {riskSellers.map((seller) => (
                          <div key={seller.sellerId} className="flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-4 py-3">
                            <div className="min-w-0">
                              <div className="text-sm font-black text-slate-950">ID {seller.sellerId}</div>
                              <div className="truncate text-xs font-semibold text-slate-500">{seller.summary.sellerName}</div>
                            </div>
                            <div className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-red-700 ring-1 ring-red-100">
                              Riesgo {getSellerRisk(seller.summary)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ChartCard>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title="Sin snapshots suficientes para esta sucursal"
                description="Cuando existan cierres mensuales en categorias_snapshots, este panel va a mostrar el resumen gerencial de la sucursal seleccionada."
              />
            )
          ) : null}

          {!loading && !error && activeView === "detail" ? (
            <CategoriaVendorHistory branchKeyOverride={selectedBranch} className="mt-0" />
          ) : null}
        </div>
      </div>
    </section>
  );
}
