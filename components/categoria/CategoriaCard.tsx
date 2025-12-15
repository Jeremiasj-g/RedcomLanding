'use client';

import React from 'react';

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
  onDetails,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* ✅ “Top bar” pintada según categoría (como tu captura) */}
      <div className={['h-1.5 w-full', categoriaColor.bg.replace(/\/\d+$/, '')].join(' ')} />

      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-semibold text-slate-700">
            {id}
          </div>

          <div className="flex-1">
            <div className="font-bold text-slate-900 leading-tight">{vendedor}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">{categoriaLabel}</div>
          </div>

          {/* puntito de color */}
          <div className={['w-3 h-3 rounded-full mt-1', categoriaColor.bg.replace(/\/\d+$/, '')].join(' ')} />
        </div>

        {/* stats */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <MiniStat label="Cobertura" value={cobertura} />
          <MiniStat label="Volumen" value={volumen} />
          <MiniStat label="POP" value={`${pop.toFixed(2)}%`} />
          <MiniStat label="Exhibición" value={`${exhibicion.toFixed(2)}%`} />
        </div>

        <button
          onClick={onDetails}
          className="mt-5 w-full rounded-xl bg-slate-50 hover:bg-slate-100 transition px-4 py-3 text-sm font-medium text-slate-700 flex items-center justify-center gap-2"
        >
          Ver detalles <span aria-hidden>→</span>
        </button>
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
