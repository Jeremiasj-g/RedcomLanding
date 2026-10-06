'use client';

import { useState } from 'react';
import { useMe } from '@/hooks/useMe';
import { RequireAuth } from '@/components/RouteGuards';
import DualSpinner from '@/components/ui/DualSpinner';
import TaskChecklistSection from './TaskChecklistSection';

// ✅ Reutilizamos el selector de rango de /tareas/supervisores
import {
  DateRangeSelector,
  type DateRangeState,
  getInitialDateRange,
} from './panel-tareas/DateRangeSelector';

import MyTasksBoard from './MyTasksBoard';

export default function TareasPage() {
  const { me, loading: loadingMe } = useMe();

  const [rangeState, setRangeState] = useState<DateRangeState>(() =>
    getInitialDateRange(),
  );

  if (loadingMe && !me) {
    return (
      <RequireAuth roles={['admin', 'supervisor', 'jdv']}>
        <div className="grid min-h-[80vh] place-items-center">
          <DualSpinner size={60} thickness={4} />
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth roles={['admin', 'supervisor', 'jdv']}>
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 px-6 pb-14 pt-10 lg:px-10">
        <header className="flex flex-col gap-6 border-b border-black/[0.08] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Espacio de trabajo
            </div>
            <h1 className="text-[clamp(2.5rem,4vw,4.15rem)] font-medium leading-[0.95] tracking-[-0.05em] text-[#0b1020]">
              Tareas personales
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-normal leading-6 text-slate-500">
              Planificá el trabajo diario, organizá prioridades y seguí el avance
              desde una vista simple y compartida.
            </p>
          </div>

          <DateRangeSelector state={rangeState} onChange={setRangeState} />
        </header>

        {me && <MyTasksBoard userId={me.id} range={rangeState.range} />}
      </div>
    </RequireAuth>
  );
}
