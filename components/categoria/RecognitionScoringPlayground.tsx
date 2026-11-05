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
        "flex min-w-0 items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm transition-all duration-200 hover:shadow-sm",
        compact && "rounded-xl px-3 py-2 shadow-none hover:translate-y-0 hover:shadow-none",
        ghost && "w-[230px] rotate-[-2deg] shadow-[0_8px_30px_rgba(15,23,42,0.05)]",
      )}
      style={{ borderColor: `${category.accent}66` }}
    >
      <span
        className={cn(
          "min-w-0 truncate rounded-lg px-2.5 py-1.5 text-xs font-medium leading-none text-white",
          compact && "px-2.5 py-1 text-[11px]",
        )}
        style={{ backgroundColor: category.accent }}
      >
        {category.label}
      </span>
      <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
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
        isOver && "border-emerald-400 bg-emerald-50",
      )}
    >
      {row.category ? (
        <div className="flex w-full items-center gap-2">
          <CategoryTile category={row.category} compact />
          <button
            type="button"
            onClick={() => onClear(row.index)}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
            aria-label={`Quitar categoría de ${row.month}`}
            title={`Quitar categoría de ${row.month}`}
          >
            ×
          </button>
        </div>
      ) : (
        <span className="text-xs font-medium text-slate-400">Arrastrá acá</span>
      )}
    </div>
  );
}

function ReadOnlyCategoryCell({ row }: { row: RecognitionRow }) {
  if (!row.category) {
    return (
      <div className="flex min-h-[56px] items-center rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
        <span className="text-xs font-medium text-slate-400">Sin categoría</span>
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
    <div className="grid min-w-[840px] grid-cols-[72px_minmax(240px,1fr)_76px_88px_100px_100px] items-stretch border-b border-slate-100 last:border-b-0">
      <div className="grid place-items-center bg-white px-3 py-2 text-xs font-semibold text-slate-950">{row.month}</div>
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
    <div className={cn("w-full overflow-x-auto rounded-2xl border border-slate-200", className)}>
      <div className="grid min-w-[840px] grid-cols-[72px_minmax(240px,1fr)_76px_88px_100px_100px] bg-slate-50 text-xs font-medium text-slate-500">
        <div className="px-3 py-3">Mes</div>
        <div className="border-l border-slate-100 px-3 py-3">Categoría</div>
        <div className="border-l border-white/10 px-3 py-3 text-center">Base</div>
        <div className="border-l border-white/10 px-3 py-3 text-center">Bono</div>
        <div className="border-l border-white/10 px-3 py-3 text-center">Total mes</div>
        <div className="border-l border-white/10 px-3 py-3 text-center">Acum.</div>
      </div>
      {rows.map((row) => (
        <ScoreTableRow key={`${row.month}-${row.index}`} row={row} readOnly={readOnly} onClear={onClear} />
      ))}
      <div className="grid min-w-[840px] grid-cols-[1fr_200px] bg-slate-50 text-slate-900">
        <div className="px-4 py-4 text-xs font-medium">Total puntos</div>
        <div className="border-l border-white/10 px-4 py-4 text-center text-2xl font-semibold text-slate-900">{total}</div>
      </div>
    </div>
  );
}

function ScoreCell({ value, hint, active, strong, accent }: { value: React.ReactNode; hint?: string; active?: boolean; strong?: boolean; accent?: boolean }) {
  return (
    <div className={cn("grid place-items-center border-l border-slate-200 px-2 py-2 text-center", active && "bg-emerald-50", accent && "bg-red-50/60")}>
      <div className={cn("text-sm font-semibold", strong ? "text-slate-950" : "text-slate-800", accent && "text-red-600")}>{value}</div>
      {hint ? <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-700">{hint}</div> : null}
    </div>
  );
}

function BenefitList({ total }: { total: number }) {
  const unlocked = RECOGNITION_BENEFITS.filter((benefit) => total >= benefit.points);
  const next = RECOGNITION_BENEFITS.find((benefit) => total < benefit.points);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold tracking-tight text-slate-900">Canjes disponibles</h4>
          <p className="mt-1 text-sm text-slate-500">Beneficios que podrías conseguir con tus puntos.</p>
        </div>
        <div className="text-sm text-slate-600"><strong className="text-2xl font-semibold text-slate-900">{unlocked.length}</strong> de {RECOGNITION_BENEFITS.length}</div>
      </div>
      <div className="mt-4 divide-y divide-slate-100">
        {RECOGNITION_BENEFITS.map((benefit) => {
          const isUnlocked=total>=benefit.points;
          return <div key={benefit.name} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn('h-2 w-2 shrink-0 rounded-full',isUnlocked?'bg-emerald-500':'bg-slate-200')}/>
              <span className={cn('text-sm',isUnlocked?'font-medium text-slate-900':'text-slate-500')}>{benefit.name}</span>
            </div>
            <span className={cn('shrink-0 text-sm font-medium tabular-nums',isUnlocked?'text-emerald-700':'text-slate-500')}>{benefit.points} pts</span>
          </div>;
        })}
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-500">
        {next?<>Próximo canje: <strong className="font-medium text-slate-800">{next.name}</strong>. Te faltan <strong className="font-medium text-slate-800">{next.points-total} puntos</strong>.</>:'Ya alcanzaste los puntos de todos los beneficios configurados.'}
      </p>
    </section>
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
      <section className={cn("space-y-9 pb-10",className)}>
        <header className="grid gap-6 border-b border-slate-200 pb-7 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 font-normal text-slate-500">Seleccioná una categoría para cada mes y explorá los puntos, los bonos y los beneficios que podrías conseguir.</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-medium text-slate-500">Puntos acumulados</p>
            <div className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-slate-950">{total}<span className="ml-1 text-base font-normal text-slate-500">pts</span></div>
            <p className="mt-1 text-xs text-slate-500">{progress}% de {max} puntos posibles al año</p>
            <div className="mt-2 h-1.5 w-full max-w-[230px] overflow-hidden rounded-full bg-slate-100 sm:ml-auto"><div className="h-full rounded-full bg-emerald-500 transition-all duration-200" style={{width:`${progress}%`}}/></div>
          </div>
        </header>

        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><h4 className="text-lg font-semibold tracking-tight text-slate-900">Armá tu año</h4>
              <p className="mt-1 text-sm text-slate-500">En celular elegí desde cada mes; en escritorio también podés arrastrar las categorías.</p></div>
              <button type="button" onClick={()=>setPreset(Array.from({length:RECOGNITION_MONTHS.length},():Assignment=>null))} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-50"><RotateCcw className="h-4 w-4"/>Limpiar</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={()=>setPreset(Array.from({length:RECOGNITION_MONTHS.length},(_,i):Assignment=>i<6?'SENIOR':null))} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-200">Senior · 6 meses</button>
              <button type="button" onClick={()=>setPreset(Array.from({length:RECOGNITION_MONTHS.length},():Assignment=>'SENIOR'))} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-200">Máximo anual</button>
              <button type="button" onClick={()=>setPreset(['JUNIOR','JUNIOR','JUNIOR','SEMI_SENIOR','SEMI_SENIOR','SEMI_SENIOR','SENIOR','SENIOR','SENIOR','SENIOR','SENIOR','SENIOR'] as Assignment[])} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-200">Evolución gradual</button>
            </div>
          </div>

          <div className="hidden grid-cols-2 gap-2 sm:grid lg:grid-cols-4">
            {RECOGNITION_CATEGORIES.map(category=><DraggableCategory key={category.key} category={category}/>)}
          </div>

          <div className="grid gap-2 sm:hidden">
            {rows.map(row=><div key={row.month} className="flex items-center gap-3 border-b border-slate-100 py-2">
              <span className="w-12 shrink-0 text-xs font-medium text-slate-500">{row.month}</span>
              <select aria-label={`Categoría de ${row.month}`} value={assignments[row.index]??''} onChange={event=>setAssignments(current=>current.map((category,index)=>index===row.index?(event.target.value as Assignment||null):category))} className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400">
                <option value="">Sin categoría</option>
                {RECOGNITION_CATEGORIES.map(category=><option key={category.key} value={category.key}>{category.label} · +{category.monthlyPoints} pts</option>)}
              </select>
              <span className="w-16 text-right text-sm font-semibold tabular-nums text-slate-900">{row.monthTotal} pts</span>
            </div>)}
          </div>
          <div className="hidden sm:block"><RecognitionScoringTable rows={rows} onClear={index=>setAssignments(current=>current.map((value,i)=>i===index?null:value))}/></div>
        </div>

        <div className="grid gap-8 border-t border-slate-200 pt-8 lg:grid-cols-[1fr_0.8fr]">
          <BenefitList total={total}/>
          <div>
            <h4 className="text-lg font-semibold tracking-tight text-slate-900">Cómo se calcula</h4>
            <div className="mt-4 divide-y divide-slate-100">
              <div className="py-3"><p className="text-sm font-medium text-slate-900">Puntos base</p><p className="mt-1 text-sm leading-6 text-slate-500">Los define la categoría de cada cierre mensual.</p></div>
              <div className="py-3"><p className="text-sm font-medium text-slate-900">Bonos de permanencia</p><p className="mt-1 text-sm leading-6 text-slate-500">A los 3 meses se agrega el primer bono. A los 6, se suma el segundo y reinicia el ciclo.</p></div>
              <div className="py-3"><p className="text-sm font-medium text-slate-900">Saldo acumulado</p><p className="mt-1 text-sm leading-6 text-slate-500">Puntos base más bonos, disponibles para comparar con los canjes.</p></div>
            </div>
          </div>
        </div>
      </section>
      <DragOverlay dropAnimation={null}>{activeCategory?<CategoryTile category={activeCategory} ghost/>:null}</DragOverlay>
    </DndContext>
  );
}

export default RecognitionScoringPlayground;
