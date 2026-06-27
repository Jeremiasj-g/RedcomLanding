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
import { CATEGORIA_RANK, type CategoriaKey } from "@/utils/categories";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RecognitionScoringTable,
  calculateRecognitionRows,
  type RecognitionAssignment,
} from "@/components/categoria/RecognitionScoringPlayground";

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



type RecognitionCategoryRule = {
  label: string;
  value: string;
  earnedAvg: number;
  max: number;
  ratio: number;
  detail?: string;
};

type RecognitionTimelinePoint = {
  period: string;
  periodLabel: string;
  categoria: CategoriaKey;
  categoriaLabel: string;
  basePoints: number;
  permanenceBonus: number;
  totalPoints: number;
  streak: number;
  bonusLabel: string | null;
};

type HistoricalScore = {
  score: number;
  totalPoints: number;
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
  monthlyRules: RecognitionCategoryRule[];
  timeline: RecognitionTimelinePoint[];
  basePoints: number;
  permanencePoints: number;
  maxPossiblePoints: number;
  bestStreak: number;
  currentStreak: number;
  redeemableBenefits: Array<{ label: string; points: number }>;
  nextBenefit: { label: string; points: number; missing: number } | null;
};

const RECOGNITION_CATEGORY_POINTS: Record<CategoriaKey, number> = {
  SENIOR: 20,
  SEMI_SENIOR: 12,
  JUNIOR: 5,
  PLAN_MEJORA: 0,
};

const PERMANENCE_BONUS: Partial<Record<CategoriaKey, { three: number; six: number }>> = {
  SENIOR: { three: 20, six: 40 },
  SEMI_SENIOR: { three: 10, six: 20 },
  JUNIOR: { three: 5, six: 10 },
};

const RECOGNITION_BENEFITS = [
  { label: "Vale combustible $10.000", points: 20 },
  { label: "Vale combustible $20.000", points: 30 },
  { label: "Uniforme", points: 80 },
  { label: "Service de moto", points: 150 },
  { label: "Mochila de trabajo", points: 180 },
  { label: "Casco homologado", points: 250 },
  { label: "Cubierta de moto", points: 350 },
];

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

function calculateRecognitionTimeline(history: CategoriaHistoryPoint[]): RecognitionTimelinePoint[] {
  const sorted = [...history].sort((a, b) => a.period.localeCompare(b.period));
  let previousCategoria: CategoriaKey | null = null;
  let streak = 0;

  return sorted.map((point) => {
    if (point.categoria === previousCategoria) {
      streak += 1;
    } else {
      previousCategoria = point.categoria;
      streak = 1;
    }

    const basePoints = RECOGNITION_CATEGORY_POINTS[point.categoria] ?? 0;
    const bonusRule = PERMANENCE_BONUS[point.categoria];
    let permanenceBonus = 0;
    let bonusLabel: string | null = null;

    // Lógica confirmada del playground: los bonos se repiten por ciclos de 6 meses.
    // Ejemplo Senior 12 meses: mes 3 +20, mes 6 +40, mes 9 +20 y mes 12 +40.
    const semesterPosition = streak % 6;

    if (bonusRule && semesterPosition === 3) {
      permanenceBonus = bonusRule.three;
      bonusLabel = `Bono por 3 meses consecutivos en ${CATEGORY_LABEL[point.categoria]}`;
    }

    if (bonusRule && semesterPosition === 0) {
      permanenceBonus = bonusRule.six;
      bonusLabel = `Bono por 6 meses consecutivos en ${CATEGORY_LABEL[point.categoria]}`;
    }

    return {
      period: point.period,
      periodLabel: point.periodLabel,
      categoria: point.categoria,
      categoriaLabel: point.categoriaLabel,
      basePoints,
      permanenceBonus,
      totalPoints: basePoints + permanenceBonus,
      streak,
      bonusLabel,
    };
  });
}

function getMaxRecognitionPoints(months: number) {
  if (months <= 0) return 0;
  const fullCycles = Math.floor(months / 6);
  const remainder = months % 6;

  return (
    months * RECOGNITION_CATEGORY_POINTS.SENIOR +
    fullCycles * (PERMANENCE_BONUS.SENIOR!.three + PERMANENCE_BONUS.SENIOR!.six) +
    (remainder >= 3 ? PERMANENCE_BONUS.SENIOR!.three : 0)
  );
}

function getRedeemableBenefits(totalPoints: number) {
  return RECOGNITION_BENEFITS.filter((benefit) => totalPoints >= benefit.points);
}

function getNextBenefit(totalPoints: number) {
  const next = RECOGNITION_BENEFITS.find((benefit) => totalPoints < benefit.points);
  return next ? { ...next, missing: next.points - totalPoints } : null;
}

function calculateHistoricalScore(
  summary: CategoriaHistorySummary | null,
  history: CategoriaHistoryPoint[],
): HistoricalScore | null {
  if (!summary || !history.length) return null;

  const timeline = calculateRecognitionTimeline(history);
  const totalPoints = timeline.reduce((acc, item) => acc + item.totalPoints, 0);
  const basePoints = timeline.reduce((acc, item) => acc + item.basePoints, 0);
  const permanencePoints = timeline.reduce((acc, item) => acc + item.permanenceBonus, 0);
  const monthlyAverage = avg(timeline.map((item) => item.totalPoints));
  const maxPossiblePoints = getMaxRecognitionPoints(timeline.length);
  const score = Math.round(clamp(maxPossiblePoints ? totalPoints / maxPossiblePoints : 0, 0, 1) * 100);
  const currentStreak = timeline.length ? timeline[timeline.length - 1].streak : 0;
  const bestStreak = timeline.reduce((max, item) => Math.max(max, item.streak), 0);
  const redeemableBenefits = getRedeemableBenefits(totalPoints);
  const nextBenefit = getNextBenefit(totalPoints);

  const label =
    score >= 80
      ? "Reconocimiento destacado"
      : score >= 55
        ? "Buen recorrido"
        : score >= 30
          ? "Reconocimiento inicial"
          : "Sin acumulación relevante";

  const tone =
    score >= 80 ? "emerald" : score >= 55 ? "blue" : score >= 30 ? "amber" : "red";

  const description =
    score >= 80
      ? "Acumula puntos de forma consistente y sostiene categorías altas dentro del rango."
      : score >= 55
        ? "Tiene una acumulación saludable. Conviene revisar oportunidades para sostener permanencia."
        : score >= 30
          ? "Suma puntos, pero todavía necesita continuidad para alcanzar mejores beneficios."
          : "La acumulación es baja o nula. Conviene revisar categoría y continuidad de resultados.";

  const categoryOrder: CategoriaKey[] = ["SENIOR", "SEMI_SENIOR", "JUNIOR", "PLAN_MEJORA"];
  const monthlyRules = categoryOrder.map((categoria) => {
    const months = timeline.filter((item) => item.categoria === categoria).length;

    return {
      label: CATEGORY_LABEL[categoria],
      value: `${RECOGNITION_CATEGORY_POINTS[categoria]} pts/mes`,
      earnedAvg: months,
      max: RECOGNITION_CATEGORY_POINTS[categoria],
      ratio: months > 0 ? 1 : 0,
      detail: months === 1 ? "1 mes" : `${months} meses`,
    };
  });

  return {
    score,
    totalPoints,
    label,
    tone,
    description,
    monthlyAverage,
    monthlyComponent: basePoints,
    trendPoints: permanencePoints,
    stabilityPoints: 0,
    points: [
      {
        label: "Puntos por categoría",
        value: `${basePoints} pts`,
        weight: "mensual",
        detail: "Senior 20, Semi Senior 12, Junior 5 y Plan de Mejora 0 puntos por mes.",
      },
      {
        label: "Bonos por permanencia",
        value: `${permanencePoints} pts`,
        weight: "acumulable",
        detail: "Se suman al cumplir 3 y 6 meses consecutivos en la misma categoría.",
      },
      {
        label: "Canjes disponibles",
        value: `${redeemableBenefits.length}`,
        weight: "beneficios",
        detail: nextBenefit
          ? `Próximo beneficio: ${nextBenefit.label}. Faltan ${nextBenefit.missing} pts.`
          : "Ya alcanza todos los beneficios configurados.",
      },
    ],
    monthlyRules,
    timeline,
    basePoints,
    permanencePoints,
    maxPossiblePoints,
    bestStreak,
    currentStreak,
    redeemableBenefits,
    nextBenefit,
  };
}

type RiskAssessment = {
  level: "low" | "medium" | "high";
  state: "En crecimiento" | "Estable" | "Requiere seguimiento" | "Plan de acción sugerido";
  label: string;
  score: number;
  description: string;
  reasons: string[];
  recommendation: string;
  actionRequired: boolean;
  breakdown: Array<{
    label: string;
    value: number;
    detail: string;
  }>;
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
  recognition?: HistoricalScore | null,
): RiskAssessment | null {
  if (!summary || !history.length) return null;

  const sorted = [...history].sort((a, b) => a.period.localeCompare(b.period));
  const first = sorted[0];
  const last = lastValid(sorted);
  if (!first || !last) return null;

  const timeline = recognition?.timeline ?? calculateRecognitionTimeline(sorted);
  const recentTimeline = timeline.slice(-3);
  const recentHistory = sorted.slice(-3);
  const totalPoints = recognition?.totalPoints ?? timeline.reduce((acc, item) => acc + item.totalPoints, 0);
  const recognitionIndex = recognition?.score ?? 0;
  const categoryDelta = summary.categoryDelta ?? 0;
  const billingTrend = getNumberTrend(first.facturacion, last.facturacion);
  const currentStreak = recognition?.currentStreak ?? (timeline.length ? timeline[timeline.length - 1].streak : 0);
  const recentPoints = recentTimeline.reduce((acc, item) => acc + item.totalPoints, 0);
  const planMejoraMonths = recentHistory.filter((item) => item.categoria === "PLAN_MEJORA").length;
  const lastMonthPoints = recentTimeline.length ? recentTimeline[recentTimeline.length - 1].totalPoints : 0;

  const reasons: string[] = [];
  const breakdown: RiskAssessment["breakdown"] = [
    {
      label: "Punto de partida",
      value: 18,
      detail: "Todo vendedor inicia la lectura con una base preventiva de 18 puntos.",
    },
  ];
  let actionScore = 18;

  const applyFactor = (label: string, value: number, detail: string, reason?: string) => {
    actionScore += value;
    breakdown.push({ label, value, detail });
    if (reason) reasons.push(reason);
  };

  if (summary.currentCategoria === "PLAN_MEJORA") {
    applyFactor(
      "Categoría actual",
      36,
      "Plan de Mejora es la categoría con mayor necesidad de intervención.",
      "El último cierre quedó en Plan de Mejora y no genera puntos por categoría.",
    );
  } else if (summary.currentCategoria === "JUNIOR") {
    applyFactor(
      "Categoría actual",
      12,
      "Junior suma puntos iniciales, pero todavía requiere acompañamiento.",
      "La categoría actual suma puntos iniciales, pero todavía requiere desarrollo.",
    );
  } else if (summary.currentCategoria === "SENIOR") {
    applyFactor(
      "Categoría actual",
      -12,
      "Senior reduce la necesidad de plan por ser la categoría de mayor desempeño.",
      "La categoría actual es Senior y genera el máximo puntaje mensual.",
    );
  }

  if (recentTimeline.length >= 2 && recentPoints === 0) {
    applyFactor(
      "Puntos recientes",
      24,
      "En los últimos meses no hubo acumulación de puntos.",
      "No sumó puntos en los últimos meses analizados.",
    );
  } else if (lastMonthPoints === 0) {
    applyFactor(
      "Último mes",
      12,
      "El último cierre no generó puntos de reconocimiento.",
      "El último mes no sumó puntos de reconocimiento.",
    );
  }

  if (planMejoraMonths >= 2) {
    applyFactor(
      "Meses recientes en mejora",
      18,
      `${planMejoraMonths} meses recientes en Plan de Mejora elevan la prioridad.`,
      `${planMejoraMonths} de los últimos ${recentHistory.length} meses estuvieron en Plan de Mejora.`,
    );
  }

  if (categoryDelta <= -2) {
    applyFactor(
      "Variación de categoría",
      18,
      `Bajó ${Math.abs(categoryDelta)} niveles durante el rango seleccionado.`,
      `Bajó ${Math.abs(categoryDelta)} niveles de categoría en el rango.`,
    );
  } else if (categoryDelta === -1) {
    applyFactor(
      "Variación de categoría",
      10,
      "Bajó 1 nivel durante el rango seleccionado.",
      "Bajó 1 nivel de categoría en el rango.",
    );
  } else if (categoryDelta >= 1) {
    applyFactor(
      "Variación de categoría",
      -10,
      `Subió ${categoryDelta} nivel${categoryDelta === 1 ? "" : "es"}; reduce la necesidad de acción.`,
      `Subió ${categoryDelta} nivel${categoryDelta === 1 ? "" : "es"} de categoría.`,
    );
  }

  if (recognitionIndex < 30) {
    applyFactor(
      "Índice de puntos",
      18,
      `${totalPoints} pts representan una acumulación baja para el rango.`,
      `Baja acumulación de puntos: ${totalPoints} pts en el rango.`,
    );
  } else if (recognitionIndex < 55) {
    applyFactor(
      "Índice de puntos",
      8,
      `${totalPoints} pts representan una acumulación moderada para el rango.`,
      `Acumulación moderada de puntos: ${totalPoints} pts.`,
    );
  } else {
    applyFactor(
      "Índice de puntos",
      -8,
      `${totalPoints} pts representan una buena acumulación para el rango.`,
      `Buena acumulación de puntos: ${totalPoints} pts.`,
    );
  }

  if (currentStreak >= 6) {
    applyFactor(
      "Permanencia",
      -10,
      `${currentStreak} meses consecutivos reducen la necesidad de plan.`,
      `Sostuvo ${currentStreak} meses consecutivos en la categoría actual.`,
    );
  } else if (currentStreak >= 3) {
    applyFactor(
      "Permanencia",
      -5,
      `${currentStreak} meses consecutivos muestran continuidad parcial.`,
      `Ya logró ${currentStreak} meses consecutivos en la categoría actual.`,
    );
  }

  if (billingTrend !== null && billingTrend <= -0.2) {
    applyFactor(
      "Facturación",
      10,
      `La facturación cayó ${(Math.abs(billingTrend) * 100).toFixed(0)}% entre el primer y último mes.`,
      `La facturación cayó ${(Math.abs(billingTrend) * 100).toFixed(0)}% entre el primer y último mes.`,
    );
  } else if (billingTrend !== null && billingTrend >= 0.15) {
    applyFactor(
      "Facturación",
      -6,
      `La facturación creció ${(billingTrend * 100).toFixed(0)}% en el rango.`,
      `La facturación creció ${(billingTrend * 100).toFixed(0)}% en el rango.`,
    );
  }

  actionScore = Math.round(clamp(actionScore / 100, 0, 1) * 100);

  const level: RiskAssessment["level"] =
    actionScore >= 62 ? "high" : actionScore >= 36 ? "medium" : "low";

  const label =
    level === "high"
      ? "Aplicar plan de acción"
      : level === "medium"
        ? "Seguimiento recomendado"
        : "Sin plan de acción";

  const state: RiskAssessment["state"] =
    level === "high"
      ? "Plan de acción sugerido"
      : level === "medium"
        ? "Requiere seguimiento"
        : categoryDelta > 0 || currentStreak >= 3
          ? "En crecimiento"
          : "Estable";

  const description =
    level === "high"
      ? "El historial de puntos y categoría indica que conviene trabajar un plan concreto de mejora."
      : level === "medium"
        ? "Hay señales mixtas. Conviene acompañar el próximo cierre y definir objetivos cortos."
        : "No se observan señales suficientes para aplicar un plan de acción en el rango seleccionado.";

  const recommendation =
    level === "high"
      ? "Aplicar plan de acción con objetivos de categoría, puntos esperados y seguimiento semanal."
      : level === "medium"
        ? "Definir seguimiento preventivo y revisar si puede alcanzar el próximo hito de permanencia."
        : "Mantener seguimiento normal y usar el caso como referencia de buenas prácticas.";

  return {
    level,
    state,
    label,
    score: actionScore,
    description,
    reasons: reasons.slice(0, 5),
    recommendation,
    actionRequired: level === "high",
    breakdown,
  };
}

function StatusPill({ categoria }: { categoria: CategoriaKey | null }) {
  if (!categoria) {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
        Sin datos
      </span>
    );
  }

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
    <Card
      className={cls(
        "rounded-[1.35rem] border border-slate-200 bg-white shadow-2xl",
        className,
      )}
    >
      {children}
    </Card>
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
    slate: {
      icon: "bg-slate-950 text-white",
      line: "bg-slate-300",
      value: "text-slate-950",
    },
    green: {
      icon: "bg-emerald-700 text-white",
      line: "bg-emerald-500",
      value: "text-emerald-800",
    },
    red: {
      icon: "bg-red-700 text-white",
      line: "bg-red-500",
      value: "text-red-800",
    },
    amber: {
      icon: "bg-amber-600 text-white",
      line: "bg-amber-500",
      value: "text-amber-800",
    },
    blue: {
      icon: "bg-blue-700 text-white",
      line: "bg-blue-500",
      value: "text-blue-800",
    },
  } as const;

  const toneClass = tones[tone];

  return (
    <div
      className={cls(
        "relative h-full min-h-[132px] overflow-hidden rounded-[1.15rem] border border-slate-200 bg-white p-4 shadow-2xl transition hover:border-slate-300",
        className,
      )}
    >
      <div className={cls("absolute inset-x-0 top-0 h-1", toneClass.line)} />
      <div className="flex h-full items-start gap-4">
        <div className={cls("grid h-10 w-10 shrink-0 place-items-center rounded-xl shadow-sm", toneClass.icon)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase leading-4 tracking-[0.18em] text-slate-500">
            {title}
          </div>
          <div className={cls("mt-2 break-words text-[clamp(1.55rem,2.4vw,2.15rem)] font-black leading-none tracking-tight", toneClass.value)}>
            {value}
          </div>
          {hint ? (
            <div className="mt-2 max-w-full break-words text-xs font-semibold leading-5 text-slate-500">
              {hint}
            </div>
          ) : null}
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

  return createPortal(
    <div
      className="fixed z-[99999] max-h-[min(680px,calc(100vh-2rem))] w-[min(460px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_24px_80px_rgba(15,23,42,0.24)] ring-1 ring-slate-900/5"
      style={{ top: coords.top, left: coords.left, width: Math.min(coords.width, 460) }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-950 text-white">
          <Info className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-black text-slate-950">¿Cómo se calculan los puntos?</div>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            Los puntos son acumulables dentro del rango seleccionado. Se suman por categoría mensual y por permanencia consecutiva en una misma categoría.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black text-slate-950">1. Puntos por categoría mensual</div>
            <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
              Cada cierre suma puntos según la categoría alcanzada.
            </div>
          </div>
          <div className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black text-white">
            {score.basePoints} pts
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {score.monthlyRules.map((rule) => {
            const earned = rule.earnedAvg > 0;

            return (
              <div
                key={rule.label}
                className={cls(
                  "rounded-xl px-2.5 py-2 ring-1 transition",
                  earned ? "bg-emerald-50/80 ring-emerald-200" : "bg-white ring-slate-200/80",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={cls("text-[10px] font-bold leading-4", earned ? "text-emerald-800" : "text-slate-500")}>
                    {rule.label}
                  </div>
                  {earned ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">
                      sumó
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs font-black text-slate-950">{rule.value}</div>
                <div className={cls("mt-0.5 text-[10px] font-bold", earned ? "text-emerald-700" : "text-slate-400")}>
                  {rule.detail} en el rango
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200/80">
          Promedio mensual: <span className="font-black text-slate-950">{monthlyAverage} pts</span>
          <div className="mt-1 text-[10px] leading-4 text-slate-500">
            Este promedio sirve como referencia; el saldo real son los puntos acumulados: <span className="font-black text-slate-900">{score.totalPoints} pts</span>.
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black text-slate-950">2. Bonos por permanencia</div>
            <div className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-500">
              Se agregan cuando el vendedor sostiene la misma categoría 3 y 6 meses seguidos. La opción implementada es acumulable y el ciclo se repite cada 6 meses: al llegar a 6 meses conserva el bono de 3 meses y suma el de 6.
            </div>
          </div>
          <div className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-200">
            +{score.permanencePoints} pts
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Senior</div>
            <div className="mt-1 text-xs font-black text-slate-900">3 meses +20</div>
            <div className="text-xs font-black text-slate-900">6 meses +40</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Semi Senior</div>
            <div className="mt-1 text-xs font-black text-slate-900">3 meses +10</div>
            <div className="text-xs font-black text-slate-900">6 meses +20</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Junior</div>
            <div className="mt-1 text-xs font-black text-slate-900">3 meses +5</div>
            <div className="text-xs font-black text-slate-900">6 meses +10</div>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-slate-950 p-3 text-white">
        <div className="text-xs font-black">Resultado del rango</div>
        <div className="mt-1 text-[11px] font-semibold leading-5 text-white/80">
          <span className="font-black text-white">{score.basePoints} pts</span> por categoría +
          <span className="font-black text-white"> {score.permanencePoints} pts</span> por permanencia =
          <span className="font-black text-white"> {score.totalPoints} pts acumulados</span>.
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-950">
        {score.nextBenefit
          ? `Próximo canje: ${score.nextBenefit.label}. Faltan ${score.nextBenefit.missing} pts.`
          : "El saldo alcanza todos los beneficios cargados en el catálogo."}
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
    const width = Math.min(420, window.innerWidth - 32);
    const wantedLeft = align === "right" ? rect.right - width : rect.left;
    const left = Math.max(16, Math.min(wantedLeft, window.innerWidth - width - 16));
    const estimatedHeight = Math.min(620, window.innerHeight - 32);
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
        {score.totalPoints}
      </span>
      <span className={cls("font-black text-slate-400", size === "lg" ? "pb-2 text-2xl" : "")}>pts</span>
      {open && coords ? <ScoreFormulaTooltip score={score} coords={coords} /> : null}
    </div>
  );
}

function RecognitionIndexTooltip({
  score,
  coords,
}: {
  score: HistoricalScore;
  coords: { top: number; left: number; width: number };
}) {
  const formula = `${score.totalPoints} / ${score.maxPossiblePoints || 0} × 100`;

  return createPortal(
    <div
      style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width, zIndex: 99999 }}
      className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Índice del vendedor</div>
          <div className="mt-1 text-lg font-black text-slate-950">{score.score}/100</div>
        </div>
        <div className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-black text-white">{formula}</div>
      </div>

      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
        El índice compara los puntos acumulados por el vendedor contra el máximo que podía obtener en el mismo rango seleccionado.
      </p>

      <div className="mt-4 grid gap-2 text-sm">
        <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
          <span className="font-semibold text-slate-600">Puntos obtenidos</span>
          <strong className="text-slate-950">{score.totalPoints} pts</strong>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
          <span className="font-semibold text-slate-600">Máximo posible del rango</span>
          <strong className="text-slate-950">{score.maxPossiblePoints} pts</strong>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
          <span className="font-semibold text-slate-600">Por categoría</span>
          <strong className="text-slate-950">{score.basePoints} pts</strong>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
          <span className="font-semibold text-slate-600">Bonos por permanencia</span>
          <strong className="text-slate-950">+{score.permanencePoints} pts</strong>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-950 p-3 text-xs font-bold leading-5 text-white">
        Cálculo: {score.totalPoints} / {score.maxPossiblePoints} × 100 = {score.score}/100.
      </div>
    </div>,
    document.body,
  );
}

function RecognitionIndexValue({ score }: { score: HistoricalScore | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  const updatePosition = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = Math.min(430, window.innerWidth - 32);
    const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
    const top = Math.min(rect.bottom + 12, window.innerHeight - 260);
    setCoords({ top: Math.max(16, top), left, width });
  };

  const show = () => {
    if (!score) return;
    updatePosition();
    setOpen(true);
  };

  const hide = () => setOpen(false);

  if (!score) {
    return (
      <div className="text-[clamp(3rem,7vw,5.2rem)] font-black leading-none tracking-[-0.08em] text-slate-950">
        Índice —
      </div>
    );
  }

  return (
    <div
      ref={ref}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="inline-flex cursor-help flex-col outline-none"
    >
      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Índice del vendedor</div>
      <div className="mt-2 text-[clamp(3.2rem,7vw,5.8rem)] font-black leading-none tracking-[-0.08em] text-slate-950">
        {score.score}<span className="text-[0.36em] text-slate-400">/100</span>
      </div>
      <div className="mt-3 w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-500">
        {score.totalPoints}/{score.maxPossiblePoints} pts del rango
      </div>
      {open && coords ? <RecognitionIndexTooltip score={score} coords={coords} /> : null}
    </div>
  );
}

function RecognitionIndexBadge({ score }: { score: HistoricalScore | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  const updatePosition = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = Math.min(430, window.innerWidth - 32);
    const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
    const top = Math.min(rect.bottom + 12, window.innerHeight - 260);
    setCoords({ top: Math.max(16, top), left, width });
  };

  const show = () => {
    if (!score) return;
    updatePosition();
    setOpen(true);
  };

  const hide = () => setOpen(false);

  return (
    <div
      ref={ref}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="cursor-help flex flex-col justify-end items-end rounded-2xl bg-white p-4 text-left outline-none transition"
    >
      <div className="mt-2 flex items-end justify-between gap-4">
        <div className="text-[clamp(2.4rem,5vw,4.1rem)] font-black leading-none tracking-[-0.08em] text-slate-950">
          {score ? score.score : "—"}<span className="text-[0.38em] text-slate-400">/100</span>
        </div>

      </div>
      <div className="mt-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-500">
        {score ? `${score.totalPoints}/${score.maxPossiblePoints} pts del rango` : "Sin puntos calculados"}
      </div>

      {open && coords && score ? <RecognitionIndexTooltip score={score} coords={coords} /> : null}
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
  const barColor = {
    emerald: "bg-emerald-600",
    blue: "bg-blue-600",
    amber: "bg-amber-500",
    red: "bg-red-600",
  } as const;

  return (
    <Panel className={cls("h-full overflow-visible", className)}>
      <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
              Puntos acumulados
            </div>
            <div className="mt-2 text-sm font-black text-slate-950">{score.label}</div>
          </div>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-white">
            <Award className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-end">
          <ScoreValue score={score} size="lg" />
          <div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
              <div className={cls("h-full rounded-full", barColor[score.tone])} style={{ width: `${score.score}%` }} />
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
              {score.description}
            </p>
            <div className="mt-2 text-xs font-black text-slate-400">
              Índice relativo del rango: {score.score}/100
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Por categoría</div>
            <div className="mt-1 text-lg font-black text-slate-950">{score.basePoints} pts</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Permanencia</div>
            <div className="mt-1 text-lg font-black text-slate-950">+{score.permanencePoints} pts</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Canjes</div>
            <div className="mt-1 text-lg font-black text-slate-950">{score.redeemableBenefits.length}</div>
          </div>
        </div>
      </div>
    </Panel>
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
      label: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      bar: "bg-emerald-600",
      icon: "bg-emerald-700 text-white",
    },
    medium: {
      label: "bg-amber-50 text-amber-700 ring-amber-200",
      bar: "bg-amber-500",
      icon: "bg-amber-600 text-white",
    },
    high: {
      label: "bg-red-50 text-red-700 ring-red-200",
      bar: "bg-red-600",
      icon: "bg-red-700 text-white",
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
    <Panel className={cls("h-full overflow-hidden", className)}>
      <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
              Plan de acción
            </div>
            <div className={cls("mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ring-1", tone.label)}>
              {assessment.label}
            </div>
          </div>
          <div className={cls("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tone.icon)}>
            {icon}
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-5 lg:grid-cols-[88px_minmax(0,1fr)] lg:items-center">
          <div className="text-center">
            <div className="mx-auto flex h-24 w-10 items-end overflow-hidden rounded-full bg-slate-100 p-1 ring-1 ring-slate-200">
              <div className={cls("w-full rounded-full", tone.bar)} style={{ height: `${Math.max(8, assessment.score)}%` }} />
            </div>
            <div className="mt-2 text-2xl font-black leading-none text-slate-950">{assessment.score}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[clamp(1.7rem,3vw,2.45rem)] font-black leading-tight tracking-[-0.04em] text-slate-950">
              {assessment.state}
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              {assessment.description}
            </p>
          </div>
        </div>

        {!compact ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                Señales principales
              </div>
              <ul className="mt-3 space-y-2 text-sm font-semibold leading-5 text-slate-600">
                {assessment.reasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <span className={cls("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", tone.bar)} />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                Próximo paso sugerido
              </div>
              <div className="mt-3 text-sm font-black leading-6 text-slate-800">
                {assessment.recommendation}
              </div>
            </div>
          </div>
        ) : null}

      </div>
    </Panel>
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
        <div className="text-sm font-black text-slate-950">Plan de acción comparado</div>
        <div className="mt-0.5 text-xs text-slate-500">
          Menor necesidad de acción: <span className="font-black text-slate-700">{better}</span>
        </div>
      </div>
      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <RiskTrafficLightCard assessment={riskA} compact className="min-h-[290px]" />
        <RiskTrafficLightCard assessment={riskB} compact className="min-h-[290px]" />
      </div>
    </Panel>
  );
}

function CategoryTrajectoryPanel({
  summary,
  recognition,
  className = "",
}: {
  summary: CategoriaHistorySummary;
  recognition?: HistoricalScore | null;
  className?: string;
}) {
  const current = summary.currentCategoria;
  const initial = summary.initialCategoria;
  const best = summary.bestCategoria;

  return (
    <Panel className={cls("h-full overflow-visible", className)}>
      <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
              Estado de categoría
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill categoria={current} />
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-500">
                {summary.months} meses revisados
              </span>
            </div>
          </div>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-white">
            <ChevronsUp className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.95fr)] lg:items-center">
          <div>
            <div className="text-[clamp(2rem,4vw,3.45rem)] font-black leading-[0.95] tracking-[-0.06em] text-slate-950">
              {summary.currentCategoriaLabel ?? "Sin datos"}
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
              Lectura de categoría alcanzada, mejor nivel observado y cambio frente al inicio del rango.
            </p>
          </div>

          <RecognitionIndexBadge score={recognition} />
        </div>

        <div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50/60">
          <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3">
            <span className="text-sm font-semibold text-slate-500">Categoría inicial</span>
            <span className="text-sm font-black text-slate-950">{initial ? CATEGORY_LABEL[initial] : "—"}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3">
            <span className="text-sm font-semibold text-slate-500">Categoría actual</span>
            <span className="text-sm font-black text-slate-950">{current ? CATEGORY_LABEL[current] : "—"}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3">
            <span className="text-sm font-semibold text-slate-500">Mejor categoría observada</span>
            <span className="text-sm font-black text-slate-950">{best ? CATEGORY_LABEL[best] : "—"}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3">
            <span className="text-sm font-semibold text-slate-500">Variación</span>
            <span className="text-sm font-black text-slate-950">{deltaLabel(summary.categoryDelta)}</span>
          </div>
        </div>
      </div>
    </Panel>
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
    <div className="rounded-[1.35rem] border border-dashed border-slate-300 bg-white p-8 text-center shadow-2xl">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-slate-950 text-white shadow-sm">
        <Search className="h-5 w-5" />
      </div>
      <div className="mt-4 text-base font-black text-slate-950">
        {title}
      </div>
      <div className="mx-auto mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
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
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-7 w-1 rounded-full bg-red-600" />
          <div className="min-w-0">
            <div className="text-sm font-black tracking-tight text-slate-950">{title}</div>
            {subtitle ? (
              <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">{subtitle}</div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="h-[320px] bg-white p-4">{children}</div>
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
  placeholder = "Buscar por vendedor o ID...",
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
  const [view, setView] = useState<"detail" | "points">("detail");
  const sortedHistory = useMemo(() => [...history].sort((a, b) => a.period.localeCompare(b.period)), [history]);
  const scoringRows = useMemo(
    () =>
      calculateRecognitionRows(
        sortedHistory.map((item): RecognitionAssignment => item.categoria),
        sortedHistory.map((item) => item.periodLabel),
      ),
    [sortedHistory],
  );

  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-black text-slate-950">{title}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              Revisá el detalle operativo o el puntaje acumulado del período.
            </div>
          </div>

          <div className="flex w-full rounded-2xl border border-slate-200 bg-white p-1 shadow-sm lg:w-auto">
            <button
              type="button"
              onClick={() => setView("detail")}
              className={cls(
                "flex-1 rounded-xl px-4 py-2 text-xs font-black transition lg:flex-none",
                view === "detail" ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              Detalle mensual
            </button>
            <button
              type="button"
              onClick={() => setView("points")}
              className={cls(
                "flex-1 rounded-xl px-4 py-2 text-xs font-black transition lg:flex-none",
                view === "points" ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              Puntaje del vendedor
            </button>
          </div>
        </div>
      </div>

      {view === "detail" ? (
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
              {sortedHistory.map((item) => (
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
      ) : (
        <div className="p-5">
          <RecognitionScoringTable rows={scoringRows} readOnly />
        </div>
      )}
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
      score: calculateHistoricalScore(entry.summary, entry.history)?.totalPoints ?? getSummaryScore(entry.summary),
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
    <div className="space-y-5">
      <Panel className="overflow-hidden">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
                ID {summary.sellerId}
              </span>
              <StatusPill categoria={summary.currentCategoria} />
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-500">
                {summary.firstPeriod} → {summary.lastPeriod}
              </span>
            </div>
            <h3 className="mt-3 truncate text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
              {selectedSeller?.name ?? summary.sellerName}
            </h3>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
              Resumen histórico del vendedor, con lectura de categoría, puntos de reconocimiento, plan de acción y desempeño comercial del período.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[440px]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Meses</div>
              <div className="mt-1 text-xl font-black text-slate-950">{summary.months}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Eficiencia</div>
              <div className="mt-1 text-xl font-black text-slate-950">{formatPercent(summary.avgEficiencia)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Efectividad</div>
              <div className="mt-1 text-xl font-black text-slate-950">{formatPercent(summary.avgEfectividad)}</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-4">
        <CategoryTrajectoryPanel summary={summary} recognition={historicalScore} className="xl:col-span-2" />
        {riskAssessment ? <RiskTrafficLightCard assessment={riskAssessment} className="xl:col-span-2" /> : null}
        {historicalScore ? <HistoricalScoreCard score={historicalScore} className="xl:col-span-4" /> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Variación"
          value={deltaLabel(summary.categoryDelta)}
          hint="Cambio de categoría en el período"
          icon={summary.improved === false ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
          tone={summary.improved === false ? "red" : summary.improved === true ? "green" : "blue"}
        />
        <KpiCard
          title="Mejor facturación"
          value={compactMoney(summary.bestFacturacion)}
          hint={summary.bestFacturacionPeriod ? `Mes ${summary.bestFacturacionPeriod}` : "Sin datos"}
          icon={<BarChart3 className="h-5 w-5" />}
          tone="slate"
        />
        <KpiCard
          title="Facturación promedio"
          value={compactMoney(summary.avgFacturacion)}
          hint="Promedio mensual del rango"
          icon={<CalendarRange className="h-5 w-5" />}
          tone="slate"
        />
        <KpiCard
          title="Eficiencia promedio"
          value={formatPercent(summary.avgEficiencia)}
          hint="Indicador operativo"
          icon={<LineChartIcon className="h-5 w-5" />}
          tone="slate"
        />
        <KpiCard
          title="Efectividad promedio"
          value={formatPercent(summary.avgEfectividad)}
          hint="Cierre sobre visitas"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="slate"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Eficiencia y efectividad" subtitle="Comparativa porcentual mes a mes.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
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

        <ChartCard title="Facturación mensual" subtitle="Facturación total y promedio de facturación diaria.">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(value) => compactMoney(Number(value))} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="facturacion" name="Facturación" radius={[4, 4, 0, 0]} fill="#0f172a" />
              <Line type="monotone" dataKey="facturacionPromedio" name="Promedio diario" stroke="#b91c1c" strokeWidth={3} dot={{ r: 4 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Evolución de categoría" subtitle="Escala: Mejora 0 · Junior 1 · Semi 2 · Senior 3.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(value) => CATEGORY_TICKS[value] ?? value} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line type="stepAfter" dataKey="categoriaRank" name="Categoría alcanzada" stroke="#0f172a" strokeWidth={3} dot={{ r: 5 }} />
              <Line type="stepAfter" dataKey="proyeccionRank" name="Proyección" stroke="#b91c1c" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 4 }} />
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
              <Bar dataKey="totalVentas" name="Ventas" fill="#0f172a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="volumen" name="Volumen" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cobertura" name="Cobertura" fill="#10b981" radius={[4, 4, 0, 0]} />
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
                  <stop offset="5%" stopColor="#0f172a" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#0f172a" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(value) => `${Number(value).toFixed(1)}h`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="horasRutaHours" name="Horas ruta" stroke="#0f172a" strokeWidth={3} fill="url(#rutaGradient)" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <LastMonthPanel history={history} />
      </div>

      <HistoryTable history={history} />
    </div>
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
    .sort((a, b) => (b.score?.totalPoints ?? 0) - (a.score?.totalPoints ?? 0));

  return (
    <Panel className="overflow-visible">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="text-sm font-black text-slate-950">Puntos comparados</div>
        <div className="mt-0.5 text-xs text-slate-500">
          Pasá el mouse sobre cada saldo para ver de dónde salen los puntos.
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
                {getMultiWinnerLabel(entries)}. Esta lectura permite comparar de 2 a {MAX_COMPARE_SELLERS} vendedores con la misma escala de puntos, necesidad de acción, categoría, eficiencia, efectividad y facturación.
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
            hint="Podés agregar o quitar vendedores para ampliar la comparación"
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
          <div className="text-sm font-black text-slate-950">Plan de acción comparado</div>
          <div className="mt-0.5 text-xs text-slate-500">
            Cuanto menor la necesidad de acción, más sostenible se ve el vendedor en el rango seleccionado.
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
      const sortScore = score?.totalPoints ?? 0;
      return { ...item, score, risk, sortScore };
    });

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "risk") {
      const ar = a.risk?.score ?? 999;
      const br = b.risk?.score ?? 999;
      if (ar !== br) return ar - br;
      return (b.score?.totalPoints ?? 0) - (a.score?.totalPoints ?? 0);
    }

    if (sortBy === "billing") {
      const av = a.summary.avgFacturacion ?? 0;
      const bv = b.summary.avgFacturacion ?? 0;
      if (av !== bv) return bv - av;
      return (b.score?.totalPoints ?? 0) - (a.score?.totalPoints ?? 0);
    }

    if (sortBy === "category") {
      const av = a.summary.currentCategoria ? CATEGORIA_RANK[a.summary.currentCategoria] : 0;
      const bv = b.summary.currentCategoria ? CATEGORIA_RANK[b.summary.currentCategoria] : 0;
      if (av !== bv) return bv - av;
      return (b.score?.totalPoints ?? 0) - (a.score?.totalPoints ?? 0);
    }

    if (sortBy === "variation") {
      const av = a.summary.categoryDelta ?? -99;
      const bv = b.summary.categoryDelta ?? -99;
      if (av !== bv) return bv - av;
      return (b.score?.totalPoints ?? 0) - (a.score?.totalPoints ?? 0);
    }

    if ((b.score?.totalPoints ?? 0) !== (a.score?.totalPoints ?? 0)) {
      return (b.score?.totalPoints ?? 0) - (a.score?.totalPoints ?? 0);
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
        const monthlyScores = points.map((point) => RECOGNITION_CATEGORY_POINTS[point.categoria] ?? 0);

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
      ? [...group.sellerRows].sort((a, b) => (b.score?.totalPoints ?? 0) - (a.score?.totalPoints ?? 0))[0]
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
    planAccion: row.avgRisk ?? null,
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
          hint={topSupervisor ? `${formatNumber(topSupervisor.avgScore, 1)} pts/mes · ${topSupervisor.sellersCount} vendedores` : "Sin datos"}
          icon={<Award className="h-5 w-5" />}
          tone="slate"
          className="xl:col-span-1"
        />
        <KpiCard
          title="Promedio de puntos"
          value={avgScore === null ? "—" : `${Math.round(avgScore)} pts`}
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
          title="Mesa con más planes"
          value={highestRisk?.supervisor ?? "—"}
          hint={highestRisk ? `Necesidad prom. ${formatNumber(highestRisk.avgRisk, 1)}/100` : "Sin datos"}
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
                Esta vista agrupa los vendedores por supervisor y muestra qué mesa sostiene mejor rendimiento, facturación y necesidad de plan de acción.
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
                  <span className="text-xs font-black text-slate-400">{formatNumber(row.avgScore, 1)} pts/mes</span>
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
        <ChartCard title="Puntos por mesa" subtitle="Puntos promedio por mesa según categoría mensual y permanencia.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scoreChartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="supervisor" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={0} angle={-8} textAnchor="end" height={55} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="score" name="Puntos mesa" fill="#0f172a" radius={[10, 10, 0, 0]} />
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
        <ChartCard title="Evolución mensual de puntos" subtitle="Permite detectar si una mesa viene mejorando o cayendo mes a mes.">
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
          <div className="mt-0.5 text-xs text-slate-500">Ordenado de mayor a menor promedio mensual de puntos.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-black">#</th>
                <th className="px-4 py-3 font-black">Mesa</th>
                <th className="px-4 py-3 font-black">Puntos mesa</th>
                <th className="px-4 py-3 font-black">Vendedores</th>
                <th className="px-4 py-3 font-black">Plan de acción</th>
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
  const avgScore = rows.length ? rows.reduce((acc, row) => acc + (row.score?.totalPoints ?? 0), 0) / rows.length : null;
  const bestBilling = rows.reduce<RankingRow | null>((best, row) => {
    if (row.summary.avgFacturacion === null) return best;
    if (!best || (best.summary.avgFacturacion ?? 0) < row.summary.avgFacturacion) return row;
    return best;
  }, null);

  const billingLeaders = rows
    .filter((row) => row.summary.avgFacturacion !== null)
    .sort((a, b) => (b.summary.avgFacturacion ?? 0) - (a.summary.avgFacturacion ?? 0))
    .slice(0, 5);

  const scoreChartData = topTen.map((row, index) => ({
    rank: `#${index + 1}`,
    label: `ID ${row.sellerId}`,
    vendedor: row.sellerName,
    score: row.score?.totalPoints ?? 0,
    planAccion: row.risk?.score ?? null,
    facturacion: row.summary.avgFacturacion,
  }));

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          className="xl:col-span-1"
          title="Mejor rendimiento"
          value={topSeller ? `ID ${topSeller.sellerId}` : "—"}
          hint={topSeller ? `${topSeller.sellerName} · ${topSeller.score?.totalPoints ?? 0} pts` : "Sin datos"}
          icon={<Award className="h-5 w-5" />}
          tone="slate"
        />
        <KpiCard
          title="Promedio de puntos"
          value={avgScore === null ? "—" : `${Math.round(avgScore)} pts`}
          hint={`${rows.length} vendedores evaluados`}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="slate"
        />
        <KpiCard
          title="Sin plan"
          value={lowRiskCount}
          hint="Vendedores con señales sanas"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="slate"
        />
        <KpiCard
          title="Con plan"
          value={highRiskCount}
          hint="Requieren revisión prioritaria"
          icon={<AlertCircle className="h-5 w-5" />}
          tone={highRiskCount > 0 ? "red" : "slate"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Top 10 por puntos acumulados" subtitle="Puntos acumulados por categoría mensual y permanencia.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scoreChartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="score" name="Puntos" fill="#0f172a" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Puntos vs plan de acción" subtitle="Cuanto más puntos y menor necesidad de acción, más sostenible es el desempeño histórico.">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={scoreChartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar yAxisId="left" dataKey="score" name="Puntos" fill="#2563eb" radius={[10, 10, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="planAccion" name="Plan" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
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
                  <div className="text-lg font-black text-slate-950">{row.score?.totalPoints ?? 0}</div>
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">pts</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="overflow-hidden p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Mayor facturación prom.</div>
              <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                {bestBilling ? `ID ${bestBilling.sellerId}` : "Sin datos"}
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                {bestBilling
                  ? `${bestBilling.sellerName} lidera por facturación promedio mensual en el rango seleccionado.`
                  : "No hay datos de facturación para comparar en este rango."}
              </p>
            </div>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
              <BarChart3 className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {billingLeaders.map((row, index) => (
              <div key={row.sellerId} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-xs font-black text-slate-700 ring-1 ring-slate-200">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-950">ID {row.sellerId}</div>
                  <div className="truncate text-xs font-semibold text-slate-500">{row.sellerName}</div>
                </div>
                <div className="shrink-0 text-right text-sm font-black text-slate-950">
                  {compactMoney(row.summary.avgFacturacion)}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="text-sm font-black text-slate-950">Ranking general de vendedores</div>
          <div className="mt-0.5 text-xs text-slate-500">
            Ordenado por puntos acumulados. El cálculo combina categoría mensual y bonos de permanencia acumulables.
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-black">#</th>
                <th className="px-4 py-3 font-black">Vendedor</th>
                <th className="px-4 py-3 font-black">Puntos</th>
                <th className="px-4 py-3 font-black">Plan</th>
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
                        <span className="font-black text-slate-950">0 pts</span>
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
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[#f6f8fb] shadow-[0_22px_70px_rgba(15,23,42,0.10)]">
        <div className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div className="absolute inset-y-0 left-0 w-2 bg-red-600" />
          <div className="absolute right-0 top-0 h-full w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(15,23,42,0.08),transparent_55%)]" />
          <div className="relative px-6 py-7 md:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full border-slate-300 bg-white text-[11px] font-black uppercase tracking-[0.22em] text-slate-600">
                    Centro histórico
                  </Badge>
                  <Badge variant="secondary" className="rounded-full bg-slate-950 text-xs font-black text-white hover:bg-slate-950">
                    {BRANCH_LABELS[branchKey] ?? branchKey}
                  </Badge>
                </div>
                <h2 className="mt-4 text-[clamp(2rem,4vw,3.8rem)] font-black leading-[0.95] tracking-[-0.06em] text-slate-950">
                  Rendimiento comercial histórico
                </h2>
                <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-500 md:text-base">
                  Un tablero de lectura ejecutiva para revisar evolución individual, comparaciones, ranking y mesas de supervisión.
                </p>
              </div>
              <div className="grid min-w-[240px] gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Rango disponible</div>
                <div className="text-lg font-black text-slate-950">{periods[0]?.value ?? "—"} → {periods[periods.length - 1]?.value ?? "—"}</div>
                <div className="text-xs font-semibold text-slate-500">{sellers.length} vendedores cargados</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5 md:p-6">
          <div className="rounded-[1.35rem] border border-slate-300 bg-white p-2">
            <Tabs value={mode} onValueChange={(value) => setMode(value as HistoryMode)} className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 lg:grid-cols-4">
                <TabsTrigger value="single" className="justify-start rounded-2xl px-4 py-3 text-sm font-black text-slate-500 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none">
                  <UserRound className="mr-2 h-4 w-4" /> Individual
                </TabsTrigger>
                <TabsTrigger value="compare" className="justify-start rounded-2xl px-4 py-3 text-sm font-black text-slate-500 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none">
                  <Users className="mr-2 h-4 w-4" /> Comparar
                </TabsTrigger>
                <TabsTrigger value="ranking" className="justify-start rounded-2xl px-4 py-3 text-sm font-black text-slate-500 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none">
                  <ListOrdered className="mr-2 h-4 w-4" /> Ranking
                </TabsTrigger>
                <TabsTrigger value="supervisors" className="justify-start rounded-2xl px-4 py-3 text-sm font-black text-slate-500 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none">
                  <ShieldCheck className="mr-2 h-4 w-4" /> Supervisores
                </TabsTrigger>
              </TabsList>
            </Tabs>
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
                  <option value="risk">Menor acción</option>
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
                Resumen agrupado por supervisor durante el período seleccionado.
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
                    Seleccioná al menos 2 vendedores. Podés agregar hasta {MAX_COMPARE_SELLERS} para comparar mejor.
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
                      label="Seleccionar vendedor"
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando datos históricos...
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
              title="Todavía no hay meses cerrados para esta sucursal"
              description="Cuando existan cierres mensuales, esta sección va a mostrar la evolución histórica."
            />
          ) : null}

          {!metaLoading && mode === "single" && periods.length > 0 && !sellerId ? (
            <EmptyState
              title="Seleccioná un vendedor"
              description="Elegí un vendedor para ver indicadores, cambios de categoría y detalle mensual."
            />
          ) : null}

          {mode === "compare" && periods.length > 0 && validCompareSellerIds.length < 2 ? (
            <EmptyState
              title="Seleccioná al menos dos vendedores"
              description="Seleccioná al menos dos vendedores distintos para comparar su evolución."
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
              description="El vendedor existe en el historial, pero no tiene datos en el rango seleccionado. Probá ampliando el período."
            />
          ) : null}

          {!historyLoading && mode === "compare" && validCompareSellerIds.length >= 2 && !hasDuplicateCompareIds && periods.length > 0 && !hasCompareData && !error ? (
            <EmptyState
              title="Sin datos suficientes para comparar"
              description="Uno o más vendedores no tienen datos en el rango seleccionado. Probá ampliando el período o cambiando la selección."
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
              description="No hay datos suficientes por supervisor dentro del rango seleccionado. Probá ampliando el período."
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
      </div>
    </section>
  );
}
