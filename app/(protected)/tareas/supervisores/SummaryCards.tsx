import React from 'react';

export type SummaryMetrics = {
  total: number;
  done: number;
  pending: number;
  inProgress: number;
  completion: number;
};

export function SummaryCards({ metrics }: { metrics: SummaryMetrics }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl border border-slate-800/80 bg-gray-900/95 p-3 shadow-md shadow-slate-950/40">
        <p className="text-xs text-slate-400">Tareas en el período</p>
        <p className="mt-1 text-2xl font-semibold text-slate-100">
          {metrics.total}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-800/80 bg-gray-900/95 p-3 shadow-md shadow-slate-950/40">
        <p className="text-xs text-slate-400">Completadas</p>
        <p className="mt-1 text-2xl font-semibold text-emerald-400">
          {metrics.done}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-800/80 bg-gray-900/95 p-3 shadow-md shadow-slate-950/40">
        <p className="text-xs text-slate-400">Pendientes</p>
        <p className="mt-1 text-2xl font-semibold text-amber-300">
          {metrics.pending}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-800/80 bg-gray-900/95 p-3 shadow-md shadow-slate-950/40">
        <p className="text-xs text-slate-400">Nivel de cumplimiento</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-600">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${metrics.completion}%` }}
            />
          </div>
          <span className="text-xs text-slate-200">
            {metrics.completion}%
          </span>
        </div>
      </div>
    </section>
  );
}
