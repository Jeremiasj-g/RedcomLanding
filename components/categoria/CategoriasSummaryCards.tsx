'use client';

import React, { useMemo } from 'react';
import { CATEGORIAS, PLAN_MEJORA, type CategoriaKey, CATEGORIA_ACCENTS } from '@/utils/categories';

type RowLike = {
  categoriaKey: CategoriaKey;
};

type Props = {
  rows: RowLike[];        // 👈 pasale el array ya filtrado
  className?: string;
};

function hexToRgba(hex: string, alpha = 1) {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function CategoriasSummaryCards({ rows, className = '' }: Props) {
  const counts = useMemo(() => {
    const init: Record<CategoriaKey, number> = {
      PLAN_MEJORA: 0,
      JUNIOR: 0,
      SEMI_SENIOR: 0,
      SENIOR: 0,
    };

    for (const r of rows) {
      const k = r.categoriaKey ?? 'PLAN_MEJORA';
      init[k] = (init[k] ?? 0) + 1;
    }

    return init;
  }, [rows]);

  const total = rows.length;

  const cards = [
    {
      key: 'SENIOR',
      title: 'SENIOR',
      value: counts.SENIOR,
      subtitle: 'Categoría alcanzada Senior.',
      accent: CATEGORIA_ACCENTS.SENIOR,
    },
    {
      key: 'SEMI_SENIOR',
      title: 'SEMI SENIOR',
      value: counts.SEMI_SENIOR,
      subtitle: 'Categoría alcanzada Semi Senior.',
      accent: CATEGORIA_ACCENTS.SEMI_SENIOR,
    },
    {
      key: 'JUNIOR',
      title: 'JUNIOR',
      value: counts.JUNIOR,
      subtitle: 'Categoría alcanzada Junior.',
      accent: CATEGORIA_ACCENTS.JUNIOR,
    },
    {
      key: 'PLAN_MEJORA',
      title: 'PLAN DE MEJORA',
      value: counts.PLAN_MEJORA,
      subtitle: 'Categoría alcanzada Plan de Mejora.',
      accent: CATEGORIA_ACCENTS.PLAN_MEJORA,
    },
  ] as const;

  return (
    <div className={['grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4', className].join(' ')}>
      {cards.map((c) => (
        <div
          key={c.key}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950 text-white"
          style={{
            boxShadow: '0 18px 50px -30px rgba(0,0,0,0.7)',
          }}
        >

          {/* subtle glow */}
          <div
            className="absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-30"
            style={{ background: c.accent }}
          />

          <div className="relative p-5">
            <div className="text-xs font-semibold tracking-wide text-white/80">
              {c.title}
            </div>

            <div className="mt-2 text-3xl font-extrabold">
              {c.value}
            </div>

            <div className="mt-2 text-sm text-white/70">
              {c.subtitle}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
