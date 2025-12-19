'use client';

import React from 'react';
import { CATEGORIA_ACCENTS } from '@/utils/categories';

type Props = {
  id: string;
  vendedor: string;
  categoriaLabel: string;
  categoriaColor: { bg: string; text: string; border: string };

  eficiencia: number;
  cobertura: number;
  volumen: number;
  pop: number;
  exhibicion: number;

  accentColor: string; // ✅ lo dejamos por si lo querés usar después (ej: borde), pero no lo usamos en el ring

  onDetails: () => void;
};

export default function CategoriaCard({
  id,
  vendedor,
  categoriaLabel,
  categoriaColor,
  eficiencia,
  cobertura,
  volumen,
  pop,
  exhibicion,
  accentColor, // (no usado por ahora)
  onDetails,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
      {/* top bar */}
      <div className={['h-1.5 w-full', categoriaColor.bg.replace(/\/\d+$/, '')].join(' ')} />

      <div className="px-6 py-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-semibold text-slate-700">
              {id}
            </div>

            <div>
              <div className="font-bold text-slate-900 leading-tight">
                {vendedor}
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">
                {categoriaLabel}
              </div>
            </div>
          </div>

          {/* puntito */}
          <div className={['w-3 h-3 rounded-full mt-1', categoriaColor.bg.replace(/\/\d+$/, '')].join(' ')} />
        </div>

        {/* progreso + stats */}
        <div className="mt-5 grid grid-cols-[90px_1fr] gap-4 items-center">
          <CircularProgress value={eficiencia} uid={id} />

          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Cobertura" value={cobertura} />
            <MiniStat label="Volumen" value={volumen} />
            <MiniStat label="POP" value={`${pop.toFixed(2)}%`} />
            <MiniStat label="Exhibición" value={`${exhibicion.toFixed(2)}%`} />
          </div>
        </div>

        <button
          onClick={onDetails}
          className="mt-5 w-full rounded-xl bg-slate-200/70 hover:bg-slate-300/60 transition px-4 py-3 text-sm font-medium text-slate-700 flex items-center justify-center gap-2"
        >
          Ver detalles <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

function CircularProgress({
  value,
  uid,
  size = 72,
  stroke = 8,
}: {
  value: number;
  uid: string; // ✅ para gradientId único
  size?: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  const COLORS = {
    senior: CATEGORIA_ACCENTS.SENIOR,
    semi: CATEGORIA_ACCENTS.SEMI_SENIOR,
    junior: CATEGORIA_ACCENTS.JUNIOR,
    mejora: CATEGORIA_ACCENTS.PLAN_MEJORA,
  };

  const gradientId = `cat-ring-gradient-${uid}`;

  return (
    <div className="relative grid place-items-center">
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={COLORS.senior} />
            <stop offset="35%" stopColor={COLORS.semi} />
            <stop offset="65%" stopColor={COLORS.junior} />
            <stop offset="100%" stopColor={COLORS.mejora} />
          </linearGradient>
        </defs>

        {/* base */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={stroke}
          fill="none"
        />

        {/* progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      <div className="absolute text-center">
        <div className="text-sm font-bold text-slate-900">
          {Math.round(progress)}%
        </div>
        <div className="text-[10px] text-slate-500">Eficiencia</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-900">{value}</div>
    </div>
  );
}
