"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
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
  CircleDollarSign,
  ClipboardCheck,
  Factory,
  LayoutDashboard,
  Loader2,
  PieChart as PieChartIcon,
  ShieldAlert,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import CategoriaVendorHistory from "@/components/categoria/CategoriaVendorHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SmartTooltip, useSmartTooltip } from "@/components/ui/smart-tooltip";
import {
  CATEGORY_LABEL,
  formatMoney,
  formatNumber,
  formatPercent,
  type CategoriaHistoryPoint,
  type CategoriaHistorySeller,
  type CategoriaHistorySummary,
} from "@/utils/categoriaHistory";
import {
  CATEGORIA_ACCENTS,
  CATEGORIA_RANK,
  type CategoriaKey,
} from "@/utils/categories";

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
  actionSeller: RankingApiItem | null;
  monthly: BranchMonthlyPoint[];
  supervisors: SupervisorBranchRow[];
  categoryDistribution: Array<{ name: string; value: number; categoria: CategoriaKey }>;
  ranking: RankingApiItem[];
};

type CompanySummary = {
  branchCount: number;
  sellersCount: number;
  monthsCount: number;
  avgHealthScore: number | null;
  avgEficiencia: number | null;
  avgEfectividad: number | null;
  avgFacturacion: number | null;
  totalFacturacion: number | null;
  dominantCategoria: CategoriaKey | null;
  dominantCategoriaPct: number | null;
  planMejoraPct: number | null;
  seniorPct: number | null;
  bestBranch: BranchSummary | null;
  actionBranch: BranchSummary | null;
  bestSeller: RankingApiItem | null;
  actionSeller: RankingApiItem | null;
  monthly: BranchMonthlyPoint[];
  categoryDistribution: Array<{ name: string; value: number; categoria: CategoriaKey }>;
  branches: BranchSummary[];
  sellers: Array<RankingApiItem & { branchLabel: string; branchKey: string }>;
};

type BranchData = {
  branchKey: BranchKey;
  periods: PeriodOption[];
  ranking: RankingApiItem[];
};

const BRANCH_OPTIONS: Array<{ key: BranchKey; label: string; shortLabel: string; description: string }> = [
  {
    key: "corrientes_masivos",
    label: "Corrientes · Masivos",
    shortLabel: "Ctes. Masivos",
    description: "Equipo comercial de Corrientes Masivos",
  },
  {
    key: "corrientes_refrigerados",
    label: "Corrientes · Refrigerados",
    shortLabel: "Ctes. Refrig.",
    description: "Equipo comercial de Corrientes Refrigerados",
  },
  {
    key: "chaco_masivos",
    label: "Chaco · Masivos",
    shortLabel: "Chaco",
    description: "Equipo comercial de Chaco",
  },
  {
    key: "misiones_masivos",
    label: "Misiones · Masivos",
    shortLabel: "Misiones",
    description: "Equipo comercial de Misiones",
  },
  {
    key: "obera_masivos",
    label: "Oberá · Masivos",
    shortLabel: "Oberá",
    description: "Equipo comercial de Oberá",
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

function getBranchInfo(branchKey: string) {
  return BRANCH_OPTIONS.find((item) => item.key === branchKey);
}

function getBranchLabel(branchKey: string) {
  return getBranchInfo(branchKey)?.label ?? branchKey;
}

function getSellerPower(summary: CategoriaHistorySummary | null) {
  if (!summary) return Number.NEGATIVE_INFINITY;
  const category = summary.currentCategoria ? CATEGORIA_RANK[summary.currentCategoria] * 1000 : 0;
  const effect = summary.avgEfectividad ?? 0;
  const efficiency = summary.avgEficiencia ?? 0;
  const billing = summary.avgFacturacion ? Math.log10(Math.max(summary.avgFacturacion, 1)) * 12 : 0;
  return category + effect * 2 + efficiency + billing;
}

function getActionNeed(summary: CategoriaHistorySummary | null) {
  if (!summary) return 100;

  let need = 20;

  if (summary.currentCategoria === "PLAN_MEJORA") need += 45;
  if (summary.currentCategoria === "JUNIOR") need += 16;
  if (summary.currentCategoria === "SEMI_SENIOR") need -= 4;
  if (summary.currentCategoria === "SENIOR") need -= 15;

  const delta = summary.categoryDelta ?? 0;
  if (delta <= -2) need += 24;
  else if (delta === -1) need += 12;
  else if (delta >= 1) need -= 10;

  if ((summary.avgEfectividad ?? 0) < 89) need += 10;
  if ((summary.avgEficiencia ?? 0) < 60) need += 8;

  return Math.max(0, Math.min(100, Math.round(need)));
}

function getBranchHealthScore(summary: BranchSummary) {
  const breakdown = getBranchHealthBreakdown(summary);
  return breakdown.finalScore;
}

type HealthBreakdownRow = {
  label: string;
  value: string;
  detail: string;
  points: number;
  maxLabel: string;
  isPenalty?: boolean;
};

type BranchHealthBreakdown = {
  rows: HealthBreakdownRow[];
  rawScore: number;
  finalScore: number;
};

function ratio01(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function getBranchHealthBreakdown(summary: BranchSummary): BranchHealthBreakdown {
  const categoryRatio = summary.avgCategoriaRank === null ? 0 : ratio01(summary.avgCategoriaRank / 3);
  const eficienciaRatio = summary.avgEficiencia === null ? 0 : ratio01(summary.avgEficiencia / 75);
  const efectividadRatio = summary.avgEfectividad === null ? 0 : ratio01(summary.avgEfectividad / 95);

  // planMejoraPct y seniorPct se guardan como porcentaje real, por ejemplo 71 = 71%.
  // Para el índice deben comportarse como ratio 0..1.
  const seniorRatio = summary.seniorPct === null ? 0 : ratio01(summary.seniorPct / 100);
  const planMejoraRatio = summary.planMejoraPct === null ? 0 : ratio01(summary.planMejoraPct / 100);

  const categoryPoints = categoryRatio * 35;
  const eficienciaPoints = eficienciaRatio * 22;
  const efectividadPoints = efectividadRatio * 22;
  const seniorPoints = seniorRatio * 13;
  const planPenalty = planMejoraRatio * 12;
  const basePoints = 8;
  const rawScore = categoryPoints + eficienciaPoints + efectividadPoints + seniorPoints - planPenalty + basePoints;
  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    rawScore,
    finalScore,
    rows: [
      {
        label: "Categoría promedio",
        value: summary.avgCategoriaRank === null ? "Sin datos" : `${formatNumber(summary.avgCategoriaRank, 2)} / 3`,
        detail: "Nivel promedio de categoría actual de los vendedores.",
        points: categoryPoints,
        maxLabel: "35",
      },
      {
        label: "Eficiencia promedio",
        value: summary.avgEficiencia === null ? "Sin datos" : `${formatPercent(summary.avgEficiencia)} sobre objetivo 75%`,
        detail: "Mide qué tan cerca está la sucursal del objetivo de eficiencia.",
        points: eficienciaPoints,
        maxLabel: "22",
      },
      {
        label: "Efectividad promedio",
        value: summary.avgEfectividad === null ? "Sin datos" : `${formatPercent(summary.avgEfectividad)} sobre objetivo 95%`,
        detail: "Mide el nivel de cumplimiento de efectividad comercial.",
        points: efectividadPoints,
        maxLabel: "22",
      },
      {
        label: "Peso de Senior",
        value: summary.seniorPct === null ? "Sin datos" : `${formatPercent(summary.seniorPct, 0)} de vendedores Senior`,
        detail: "Suma cuando la sucursal concentra vendedores en categorías superiores.",
        points: seniorPoints,
        maxLabel: "13",
      },
      {
        label: "Plan de Mejora",
        value: summary.planMejoraPct === null ? "Sin datos" : `${formatPercent(summary.planMejoraPct, 0)} en Plan de Mejora`,
        detail: "Resta puntos cuando hay una proporción alta en Plan de Mejora.",
        points: -planPenalty,
        maxLabel: "-12",
        isPenalty: true,
      },
      {
        label: "Base de lectura",
        value: "+8 pts",
        detail: "Punto de partida para que el índice sea comparable entre sucursales.",
        points: basePoints,
        maxLabel: "8",
      },
    ],
  };
}

function buildMonthly(points: CategoriaHistoryPoint[]) {
  const periodMap = new Map<string, CategoriaHistoryPoint[]>();
  for (const point of points) {
    const current = periodMap.get(point.period) ?? [];
    current.push(point);
    periodMap.set(point.period, current);
  }

  return Array.from(periodMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, currentPoints]) => {
      const facturacionTotal = sum(currentPoints.map((item) => item.facturacion));
      const planCount = currentPoints.filter((item) => item.categoria === "PLAN_MEJORA").length;

      return {
        period,
        periodLabel: periodLabel(period),
        vendedores: currentPoints.length,
        eficiencia: average(currentPoints.map((item) => item.eficiencia)),
        efectividad: average(currentPoints.map((item) => item.efectividad)),
        facturacionTotal,
        facturacionPromedio: average(currentPoints.map((item) => item.facturacion)),
        ventas: sum(currentPoints.map((item) => item.totalVentas)),
        categoriaIndex: average(currentPoints.map((item) => item.categoriaRank)),
        planMejoraPct: currentPoints.length ? (planCount / currentPoints.length) * 100 : null,
      } satisfies BranchMonthlyPoint;
    });
}

function buildCategoryDistribution(latest: CategoriaHistoryPoint[]) {
  const categoryCounts = new Map<CategoriaKey, number>();
  for (const point of latest) {
    categoryCounts.set(point.categoria, (categoryCounts.get(point.categoria) ?? 0) + 1);
  }

  return CATEGORY_ORDER.map((categoria) => ({
    categoria,
    name: CATEGORY_LABEL[categoria],
    value: categoryCounts.get(categoria) ?? 0,
  })).filter((item) => item.value > 0);
}

function buildBranchSummary(branchKey: string, ranking: RankingApiItem[], periods: PeriodOption[]): BranchSummary {
  const label = getBranchLabel(branchKey);
  const rows = ranking.filter((item) => item.summary && Array.isArray(item.history) && item.history.length > 0);
  const allPoints = rows.flatMap((item) => item.history);
  const latestBySeller = rows
    .map((item) => ({ item, last: [...item.history].sort((a, b) => a.period.localeCompare(b.period)).at(-1) ?? null }))
    .filter((item): item is { item: RankingApiItem; last: CategoriaHistoryPoint } => Boolean(item.last));

  const categoryDistribution = buildCategoryDistribution(latestBySeller.map(({ last }) => last));
  const dominant = categoryDistribution.reduce<typeof categoryDistribution[number] | null>(
    (best, item) => (!best || item.value > best.value ? item : best),
    null,
  );

  const supervisors = buildSupervisorRows(rows);
  const bestSeller = [...rows].sort((a, b) => getSellerPower(b.summary) - getSellerPower(a.summary))[0] ?? null;
  const actionSeller = [...rows].sort((a, b) => getActionNeed(b.summary) - getActionNeed(a.summary))[0] ?? null;

  const summary: BranchSummary = {
    branchKey,
    label,
    sellersCount: rows.length,
    monthsCount: periods.length || buildMonthly(allPoints).length,
    firstPeriod: periods[0]?.value ?? allPoints.map((point) => point.period).sort()[0] ?? null,
    lastPeriod: periods.at(-1)?.value ?? allPoints.map((point) => point.period).sort().at(-1) ?? null,
    avgEficiencia: average(rows.map((item) => item.summary.avgEficiencia)),
    avgEfectividad: average(rows.map((item) => item.summary.avgEfectividad)),
    avgFacturacion: average(rows.map((item) => item.summary.avgFacturacion)),
    totalFacturacion: sum(allPoints.map((point) => point.facturacion)),
    avgCategoriaRank: average(latestBySeller.map(({ last }) => last.categoriaRank)),
    dominantCategoria: dominant?.categoria ?? null,
    dominantCategoriaPct: dominant && latestBySeller.length ? dominant.value / latestBySeller.length : null,
    planMejoraPct: latestBySeller.length ? (latestBySeller.filter(({ last }) => last.categoria === "PLAN_MEJORA").length / latestBySeller.length) * 100 : null,
    seniorPct: latestBySeller.length ? (latestBySeller.filter(({ last }) => last.categoria === "SENIOR").length / latestBySeller.length) * 100 : null,
    healthScore: null,
    bestSeller,
    actionSeller,
    monthly: buildMonthly(allPoints),
    supervisors,
    categoryDistribution,
    ranking: rows,
  };

  summary.healthScore = getBranchHealthScore(summary);
  return summary;
}

function buildSupervisorRows(rows: RankingApiItem[]) {
  const supervisorMap = new Map<string, RankingApiItem[]>();
  for (const item of rows) {
    const last = [...item.history].sort((a, b) => a.period.localeCompare(b.period)).at(-1);
    const supervisor = String(last?.supervisor ?? "").trim();
    const validSupervisor = supervisor && supervisor !== "—" && supervisor.toUpperCase() !== "NO";
    const key = validSupervisor ? supervisor : "Sin supervisor asignado";
    const current = supervisorMap.get(key) ?? [];
    current.push(item);
    supervisorMap.set(key, current);
  }

  return Array.from(supervisorMap.entries())
    .map(([supervisor, items]) => {
      const latest = items
        .map((item) => ({ item, last: [...item.history].sort((a, b) => a.period.localeCompare(b.period)).at(-1) ?? null }))
        .filter((item): item is { item: RankingApiItem; last: CategoriaHistoryPoint } => Boolean(item.last));
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
        bestSeller: bestSeller?.summary.sellerName ?? "—",
      } satisfies SupervisorBranchRow;
    })
    .sort((a, b) => (b.avgCategoriaRank ?? 0) - (a.avgCategoriaRank ?? 0));
}

function buildCompanySummary(branches: BranchSummary[]): CompanySummary {
  const activeBranches = branches.filter((branch) => branch.sellersCount > 0);
  const sellers = activeBranches.flatMap((branch) =>
    branch.ranking.map((seller) => ({ ...seller, branchLabel: branch.label, branchKey: branch.branchKey })),
  );
  const allPoints = sellers.flatMap((seller) => seller.history);
  const latestBySeller = sellers
    .map((seller) => ({ seller, last: [...seller.history].sort((a, b) => a.period.localeCompare(b.period)).at(-1) ?? null }))
    .filter((item): item is { seller: RankingApiItem & { branchLabel: string; branchKey: string }; last: CategoriaHistoryPoint } => Boolean(item.last));

  const categoryDistribution = buildCategoryDistribution(latestBySeller.map(({ last }) => last));
  const dominant = categoryDistribution.reduce<typeof categoryDistribution[number] | null>(
    (best, item) => (!best || item.value > best.value ? item : best),
    null,
  );

  const bestSeller = [...sellers].sort((a, b) => getSellerPower(b.summary) - getSellerPower(a.summary))[0] ?? null;
  const actionSeller = [...sellers].sort((a, b) => getActionNeed(b.summary) - getActionNeed(a.summary))[0] ?? null;
  const bestBranch = [...activeBranches].sort((a, b) => (b.healthScore ?? 0) - (a.healthScore ?? 0))[0] ?? null;
  const actionBranch = [...activeBranches].sort((a, b) => (b.planMejoraPct ?? 0) - (a.planMejoraPct ?? 0))[0] ?? null;

  return {
    branchCount: activeBranches.length,
    sellersCount: sellers.length,
    monthsCount: new Set(allPoints.map((point) => point.period)).size,
    avgHealthScore: average(activeBranches.map((branch) => branch.healthScore)),
    avgEficiencia: average(sellers.map((seller) => seller.summary.avgEficiencia)),
    avgEfectividad: average(sellers.map((seller) => seller.summary.avgEfectividad)),
    avgFacturacion: average(sellers.map((seller) => seller.summary.avgFacturacion)),
    totalFacturacion: sum(allPoints.map((point) => point.facturacion)),
    dominantCategoria: dominant?.categoria ?? null,
    dominantCategoriaPct: dominant && latestBySeller.length ? dominant.value / latestBySeller.length : null,
    planMejoraPct: latestBySeller.length ? (latestBySeller.filter(({ last }) => last.categoria === "PLAN_MEJORA").length / latestBySeller.length) * 100 : null,
    seniorPct: latestBySeller.length ? (latestBySeller.filter(({ last }) => last.categoria === "SENIOR").length / latestBySeller.length) * 100 : null,
    bestBranch,
    actionBranch,
    bestSeller,
    actionSeller,
    monthly: buildMonthly(allPoints),
    categoryDistribution,
    branches: activeBranches,
    sellers,
  };
}

function mergePeriods(data: BranchData[]) {
  const map = new Map<string, PeriodOption>();
  for (const branch of data) {
    for (const period of branch.periods) {
      if (!map.has(period.value)) map.set(period.value, period);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.value.localeCompare(b.value));
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

async function fetchAllBranches(from?: string, to?: string, signal?: AbortSignal) {
  const responses = await Promise.all(
    BRANCH_OPTIONS.map(async (branch) => {
      try {
        const json = await fetchBranchRanking(branch.key, from, to, signal);
        return {
          branchKey: branch.key,
          periods: Array.isArray(json.periods) ? json.periods : [],
          ranking: Array.isArray(json.ranking) ? json.ranking : [],
        } satisfies BranchData;
      } catch {
        return {
          branchKey: branch.key,
          periods: [],
          ranking: [],
        } satisfies BranchData;
      }
    }),
  );
  return responses;
}

function PeriodSelect({
  label,
  value,
  periods,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  periods: PeriodOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cls("block", disabled ? "opacity-60" : "")}>
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cls(
          "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5",
          disabled ? "cursor-not-allowed bg-slate-100 text-slate-400 focus:border-slate-200 focus:ring-0" : "",
        )}
      >
        {periods.map((period) => (
          <option key={`${label}-${period.value}`} value={period.value}>
            {periodLabel(period.value)}
          </option>
        ))}
      </select>
    </label>
  );
}

function BranchIndexTooltip({ summary }: { summary: BranchSummary }) {
  const breakdown = getBranchHealthBreakdown(summary);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Índice sucursal</div>
          <div className="mt-1 text-lg font-black text-slate-950">{summary.healthScore ?? breakdown.finalScore}/100</div>
        </div>
        <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">{summary.label}</div>
      </div>

      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
        Resume la salud comercial de la sucursal combinando categoría promedio, eficiencia, efectividad, presencia de Senior y peso de Plan de Mejora.
      </p>

      <div className="mt-4 space-y-2">
        {breakdown.rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-black text-slate-950">{row.label}</div>
                <div className="mt-0.5 text-xs font-semibold leading-5 text-slate-500">{row.value}</div>
              </div>
              <div className={cls("shrink-0 text-sm font-black", row.isPenalty ? "text-red-600" : "text-slate-950")}>
                {row.points >= 0 ? "+" : ""}{formatNumber(row.points, 1)} pts
              </div>
            </div>
            <div className="mt-1 text-[11px] font-semibold leading-4 text-slate-400">{row.detail}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-slate-950 p-3 text-xs font-bold leading-5 text-white">
        Resultado: {breakdown.rows.map((row) => `${row.points >= 0 ? "+" : ""}${formatNumber(row.points, 1)}`).join(" ")} = {formatNumber(breakdown.rawScore, 1)} → {breakdown.finalScore}/100.
      </div>
    </div>
  );
}

function CompanyIndexTooltip({ company }: { company: CompanySummary }) {
  const branches = company.branches.filter((branch) => typeof branch.healthScore === "number");
  const total = branches.reduce((acc, branch) => acc + (branch.healthScore ?? 0), 0);
  const averageScore = branches.length ? total / branches.length : null;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Índice empresa</div>
          <div className="mt-1 text-lg font-black text-slate-950">{averageScore !== null ? `${formatNumber(averageScore, 0)}/100` : "—"}</div>
        </div>
        <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">{branches.length} sucursales</div>
      </div>

      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
        Es el promedio simple de los índices de las sucursales con datos en el rango seleccionado. Sirve para ver la foto general de la empresa sin entrar sucursal por sucursal.
      </p>

      <div className="mt-4 space-y-2">
        {branches.map((branch) => (
          <div key={branch.branchKey} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div>
              <div className="text-sm font-black text-slate-950">{branch.label}</div>
              <div className="mt-0.5 text-xs font-semibold text-slate-500">
                {branch.sellersCount} vendedores · {formatPercent(branch.planMejoraPct, 0)} en Plan de Mejora
              </div>
            </div>
            <div className="self-center text-sm font-black text-slate-950">{branch.healthScore ?? "—"}/100</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-slate-950 p-3 text-xs font-bold leading-5 text-white">
        Cálculo: ({branches.map((branch) => branch.healthScore ?? 0).join(" + ") || "sin datos"}) / {branches.length || 0} = {averageScore !== null ? `${formatNumber(averageScore, 1)}/100` : "—"}.
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  accent = "slate",
  tooltip,
}: {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  icon: React.ReactNode;
  accent?: "slate" | "red" | "emerald" | "amber" | "blue";
  tooltip?: React.ReactNode;
}) {
  const smartTooltip = useSmartTooltip();
  const ref = useRef<HTMLDivElement | null>(null);
  const accentClasses = {
    slate: "bg-slate-950 text-white",
    red: "bg-red-600 text-white",
    emerald: "bg-emerald-700 text-white",
    amber: "bg-amber-500 text-white",
    blue: "bg-sky-700 text-white",
  }[accent];

  const show = () => {
    if (!tooltip) return;
    smartTooltip.show();
  };

  const hide = () => {
    if (!tooltip) return;
    smartTooltip.hide();
  };

  return (
    <>
      <Card
        ref={ref}
        tabIndex={tooltip ? 0 : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={cls(
          "rounded-2xl border-slate-200 bg-white shadow-2xl",
          tooltip ? "cursor-help outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-slate-900/30" : "",
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={cls("grid h-10 w-10 shrink-0 place-items-center rounded-xl", accentClasses)}>{icon}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase leading-4 tracking-[0.16em] text-slate-500">
                {label}
                {tooltip ? (
                  <span className="inline-grid h-5 w-5 place-items-center rounded-full border border-slate-200 bg-slate-50 text-[10px] text-slate-500">?</span>
                ) : null}
              </div>
              <div className="mt-2 text-2xl font-black leading-none tracking-tight text-slate-950 md:text-3xl">{value}</div>
              {helper ? <div className="mt-2 text-xs font-semibold leading-5 text-slate-500">{helper}</div> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {tooltip ? (
        <SmartTooltip
          anchorRef={ref}
          open={smartTooltip.open}
          width={520}
          align="start"
          onMouseEnter={smartTooltip.show}
          onMouseLeave={smartTooltip.hide}
        >
          {tooltip}
        </SmartTooltip>
      ) : null}
    </>
  );
}

function ChartPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cls("rounded-2xl border-slate-200 bg-white shadow-2xl", className)}>
      <CardHeader className="border-b border-slate-100 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-black tracking-tight text-slate-950">{title}</CardTitle>
            {description ? <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{description}</p> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white text-slate-400 shadow-sm">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function CategoryBadge({ categoria }: { categoria: CategoriaKey | null }) {
  if (!categoria) return <span className="text-slate-400">—</span>;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-black text-white"
      style={{ backgroundColor: CATEGORIA_ACCENTS[categoria] }}
    >
      {CATEGORY_LABEL[categoria]}
    </span>
  );
}

function BranchSelector({
  value,
  onChange,
}: {
  value: BranchKey;
  onChange: (value: BranchKey) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Sucursal</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as BranchKey)}
        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
      >
        {BRANCH_OPTIONS.map((branch) => (
          <option key={branch.key} value={branch.key}>
            {branch.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur">
      <div className="mb-2 font-black text-slate-900">{label}</div>
      <div className="space-y-1">
        {payload.map((item: any) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-bold text-slate-900">
              {String(item.dataKey).toLowerCase().includes("facturacion")
                ? formatMoney(Number(item.value))
                : String(item.dataKey).toLowerCase().includes("pct") || String(item.name).includes("%")
                  ? formatPercent(Number(item.value), 1)
                  : typeof item.value === "number"
                    ? formatNumber(item.value, 1)
                    : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExecutiveIntro({ company }: { company: CompanySummary }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              <Factory className="h-3.5 w-3.5" /> Vista empresa
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Tablero comercial consolidado</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
              Reúne todas las sucursales con cierres disponibles para detectar dónde crece la operación, dónde se concentra el Plan de Mejora y qué equipos requieren seguimiento.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Cobertura</div>
            <div className="mt-1 text-2xl font-black text-slate-950">{company.branchCount} sucursales</div>
            <div className="text-xs font-semibold text-slate-500">{company.sellersCount} vendedores en análisis</div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-2xl">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/50">Lectura rápida</div>
        <div className="mt-3 text-lg font-black leading-6">
          {company.bestBranch ? `${company.bestBranch.label} lidera el índice general.` : "Sin sucursales con datos suficientes."}
        </div>
        <p className="mt-2 text-sm font-semibold leading-6 text-white/60">
          {company.actionBranch
            ? `${company.actionBranch.label} concentra ${formatPercent(company.actionBranch.planMejoraPct, 0)} en Plan de Mejora.`
            : "Cuando haya más cierres, se mostrarán focos de seguimiento."}
        </p>
      </div>
    </div>
  );
}

function CompanyView({ company }: { company: CompanySummary }) {
  if (!company.sellersCount) {
    return (
      <EmptyState
        title="Sin datos consolidados para empresa"
        description="Cuando existan cierres mensuales en las sucursales, este panel va a consolidar vendedores, categorías, facturación y planes de acción."
      />
    );
  }

  const branchScoreData = company.branches.map((branch) => ({
    label: getBranchInfo(branch.branchKey)?.shortLabel ?? branch.label,
    score: branch.healthScore,
    planMejora: branch.planMejoraPct,
    sellers: branch.sellersCount,
  }));

  const topSellers = [...company.sellers].sort((a, b) => getSellerPower(b.summary) - getSellerPower(a.summary)).slice(0, 7);
  const actionSellers = [...company.sellers].sort((a, b) => getActionNeed(b.summary) - getActionNeed(a.summary)).slice(0, 7);

  return (
    <div className="space-y-6">
      <ExecutiveIntro company={company} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Índice empresa"
          value={company.avgHealthScore !== null ? `${formatNumber(company.avgHealthScore, 0)}/100` : "—"}
          helper="Promedio de salud de sucursales."
          icon={<ShieldAlert className="h-5 w-5" />}
          accent="red"
          tooltip={<CompanyIndexTooltip company={company} />}
        />
        <MetricCard
          label="Vendedores"
          value={company.sellersCount}
          helper={`${company.branchCount} sucursales con datos`}
          icon={<Users className="h-5 w-5" />}
        />
        <MetricCard
          label="Categoría dominante"
          value={<CategoryBadge categoria={company.dominantCategoria} />}
          helper={company.dominantCategoriaPct !== null ? `${formatPercent(company.dominantCategoriaPct * 100, 0)} del total` : "Sin datos"}
          icon={<PieChartIcon className="h-5 w-5" />}
          accent="blue"
        />
        <MetricCard
          label="Eficiencia / efectividad"
          value={formatPercent(company.avgEficiencia)}
          helper={`Efectividad: ${formatPercent(company.avgEfectividad)}`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="emerald"
        />
        <MetricCard
          label="Facturación total"
          value={compactMoney(company.totalFacturacion)}
          helper={`Promedio vendedor: ${compactMoney(company.avgFacturacion)}`}
          icon={<CircleDollarSign className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <ChartPanel title="Comparativo de sucursales" description="Índice general y peso de Plan de Mejora por sucursal.">
          <div className="h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={branchScoreData} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(value) => `${value}%`} />
                <Tooltip content={<CurrencyTooltip />} />
                <Legend />
                <Bar yAxisId="left" dataKey="score" name="Índice" fill="#0f172a" radius={[10, 10, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="planMejora" name="% Plan de Mejora" stroke="#dc2626" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Composición de categorías" description="Última categoría detectada de todos los vendedores.">
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={company.categoryDistribution} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={4}>
                    {company.categoryDistribution.map((entry) => (
                      <Cell key={entry.categoria} fill={CATEGORIA_ACCENTS[entry.categoria]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {company.categoryDistribution.map((entry) => (
                <div key={entry.categoria} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORIA_ACCENTS[entry.categoria] }} />
                    <span className="text-sm font-black text-slate-800">{entry.name}</span>
                  </div>
                  <span className="text-sm font-black text-slate-950">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartPanel title="Evolución operativa empresa" description="Eficiencia, efectividad y categoría promedio por mes.">
          <div className="h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={company.monthly} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="periodLabel" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CurrencyTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="eficiencia" name="Eficiencia" stroke="#0f172a" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="efectividad" name="Efectividad" stroke="#047857" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="categoriaIndex" name="Índice categoría" stroke="#dc2626" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Facturación consolidada" description="Facturación total mensual de todas las sucursales incluidas.">
          <div className="h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={company.monthly} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="companyBilling" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="periodLabel" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => compactMoney(Number(value))} />
                <Tooltip content={<CurrencyTooltip />} />
                <Area type="monotone" dataKey="facturacionTotal" name="Facturación total" stroke="#0f172a" strokeWidth={3} fill="url(#companyBilling)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <ChartPanel title="Ranking de sucursales" description="Resumen de desempeño por sucursal.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-black">Sucursal</th>
                  <th className="px-4 py-3 font-black">Índice</th>
                  <th className="px-4 py-3 font-black">Vendedores</th>
                  <th className="px-4 py-3 font-black">Categoría dominante</th>
                  <th className="px-4 py-3 font-black">Eficiencia</th>
                  <th className="px-4 py-3 font-black">Efectividad</th>
                  <th className="px-4 py-3 font-black">Plan mejora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...company.branches].sort((a, b) => (b.healthScore ?? 0) - (a.healthScore ?? 0)).map((branch) => (
                  <tr key={branch.branchKey} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-black text-slate-950">{branch.label}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{branch.healthScore ?? "—"}/100</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{branch.sellersCount}</td>
                    <td className="px-4 py-3"><CategoryBadge categoria={branch.dominantCategoria} /></td>
                    <td className="px-4 py-3 font-bold text-slate-700">{formatPercent(branch.avgEficiencia)}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{formatPercent(branch.avgEfectividad)}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{formatPercent(branch.planMejoraPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartPanel>

        <div className="space-y-5">
          <ChartPanel title="Top vendedores empresa" description="Mejores referencias del período.">
            <div className="space-y-2">
              {topSellers.map((seller, index) => (
                <div key={`${seller.branchKey}-${seller.sellerId}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-950">#{index + 1} · ID {seller.sellerId}</div>
                    <div className="truncate text-xs font-semibold text-slate-500">{seller.summary.sellerName} · {seller.branchLabel}</div>
                  </div>
                  <CategoryBadge categoria={seller.summary.currentCategoria} />
                </div>
              ))}
            </div>
          </ChartPanel>

          <ChartPanel title="Planes a revisar" description="Prioridad sugerida por categoría, evolución y promedios.">
            <div className="space-y-2">
              {actionSellers.map((seller) => (
                <div key={`${seller.branchKey}-${seller.sellerId}`} className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-950">ID {seller.sellerId}</div>
                    <div className="truncate text-xs font-semibold text-slate-500">{seller.summary.sellerName} · {seller.branchLabel}</div>
                  </div>
                  <div className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-red-700 ring-1 ring-red-100">
                    Plan {getActionNeed(seller.summary)}
                  </div>
                </div>
              ))}
            </div>
          </ChartPanel>
        </div>
      </div>
    </div>
  );
}

function BranchView({ summary }: { summary: BranchSummary }) {
  if (!summary.sellersCount) {
    return (
      <EmptyState
        title="Sin meses cerrados suficientes para esta sucursal"
        description="Cuando existan cierres mensuales, este panel va a mostrar el resumen gerencial de la sucursal seleccionada."
      />
    );
  }

  const topSellers = [...summary.ranking].sort((a, b) => getSellerPower(b.summary) - getSellerPower(a.summary)).slice(0, 6);
  const actionSellers = [...summary.ranking].sort((a, b) => getActionNeed(b.summary) - getActionNeed(a.summary)).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Resumen sucursal</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">{summary.label}</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
              Lectura ejecutiva de categorías, indicadores comerciales, mesas de supervisión y planes a revisar dentro del período seleccionado.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
            {summary.firstPeriod ? periodLabel(summary.firstPeriod) : "—"} — {summary.lastPeriod ? periodLabel(summary.lastPeriod) : "—"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Índice sucursal"
          value={summary.healthScore !== null ? `${summary.healthScore}/100` : "—"}
          helper="Salud comercial del equipo."
          icon={<ShieldAlert className="h-5 w-5" />}
          accent="red"
          tooltip={<BranchIndexTooltip summary={summary} />}
        />
        <MetricCard label="Vendedores" value={summary.sellersCount} helper={`${summary.monthsCount} meses analizados`} icon={<Users className="h-5 w-5" />} />
        <MetricCard label="Categoría dominante" value={<CategoryBadge categoria={summary.dominantCategoria} />} helper={summary.dominantCategoriaPct !== null ? `${formatPercent(summary.dominantCategoriaPct * 100, 0)} de la sucursal` : "Sin datos"} icon={<PieChartIcon className="h-5 w-5" />} accent="blue" />
        <MetricCard label="Eficiencia" value={formatPercent(summary.avgEficiencia)} helper={`Efectividad: ${formatPercent(summary.avgEfectividad)}`} icon={<CheckCircle2 className="h-5 w-5" />} accent="emerald" />
        <MetricCard label="Facturación" value={compactMoney(summary.totalFacturacion)} helper={`Promedio vendedor: ${compactMoney(summary.avgFacturacion)}`} icon={<CircleDollarSign className="h-5 w-5" />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartPanel title="Evolución mensual" description="Eficiencia, efectividad y categoría promedio de la sucursal.">
          <div className="h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary.monthly} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="periodLabel" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CurrencyTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="eficiencia" name="Eficiencia" stroke="#0f172a" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="efectividad" name="Efectividad" stroke="#047857" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="categoriaIndex" name="Índice categoría" stroke="#dc2626" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Facturación mensual" description="Facturación total acumulada por la sucursal.">
          <div className="h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.monthly} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="periodLabel" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => compactMoney(Number(value))} />
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="facturacionTotal" name="Facturación total" fill="#0f172a" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ChartPanel title="Composición actual" description="Última categoría detectada por vendedor.">
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summary.categoryDistribution} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={4}>
                    {summary.categoryDistribution.map((entry) => (
                      <Cell key={entry.categoria} fill={CATEGORIA_ACCENTS[entry.categoria]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {summary.categoryDistribution.map((entry) => (
                <div key={entry.categoria} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORIA_ACCENTS[entry.categoria] }} />
                    <span className="text-sm font-black text-slate-800">{entry.name}</span>
                  </div>
                  <span className="text-sm font-black text-slate-950">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartPanel>

        <ChartPanel title="Mesas de supervisión" description="Rendimiento agregado por supervisor.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-black">Supervisor</th>
                  <th className="px-4 py-3 font-black">Vendedores</th>
                  <th className="px-4 py-3 font-black">Categoría</th>
                  <th className="px-4 py-3 font-black">Eficiencia</th>
                  <th className="px-4 py-3 font-black">Efectividad</th>
                  <th className="px-4 py-3 font-black">Facturación</th>
                  <th className="px-4 py-3 font-black">Plan mejora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.supervisors.map((supervisor) => (
                  <tr key={supervisor.supervisor} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-black text-slate-950">{supervisor.supervisor}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{supervisor.sellersCount}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{supervisor.avgCategoriaRank === null ? "—" : formatNumber(supervisor.avgCategoriaRank, 1)}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{formatPercent(supervisor.avgEficiencia)}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{formatPercent(supervisor.avgEfectividad)}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{compactMoney(supervisor.totalFacturacion)}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{formatPercent(supervisor.planMejoraPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartPanel title="Top vendedores" description="Mejores referencias dentro de la sucursal.">
          <div className="space-y-2">
            {topSellers.map((seller, index) => (
              <div key={seller.sellerId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-950">#{index + 1} · ID {seller.sellerId}</div>
                  <div className="truncate text-xs font-semibold text-slate-500">{seller.summary.sellerName}</div>
                </div>
                <CategoryBadge categoria={seller.summary.currentCategoria} />
              </div>
            ))}
          </div>
        </ChartPanel>

        <ChartPanel title="Planes a revisar" description="Casos que conviene mirar primero.">
          <div className="space-y-2">
            {actionSellers.map((seller) => (
              <div key={seller.sellerId} className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/50 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-950">ID {seller.sellerId}</div>
                  <div className="truncate text-xs font-semibold text-slate-500">{seller.summary.sellerName}</div>
                </div>
                <div className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-red-700 ring-1 ring-red-100">
                  Plan {getActionNeed(seller.summary)}
                </div>
              </div>
            ))}
          </div>
        </ChartPanel>
      </div>
    </div>
  );
}

export default function GerenciaCategoriasDashboard() {
  const [selectedBranch, setSelectedBranch] = useState<BranchKey>("corrientes_masivos");
  const [activeView, setActiveView] = useState<"company" | "branch" | "detail">("company");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<BranchData[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const responses = await fetchAllBranches(undefined, undefined, controller.signal);
        const nextPeriods = mergePeriods(responses);
        setData(responses);
        setPeriods(nextPeriods);
        setFrom(nextPeriods[0]?.value ?? "");
        setTo(nextPeriods.at(-1)?.value ?? "");
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError(e?.message ?? "No se pudo cargar el análisis de categorías");
          setData([]);
          setPeriods([]);
          setFrom("");
          setTo("");
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!from || !to) return;
    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const responses = await fetchAllBranches(from, to, controller.signal);
        setData(responses);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError(e?.message ?? "No se pudo cargar el rango seleccionado");
          setData([]);
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [from, to]);

  const branchSummaries = useMemo(
    () => data.map((branch) => buildBranchSummary(branch.branchKey, branch.ranking, branch.periods)),
    [data],
  );

  const company = useMemo(() => buildCompanySummary(branchSummaries), [branchSummaries]);

  const selectedBranchSummary = useMemo(
    () => branchSummaries.find((branch) => branch.branchKey === selectedBranch) ?? buildBranchSummary(selectedBranch, [], []),
    [branchSummaries, selectedBranch],
  );

  const selectedBranchInfo = getBranchInfo(selectedBranch);
  const datesLocked = activeView === "detail";

  return (
    <section className="mt-8 space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200 px-5 py-6 md:px-7">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.20em] text-slate-500">
                <LayoutDashboard className="h-3.5 w-3.5" /> Categorías históricas
              </div>
              <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
                Análisis comercial por empresa, sucursal y vendedor
              </h1>
              <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-slate-500 md:text-base">
                Una lectura única para comparar sucursales, revisar equipos y bajar al detalle individual cuando haga falta tomar decisiones.
              </p>
            </div>

            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
              <PeriodSelect label="Desde" value={from} periods={periods} onChange={setFrom} disabled={datesLocked} />
              <PeriodSelect label="Hasta" value={to} periods={periods} onChange={setTo} disabled={datesLocked} />
              <div className="md:col-span-2">
                <BranchSelector value={selectedBranch} onChange={setSelectedBranch} />
                <div className="mt-2 text-xs font-semibold text-slate-500">{selectedBranchInfo?.description}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-7">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Tabs value={activeView} onValueChange={(value) => setActiveView(value as "company" | "branch" | "detail")} className="w-full lg:w-auto">
              <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-3 lg:w-auto">
                <TabsTrigger value="company" className="rounded-xl px-4 py-3 text-sm font-black text-slate-500 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none">
                  Resumen empresa
                </TabsTrigger>
                <TabsTrigger value="branch" className="rounded-xl px-4 py-3 text-sm font-black text-slate-500 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none">
                  Resumen sucursal
                </TabsTrigger>
                <TabsTrigger value="detail" className="rounded-xl px-4 py-3 text-sm font-black text-slate-500 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none">
                  Detalle vendedores
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs font-black text-slate-500 ring-1 ring-slate-200">
              <CalendarRange className="h-4 w-4" /> {from ? periodLabel(from) : "—"} a {to ? periodLabel(to) : "—"}
            </div>
          </div>

          {error ? (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{error}</div>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 py-14 text-sm font-black text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando análisis de categorías...
            </div>
          ) : null}

          {!loading && !error && activeView === "company" ? <CompanyView company={company} /> : null}
          {!loading && !error && activeView === "branch" ? <BranchView summary={selectedBranchSummary} /> : null}
          {!loading && !error && activeView === "detail" ? (
            <CategoriaVendorHistory branchKeyOverride={selectedBranch} className="mt-0" />
          ) : null}
        </div>
      </div>
    </section>
  );
}
