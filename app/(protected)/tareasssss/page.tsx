'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';

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
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-12">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-black">
              <CalendarDays className="h-5 w-8 font-bold text-black" />
              Tareas personales
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Planificá tus tareas y marcá el avance día a día. Podés verlas
              por semana, mes o varios bloques de semanas.
            </p>
          </div>

          {/* 🔁 Selector reutilizable de rango (semana / mes / multi-semana) */}
          <DateRangeSelector state={rangeState} onChange={setRangeState} />
        </header>

        {/* Tablero de tareas (creación + calendario + modal) */}
        {me && <MyTasksBoard userId={me.id} range={rangeState.range} />}
      </div>
    </RequireAuth>
  );
}
