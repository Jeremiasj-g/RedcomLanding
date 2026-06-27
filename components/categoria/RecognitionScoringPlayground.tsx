"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Gift, RotateCcw, Trophy, Wand2 } from "lucide-react";
import { CATEGORIA_ACCENTS, type CategoriaKey } from "@/utils/categories";
import { cn } from "@/lib/utils";

const DEFAULT_STORAGE_KEY = "redcom-scoring-playground-v2";

export const RECOGNITION_MONTHS = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
];

export type RecognitionCategoryConfig = {
  key: CategoriaKey;
  id: string;
  label: string;
  shortLabel: string;
  monthlyPoints: number;
  bonus3: number;
  bonus6: number;
  accent: string;
  icon: string;
};

export const RECOGNITION_CATEGORIES: RecognitionCategoryConfig[] = [
  {
    key: "SENIOR",
    id: "senior",
    label: "Senior",
    shortLabel: "Senior",
    monthlyPoints: 20,
    bonus3: 20,
    bonus6: 40,
    accent: CATEGORIA_ACCENTS.SENIOR,
    icon: "↗",
  },
  {
    key: "SEMI_SENIOR",
    id: "semi-senior",
    label: "Semi Senior",
    shortLabel: "Semi",
    monthlyPoints: 12,
    bonus3: 10,
    bonus6: 20,
    accent: CATEGORIA_ACCENTS.SEMI_SENIOR,
    icon: "★",
  },
  {
    key: "JUNIOR",
    id: "junior",
    label: "Junior",
    shortLabel: "Junior",
    monthlyPoints: 5,
    bonus3: 5,
    bonus6: 10,
    accent: CATEGORIA_ACCENTS.JUNIOR,
    icon: "●",
  },
  {
    key: "PLAN_MEJORA",
    id: "plan-mejora",
    label: "Plan de Mejora",
    shortLabel: "Mejora",
    monthlyPoints: 0,
    bonus3: 0,
    bonus6: 0,
    accent: CATEGORIA_ACCENTS.PLAN_MEJORA,
    icon: "↘",
  },
];

export const RECOGNITION_BENEFITS = [
  { name: "Vale de combustible $10.000", points: 20 },
  { name: "Vale de combustible $20.000", points: 30 },
  { name: "Uniforme", points: 80 },
  { name: "Service de moto", points: 150 },
  { name: "Mochila de trabajo", points: 180 },
  { name: "Casco homologado", points: 250 },
  { name: "Cubierta de moto", points: 350 },
];

export type RecognitionAssignment = CategoriaKey | null;

type Assignment = RecognitionAssignment;

export type RecognitionRow = {
  index: number;
  month: string;
  category: RecognitionCategoryConfig | null;
  base: number;
  bonus: number;
  bonusReason: string;
  streak: number;
  monthTotal: number;
  accumulated: number;
};

function getCategoryByKey(key: CategoriaKey | null | undefined) {
  if (!key) return null;
  return RECOGNITION_CATEGORIES.find((category) => category.key === key) ?? null;
}

function getCategoryById(id: string | null | undefined) {
  if (!id) return null;
  return RECOGNITION_CATEGORIES.find((category) => category.id === id) ?? null;
}

function normalizeStoredAssignments(value: unknown): Assignment[] | null {
  if (!Array.isArray(value) || value.length !== RECOGNITION_MONTHS.length) return null;
  return value.map((item) => {
    const byKey = RECOGNITION_CATEGORIES.find((category) => category.key === item);
    if (byKey) return byKey.key;
    const byId = RECOGNITION_CATEGORIES.find((category) => category.id === item);
    if (byId) return byId.key;
    return null;
  });
}

export function calculateRecognitionRows(assignments: Assignment[], monthLabels: string[] = RECOGNITION_MONTHS): RecognitionRow[] {
  let previousCategory: CategoriaKey | null = null;
  let streak = 0;
  let accumulated = 0;

  return assignments.map((categoryKey, index) => {
    const category = getCategoryByKey(categoryKey);
    let base = 0;
    let bonus = 0;
    let bonusReason = "";
    let currentStreak = 0;

    if (category) {
      base = category.monthlyPoints;

      if (category.key === previousCategory) {
        streak += 1;
      } else {
        previousCategory = category.key;
        streak = 1;
      }

      currentStreak = streak;
      const semesterPosition = streak % 6;

      if (semesterPosition === 3) {
        bonus = category.bonus3;
        bonusReason = bonus > 0 ? "Bono 3 meses" : "";
      }

      if (semesterPosition === 0) {
        bonus = category.bonus6;
        bonusReason = bonus > 0 ? "Bono 6 meses" : "";
      }
    } else {
      previousCategory = null;
      streak = 0;
    }

    const monthTotal = base + bonus;
    accumulated += monthTotal;

    return {
      index,
      month: monthLabels[index] ?? RECOGNITION_MONTHS[index] ?? `Mes ${index + 1}`,
      category,
      base,
      bonus,
      bonusReason,
      streak: currentStreak,
      monthTotal,
      accumulated,
    };
  });
}

function getAnnualMaximum() {
  const rows = calculateRecognitionRows(Array.from({ length: RECOGNITION_MONTHS.length }, (): Assignment => "SENIOR"));
  return rows[rows.length - 1]?.accumulated ?? 360;
}

function CategoryTile({ category, compact = false, ghost = false }: { category: RecognitionCategoryConfig; compact?: boolean; ghost?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 shadow-md transition hover:-translate-y-0.5 hover:shadow-xl",
        compact && "rounded-xl px-3 py-2 shadow-none hover:translate-y-0 hover:shadow-none",
        ghost && "w-[230px] rotate-[-2deg] shadow-2xl",
      )}
      style={{ borderColor: `${category.accent}66` }}
    >
      <span
        className={cn(
          "min-w-0 truncate rounded-full px-3 py-1.5 text-xs font-black leading-none text-white",
          compact && "px-2.5 py-1 text-[11px]",
        )}
        style={{ backgroundColor: category.accent }}
      >
        {category.label}
      </span>
      <span className="shrink-0 rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black text-white">
        +{category.monthlyPoints}
      </span>
    </div>
  );
}

function DraggableCategory({ category }: { category: RecognitionCategoryConfig }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `category-${category.id}`,
    data: {
      type: "category",
      categoryId: category.id,
    },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn("w-full cursor-grab touch-none border-0 bg-transparent p-0 text-left active:cursor-grabbing", isDragging && "opacity-70")}
      {...listeners}
      {...attributes}
    >
      <CategoryTile category={category} />
    </button>
  );
}

function MonthDropCell({ row, onClear }: { row: RecognitionRow; onClear: (index: number) => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `month-${row.index}`,
    data: {
      type: "month",
      monthIndex: row.index,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[56px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-2 py-2 transition",
        isOver && "border-red-300 bg-red-50 ring-2 ring-red-100",
      )}
    >
      {row.category ? (
        <div className="flex w-full items-center gap-2">
          <CategoryTile category={row.category} compact />
          <button
            type="button"
            onClick={() => onClear(row.index)}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-950 text-sm font-black text-white transition hover:bg-red-600"
            aria-label={`Quitar categoría de ${row.month}`}
            title={`Quitar categoría de ${row.month}`}
          >
            ×
          </button>
        </div>
      ) : (
        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Arrastrá acá</span>
      )}
    </div>
  );
}

function ReadOnlyCategoryCell({ row }: { row: RecognitionRow }) {
  if (!row.category) {
    return (
      <div className="flex min-h-[56px] items-center rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Sin categoría</span>
      </div>
    );
  }

  return <CategoryTile category={row.category} compact />;
}

function ScoreTableRow({
  row,
  onClear,
  readOnly = false,
}: {
  row: RecognitionRow;
  onClear?: (index: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="grid min-w-[920px] grid-cols-[92px_minmax(280px,1fr)_88px_100px_112px_112px] items-stretch border-b border-slate-200 last:border-b-0">
      <div className="grid place-items-center bg-white px-3 py-2 text-xs font-black text-slate-950">{row.month}</div>
      <div className="border-l border-slate-200 px-2 py-2">
        {readOnly ? <ReadOnlyCategoryCell row={row} /> : <MonthDropCell row={row} onClear={onClear ?? (() => undefined)} />}
      </div>
      <ScoreCell value={row.base} />
      <ScoreCell value={row.bonus > 0 ? `+${row.bonus}` : 0} hint={row.bonusReason} active={row.bonus > 0} />
      <ScoreCell value={row.monthTotal} strong />
      <ScoreCell value={row.accumulated} strong accent />
    </div>
  );
}

export function RecognitionScoringTable({
  rows,
  onClear,
  readOnly = false,
  className = "",
}: {
  rows: RecognitionRow[];
  onClear?: (index: number) => void;
  readOnly?: boolean;
  className?: string;
}) {
  const total = rows[rows.length - 1]?.accumulated ?? 0;

  return (
    <div className={cn("w-full overflow-x-auto rounded-2xl border border-slate-200 shadow-2xl", className)}>
      <div className="grid min-w-[920px] grid-cols-[92px_minmax(280px,1fr)_88px_100px_112px_112px] bg-slate-950 text-[10px] font-black uppercase tracking-[0.16em] text-white">
        <div className="px-3 py-3">Mes</div>
        <div className="border-l border-white/10 px-3 py-3">Categoría</div>
        <div className="border-l border-white/10 px-3 py-3 text-center">Base</div>
        <div className="border-l border-white/10 px-3 py-3 text-center">Bono</div>
        <div className="border-l border-white/10 px-3 py-3 text-center">Total mes</div>
        <div className="border-l border-white/10 px-3 py-3 text-center">Acum.</div>
      </div>
      {rows.map((row) => (
        <ScoreTableRow key={`${row.month}-${row.index}`} row={row} readOnly={readOnly} onClear={onClear} />
      ))}
      <div className="grid min-w-[920px] grid-cols-[1fr_224px] bg-slate-950 text-white">
        <div className="px-4 py-4 text-xs font-black uppercase tracking-[0.16em]">Total puntos</div>
        <div className="border-l border-white/10 px-4 py-4 text-center text-3xl font-black text-yellow-300">{total}</div>
      </div>
    </div>
  );
}

function ScoreCell({ value, hint, active, strong, accent }: { value: React.ReactNode; hint?: string; active?: boolean; strong?: boolean; accent?: boolean }) {
  return (
    <div className={cn("grid place-items-center border-l border-slate-200 px-2 py-2 text-center", active && "bg-emerald-50", accent && "bg-red-50/60")}>
      <div className={cn("text-sm font-black", strong ? "text-slate-950" : "text-slate-800", accent && "text-red-600")}>{value}</div>
      {hint ? <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">{hint}</div> : null}
    </div>
  );
}

function BenefitList({ total }: { total: number }) {
  const unlocked = RECOGNITION_BENEFITS.filter((benefit) => total >= benefit.points);
  const next = RECOGNITION_BENEFITS.find((benefit) => total < benefit.points);

  return (
    <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Canjes disponibles</div>
          <div className="mt-1 text-2xl font-black text-slate-950">{unlocked.length}</div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white">
          <Gift className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
        {RECOGNITION_BENEFITS.map((benefit) => {
          const isUnlocked = total >= benefit.points;
          return (
            <div key={benefit.name} className={cn("grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-sm", isUnlocked ? "bg-emerald-50/80" : "bg-white")}>
              <span className={cn("font-semibold", isUnlocked ? "text-slate-950" : "text-slate-500")}>{benefit.name}</span>
              <span className={cn("font-black", isUnlocked ? "text-emerald-700" : "text-slate-500")}>{benefit.points} pts</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl bg-slate-950 p-3 text-xs font-semibold leading-5 text-white">
        {next ? (
          <>
            Próximo canje: <strong>{next.name}</strong>. Faltan <strong>{next.points - total} pts</strong>.
          </>
        ) : (
          "Ya alcanza todos los beneficios configurados."
        )}
      </div>
    </div>
  );
}

export function RecognitionScoringPlayground({
  className = "",
  storageKey = DEFAULT_STORAGE_KEY,
  title = "Simulador de puntos",
  description = "Arrastrá una categoría a cada mes para ver cómo se acumulan puntos, bonos por permanencia y canjes disponibles.",
}: {
  className?: string;
  storageKey?: string;
  title?: string;
  description?: string;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>(() => Array.from({ length: RECOGNITION_MONTHS.length }, (): Assignment => null));
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      const next = normalizeStoredAssignments(stored);
      if (next) setAssignments(next);
    } catch {
      // localStorage puede venir vacío o con formato viejo.
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(assignments));
    } catch {
      // No bloquea el uso del simulador.
    }
  }, [assignments, storageKey]);

  const rows = useMemo(() => calculateRecognitionRows(assignments), [assignments]);
  const total = rows[rows.length - 1]?.accumulated ?? 0;
  const max = getAnnualMaximum();
  const progress = Math.min(100, Math.round((total / max) * 100));
  const activeCategory = getCategoryById(activeCategoryId);

  const setPreset = (preset: Assignment[]) => setAssignments(preset);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => setActiveCategoryId(event.active.data.current?.categoryId ?? null)}
      onDragEnd={(event) => {
        const categoryId = event.active.data.current?.categoryId;
        const category = getCategoryById(categoryId);
        const dropData = event.over?.data.current;

        if (category && dropData?.type === "month") {
          setAssignments((current) => {
            const next = [...current];
            next[dropData.monthIndex] = category.key;
            return next;
          });
        }

        setActiveCategoryId(null);
      }}
      onDragCancel={() => setActiveCategoryId(null)}
    >
      <section className={cn("rounded-[1.6rem] border border-slate-200 bg-white shadow-2xl", className)}>
        <div className="grid gap-5 border-b border-slate-200 p-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-red-700">
              <Wand2 className="h-3.5 w-3.5" />
              Playground interactivo
            </div>
            <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">{title}</h3>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">{description}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-2xl">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Total simulado</div>
            <div className="mt-1 text-4xl font-black leading-none text-slate-950">{total}<span className="text-lg text-slate-400"> pts</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
              <div className="h-full rounded-full bg-red-600" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 text-xs font-bold text-slate-500">{progress}% del máximo anual de {max} pts</div>
          </div>
        </div>

        <div className="grid gap-5 p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
            <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Categorías</div>
                  <div className="mt-1 text-sm font-bold text-slate-950">Arrastrá una categoría a cada mes</div>
                </div>
                <Trophy className="h-5 w-5 text-red-600" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {RECOGNITION_CATEGORIES.map((category) => (
                  <DraggableCategory key={category.key} category={category} />
                ))}
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4 shadow-2xl">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Regla confirmada</div>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                Cada 6 meses se reinicia el ciclo de permanencia: en el mes 3 se suma el bono de 3 meses y en el mes 6 el bono de 6 meses.
              </p>
              <div className="mt-3 rounded-2xl bg-white p-3 text-xs font-bold leading-5 text-slate-600 ring-1 ring-slate-200">
                Senior anual: 20×12 + 20 + 40 + 20 + 40 = <strong className="text-slate-950">360 pts</strong>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPreset(Array.from({ length: RECOGNITION_MONTHS.length }, (_, index): Assignment => (index < 6 ? "SENIOR" : null)))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50">
              Senior 6 meses
            </button>
            <button type="button" onClick={() => setPreset(Array.from({ length: RECOGNITION_MONTHS.length }, (): Assignment => "SENIOR"))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50">
              Máximo 360
            </button>
            <button type="button" onClick={() => setPreset(["JUNIOR", "JUNIOR", "JUNIOR", "SEMI_SENIOR", "SEMI_SENIOR", "SEMI_SENIOR", "SENIOR", "SENIOR", "SENIOR", "SENIOR", "SENIOR", "SENIOR"] as Assignment[])} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50">
              Ejemplo evolución
            </button>
            <button type="button" onClick={() => setPreset(Array.from({ length: RECOGNITION_MONTHS.length }, (): Assignment => null))} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-red-600">
              <RotateCcw className="h-3.5 w-3.5" />
              Limpiar
            </button>
          </div>

          <RecognitionScoringTable rows={rows} onClear={(index) => setAssignments((current) => current.map((value, i) => (i === index ? null : value)))} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
            <BenefitList total={total} />
            <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-2xl">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Lectura del resultado</div>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                La tabla muestra el detalle completo: puntos base del mes, bono por permanencia, total mensual y acumulado. Usala para simular escenarios antes de definir un canje o explicar el programa a un vendedor.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Base</div>
                  <div className="mt-1 text-lg font-black text-slate-950">Categoría mensual</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Bono</div>
                  <div className="mt-1 text-lg font-black text-slate-950">3 y 6 meses</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Acumulado</div>
                  <div className="mt-1 text-lg font-black text-slate-950">Saldo para canje</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DragOverlay dropAnimation={null}>{activeCategory ? <CategoryTile category={activeCategory} ghost /> : null}</DragOverlay>
    </DndContext>
  );
}

export default RecognitionScoringPlayground;
