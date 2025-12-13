'use client';

import React from 'react';
import './QuadSpinner.css';
import { getCategoriaByKey } from '@/utils/categories';

type QuadSpinnerProps = {
  size?: number;
  thickness?: number;
};

const RING_KEYS = ['SENIOR', 'SEMI_SENIOR', 'JUNIOR', 'PLAN_MEJORA'] as const;

// ✅ clases estáticas (Tailwind las detecta y compila)
const RING_BORDER_TOP: Record<(typeof RING_KEYS)[number], string> = {
  SENIOR: 'border-t-emerald-700',
  SEMI_SENIOR: 'border-t-emerald-400',
  JUNIOR: 'border-t-yellow-500',
  PLAN_MEJORA: 'border-t-red-500',
};

export default function QuadSpinner({ size = 56, thickness = 3 }: QuadSpinnerProps) {
  // escalonado entre anillos
  const step = Math.round(size * 0.14);

  return (
    <div className="quad-spinner-wrapper" style={{ width: size, height: size }}>
      {RING_KEYS.map((key, i) => {
        const ringSize = size - i * step;
        const direction = i % 2 === 0 ? 'spin-cw' : 'spin-ccw';

        // (opcional) por si querés usar algo del utils: acá ya lo tenés
        // const cat = getCategoriaByKey(key);

        return (
          <div
            key={key}
            className={[
              'quad-spinner',
              'border border-transparent', // resto transparente
              RING_BORDER_TOP[key],        // solo el top con color
              direction,
            ].join(' ')}
            style={{
              width: ringSize,
              height: ringSize,
              borderWidth: thickness,
            }}
          />
        );
      })}
    </div>
  );
}
