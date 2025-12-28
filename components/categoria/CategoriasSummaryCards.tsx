'use client';

import React, { useMemo } from 'react';
import {
  type CategoriaKey,
  CATEGORIA_ACCENTS,
  normalizeCategoriaKey,
} from '@/utils/categories';

type RowLike = {
  // LIVE
  categoriaKey?: CategoriaKey | string | null;

  // SNAPSHOT (BD) viene así:
  Categoria_alcanzada?: string | null;
};

type Props = {
  rows: RowLike[]; // 👈 pasale el array ya filtrado
  className?: string;
};

export default function CategoriasSummaryCards({ rows, className = '' }: Props) {
  const counts = useMemo(() => {
    const init: Record<CategoriaKey, number> = {
      PLAN_MEJORA: 0,
      JUNIOR: 0,
      SEMI_SENIOR: 0,
      SENIOR: 0,
    };

    for (const r of rows) {
      // ✅ LIVE: r.categoriaKey
      // ✅ SNAPSHOT: r.Categoria_alcanzada
      const k = normalizeCategoriaKey(r.categoriaKey ?? r.Categoria_alcanzada);
      init[k] = (init[k] ?? 0) + 1;
    }

    return init;
  }, [rows]);

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
    <div
      className={[
        'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4',
        className,
      ].join(' ')}
    >
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

            <div className="mt-2 text-3xl font-extrabold">{c.value}</div>

            <div className="mt-2 text-sm text-white/70">{c.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
