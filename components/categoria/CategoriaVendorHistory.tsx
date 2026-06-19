"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  Award,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ChevronsUp,
  Info,
  Plus,
  ShieldCheck,
  Clock3,
  LineChart as LineChartIcon,
  ListOrdered,
  Loader2,
  Search,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { getBranchKeyFromPath } from "@/utils/branchFromPath";
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
} from "@/utils/categoriaHistory";
import { CATEGORIAS, CATEGORIA_RANK, PUNTOS, type CategoriaKey } from "@/utils/categories";

type ApiResponse = {
  branchKey: string;
  periods: Array<{
    value: string;
    year: number;
    month: number;
    closedAt: string | null;
    snapshotId: number;
  }>;
  sellers: CategoriaHistorySeller[];
  history: CategoriaHistoryPoint[];
  summary: CategoriaHistorySummary | null;
  ranking?: RankingApiItem[];
  error?: string;
};

type RankingApiItem = {
  sellerId: string;
  sellerName: string;
  sellerCatalogName?: string;
  months: number;
  history: CategoriaHistoryPoint[];
  summary: CategoriaHistorySummary;
};

type RankingRow = RankingApiItem & {
  score: HistoricalScore | null;
  risk: RiskAssessment | null;
  sortScore: number;
};

type SupervisorMonthlyPoint = {
  period: string;
  periodLabel: string;
  score: number | null;
  eficiencia: number | null;
  efectividad: number | null;
  facturacionPromedio: number | null;
  facturacionTotal: number | null;
  totalVentas: number | null;
  vendedores: number;
};

type SupervisorRow = {
  supervisor: string;
  sellerIds: string[];
  sellersCount: number;
  avgScore: number | null;
  avgRisk: number | null;
  avgEficiencia: number | null;
  avgEfectividad: number | null;
  avgFacturacion: number | null;
  totalFacturacion: number | null;
  totalVentas: number | null;
  avgCategoriaRank: number | null;
  highRiskCount: number;
  lowRiskCount: number;
  planMejoraPct: number | null;
  seniorPct: number | null;
  months: number;
  bestSeller: RankingRow | null;
  atRiskSeller: RankingRow | null;
  monthly: SupervisorMonthlyPoint[];
};

type CompareSellerResult = {
  sellerId: string;
  history: CategoriaHistoryPoint[];
  summary: CategoriaHistorySummary;
};

type HistoryMode = "single" | "compare" | "ranking" | "supervisors";
type RankingSortKey = "score" | "risk" | "billing" | "category" | "variation";

const BRANCH_LABELS: Record<string, string> = {
  corrientes_masivos: "Corrientes · Masivos",
  corrientes_refrigerados: "Corrientes · Refrigerados",
  chaco_masivos: "Chaco · Masivos",
  misiones_masivos: "Misiones · Masivos",
  obera_masivos: "Oberá · Masivos",
};

const CATEGORY_TICKS: Record<number, string> = {
  0: "Mejora",
  1: "Junior",
  2: "Semi",
  3: "Senior",
};

const SELLER_A_COLOR = "#2563eb";
const SELLER_B_COLOR = "#f97316";
const SELLER_COLORS = [SELLER_A_COLOR, SELLER_B_COLOR, "#10b981", "#8b5cf6", "#ef4444", "#0ea5e9"];
const SELLER_LABELS = ["A", "B", "C", "D", "E", "F"];
const MAX_COMPARE_SELLERS = 5;

function cls(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function compactMoney(value: number | null) {
  if (value === null) return "—";
  if (Math.abs(value) >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return formatMoney(value);
}

function compactNumber(value: number | null) {
  if (value === null) return "—";
  if (Math.abs(value) >= 1_000_000)
    return `${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(value) >= 1_000)
    return `${(value / 1_000).toFixed(1).replace(".", ",")}K`;
  return formatNumber(value);
}

function deltaLabel(value: number | null | undefined) {
  if (value === null || typeof value === "undefined") return "Sin variación";
  if (value > 0) return `+${value} nivel${value === 1 ? "" : "es"}`;
  if (value < 0) return `${value} nivel${value === -1 ? "" : "es"}`;
  return "Sin variación";
}

function categoryShortName(categoria: CategoriaKey | null) {
  if (!categoria) return "—";
  return CATEGORY_TICKS[CATEGORIA_RANK[categoria]] ?? CATEGORY_LABEL[categoria];
}

function getSummaryScore(summary: CategoriaHistorySummary | null) {
  if (!summary) return Number.NEGATIVE_INFINITY;
  const category = summary.currentCategoria ? CATEGORIA_RANK[summary.currentCategoria] * 1000 : 0;
  const avgEfect = summary.avgEfectividad ?? 0;
  const avgEfic = summary.avgEficiencia ?? 0;
  const avgBilling = summary.avgFacturacion ? Math.log10(Math.max(summary.avgFacturacion, 1)) * 10 : 0;
  return category + avgEfect * 2 + avgEfic + avgBilling;
}

function getWinnerLabel(a: CategoriaHistorySummary | null, b: CategoriaHistorySummary | null) {
  if (!a || !b) return "Sin datos suficientes";
  const aScore = getSummaryScore(a);
  const bScore = getSummaryScore(b);
  if (Math.abs(aScore - bScore) < 0.1) return "Empate técnico";
  return aScore > bScore ? `Mejor evolución: ID ${a.sellerId}` : `Mejor evolución: ID ${b.sellerId}`;
}



type HistoricalScore = {
  score: number;
  label: string;
  tone: "emerald" | "blue" | "amber" | "red";
  description: string;
  monthlyAverage: number | null;
  monthlyComponent: number;
  trendPoints: number;
  stabilityPoints: number;
  points: Array<{
    label: string;
    value: string;
    weight: string;
    detail?: string;
  }>;
  monthlyRules: Array<{
    label: string;
    value: string;
    earnedAvg: number;
    max: number;
    ratio: number;
  }>;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function avg(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number =>
    typeof value === "number" && Number.isFinite(value),
  );
  if (!valid.length) return null;
  return valid.reduce((acc, value) => acc + value, 0) / valid.length;
}

function pctOfBooleans(values: Array<boolean | null | undefined>) {
  const valid = values.filter((value): value is boolean => typeof value === "boolean");
  if (!valid.length) return null;
  return valid.filter(Boolean).length / valid.length;
}

function trendScore(first: number | null | undefined, last: number | null | undefined) {
  if (typeof first !== "number" || typeof last !== "number" || !Number.isFinite(first) || !Number.isFinite(last)) {
    return 0.5;
  }
  if (first <= 0 && last <= 0) return 0.5;
  if (first <= 0 && last > 0) return 1;

  const delta = (last - first) / Math.abs(first);
  // -30% o peor = 0 puntos, +30% o mejor = máximo.
  return clamp((delta + 0.3) / 0.6);
}

function calculateMonthlyCategoryScore(point: CategoriaHistoryPoint) {
  // Puntaje mensual basado en las reglas oficiales de utils/categories.ts.
  // Si el vendedor cae en Plan de Mejora, lo medimos contra el piso JUNIOR
  // para mostrar avance parcial sin inventar otra tabla de criterios.
  const targetKey: CategoriaKey = point.categoria === "PLAN_MEJORA" ? "JUNIOR" : point.categoria;
  const target = CATEGORIAS.find((item) => item.key === targetKey) ?? CATEGORIAS[CATEGORIAS.length - 1];

  if (!target) return { score: 0, targetLabel: "Sin regla", breakdown: [] as Array<{ label: string; earned: number; max: number }> };

  const breakdown = [
    {
      label: "Facturación / proyección",
      earned: point.proyeccionRank >= CATEGORIA_RANK[target.facturacion] ? PUNTOS.FACTURACION : 0,
      max: PUNTOS.FACTURACION,
    },
    {
      label: "Eficiencia",
      earned: (point.eficiencia ?? 0) >= target.eficiencia ? PUNTOS.EFICIENCIA : 0,
      max: PUNTOS.EFICIENCIA,
    },
    {
      label: "Cobertura",
      earned: (point.cobertura ?? 0) >= target.cobertura ? PUNTOS.COBERTURA : 0,
      max: PUNTOS.COBERTURA,
    },
    {
      label: "Volumen",
      earned: (point.volumen ?? 0) >= target.volumen ? PUNTOS.VOLUMEN : 0,
      max: PUNTOS.VOLUMEN,
    },
    {
      label: "% POP",
      earned: (point.pop ?? 0) >= target.pop ? PUNTOS.POP : 0,
      max: PUNTOS.POP,
    },
    {
      label: "% Exhibición",
      earned: (point.exhibicion ?? 0) >= target.exhibicion ? PUNTOS.EXHIBICION : 0,
      max: PUNTOS.EXHIBICION,
    },
    {
      label: "Mix",
      earned: (point.mix ?? 0) >= target.mix ? PUNTOS.MIX : 0,
      max: PUNTOS.MIX,
    },
  ];

  return {
    score: breakdown.reduce((acc, item) => acc + item.earned, 0),
    targetLabel: CATEGORY_LABEL[target.key],
    breakdown,
  };
}

function getTrendPoints(categoryDelta: number | null | undefined) {
  const delta = categoryDelta ?? 0;
  if (delta >= 2) return 10;
  if (delta === 1) return 8;
  if (delta === 0) return 6;
  if (delta === -1) return 3;
  return 0;
}

function getStabilityInfo(history: CategoriaHistoryPoint[]) {
  const categoriaNoMejoraPct = history.length
    ? history.filter((item) => item.categoria !== "PLAN_MEJORA").length / history.length
    : null;
  const horarioPct = pctOfBooleans(history.map((item) => item.cumpleHorario));
  const efectividadPct = pctOfBooleans(history.map((item) => item.cumpleEfectividad));

  const validParts = [categoriaNoMejoraPct, horarioPct, efectividadPct].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );

  const ratio = validParts.length
    ? validParts.reduce((acc, value) => acc + value, 0) / validParts.length
    : 0;

  return {
    ratio,
    points: ratio * 10,
    categoriaNoMejoraPct,
    horarioPct,
    efectividadPct,
  };
}

function calculateHistoricalScore(
  summary: CategoriaHistorySummary | null,
  history: CategoriaHistoryPoint[],
): HistoricalScore | null {
  if (!summary || !history.length) return null;

  const monthlyScores = history.map(calculateMonthlyCategoryScore);
  const monthlyAverage = avg(monthlyScores.map((item) => item.score));
  const monthlyComponent = (monthlyAverage ?? 0) * 0.8;

  const trendPoints = getTrendPoints(summary.categoryDelta);
  const stability = getStabilityInfo(history);
  const stabilityPoints = stability.points;

  const score = Math.round(clamp(monthlyComponent + trendPoints + stabilityPoints, 0, 100));

  const label =
    score >= 80
      ? "Muy sólido"
      : score >= 65
        ? "Buen desempeño"
        : score >= 50
          ? "Riesgo medio"
          : "Riesgo alto";

  const tone =
    score >= 80 ? "emerald" : score >= 65 ? "blue" : score >= 50 ? "amber" : "red";

  const description =
    score >= 80
      ? "Historial fuerte: buen promedio mensual, tendencia sana y buena estabilidad."
      : score >= 65
        ? "Desempeño general sano, aunque conviene revisar meses con caída o puntos no cumplidos."
        : score >= 50
          ? "Evolución irregular: el promedio mensual o la estabilidad necesitan seguimiento."
          : "Alerta: el histórico muestra bajo puntaje mensual, caída o poca estabilidad.";

  const officialMonthlyRules = [
    { label: "Facturación / proyección", max: PUNTOS.FACTURACION },
    { label: "Eficiencia", max: PUNTOS.EFICIENCIA },
    { label: "Cobertura", max: PUNTOS.COBERTURA },
    { label: "Volumen", max: PUNTOS.VOLUMEN },
    { label: "% POP", max: PUNTOS.POP },
    { label: "% Exhibición", max: PUNTOS.EXHIBICION },
    { label: "Mix", max: PUNTOS.MIX },
  ];

  const monthlyRules = officialMonthlyRules.map((rule) => {
    const earnedAvg =
      avg(
        monthlyScores.map((monthlyScore) =>
          monthlyScore.breakdown.find((item) => item.label === rule.label)?.earned ?? 0,
        ),
      ) ?? 0;

    return {
      label: rule.label,
      value: `${rule.max} pts`,
      earnedAvg,
      max: rule.max,
      ratio: rule.max > 0 ? earnedAvg / rule.max : 0,
    };
  });

  return {
    score,
    label,
    tone,
    description,
    monthlyAverage,
    monthlyComponent,
    trendPoints,
    stabilityPoints,
    points: [
      {
        label: "Promedio mensual reglas de categoría",
        value: `${formatNumber(monthlyAverage, 1)}/100`,
        weight: "80%",
        detail: "Promedio de los puntos mensuales calculados con CATEGORIAS + PUNTOS.",
      },
      {
        label: "Tendencia de categoría",
        value: `${deltaLabel(summary.categoryDelta)} · ${formatNumber(trendPoints, 1)}/10`,
        weight: "10%",
        detail: "Premia subidas de categoría, deja puntaje medio si se mantiene y penaliza caídas.",
      },
      {
        label: "Estabilidad / consistencia",
        value: `${formatPercent(stability.ratio * 100, 0)} · ${formatNumber(stabilityPoints, 1)}/10`,
        weight: "10%",
        detail: "Combina meses fuera de Plan de Mejora, cumplimiento horario y cumplimiento de efectividad.",
      },
    ],
    monthlyRules,
  };
}

type RiskAssessment = {
  level: "low" | "medium" | "high";
  state: "En crecimiento" | "Estable" | "En seguimiento" | "En caída";
  label: string;
  score: number;
  description: string;
  reasons: string[];
  recommendation: string;
};

function getNumberTrend(first: number | null | undefined, last: number | null | undefined) {
  if (
    typeof first !== "number" ||
    typeof last !== "number" ||
    !Number.isFinite(first) ||
    !Number.isFinite(last) ||
    first === 0
  ) {
    return null;
  }

  return (last - first) / Math.abs(first);
}

function lastValid<T>(values: T[]) {
  return values.length ? values[values.length - 1] : null;
}

function calculateRiskAssessment(
  summary: CategoriaHistorySummary | null,
  history: CategoriaHistoryPoint[],
  historicalScore?: HistoricalScore | null,
): RiskAssessment | null {
  if (!summary || !history.length) return null;

  const sorted = [...history].sort((a, b) => a.period.localeCompare(b.period));
  const first = sorted[0];
  const last = lastValid(sorted);
  if (!first || !last) return null;

  const reasons: string[] = [];
  let riskScore = 20;

  const categoryDelta = summary.categoryDelta ?? 0;
  const billingTrend = getNumberTrend(first.facturacion, last.facturacion);
  const recent = sorted.slice(-3);
  const planMejoraMonths = recent.filter((item) => item.categoria === "PLAN_MEJORA").length;
  const badHorarioMonths = recent.filter((item) => item.cumpleHorario === false).length;
  const badEfectividadMonths = recent.filter((item) => item.cumpleEfectividad === false).length;

  if (summary.currentCategoria === "PLAN_MEJORA") {
    riskScore += 24;
    reasons.push("Actualmente está en Plan de Mejora.");
  } else if (summary.currentCategoria === "JUNIOR") {
    riskScore += 8;
    reasons.push("La categoría actual todavía es inicial.");
  } else if (summary.currentCategoria === "SENIOR") {
    riskScore -= 12;
    reasons.push("La categoría actual es Senior.");
  }

  if (categoryDelta <= -2) {
    riskScore += 20;
    reasons.push(`Bajó ${Math.abs(categoryDelta)} niveles de categoría en el rango.`);
  } else if (categoryDelta === -1) {
    riskScore += 12;
    reasons.push("Bajó 1 nivel de categoría en el rango.");
  } else if (categoryDelta >= 1) {
    riskScore -= 12;
    reasons.push(`Subió ${categoryDelta} nivel${categoryDelta === 1 ? "" : "es"} de categoría.`);
  }

  if ((summary.avgEfectividad ?? 0) < 88) {
    riskScore += 16;
    reasons.push(`Efectividad promedio baja: ${formatPercent(summary.avgEfectividad)}.`);
  } else if ((summary.avgEfectividad ?? 0) < 94) {
    riskScore += 8;
    reasons.push(`Efectividad promedio en zona de seguimiento: ${formatPercent(summary.avgEfectividad)}.`);
  } else {
    riskScore -= 6;
    reasons.push(`Buena efectividad promedio: ${formatPercent(summary.avgEfectividad)}.`);
  }

  if ((summary.avgEficiencia ?? 0) < 55) {
    riskScore += 14;
    reasons.push(`Eficiencia promedio baja: ${formatPercent(summary.avgEficiencia)}.`);
  } else if ((summary.avgEficiencia ?? 0) < 65) {
    riskScore += 7;
    reasons.push(`Eficiencia promedio mejorable: ${formatPercent(summary.avgEficiencia)}.`);
  } else {
    riskScore -= 5;
    reasons.push(`Eficiencia promedio saludable: ${formatPercent(summary.avgEficiencia)}.`);
  }

  if (planMejoraMonths >= 2) {
    riskScore += 12;
    reasons.push(`${planMejoraMonths} de los últimos ${recent.length} meses estuvieron en Plan de Mejora.`);
  }

  if (badHorarioMonths >= 2) {
    riskScore += 9;
    reasons.push(`${badHorarioMonths} de los últimos ${recent.length} meses no cumplieron horario de ruta.`);
  } else if (last.cumpleHorario === false) {
    riskScore += 5;
    reasons.push("El último mes no cumplió horario de ruta.");
  }

  if (badEfectividadMonths >= 2) {
    riskScore += 9;
    reasons.push(`${badEfectividadMonths} de los últimos ${recent.length} meses no cumplieron efectividad.`);
  } else if (last.cumpleEfectividad === false) {
    riskScore += 5;
    reasons.push("El último mes no cumplió efectividad.");
  }

  if (billingTrend !== null && billingTrend <= -0.2) {
    riskScore += 12;
    reasons.push(`La facturación cayó ${(Math.abs(billingTrend) * 100).toFixed(0)}% entre el primer y último mes.`);
  } else if (billingTrend !== null && billingTrend <= -0.1) {
    riskScore += 6;
    reasons.push(`La facturación muestra caída de ${(Math.abs(billingTrend) * 100).toFixed(0)}%.`);
  } else if (billingTrend !== null && billingTrend >= 0.15) {
    riskScore -= 8;
    reasons.push(`La facturación creció ${(billingTrend * 100).toFixed(0)}% en el rango.`);
  }

  if (historicalScore) {
    if (historicalScore.score < 50) {
      riskScore += 10;
      reasons.push(`Score histórico bajo: ${historicalScore.score}/100.`);
    } else if (historicalScore.score >= 75) {
      riskScore -= 8;
      reasons.push(`Score histórico sólido: ${historicalScore.score}/100.`);
    }
  }

  riskScore = Math.round(clamp(riskScore / 100, 0, 1) * 100);

  const level: RiskAssessment["level"] =
    riskScore >= 62 ? "high" : riskScore >= 36 ? "medium" : "low";

  const state: RiskAssessment["state"] =
    level === "high"
      ? "En caída"
      : level === "medium"
        ? "En seguimiento"
        : categoryDelta > 0 || (billingTrend !== null && billingTrend > 0.1)
          ? "En crecimiento"
          : "Estable";

  const label =
    level === "high" ? "Riesgo alto" : level === "medium" ? "Riesgo medio" : "Riesgo bajo";

  const description =
    level === "high"
      ? "Señales históricas débiles o deterioro reciente. Conviene revisar el caso con prioridad."
      : level === "medium"
        ? "Hay indicadores mixtos. Requiere seguimiento y comparación contra contexto de sucursal."
        : "No se observan alertas fuertes en el rango seleccionado.";

  const recommendation =
    level === "high"
      ? "Revisar causa raíz: efectividad, cobertura, horario y evolución de categoría antes de decidir."
      : level === "medium"
        ? "Monitorear próximos cierres y contrastar contra promedio de sucursal o versus directo."
        : "Mantener seguimiento normal y usarlo como referencia para buenas prácticas.";

  return {
    level,
    state,
    label,
    score: riskScore,
    description,
    reasons: reasons.slice(0, 5),
    recommendation,
  };
}

function StatusPill({ categoria }: { categoria: CategoriaKey | null }) {
  if (!categoria)
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
        Sin datos
      </span>
    );

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold text-white shadow-sm"
      style={{ backgroundColor: CATEGORY_COLORS[categoria] }}
    >
      {CATEGORY_LABEL[categoria]}
    </span>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cls(
        "rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
  icon,
  tone = "slate",
  className = "",
}: {
  title: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  tone?: "slate" | "green" | "red" | "amber" | "blue";
  className?: string;
}) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-700",
    green: "border-slate-200 bg-white text-emerald-700",
    red: "border-red-200 bg-red-50/70 text-red-700 shadow-[0_16px_42px_rgba(239,68,68,0.10)]",
    amber: "border-slate-200 bg-white text-amber-700",
    blue: "border-slate-200 bg-white text-blue-700",
  } as const;

  return (
    <div
      className={cls(
        "group h-full min-h-[136px] rounded-[1.65rem] border p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_55px_rgba(15,23,42,0.10)]",
        tones[tone],
        className,
      )}
    >
      <div className="flex h-full items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="break-words text-xs font-black uppercase leading-5 tracking-[0.22em] text-slate-500">
            {title}
          </div>
          <div className="mt-3 break-words text-[clamp(1.85rem,3vw,2.45rem)] font-black leading-[0.98] tracking-tight text-slate-950">
            {value}
          </div>
          {hint ? (
            <div className="mt-3 max-w-full break-words text-sm font-semibold leading-5 text-slate-500">
              {hint}
            </div>
          ) : null}
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/95 shadow-sm ring-1 ring-slate-900/5 transition group-hover:scale-105">
          {icon}
        </div>
      </div>
    </div>
  );
}


function ScoreFormulaTooltip({
  score,
  coords,
}: {
  score: HistoricalScore;
  coords: { top: number; left: number; width: number };
}) {
  const monthlyAverage = typeof score.monthlyAverage === "number" ? formatNumber(score.monthlyAverage, 1) : "—";
  const monthlyComponent = formatNumber(score.monthlyComponent, 1);
  const trendPoints = formatNumber(score.trendPoints, 1);
  const stabilityPoints = formatNumber(score.stabilityPoints, 1);

  return createPortal(
    <div
      className="fixed z-[99999] max-h-[min(680px,calc(100vh-2rem))] w-[min(440px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_24px_80px_rgba(15,23,42,0.24)] ring-1 ring-slate-900/5"
      style={{ top: coords.top, left: coords.left, width: Math.min(coords.width, 440) }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-950 text-white">
          <Info className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-black text-slate-950">¿Cómo se calcula el score histórico?</div>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            El score se calcula sobre <span className="font-black text-slate-900">100 puntos</span> y usa como base las reglas oficiales de categorías definidas en
            <span className="font-black text-slate-900"> utils/categories.ts</span>.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black text-slate-950">1. Puntaje mensual promedio</div>
            <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
              Promedio de los meses analizados usando CATEGORIAS + PUNTOS.
            </div>
          </div>
          <div className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black text-white">
            80%
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {score.monthlyRules.map((rule) => {
            const earned = rule.earnedAvg > 0;
            const full = rule.ratio >= 0.95;

            return (
              <div
                key={rule.label}
                className={cls(
                  "rounded-xl px-2.5 py-2 ring-1 transition",
                  earned
                    ? "bg-emerald-50/80 ring-emerald-200"
                    : "bg-white ring-slate-200/80",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={cls("text-[10px] font-bold leading-4", earned ? "text-emerald-800" : "text-slate-500")}>
                    {rule.label}
                  </div>
                  {earned ? (
                    <span className={cls(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black",
                      full ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700",
                    )}>
                      suma
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs font-black text-slate-950">{rule.value}</div>
                <div className={cls("mt-0.5 text-[10px] font-bold", earned ? "text-emerald-700" : "text-slate-400")}>
                  Prom. ganado: {formatNumber(rule.earnedAvg, 1)}/{rule.max}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200/80">
          Resultado mensual promedio: <span className="font-black text-slate-950">{monthlyAverage}/100</span>
          <div className="mt-1 text-[10px] leading-4 text-slate-500">
            Este promedio no se suma completo al resultado final: pesa el 80%, por eso aporta
            <span className="font-black text-slate-900"> {monthlyComponent}/80</span>.
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className={cls(
          "rounded-2xl border p-3",
          score.trendPoints > 0 ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white",
        )}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-black text-slate-950">2. Tendencia de categoría</div>
            <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-700">10%</div>
          </div>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-500">
            Premia si el vendedor sube de categoría, asigna puntaje medio si se mantiene y penaliza si baja.
          </p>
          <div className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200/70">
            Aporte actual: <span className="font-black text-slate-950">{trendPoints}/10</span>
          </div>
        </div>

        <div className={cls(
          "rounded-2xl border p-3",
          score.stabilityPoints > 0 ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white",
        )}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-black text-slate-950">3. Estabilidad / consistencia</div>
            <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-700">10%</div>
          </div>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-500">
            Evalúa constancia: meses fuera de Plan de Mejora, cumplimiento horario y cumplimiento de efectividad.
          </p>
          <div className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200/70">
            Aporte actual: <span className="font-black text-slate-950">{stabilityPoints}/10</span>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-slate-950 p-3 text-white">
        <div className="text-xs font-black">Fórmula final aplicada</div>
        <div className="mt-1 text-[11px] font-semibold leading-5 text-white/80">
          <span className="font-black text-white">{monthlyAverage} × 80% = {monthlyComponent}</span> +
          <span className="font-black text-white"> {trendPoints}</span> de tendencia +
          <span className="font-black text-white"> {stabilityPoints}</span> de estabilidad =
          <span className="font-black text-white"> {score.score}/100</span>.
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-950">
        Resultado final: {score.score}/100 · {score.label}
      </div>
    </div>,
    document.body,
  );
}

function ScoreValue({
  score,
  size = "lg",
  align = "left",
}: {
  score: HistoricalScore;
  size?: "sm" | "md" | "lg";
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  const sizeClass =
    size === "sm"
      ? "text-sm"
      : size === "md"
        ? "text-2xl"
        : "text-[clamp(3.4rem,6vw,5.4rem)]";

  const updatePosition = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = Math.min(390, window.innerWidth - 32);
    const wantedLeft = align === "right" ? rect.right - width : rect.left;
    const left = Math.max(16, Math.min(wantedLeft, window.innerWidth - width - 16));
    const estimatedHeight = Math.min(560, window.innerHeight - 32);
    let top = rect.bottom + 12;
    if (top + estimatedHeight > window.innerHeight) {
      top = Math.max(16, rect.top - estimatedHeight - 12);
    }
    setCoords({ top, left, width });
  };

  const show = () => {
    updatePosition();
    setOpen(true);
  };

  const hide = () => setOpen(false);

  return (
    <div
      ref={ref}
      className="relative inline-flex cursor-help items-end gap-1 focus-within:outline-none"
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span className={cls("font-black leading-[0.85] tracking-[-0.08em] text-slate-950", sizeClass)}>
        {score.score}
      </span>
      {size === "lg" ? <span className="pb-2 text-2xl font-black text-slate-400">/100</span> : <span className="font-black text-slate-400">/100</span>}
      {open && coords ? <ScoreFormulaTooltip score={score} coords={coords} /> : null}
    </div>
  );
}

function HistoricalScoreCard({
  score,
  className = "",
}: {
  score: HistoricalScore;
  className?: string;
}) {
  const toneClasses = {
    emerald: "border-emerald-200 bg-gradient-to-br from-white via-white to-emerald-50/70 text-emerald-700",
    blue: "border-blue-200 bg-gradient-to-br from-white via-white to-blue-50/70 text-blue-700",
    amber: "border-amber-200 bg-gradient-to-br from-white via-white to-amber-50/70 text-amber-700",
    red: "border-red-200 bg-gradient-to-br from-white via-white to-red-50/70 text-red-700",
  } as const;

  const barColor = {
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  } as const;

  return (
    <div
      className={cls(
        "group relative h-full min-h-[330px] overflow-visible rounded-[2rem] border p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_30px_70px_rgba(15,23,42,0.12)]",
        toneClasses[score.tone],
        className,
      )}
    >
      <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/70 blur-3xl" />
      <div className="relative flex h-full flex-col justify-between gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase leading-5 tracking-[0.24em] text-slate-500">
              Score histórico
            </div>
            <div className="mt-3 inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
              {score.label}
            </div>
          </div>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition group-hover:scale-105">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div>
          <ScoreValue score={score} size="lg" />
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/90 ring-1 ring-slate-200">
            <div className={cls("h-full rounded-full", barColor[score.tone])} style={{ width: `${score.score}%` }} />
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
            {score.description}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {score.points.slice(0, 4).map((point) => (
            <div key={point.label} className="rounded-2xl bg-white/80 p-3 ring-1 ring-slate-200/80">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                {point.label}
              </div>
              <div className="mt-1 break-words text-sm font-black text-slate-900">
                {point.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function RiskTrafficLightCard({
  assessment,
  className = "",
  compact = false,
}: {
  assessment: RiskAssessment;
  className?: string;
  compact?: boolean;
}) {
  const styles = {
    low: {
      border: "border-emerald-200",
      soft: "bg-emerald-50",
      text: "text-emerald-700",
      dot: "bg-emerald-500",
      ring: "ring-emerald-100",
    },
    medium: {
      border: "border-amber-200",
      soft: "bg-amber-50",
      text: "text-amber-700",
      dot: "bg-amber-500",
      ring: "ring-amber-100",
    },
    high: {
      border: "border-red-200",
      soft: "bg-red-50",
      text: "text-red-700",
      dot: "bg-red-500",
      ring: "ring-red-100",
    },
  } as const;

  const tone = styles[assessment.level];
  const icon =
    assessment.level === "high" ? (
      <TrendingDown className="h-5 w-5" />
    ) : assessment.level === "medium" ? (
      <AlertCircle className="h-5 w-5" />
    ) : (
      <CheckCircle2 className="h-5 w-5" />
    );

  return (
    <div
      className={cls(
        "group relative h-full overflow-hidden rounded-[2rem] border bg-white p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_30px_70px_rgba(15,23,42,0.12)]",
        tone.border,
        className,
      )}
    >
      <div className={cls("absolute -right-20 -top-20 h-52 w-52 rounded-full blur-3xl", tone.soft)} />
      <div className="relative flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase leading-5 tracking-[0.24em] text-slate-500">
              Semáforo de riesgo
            </div>
            <div className={cls("mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ring-1", tone.soft, tone.text, tone.ring)}>
              <span className={cls("h-2.5 w-2.5 rounded-full", tone.dot)} />
              {assessment.label}
            </div>
          </div>

          <div className={cls("grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white shadow-sm ring-1 transition group-hover:scale-105", tone.text, tone.ring)}>
            {icon}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
          <div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full bg-slate-50 ring-1 ring-slate-200">
            <div className="absolute inset-2 rounded-full border-[10px] border-slate-200" />
            <div
              className={cls("absolute inset-2 rounded-full border-[10px] border-transparent", tone.text)}
              style={{
                borderTopColor: "currentColor",
                borderRightColor: assessment.score >= 35 ? "currentColor" : "transparent",
                borderBottomColor: assessment.score >= 65 ? "currentColor" : "transparent",
                transform: "rotate(45deg)",
              }}
            />
            <div className="relative text-center">
              <div className="text-3xl font-black leading-none text-slate-950">{assessment.score}</div>
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">riesgo</div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="break-words text-[clamp(2rem,3vw,3rem)] font-black leading-[0.95] tracking-[-0.06em] text-slate-950">
              {assessment.state}
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              {assessment.description}
            </p>
          </div>
        </div>

        {!compact ? (
          <div className="grid gap-3 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/80">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                Señales detectadas
              </div>
              <ul className="mt-3 space-y-2 text-sm font-semibold leading-5 text-slate-600">
                {assessment.reasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <span className={cls("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)} />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={cls("rounded-2xl p-4 ring-1", tone.soft, tone.ring)}>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Recomendación
              </div>
              <div className="mt-3 text-sm font-black leading-6 text-slate-800">
                {assessment.recommendation}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RiskComparePanel({
  riskA,
  riskB,
  aLabel,
  bLabel,
}: {
  riskA: RiskAssessment | null;
  riskB: RiskAssessment | null;
  aLabel: string;
  bLabel: string;
}) {
  if (!riskA || !riskB) return null;

  const better = riskA.score === riskB.score ? "Empate técnico" : riskA.score < riskB.score ? aLabel : bLabel;

  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="text-sm font-black text-slate-950">Semáforo de riesgo comparado</div>
        <div className="mt-0.5 text-xs text-slate-500">
          Menor riesgo relativo: <span className="font-black text-slate-700">{better}</span>
        </div>
      </div>
      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <RiskTrafficLightCard assessment={riskA} compact className="min-h-[290px]" />
        <RiskTrafficLightCard assessment={riskB} compact className="min-h-[290px]" />
      </div>
    </Panel>
  );
}

function CategoryBentoCard({ summary }: { summary: CategoriaHistorySummary }) {
  const current = summary.currentCategoria;
  const initial = summary.initialCategoria;
  const best = summary.bestCategoria;
  const currentColor = current ? CATEGORY_COLORS[current] : "#64748b";
  const initialRank = initial ? categoryShortName(initial) : "—";
  const currentRank = current ? categoryShortName(current) : "—";
  const bestLabel = best ? CATEGORY_LABEL[best] : "—";

  return (
    <div className="relative h-full min-h-[330px] overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-slate-100 blur-3xl" />
      <div className="absolute -bottom-20 left-8 h-48 w-48 rounded-full bg-slate-50 blur-3xl" />

      <div className="relative flex h-full flex-col justify-between gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="break-words text-xs font-black uppercase leading-5 tracking-[0.24em] text-slate-500">
              Categoría actual
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StatusPill categoria={current} />
              <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200">
                {summary.months} meses
              </span>
            </div>
          </div>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
            <ChevronsUp className="h-5 w-5" />
          </div>
        </div>

        <div className="min-w-0">
          <div className="max-w-full break-words text-[clamp(2.6rem,5vw,4.8rem)] font-black leading-[0.9] tracking-[-0.08em] text-slate-950">
            {summary.currentCategoriaLabel ?? "Sin datos"}
          </div>
          <div className="mt-4 max-w-xl break-words text-sm font-semibold leading-6 text-slate-500">
            Evolución desde{" "}
            <span className="font-black text-slate-700">
              {summary.initialCategoriaLabel ?? "—"}
            </span>{" "}
            hasta{" "}
            <span className="font-black text-slate-700">
              {summary.currentCategoriaLabel ?? "—"}
            </span>{" "}
            en el rango seleccionado.
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/80">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              Inicial
            </div>
            <div className="mt-2 break-words text-lg font-black text-slate-950">
              {initialRank}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/80">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              Actual
            </div>
            <div className="mt-2 break-words text-lg font-black" style={{ color: currentColor }}>
              {currentRank}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/80">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              Mejor
            </div>
            <div className="mt-2 break-words text-lg font-black text-slate-950">
              {bestLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-500 shadow-sm">
        <Search className="h-5 w-5" />
      </div>
      <div className="mt-4 text-base font-extrabold text-slate-900">
        {title}
      </div>
      <div className="mx-auto mt-1 max-w-2xl text-sm text-slate-500">
        {description}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Panel className={cls("overflow-hidden", className)}>
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="text-sm font-black text-slate-950">{title}</div>
        {subtitle ? (
          <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>
        ) : null}
      </div>
      <div className="h-[310px] p-4">{children}</div>
    </Panel>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur">
      <div className="mb-2 font-black text-slate-900">{label}</div>
      <div className="space-y-1">
        {payload.map((item: any) => (
          <div
            key={item.dataKey}
            className="flex items-center justify-between gap-6"
          >
            <span className="flex items-center gap-2 text-slate-500">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
            </span>
            <span className="font-bold text-slate-900">
              {String(item.dataKey).toLowerCase().includes("facturacion")
                ? formatMoney(item.value)
                : String(item.dataKey).toLowerCase().includes("categoria") ||
                    String(item.dataKey).toLowerCase().includes("proyeccion")
                  ? (CATEGORY_TICKS[item.value as number] ?? item.value)
                  : String(item.dataKey).toLowerCase().includes("horas")
                    ? `${Number(item.value ?? 0).toFixed(1)} h`
                    : typeof item.value === "number"
                      ? item.value.toLocaleString("es-AR", {
                          maximumFractionDigits: 1,
                        })
                      : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SellerCombobox({
  sellers,
  value,
  onChange,
  label = "Vendedor",
  placeholder = "Buscar por ID o nombre...",
}: {
  sellers: CategoriaHistorySeller[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sellers;
    return sellers.filter((seller) =>
      `${seller.id} ${seller.name}`.toLowerCase().includes(q),
    );
  }, [search, sellers]);

  return (
    <div className="space-y-2">
      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </label>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={placeholder}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
          />
        </div>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
        >
          <option value="">Seleccionar vendedor</option>
          {filtered.map((seller) => (
            <option key={seller.id} value={seller.id}>
              ID {seller.id} · {seller.name} · {seller.months} meses
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function PeriodSelect({
  label,
  value,
  periods,
  onChange,
}: {
  label: string;
  value: string;
  periods: ApiResponse["periods"];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
      >
        {periods.map((period) => (
          <option key={`${label}-${period.value}`} value={period.value}>
            {period.value}
          </option>
        ))}
      </select>
    </div>
  );
}

function HistoryTable({
  history,
  title = "Detalle mensual",
}: {
  history: CategoriaHistoryPoint[];
  title?: string;
}) {
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="text-sm font-black text-slate-950">{title}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          Lectura tabular del histórico filtrado.
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1050px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-black">Mes</th>
              <th className="px-4 py-3 font-black">Categoría</th>
              <th className="px-4 py-3 font-black">Proyección</th>
              <th className="px-4 py-3 font-black">Eficiencia</th>
              <th className="px-4 py-3 font-black">Efectividad</th>
              <th className="px-4 py-3 font-black">Facturación</th>
              <th className="px-4 py-3 font-black">Ventas</th>
              <th className="px-4 py-3 font-black">Volumen</th>
              <th className="px-4 py-3 font-black">Cobertura</th>
              <th className="px-4 py-3 font-black">Ruta</th>
              <th className="px-4 py-3 font-black">Supervisor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.map((item) => (
              <tr key={`${item.sellerId}-${item.period}`} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 font-black text-slate-900">
                  {item.periodLabel}
                </td>
                <td className="px-4 py-3">
                  <StatusPill categoria={item.categoria} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill categoria={item.proyeccion} />
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">
                  {formatPercent(item.eficiencia)}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">
                  {formatPercent(item.efectividad)}
                </td>
                <td className="px-4 py-3 font-black text-slate-900">
                  {formatMoney(item.facturacion)}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">
                  {formatNumber(item.totalVentas)}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">
                  {formatNumber(item.volumen)}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">
                  {formatNumber(item.cobertura)}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">
                  {secondsToHoursLabel(item.horasRutaSeconds)}
                </td>
                <td className="px-4 py-3 text-slate-500">{item.supervisor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function buildChartData(history: CategoriaHistoryPoint[]) {
  return history.map((item) => ({
    ...item,
    horasRutaHours:
      item.horasRutaSeconds === null ? null : item.horasRutaSeconds / 3600,
    categoriaColor: CATEGORY_COLORS[item.categoria],
  }));
}

function mergeCompareChartData(
  historyA: CategoriaHistoryPoint[],
  historyB: CategoriaHistoryPoint[],
) {
  const map = new Map<string, any>();

  for (const item of historyA) {
    const current = map.get(item.period) ?? {
      period: item.period,
      periodLabel: item.periodLabel,
    };
    current.eficienciaA = item.eficiencia;
    current.efectividadA = item.efectividad;
    current.facturacionA = item.facturacion;
    current.categoriaRankA = item.categoriaRank;
    current.totalVentasA = item.totalVentas;
    current.horasRutaA = item.horasRutaSeconds === null ? null : item.horasRutaSeconds / 3600;
    map.set(item.period, current);
  }

  for (const item of historyB) {
    const current = map.get(item.period) ?? {
      period: item.period,
      periodLabel: item.periodLabel,
    };
    current.eficienciaB = item.eficiencia;
    current.efectividadB = item.efectividad;
    current.facturacionB = item.facturacion;
    current.categoriaRankB = item.categoriaRank;
    current.totalVentasB = item.totalVentas;
    current.horasRutaB = item.horasRutaSeconds === null ? null : item.horasRutaSeconds / 3600;
    map.set(item.period, current);
  }

  return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
}


function mergeMultiCompareChartData(entries: CompareSellerResult[]) {
  const map = new Map<string, any>();

  entries.forEach((entry, index) => {
    for (const item of entry.history) {
      const current = map.get(item.period) ?? {
        period: item.period,
        periodLabel: item.periodLabel,
      };
      current[`eficiencia${index}`] = item.eficiencia;
      current[`efectividad${index}`] = item.efectividad;
      current[`facturacion${index}`] = item.facturacion;
      current[`categoriaRank${index}`] = item.categoriaRank;
      current[`totalVentas${index}`] = item.totalVentas;
      current[`horasRuta${index}`] = item.horasRutaSeconds === null ? null : item.horasRutaSeconds / 3600;
      map.set(item.period, current);
    }
  });

  return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
}

function compareLabel(entry: CompareSellerResult, index: number) {
  return `ID ${entry.summary.sellerId}`;
}

function getMultiWinnerLabel(entries: CompareSellerResult[]) {
  if (entries.length < 2) return "Sin datos suficientes";

  const ranked = entries
    .map((entry) => ({
      entry,
      score: calculateHistoricalScore(entry.summary, entry.history)?.score ?? getSummaryScore(entry.summary),
    }))
    .sort((a, b) => b.score - a.score);

  if (ranked.length >= 2 && Math.abs(ranked[0].score - ranked[1].score) < 1) {
    return "Empate técnico entre los vendedores principales";
  }

  return `Mejor evolución: ID ${ranked[0].entry.summary.sellerId}`;
}

function SingleDashboard({
  history,
  summary,
  selectedSeller,
}: {
  history: CategoriaHistoryPoint[];
  summary: CategoriaHistorySummary;
  selectedSeller: CategoriaHistorySeller | null;
}) {
  const chartData = useMemo(() => buildChartData(history), [history]);
  const historicalScore = useMemo(() => calculateHistoricalScore(summary, history), [summary, history]);
  const riskAssessment = useMemo(
    () => calculateRiskAssessment(summary, history, historicalScore),
    [summary, history, historicalScore],
  );

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-6">
        <KpiCard
          className="md:col-span-2 xl:col-span-1"
          title="Vendedor"
          value={`ID ${summary.sellerId}`}
          hint={selectedSeller?.name ?? summary.sellerName}
          icon={<UserRound className="h-5 w-5" />}
          tone="slate"
        />

        <div className="md:col-span-2 md:row-span-2 xl:col-span-2 xl:row-span-2">
          <CategoryBentoCard summary={summary} />
        </div>

        {historicalScore ? (
          <div className="md:col-span-2 md:row-span-2 xl:col-span-2 xl:row-span-2">
            <HistoricalScoreCard score={historicalScore} />
          </div>
        ) : null}

        {riskAssessment ? (
          <div className="md:col-span-4 xl:col-span-3">
            <RiskTrafficLightCard assessment={riskAssessment} />
          </div>
        ) : null}

        <KpiCard
          className="md:col-span-2 xl:col-span-1"
          title="Variación"
          value={deltaLabel(summary.categoryDelta)}
          hint={`${summary.months} meses analizados`}
          icon={
            summary.improved === false ? (
              <TrendingDown className="h-5 w-5" />
            ) : (
              <TrendingUp className="h-5 w-5" />
            )
          }
          tone={
            summary.improved === false
              ? "red"
              : summary.improved === true
                ? "green"
                : "blue"
          }
        />

        <KpiCard
          className="md:col-span-2 xl:col-span-2"
          title="Mejor facturación"
          value={compactMoney(summary.bestFacturacion)}
          hint={
            summary.bestFacturacionPeriod
              ? `Mes ${summary.bestFacturacionPeriod}`
              : "Sin datos"
          }
          icon={<BarChart3 className="h-5 w-5" />}
          tone="slate"
        />

        <KpiCard
          className="md:col-span-2 xl:col-span-1"
          title="Promedio eficiencia"
          value={formatPercent(summary.avgEficiencia)}
          hint="Promedio del rango"
          icon={<LineChartIcon className="h-5 w-5" />}
          tone="slate"
        />

        <KpiCard
          className="md:col-span-2 xl:col-span-1"
          title="Promedio efectividad"
          value={formatPercent(summary.avgEfectividad)}
          hint="Promedio del rango"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="slate"
        />

        <KpiCard
          className="md:col-span-4 xl:col-span-2"
          title="Facturación promedio"
          value={compactMoney(summary.avgFacturacion)}
          hint={`${summary.firstPeriod} → ${summary.lastPeriod}`}
          icon={<CalendarRange className="h-5 w-5" />}
          tone="slate"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Eficiencia y efectividad"
          subtitle="Comparativa porcentual mes a mes."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 18, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(value) => `${value}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="eficiencia" name="Eficiencia" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="efectividad" name="Efectividad" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Facturación mensual"
          subtitle="Facturación total y promedio de facturación diaria."
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(value) => compactMoney(Number(value))} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="facturacion" name="Facturación" radius={[10, 10, 0, 0]} fill="#0f172a" />
              <Line type="monotone" dataKey="facturacionPromedio" name="Promedio diario" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Evolución de categoría" subtitle="Ranking: 0 Mejora · 1 Junior · 2 Semi · 3 Senior.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(value) => CATEGORY_TICKS[value] ?? value} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line type="stepAfter" dataKey="categoriaRank" name="Categoría alcanzada" stroke="#047857" strokeWidth={3} dot={{ r: 5 }} />
              <Line type="stepAfter" dataKey="proyeccionRank" name="Proyección" stroke="#7c3aed" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Volumen, cobertura y ventas" subtitle="KPIs operativos para comparar la actividad mensual.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(value) => compactNumber(Number(value))} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="totalVentas" name="Ventas" fill="#0f172a" radius={[8, 8, 0, 0]} />
              <Bar dataKey="volumen" name="Volumen" fill="#2563eb" radius={[8, 8, 0, 0]} />
              <Bar dataKey="cobertura" name="Cobertura" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <ChartCard title="Ruta promedio" subtitle="Horas promedio en ruta por mes.">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rutaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(value) => `${Number(value).toFixed(1)}h`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="horasRutaHours" name="Horas ruta" stroke="#2563eb" strokeWidth={3} fill="url(#rutaGradient)" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <LastMonthPanel history={history} />
      </div>

      <HistoryTable history={history} />
    </>
  );
}

function LastMonthPanel({ history }: { history: CategoriaHistoryPoint[] }) {
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="text-sm font-black text-slate-950">Semáforo del último mes</div>
        <div className="mt-0.5 text-xs text-slate-500">Lectura rápida del estado más reciente.</div>
      </div>
      <div className="space-y-3 p-5">
        {history.slice(-1).map((last) => (
          <React.Fragment key={last.period}>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Último período</div>
              <div className="mt-1 text-xl font-black text-slate-950">{last.periodLabel}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-slate-600">Cumple horario</span>
                  <span className={cls("rounded-full px-2.5 py-1 text-xs font-black", last.cumpleHorario ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                    {last.cumpleHorario ? "Sí" : "No"}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm font-black text-slate-950">
                  <Clock3 className="h-4 w-4 text-slate-400" /> {secondsToHoursLabel(last.horasRutaSeconds)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-slate-600">Cumple efectividad</span>
                  <span className={cls("rounded-full px-2.5 py-1 text-xs font-black", last.cumpleEfectividad ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                    {last.cumpleEfectividad ? "Sí" : "No"}
                  </span>
                </div>
                <div className="mt-2 text-sm font-black text-slate-950">{formatPercent(last.efectividad)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-bold text-slate-600">Supervisor actual</div>
                <div className="mt-2 text-sm font-black text-slate-950">{last.supervisor}</div>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </Panel>
  );
}

function CompareMetricCard({
  title,
  aLabel,
  bLabel,
  aValue,
  bValue,
  formatter,
}: {
  title: string;
  aLabel: string;
  bLabel: string;
  aValue: number | null;
  bValue: number | null;
  formatter: (value: number | null) => string;
}) {
  const winner = aValue === null || bValue === null ? null : aValue === bValue ? "tie" : aValue > bValue ? "a" : "b";

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_16px_35px_rgba(15,23,42,0.05)]">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className={cls("rounded-2xl border p-4", winner === "a" ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50")}>
          <div className="text-xs font-black text-slate-500">{aLabel}</div>
          <div className="mt-2 break-words text-2xl font-black text-slate-950">{formatter(aValue)}</div>
        </div>
        <div className={cls("rounded-2xl border p-4", winner === "b" ? "border-orange-200 bg-orange-50" : "border-slate-200 bg-slate-50")}>
          <div className="text-xs font-black text-slate-500">{bLabel}</div>
          <div className="mt-2 break-words text-2xl font-black text-slate-950">{formatter(bValue)}</div>
        </div>
      </div>
    </div>
  );
}

function ScoreCompareCard({ entries }: { entries: CompareSellerResult[] }) {
  const scored = entries
    .map((entry, index) => ({
      entry,
      index,
      score: calculateHistoricalScore(entry.summary, entry.history),
    }))
    .sort((a, b) => (b.score?.score ?? 0) - (a.score?.score ?? 0));

  return (
    <Panel className="overflow-visible">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="text-sm font-black text-slate-950">Score histórico comparado</div>
        <div className="mt-0.5 text-xs text-slate-500">
          Pasá el mouse sobre cada puntaje para ver de dónde sale el cálculo.
        </div>
      </div>
      <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
        {scored.map(({ entry, index, score }) => (
          <div key={entry.sellerId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Vendedor {SELLER_LABELS[index] ?? index + 1}
                </div>
                <div className="mt-1 truncate text-base font-black text-slate-950">ID {entry.summary.sellerId}</div>
                <div className="mt-1 truncate text-xs font-semibold text-slate-500">{entry.summary.sellerName}</div>
              </div>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: SELLER_COLORS[index % SELLER_COLORS.length] }} />
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              {score ? <ScoreValue score={score} size="md" align="right" /> : <span className="text-2xl font-black text-slate-400">—</span>}
              <StatusPill categoria={entry.summary.currentCategoria} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function MultiCompareMetricGrid({ entries }: { entries: CompareSellerResult[] }) {
  const metrics = [
    {
      title: "Eficiencia promedio",
      getValue: (entry: CompareSellerResult) => entry.summary.avgEficiencia,
      formatter: (value: number | null) => formatPercent(value),
      higherIsBetter: true,
    },
    {
      title: "Efectividad promedio",
      getValue: (entry: CompareSellerResult) => entry.summary.avgEfectividad,
      formatter: (value: number | null) => formatPercent(value),
      higherIsBetter: true,
    },
    {
      title: "Mejor facturación",
      getValue: (entry: CompareSellerResult) => entry.summary.bestFacturacion,
      formatter: (value: number | null) => compactMoney(value),
      higherIsBetter: true,
    },
    {
      title: "Facturación promedio",
      getValue: (entry: CompareSellerResult) => entry.summary.avgFacturacion,
      formatter: (value: number | null) => compactMoney(value),
      higherIsBetter: true,
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {metrics.map((metric) => {
        const values = entries.map((entry) => metric.getValue(entry));
        const validValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
        const best = validValues.length ? Math.max(...validValues) : null;

        return (
          <div key={metric.title} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_16px_35px_rgba(15,23,42,0.05)]">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{metric.title}</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {entries.map((entry, index) => {
                const value = metric.getValue(entry);
                const isWinner = best !== null && value === best;

                return (
                  <div
                    key={`${metric.title}-${entry.sellerId}`}
                    className={cls(
                      "rounded-2xl border p-4",
                      isWinner ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-950",
                    )}
                  >
                    <div className={cls("text-xs font-black", isWinner ? "text-white/70" : "text-slate-500")}>ID {entry.summary.sellerId}</div>
                    <div className="mt-2 break-words text-2xl font-black">{metric.formatter(value)}</div>
                    <div className={cls("mt-1 truncate text-[11px] font-semibold", isWinner ? "text-white/60" : "text-slate-400")}>{entry.summary.sellerName}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompareDashboard({ entries }: { entries: CompareSellerResult[] }) {
  const compareData = useMemo(() => mergeMultiCompareChartData(entries), [entries]);
  const risks = useMemo(
    () =>
      entries.map((entry) => {
        const score = calculateHistoricalScore(entry.summary, entry.history);
        return calculateRiskAssessment(entry.summary, entry.history, score);
      }),
    [entries],
  );
  const labels = entries.map((entry, index) => compareLabel(entry, index));

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel className="overflow-hidden">
          <div className="relative overflow-hidden p-6">
            <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-slate-100 blur-3xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                <Users className="h-3.5 w-3.5" /> Comparativa directa
              </div>
              <h3 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                {labels.join(" vs ")}
              </h3>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                {getMultiWinnerLabel(entries)}. Esta lectura permite comparar de 2 a {MAX_COMPARE_SELLERS} vendedores con la misma escala de score, riesgo, categoría, eficiencia, efectividad y facturación.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {entries.map((entry, index) => (
                  <div key={entry.sellerId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Vendedor {SELLER_LABELS[index] ?? index + 1}</div>
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: SELLER_COLORS[index % SELLER_COLORS.length] }} />
                    </div>
                    <div className="mt-2 text-lg font-black text-slate-950">ID {entry.summary.sellerId}</div>
                    <div className="mt-1 truncate text-sm font-semibold text-slate-500">{entry.summary.sellerName}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill categoria={entry.summary.currentCategoria} />
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200">{entry.summary.months} meses</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <KpiCard
            title="Vendedores comparados"
            value={entries.length}
            hint="Podés agregar o quitar IDs para ampliar el versus"
            icon={<Users className="h-5 w-5" />}
            tone="slate"
          />
          <KpiCard
            title="Mayor facturación prom."
            value={compactMoney(
              entries.reduce<number | null>((best, entry) => {
                const value = entry.summary.avgFacturacion;
                if (value === null) return best;
                if (best === null || value > best) return value;
                return best;
              }, null),
            )}
            hint="Promedio del rango seleccionado"
            icon={<BarChart3 className="h-5 w-5" />}
            tone="slate"
          />
        </div>
      </div>

      <ScoreCompareCard entries={entries} />
      <MultiCompareMetricGrid entries={entries} />

      <Panel className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="text-sm font-black text-slate-950">Semáforo de riesgo comparado</div>
          <div className="mt-0.5 text-xs text-slate-500">
            Cuanto menor el riesgo, más estable se ve el vendedor en el rango seleccionado.
          </div>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry, index) => (
            risks[index] ? (
              <RiskTrafficLightCard key={entry.sellerId} assessment={risks[index]!} compact className="min-h-[290px]" />
            ) : null
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Eficiencia comparada" subtitle="Líneas superpuestas por vendedor.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={compareData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(value) => `${value}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {entries.map((entry, index) => (
                <Line key={`eficiencia-${entry.sellerId}`} type="monotone" dataKey={`eficiencia${index}`} name={`ID ${entry.summary.sellerId} eficiencia`} stroke={SELLER_COLORS[index % SELLER_COLORS.length]} strokeWidth={3} dot={{ r: 4 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Efectividad comparada" subtitle="Permite detectar estabilidad comercial en el rango.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={compareData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(value) => `${value}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {entries.map((entry, index) => (
                <Line key={`efectividad-${entry.sellerId}`} type="monotone" dataKey={`efectividad${index}`} name={`ID ${entry.summary.sellerId} efectividad`} stroke={SELLER_COLORS[index % SELLER_COLORS.length]} strokeWidth={3} dot={{ r: 4 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Facturación comparada" subtitle="Facturación mensual por vendedor.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={compareData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(value) => compactMoney(Number(value))} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {entries.map((entry, index) => (
                <Bar key={`facturacion-${entry.sellerId}`} dataKey={`facturacion${index}`} name={`ID ${entry.summary.sellerId} facturación`} fill={SELLER_COLORS[index % SELLER_COLORS.length]} radius={[8, 8, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Categoría comparada" subtitle="Ranking: 0 Mejora · 1 Junior · 2 Semi · 3 Senior.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={compareData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(value) => CATEGORY_TICKS[value] ?? value} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {entries.map((entry, index) => (
                <Line key={`categoria-${entry.sellerId}`} type="stepAfter" dataKey={`categoriaRank${index}`} name={`ID ${entry.summary.sellerId} categoría`} stroke={SELLER_COLORS[index % SELLER_COLORS.length]} strokeWidth={3} dot={{ r: 5 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {entries.map((entry) => (
          <HistoryTable key={entry.sellerId} history={entry.history} title={`Detalle mensual · ID ${entry.summary.sellerId}`} />
        ))}
      </div>
    </>
  );
}

function isMeaningfulRankingItem(item: RankingApiItem) {
  const name = `${item.sellerName ?? ""} ${item.sellerCatalogName ?? ""}`.trim().toUpperCase();
  if (!name || name.includes("VACANTE") || name === "NULL") return false;

  const hasUsefulMetrics = item.history.some(
    (point) =>
      point.facturacion !== null ||
      point.eficiencia !== null ||
      point.efectividad !== null ||
      point.totalVentas !== null,
  );

  return hasUsefulMetrics;
}

function buildRankingRows(items: RankingApiItem[], sortBy: RankingSortKey): RankingRow[] {
  const rows = items
    .filter(isMeaningfulRankingItem)
    .map((item) => {
      const score = calculateHistoricalScore(item.summary, item.history);
      const risk = calculateRiskAssessment(item.summary, item.history, score);
      const sortScore = score?.score ?? 0;
      return { ...item, score, risk, sortScore };
    });

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "risk") {
      const ar = a.risk?.score ?? 999;
      const br = b.risk?.score ?? 999;
      if (ar !== br) return ar - br;
      return (b.score?.score ?? 0) - (a.score?.score ?? 0);
    }

    if (sortBy === "billing") {
      const av = a.summary.avgFacturacion ?? 0;
      const bv = b.summary.avgFacturacion ?? 0;
      if (av !== bv) return bv - av;
      return (b.score?.score ?? 0) - (a.score?.score ?? 0);
    }

    if (sortBy === "category") {
      const av = a.summary.currentCategoria ? CATEGORIA_RANK[a.summary.currentCategoria] : 0;
      const bv = b.summary.currentCategoria ? CATEGORIA_RANK[b.summary.currentCategoria] : 0;
      if (av !== bv) return bv - av;
      return (b.score?.score ?? 0) - (a.score?.score ?? 0);
    }

    if (sortBy === "variation") {
      const av = a.summary.categoryDelta ?? -99;
      const bv = b.summary.categoryDelta ?? -99;
      if (av !== bv) return bv - av;
      return (b.score?.score ?? 0) - (a.score?.score ?? 0);
    }

    if ((b.score?.score ?? 0) !== (a.score?.score ?? 0)) {
      return (b.score?.score ?? 0) - (a.score?.score ?? 0);
    }

    return (a.risk?.score ?? 999) - (b.risk?.score ?? 999);
  });

  return sorted;
}

function riskBadgeClasses(level?: RiskAssessment["level"]) {
  if (level === "low") return "bg-emerald-100 text-emerald-700 ring-emerald-200";
  if (level === "medium") return "bg-amber-100 text-amber-700 ring-amber-200";
  if (level === "high") return "bg-red-100 text-red-700 ring-red-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}


function normalizeSupervisorName(value: unknown) {
  const raw = String(value ?? "").trim();
  const upper = raw.toUpperCase();

  if (!raw || upper === "NO" || upper === "#N/A" || upper === "NULL" || upper === "FALSE") {
    return "Sin supervisor asignado";
  }

  return raw
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function isAssignedSupervisor(supervisor: string) {
  return supervisor !== "Sin supervisor asignado";
}

function supervisorDataKey(supervisor: string) {
  return `sup_${supervisor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()}`;
}

function sumNullable(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((acc, value) => acc + value, 0);
}

function getLatestSupervisor(row: RankingRow) {
  const sorted = [...row.history].sort((a, b) => a.period.localeCompare(b.period));
  const latest = sorted[sorted.length - 1];
  return normalizeSupervisorName(latest?.supervisor);
}

function buildSupervisorRows(items: RankingApiItem[]) {
  const sellerRows = buildRankingRows(items, "score");
  const map = new Map<string, { points: CategoriaHistoryPoint[]; sellerIds: Set<string>; sellerRows: RankingRow[] }>();
  let unassignedPoints = 0;

  const ensure = (supervisor: string) => {
    const current = map.get(supervisor);
    if (current) return current;

    const next = {
      points: [] as CategoriaHistoryPoint[],
      sellerIds: new Set<string>(),
      sellerRows: [] as RankingRow[],
    };

    map.set(supervisor, next);
    return next;
  };

  for (const row of sellerRows) {
    const latestSupervisor = getLatestSupervisor(row);

    if (isAssignedSupervisor(latestSupervisor)) {
      ensure(latestSupervisor).sellerRows.push(row);
    }

    for (const point of row.history) {
      const supervisor = normalizeSupervisorName(point.supervisor);

      if (!isAssignedSupervisor(supervisor)) {
        unassignedPoints += 1;
        continue;
      }

      const group = ensure(supervisor);
      group.points.push(point);
      group.sellerIds.add(row.sellerId);
    }
  }

  const rows: SupervisorRow[] = Array.from(map.entries()).map(([supervisor, group]) => {
    const monthlyMap = new Map<string, CategoriaHistoryPoint[]>();

    for (const point of group.points) {
      const current = monthlyMap.get(point.period) ?? [];
      current.push(point);
      monthlyMap.set(point.period, current);
    }

    const monthly = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, points]) => {
        const first = points[0];
        const sellersInPeriod = new Set(points.map((point) => point.sellerId));
        const monthlyScores = points.map((point) => calculateMonthlyCategoryScore(point).score);

        return {
          period,
          periodLabel: first?.periodLabel ?? period,
          score: avg(monthlyScores),
          eficiencia: avg(points.map((point) => point.eficiencia)),
          efectividad: avg(points.map((point) => point.efectividad)),
          facturacionPromedio: avg(points.map((point) => point.facturacion)),
          facturacionTotal: sumNullable(points.map((point) => point.facturacion)),
          totalVentas: sumNullable(points.map((point) => point.totalVentas)),
          vendedores: sellersInPeriod.size,
        } satisfies SupervisorMonthlyPoint;
      });

    const avgScore = avg(monthly.map((item) => item.score));
    const avgRisk = avg(group.sellerRows.map((row) => row.risk?.score));
    const bestSeller = group.sellerRows.length
      ? [...group.sellerRows].sort((a, b) => (b.score?.score ?? 0) - (a.score?.score ?? 0))[0]
      : null;
    const atRiskSeller = group.sellerRows.length
      ? [...group.sellerRows].sort((a, b) => (b.risk?.score ?? 0) - (a.risk?.score ?? 0))[0]
      : null;

    const totalFacturacion = sumNullable(group.points.map((point) => point.facturacion));
    const totalVentas = sumNullable(group.points.map((point) => point.totalVentas));
    const planMejoraPct = group.points.length
      ? (group.points.filter((point) => point.categoria === "PLAN_MEJORA").length / group.points.length) * 100
      : null;
    const seniorPct = group.points.length
      ? (group.points.filter((point) => point.categoria === "SENIOR").length / group.points.length) * 100
      : null;

    return {
      supervisor,
      sellerIds: Array.from(group.sellerIds).sort((a, b) => Number(a) - Number(b)),
      sellersCount: group.sellerIds.size,
      avgScore,
      avgRisk,
      avgEficiencia: avg(group.points.map((point) => point.eficiencia)),
      avgEfectividad: avg(group.points.map((point) => point.efectividad)),
      avgFacturacion: avg(group.points.map((point) => point.facturacion)),
      totalFacturacion,
      totalVentas,
      avgCategoriaRank: avg(group.points.map((point) => point.categoriaRank)),
      highRiskCount: group.sellerRows.filter((row) => row.risk?.level === "high").length,
      lowRiskCount: group.sellerRows.filter((row) => row.risk?.level === "low").length,
      planMejoraPct,
      seniorPct,
      months: monthly.length,
      bestSeller,
      atRiskSeller,
      monthly,
    } satisfies SupervisorRow;
  });

  return {
    rows: rows.sort((a, b) => {
      const scoreDelta = (b.avgScore ?? 0) - (a.avgScore ?? 0);
      if (Math.abs(scoreDelta) > 0.01) return scoreDelta;
      return (b.avgEfectividad ?? 0) - (a.avgEfectividad ?? 0);
    }),
    unassignedPoints,
    sellerRows,
  };
}

function buildSupervisorTrendData(rows: SupervisorRow[], metric: "score" | "facturacion" | "eficiencia" | "efectividad") {
  const periods = Array.from(
    new Set(rows.flatMap((row) => row.monthly.map((item) => `${item.period}|${item.periodLabel}`))),
  )
    .map((value) => {
      const [period, periodLabel] = value.split("|");
      return { period, periodLabel };
    })
    .sort((a, b) => a.period.localeCompare(b.period));

  return periods.map(({ period, periodLabel }) => {
    const record: Record<string, string | number | null> = { period, periodLabel };

    for (const row of rows) {
      const monthly = row.monthly.find((item) => item.period === period);
      const key = supervisorDataKey(row.supervisor);

      if (metric === "score") record[key] = monthly?.score ?? null;
      if (metric === "facturacion") record[key] = monthly?.facturacionTotal ?? null;
      if (metric === "eficiencia") record[key] = monthly?.eficiencia ?? null;
      if (metric === "efectividad") record[key] = monthly?.efectividad ?? null;
    }

    return record;
  });
}

function SupervisorDashboard({ items }: { items: RankingApiItem[] }) {
  const { rows, unassignedPoints, sellerRows } = useMemo(() => buildSupervisorRows(items), [items]);
  const topSupervisor = rows[0] ?? null;
  const highestBilling = rows.reduce<SupervisorRow | null>((best, row) => {
    if (row.totalFacturacion === null) return best;
    if (!best || (best.totalFacturacion ?? 0) < row.totalFacturacion) return row;
    return best;
  }, null);
  const highestRisk = rows.reduce<SupervisorRow | null>((best, row) => {
    if (row.avgRisk === null) return best;
    if (!best || (best.avgRisk ?? 0) < row.avgRisk) return row;
    return best;
  }, null);
  const avgScore = rows.length ? rows.reduce((acc, row) => acc + (row.avgScore ?? 0), 0) / rows.length : null;

  const scoreChartData = rows.map((row) => ({
    supervisor: row.supervisor,
    score: row.avgScore ?? 0,
    riesgo: row.avgRisk ?? null,
    facturacion: row.totalFacturacion ?? 0,
  }));
  const performanceChartData = rows.map((row) => ({
    supervisor: row.supervisor,
    eficiencia: row.avgEficiencia,
    efectividad: row.avgEfectividad,
  }));
  const scoreTrendData = buildSupervisorTrendData(rows, "score");
  const billingTrendData = buildSupervisorTrendData(rows, "facturacion");

  if (!rows.length) {
    return (
      <EmptyState
        title="Sin datos suficientes para analizar mesas"
        description="No se encontraron supervisores asignados con métricas válidas dentro del rango seleccionado. Probá ampliando el período."
      />
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Mesa líder"
          value={topSupervisor?.supervisor ?? "—"}
          hint={topSupervisor ? `${formatNumber(topSupervisor.avgScore, 1)}/100 · ${topSupervisor.sellersCount} vendedores` : "Sin datos"}
          icon={<Award className="h-5 w-5" />}
          tone="slate"
          className="xl:col-span-1"
        />
        <KpiCard
          title="Score promedio mesas"
          value={avgScore === null ? "—" : `${Math.round(avgScore)}/100`}
          hint={`${rows.length} mesas evaluadas · ${sellerRows.length} vendedores`}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="slate"
        />
        <KpiCard
          title="Mayor facturación total"
          value={highestBilling?.supervisor ?? "—"}
          hint={highestBilling ? compactMoney(highestBilling.totalFacturacion) : "Sin datos"}
          icon={<BarChart3 className="h-5 w-5" />}
          tone="slate"
        />
        <KpiCard
          title="Mesa con más alerta"
          value={highestRisk?.supervisor ?? "—"}
          hint={highestRisk ? `Riesgo prom. ${formatNumber(highestRisk.avgRisk, 1)}/100` : "Sin datos"}
          icon={<AlertCircle className="h-5 w-5" />}
          tone={highestRisk && (highestRisk.avgRisk ?? 0) >= 60 ? "red" : "slate"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel className="overflow-hidden p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Lectura ejecutiva</div>
              <h3 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Rendimiento por mesa de supervisión</h3>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                Esta vista agrupa los vendedores por el supervisor informado en cada snapshot mensual. Sirve para ver qué mesa sostiene mejor score, eficiencia, efectividad, facturación y riesgo acumulado.
              </p>
            </div>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {rows.slice(0, 3).map((row, index) => (
              <div key={row.supervisor} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className={cls("grid h-8 w-8 place-items-center rounded-full text-xs font-black", index === 0 ? "bg-slate-950 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200")}>#{index + 1}</span>
                  <span className="text-xs font-black text-slate-400">{formatNumber(row.avgScore, 1)}/100</span>
                </div>
                <div className="mt-3 break-words text-base font-black text-slate-950">{row.supervisor}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{row.sellersCount} vendedores · {row.months} meses</div>
              </div>
            ))}
          </div>

          {unassignedPoints > 0 ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              Hay {unassignedPoints} registros históricos sin supervisor asignado o con valor inválido. No se incluyen en el ranking de mesas para evitar distorsiones.
            </div>
          ) : null}
        </Panel>

        <Panel className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="text-sm font-black text-slate-950">Composición de mesas</div>
            <div className="mt-0.5 text-xs text-slate-500">Cantidad de vendedores únicos detectados por mesa en el rango.</div>
          </div>
          <div className="space-y-3 p-5">
            {rows.map((row) => (
              <div key={row.supervisor} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-950">{row.supervisor}</div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-500">IDs: {row.sellerIds.slice(0, 8).join(", ")}{row.sellerIds.length > 8 ? "..." : ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-slate-950">{row.sellersCount}</div>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">vendedores</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Score por mesa" subtitle="Promedio mensual según reglas oficiales de categorías y puntos.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scoreChartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="supervisor" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={0} angle={-8} textAnchor="end" height={55} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="score" name="Score mesa" fill="#0f172a" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Eficiencia vs efectividad" subtitle="Promedios históricos por mesa de supervisión.">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={performanceChartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="supervisor" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={0} angle={-8} textAnchor="end" height={55} />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="eficiencia" name="Eficiencia" fill="#2563eb" radius={[10, 10, 0, 0]} />
              <Line type="monotone" dataKey="efectividad" name="Efectividad" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Evolución mensual del score" subtitle="Permite detectar si una mesa viene mejorando o cayendo mes a mes.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={scoreTrendData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {rows.slice(0, 5).map((row, index) => (
                <Line key={row.supervisor} type="monotone" dataKey={supervisorDataKey(row.supervisor)} name={row.supervisor} stroke={SELLER_COLORS[index % SELLER_COLORS.length]} strokeWidth={3} dot={{ r: 4 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Facturación total por mes" subtitle="Suma mensual de facturación generada por los vendedores de cada mesa.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={billingTrendData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(value) => compactMoney(Number(value))} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {rows.slice(0, 5).map((row, index) => (
                <Line key={row.supervisor} type="monotone" dataKey={supervisorDataKey(row.supervisor)} name={row.supervisor} stroke={SELLER_COLORS[index % SELLER_COLORS.length]} strokeWidth={3} dot={{ r: 4 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Panel className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="text-sm font-black text-slate-950">Ranking ejecutivo de mesas</div>
          <div className="mt-0.5 text-xs text-slate-500">Ordenado de mayor a menor score mensual promedio.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-black">#</th>
                <th className="px-4 py-3 font-black">Mesa</th>
                <th className="px-4 py-3 font-black">Score mesa</th>
                <th className="px-4 py-3 font-black">Vendedores</th>
                <th className="px-4 py-3 font-black">Riesgo alto</th>
                <th className="px-4 py-3 font-black">Eficiencia</th>
                <th className="px-4 py-3 font-black">Efectividad</th>
                <th className="px-4 py-3 font-black">Fact. promedio</th>
                <th className="px-4 py-3 font-black">Fact. total</th>
                <th className="px-4 py-3 font-black">Plan Mejora</th>
                <th className="px-4 py-3 font-black">Mejor vendedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr key={row.supervisor} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <span className={cls("inline-grid h-8 w-8 place-items-center rounded-full text-xs font-black", index < 3 ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600")}>{index + 1}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-black text-slate-950">{row.supervisor}</div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-500">{row.months} meses con datos</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-slate-950" style={{ width: `${row.avgScore ?? 0}%` }} />
                      </div>
                      <span className="font-black text-slate-950">{formatNumber(row.avgScore, 1)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{row.sellersCount}</td>
                  <td className="px-4 py-3">
                    <span className={cls("inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1", row.highRiskCount > 0 ? "bg-red-100 text-red-700 ring-red-200" : "bg-emerald-100 text-emerald-700 ring-emerald-200")}>{row.highRiskCount}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{formatPercent(row.avgEficiencia)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{formatPercent(row.avgEfectividad)}</td>
                  <td className="px-4 py-3 font-black text-slate-950">{compactMoney(row.avgFacturacion)}</td>
                  <td className="px-4 py-3 font-black text-slate-950">{compactMoney(row.totalFacturacion)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{formatPercent(row.planMejoraPct, 0)}</td>
                  <td className="px-4 py-3">
                    <div className="font-black text-slate-950">{row.bestSeller ? `ID ${row.bestSeller.sellerId}` : "—"}</div>
                    <div className="mt-0.5 max-w-[220px] truncate text-xs font-semibold text-slate-500">{row.bestSeller?.sellerName ?? "Sin datos"}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function RankingDashboard({
  items,
  sortBy,
}: {
  items: RankingApiItem[];
  sortBy: RankingSortKey;
}) {
  const rows = useMemo(() => buildRankingRows(items, sortBy), [items, sortBy]);
  const topTen = rows.slice(0, 10);
  const topSeller = rows[0] ?? null;
  const highRiskCount = rows.filter((row) => row.risk?.level === "high").length;
  const lowRiskCount = rows.filter((row) => row.risk?.level === "low").length;
  const avgScore = rows.length ? rows.reduce((acc, row) => acc + (row.score?.score ?? 0), 0) / rows.length : null;
  const bestBilling = rows.reduce<RankingRow | null>((best, row) => {
    if (row.summary.avgFacturacion === null) return best;
    if (!best || (best.summary.avgFacturacion ?? 0) < row.summary.avgFacturacion) return row;
    return best;
  }, null);

  const scoreChartData = topTen.map((row, index) => ({
    rank: `#${index + 1}`,
    label: `ID ${row.sellerId}`,
    vendedor: row.sellerName,
    score: row.score?.score ?? 0,
    riesgo: row.risk?.score ?? null,
    facturacion: row.summary.avgFacturacion,
  }));

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          className="xl:col-span-1"
          title="Mejor rendimiento"
          value={topSeller ? `ID ${topSeller.sellerId}` : "—"}
          hint={topSeller ? `${topSeller.sellerName} · ${topSeller.score?.score ?? 0}/100` : "Sin datos"}
          icon={<Award className="h-5 w-5" />}
          tone="slate"
        />
        <KpiCard
          title="Score promedio"
          value={avgScore === null ? "—" : `${Math.round(avgScore)}/100`}
          hint={`${rows.length} vendedores evaluados`}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="slate"
        />
        <KpiCard
          title="Bajo riesgo"
          value={lowRiskCount}
          hint="Vendedores con señales sanas"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="slate"
        />
        <KpiCard
          title="Alto riesgo"
          value={highRiskCount}
          hint="Requieren revisión prioritaria"
          icon={<AlertCircle className="h-5 w-5" />}
          tone={highRiskCount > 0 ? "red" : "slate"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="text-sm font-black text-slate-950">Ranking general de vendedores</div>
            <div className="mt-0.5 text-xs text-slate-500">
              Ordenado por rendimiento histórico. El score se basa en reglas mensuales de categoría, tendencia y estabilidad.
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-black">#</th>
                  <th className="px-4 py-3 font-black">Vendedor</th>
                  <th className="px-4 py-3 font-black">Score</th>
                  <th className="px-4 py-3 font-black">Riesgo</th>
                  <th className="px-4 py-3 font-black">Categoría</th>
                  <th className="px-4 py-3 font-black">Variación</th>
                  <th className="px-4 py-3 font-black">Eficiencia</th>
                  <th className="px-4 py-3 font-black">Efectividad</th>
                  <th className="px-4 py-3 font-black">Fact. promedio</th>
                  <th className="px-4 py-3 font-black">Meses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, index) => (
                  <tr key={row.sellerId} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <span className={cls(
                        "inline-grid h-8 w-8 place-items-center rounded-full text-xs font-black",
                        index < 3 ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600",
                      )}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-black text-slate-950">ID {row.sellerId}</div>
                      <div className="mt-0.5 max-w-[240px] truncate text-xs font-semibold text-slate-500">{row.sellerName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-24 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-slate-950" style={{ width: `${row.score?.score ?? 0}%` }} />
                        </div>
                        {row.score ? (
                          <ScoreValue score={row.score} size="sm" align="right" />
                        ) : (
                          <span className="font-black text-slate-950">0/100</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cls("inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1", riskBadgeClasses(row.risk?.level))}>
                        {row.risk?.label ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusPill categoria={row.summary.currentCategoria} /></td>
                    <td className="px-4 py-3 font-black text-slate-700">{deltaLabel(row.summary.categoryDelta)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{formatPercent(row.summary.avgEficiencia)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{formatPercent(row.summary.avgEfectividad)}</td>
                    <td className="px-4 py-3 font-black text-slate-950">{compactMoney(row.summary.avgFacturacion)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-500">{row.summary.months}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel className="overflow-hidden p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Lectura ejecutiva</div>
                <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">Ranking para decidir rápido</div>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                  Usá esta vista para detectar quién viene rindiendo mejor, quién necesita seguimiento y quién conviene comparar en el modo versus antes de tomar una decisión.
                </p>
              </div>
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                <ListOrdered className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {topTen.slice(0, 5).map((row, index) => (
                <div key={row.sellerId} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-950">#{index + 1} · ID {row.sellerId}</div>
                    <div className="truncate text-xs font-semibold text-slate-500">{row.sellerName}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-black text-slate-950">{row.score?.score ?? 0}</div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">score</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <KpiCard
            title="Mayor facturación prom."
            value={bestBilling ? `ID ${bestBilling.sellerId}` : "—"}
            hint={bestBilling ? `${compactMoney(bestBilling.summary.avgFacturacion)} · ${bestBilling.sellerName}` : "Sin datos"}
            icon={<BarChart3 className="h-5 w-5" />}
            tone="slate"
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Top 10 por score histórico" subtitle="Score 0–100 basado en reglas mensuales, tendencia y estabilidad.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scoreChartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="score" name="Score" fill="#0f172a" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Score vs riesgo" subtitle="Cuanto mayor el score y menor el riesgo, más sólido es el desempeño histórico.">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={scoreChartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar yAxisId="left" dataKey="score" name="Score" fill="#2563eb" radius={[10, 10, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="riesgo" name="Riesgo" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );
}

async function fetchRanking(params: {
  branchKey: string;
  from: string;
  to: string;
  signal: AbortSignal;
}) {
  const query = new URLSearchParams({
    branch_key: params.branchKey,
    from: params.from,
    to: params.to,
    ranking: "1",
  });

  const res = await fetch(`/api/categorias/history?${query.toString()}`, {
    cache: "no-store",
    signal: params.signal,
  });
  const json = (await res.json()) as ApiResponse;
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json;
}

async function fetchHistory(params: {
  branchKey: string;
  sellerId: string;
  from: string;
  to: string;
  signal: AbortSignal;
}) {
  const query = new URLSearchParams({
    branch_key: params.branchKey,
    seller_id: params.sellerId,
    from: params.from,
    to: params.to,
  });

  const res = await fetch(`/api/categorias/history?${query.toString()}`, {
    cache: "no-store",
    signal: params.signal,
  });
  const json = (await res.json()) as ApiResponse;
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json;
}

type CategoriaVendorHistoryProps = {
  branchKeyOverride?: string;
  className?: string;
};

export default function CategoriaVendorHistory({
  branchKeyOverride,
  className = "",
}: CategoriaVendorHistoryProps = {}) {
  const pathname = usePathname();
  const pathBranchKey = useMemo(() => getBranchKeyFromPath(pathname), [pathname]);
  const branchKey = branchKeyOverride ?? pathBranchKey;

  const [mode, setMode] = useState<HistoryMode>("single");
  const [rankingSort, setRankingSort] = useState<RankingSortKey>("score");
  const [metaLoading, setMetaLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [periods, setPeriods] = useState<ApiResponse["periods"]>([]);
  const [sellers, setSellers] = useState<CategoriaHistorySeller[]>([]);
  const [sellerId, setSellerId] = useState("");
  const [compareSellerIds, setCompareSellerIds] = useState<string[]>(["", ""]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [history, setHistory] = useState<CategoriaHistoryPoint[]>([]);
  const [summary, setSummary] = useState<CategoriaHistorySummary | null>(null);
  const [compareResults, setCompareResults] = useState<CompareSellerResult[]>([]);
  const [rankingItems, setRankingItems] = useState<RankingApiItem[]>([]);

  const selectedSeller = useMemo(
    () => sellers.find((seller) => seller.id === sellerId) ?? null,
    [sellerId, sellers],
  );

  const validCompareSellerIds = useMemo(
    () => compareSellerIds.map((id) => id.trim()).filter(Boolean),
    [compareSellerIds],
  );

  const hasDuplicateCompareIds = useMemo(
    () => new Set(validCompareSellerIds).size !== validCompareSellerIds.length,
    [validCompareSellerIds],
  );


  useEffect(() => {
    if (!branchKey) return;

    const run = async () => {
      setMetaLoading(true);
      setError(null);
      setHistory([]);
      setSummary(null);
      setCompareResults([]);
      setRankingItems([]);

      try {
        const res = await fetch(
          `/api/categorias/history?branch_key=${encodeURIComponent(branchKey)}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as ApiResponse;
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

        const nextPeriods = Array.isArray(json.periods) ? json.periods : [];
        const nextSellers = Array.isArray(json.sellers) ? json.sellers : [];

        setPeriods(nextPeriods);
        setSellers(nextSellers);

        const first = nextPeriods[0]?.value ?? "";
        const last = nextPeriods[nextPeriods.length - 1]?.value ?? "";
        const firstSeller = nextSellers[0]?.id ?? "";
        const secondSeller = nextSellers.find((seller) => seller.id !== firstSeller)?.id ?? "";

        setFrom(first);
        setTo(last);
        setSellerId(firstSeller);
        setCompareSellerIds([firstSeller, secondSeller].filter(Boolean).length >= 2 ? [firstSeller, secondSeller] : [firstSeller, ""]);
      } catch (e: any) {
        setError(e?.message ?? "No se pudo cargar el histórico");
        setPeriods([]);
        setSellers([]);
        setFrom("");
        setTo("");
        setSellerId("");
        setCompareSellerIds(["", ""]);
        setCompareResults([]);
        setRankingItems([]);
      } finally {
        setMetaLoading(false);
      }
    };

    run();
  }, [branchKey]);

  useEffect(() => {
    if (!branchKey || !from || !to) return;
    if (mode === "single" && !sellerId) return;
    if (mode === "compare" && (validCompareSellerIds.length < 2 || hasDuplicateCompareIds)) return;

    const controller = new AbortController();

    const run = async () => {
      setHistoryLoading(true);
      setError(null);

      try {
        if (mode === "ranking" || mode === "supervisors") {
          const json = await fetchRanking({
            branchKey,
            from,
            to,
            signal: controller.signal,
          });

          setRankingItems(Array.isArray(json.ranking) ? json.ranking : []);
          setHistory([]);
          setSummary(null);
          setCompareResults([]);
          return;
        }

        if (mode === "single") {
          const json = await fetchHistory({
            branchKey,
            sellerId,
            from,
            to,
            signal: controller.signal,
          });

          setHistory(Array.isArray(json.history) ? json.history : []);
          setSummary(json.summary ?? null);
          setCompareResults([]);
          setRankingItems([]);
          return;
        }

        const responses = await Promise.all(
          validCompareSellerIds.map((id) =>
            fetchHistory({ branchKey, sellerId: id, from, to, signal: controller.signal }),
          ),
        );

        const nextCompareResults = responses
          .map((response, index) => ({
            sellerId: validCompareSellerIds[index],
            history: Array.isArray(response.history) ? response.history : [],
            summary: response.summary,
          }))
          .filter((item): item is CompareSellerResult => Boolean(item.summary) && item.history.length > 0);

        setCompareResults(nextCompareResults);
        setHistory([]);
        setSummary(null);
        setRankingItems([]);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError(e?.message ?? "No se pudo cargar la evolución");
          setHistory([]);
          setSummary(null);
          setCompareResults([]);
          setRankingItems([]);
        }
      } finally {
        setHistoryLoading(false);
      }
    };

    run();

    return () => controller.abort();
  }, [branchKey, sellerId, validCompareSellerIds, hasDuplicateCompareIds, from, to, mode]);

  if (!branchKey) return null;

  const hasSingleData = mode === "single" && history.length > 0 && summary !== null;
  const hasCompareData = mode === "compare" && compareResults.length >= 2;
  const hasRankingData = mode === "ranking" && rankingItems.length > 0;
  const hasSupervisorData = mode === "supervisors" && rankingItems.length > 0;

  return (
    <section className={cls("mt-10", className)}>
      <Panel className="overflow-hidden">
        <div className="relative overflow-hidden border-b border-slate-200 bg-slate-950 px-5 py-5 text-white">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.35),transparent_45%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.25),transparent_40%)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white/80">
                <BarChart3 className="h-3.5 w-3.5" /> Histórico de categorías
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                Evolución mensual por vendedor
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
                Analizá un vendedor por ID, compará varios vendedores, revisá ranking general o evaluá el rendimiento por mesa de supervisión con métricas históricas.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm backdrop-blur">
              <div className="text-xs uppercase tracking-[0.18em] text-white/50">Sucursal</div>
              <div className="mt-1 font-black text-white">{BRANCH_LABELS[branchKey] ?? branchKey}</div>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={cls(
                "rounded-xl px-4 py-2 text-sm font-black transition",
                mode === "single" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
              )}
            >
              Análisis individual
            </button>
            <button
              type="button"
              onClick={() => setMode("compare")}
              className={cls(
                "rounded-xl px-4 py-2 text-sm font-black transition",
                mode === "compare" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
              )}
            >
              Comparar vendedores
            </button>
            <button
              type="button"
              onClick={() => setMode("ranking")}
              className={cls(
                "rounded-xl px-4 py-2 text-sm font-black transition",
                mode === "ranking" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
              )}
            >
              Ranking de vendedores
            </button>
            <button
              type="button"
              onClick={() => setMode("supervisors")}
              className={cls(
                "rounded-xl px-4 py-2 text-sm font-black transition",
                mode === "supervisors" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
              )}
            >
              Mesa de supervisión
            </button>
          </div>

          {mode === "ranking" ? (
            <div className="grid gap-4 xl:grid-cols-[180px_180px_minmax(0,260px)]">
              <PeriodSelect label="Desde" value={from} periods={periods} onChange={setFrom} />
              <PeriodSelect label="Hasta" value={to} periods={periods} onChange={setTo} />
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Ordenar por
                </label>
                <select
                  value={rankingSort}
                  onChange={(event) => setRankingSort(event.target.value as RankingSortKey)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
                >
                  <option value="score">Mejor rendimiento</option>
                  <option value="risk">Menor riesgo</option>
                  <option value="billing">Mayor facturación promedio</option>
                  <option value="category">Mejor categoría actual</option>
                  <option value="variation">Mayor crecimiento</option>
                </select>
              </div>
            </div>
          ) : mode === "supervisors" ? (
            <div className="grid gap-4 xl:grid-cols-[180px_180px_minmax(0,1fr)]">
              <PeriodSelect label="Desde" value={from} periods={periods} onChange={setFrom} />
              <PeriodSelect label="Hasta" value={to} periods={periods} onChange={setTo} />
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-600">
                La mesa se arma con el supervisor informado en cada snapshot mensual. Los registros sin supervisor válido se separan para no distorsionar el análisis.
              </div>
            </div>
          ) : mode === "compare" ? (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_180px]">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Vendedores a comparar
                  </label>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                    Seleccioná mínimo 2 vendedores. Podés agregar hasta {MAX_COMPARE_SELLERS} para ampliar el versus.
                  </div>
                </div>
                <PeriodSelect label="Desde" value={from} periods={periods} onChange={setFrom} />
                <PeriodSelect label="Hasta" value={to} periods={periods} onChange={setTo} />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {compareSellerIds.map((id, index) => (
                  <div key={`compare-seller-${index}`} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-full text-xs font-black text-white" style={{ backgroundColor: SELLER_COLORS[index % SELLER_COLORS.length] }}>
                          {SELLER_LABELS[index] ?? index + 1}
                        </span>
                        <div className="text-sm font-black text-slate-950">Vendedor {SELLER_LABELS[index] ?? index + 1}</div>
                      </div>
                      {index >= 2 ? (
                        <button
                          type="button"
                          onClick={() => setCompareSellerIds((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          aria-label="Quitar vendedor"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    <SellerCombobox
                      sellers={sellers}
                      value={id}
                      onChange={(nextId) =>
                        setCompareSellerIds((current) => current.map((item, itemIndex) => (itemIndex === index ? nextId : item)))
                      }
                      label="Seleccionar ID"
                      placeholder={`Buscar vendedor ${SELLER_LABELS[index] ?? index + 1}...`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCompareSellerIds((current) => (current.length >= MAX_COMPARE_SELLERS ? current : [...current, ""]))}
                  disabled={compareSellerIds.length >= MAX_COMPARE_SELLERS}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> Agregar vendedor
                </button>
                <div className="text-xs font-semibold text-slate-500">
                  {validCompareSellerIds.length}/{MAX_COMPARE_SELLERS} seleccionados
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_180px_180px]">
              <SellerCombobox sellers={sellers} value={sellerId} onChange={setSellerId} label="Vendedor" />
              <PeriodSelect label="Desde" value={from} periods={periods} onChange={setFrom} />
              <PeriodSelect label="Hasta" value={to} periods={periods} onChange={setTo} />
            </div>
          )}

          {mode === "compare" && hasDuplicateCompareIds ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-black">Hay vendedores repetidos</div>
                <div className="mt-0.5">Para comparar correctamente, elegí IDs distintos en cada selector.</div>
              </div>
            </div>
          ) : null}

          {metaLoading ? (
            <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 py-10 text-sm font-bold text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando snapshots históricos...
            </div>
          ) : null}

          {error ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-black">No se pudo cargar la evolución</div>
                <div className="mt-0.5">{error}</div>
              </div>
            </div>
          ) : null}

          {!metaLoading && !periods.length && !error ? (
            <EmptyState
              title="Todavía no hay snapshots cerrados para esta sucursal"
              description="Cuando cierres meses desde el panel de categorías, esta sección va a poder construir la evolución histórica por ID de vendedor."
            />
          ) : null}

          {!metaLoading && mode === "single" && periods.length > 0 && !sellerId ? (
            <EmptyState
              title="Seleccioná un vendedor"
              description="Elegí un ID de vendedor para ver sus KPIs históricos, cambios de categoría y detalle mensual."
            />
          ) : null}

          {mode === "compare" && periods.length > 0 && validCompareSellerIds.length < 2 ? (
            <EmptyState
              title="Seleccioná al menos dos vendedores"
              description="El modo versus necesita mínimo dos IDs distintos. Podés agregar más vendedores con el botón de comparación."
            />
          ) : null}

          {historyLoading ? (
            <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white py-16 text-sm font-bold text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculando evolución...
            </div>
          ) : null}

          {!historyLoading && mode === "single" && sellerId && periods.length > 0 && history.length === 0 && !error ? (
            <EmptyState
              title="Sin registros para el rango seleccionado"
              description="El ID existe en el catálogo histórico, pero no aparece dentro del rango de meses seleccionado. Probá ampliando el período."
            />
          ) : null}

          {!historyLoading && mode === "compare" && validCompareSellerIds.length >= 2 && !hasDuplicateCompareIds && periods.length > 0 && !hasCompareData && !error ? (
            <EmptyState
              title="Sin datos suficientes para comparar"
              description="Uno o más vendedores no aparecen en el rango seleccionado. Probá ampliando el período o cambiando alguno de los IDs."
            />
          ) : null}

          {!historyLoading && mode === "ranking" && periods.length > 0 && !hasRankingData && !error ? (
            <EmptyState
              title="Sin datos suficientes para ranking"
              description="No hay vendedores con métricas válidas dentro del rango seleccionado. Probá ampliando el período."
            />
          ) : null}

          {!historyLoading && mode === "supervisors" && periods.length > 0 && !hasSupervisorData && !error ? (
            <EmptyState
              title="Sin datos suficientes para analizar mesas"
              description="No hay vendedores con supervisor válido y métricas suficientes dentro del rango seleccionado. Probá ampliando el período."
            />
          ) : null}

          {!historyLoading && hasSingleData ? (
            <SingleDashboard history={history} summary={summary!} selectedSeller={selectedSeller} />
          ) : null}

          {!historyLoading && hasCompareData ? (
            <CompareDashboard entries={compareResults} />
          ) : null}

          {!historyLoading && hasRankingData ? (
            <RankingDashboard items={rankingItems} sortBy={rankingSort} />
          ) : null}


          {!historyLoading && hasSupervisorData ? (
            <SupervisorDashboard items={rankingItems} />
          ) : null}
        </div>
      </Panel>
    </section>
  );
}
