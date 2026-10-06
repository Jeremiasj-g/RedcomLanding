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
    <section className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#151517] shadow-[0_16px_45px_rgba(0,0,0,.14)]">
      <div className="grid grid-cols-2 lg:grid-cols-4">
        <Metric label="Visibles" value={metrics.total} />
        <Metric label="Completadas" value={metrics.done} tone="success" />
        <Metric label="Pendientes" value={metrics.pending} tone="warning" />
        <div className="border-l border-white/[0.07] px-5 py-4">
          <div className="text-[9px] font-medium uppercase tracking-[0.10em] text-white/[0.34]">
            Cumplimiento
          </div>
          <div className="mt-1 flex items-end justify-between gap-3">
            <span className="text-[26px] font-medium tracking-[-0.03em] text-white/[0.94]">
              {metrics.completion}%
            </span>
            <span className="pb-1 text-[9px] font-normal text-white/[0.34]">
              {metrics.done} de {metrics.total}
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-[#5ac8fa] transition-all duration-300"
              style={{ width: `${metrics.completion}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'warning';
}) {
  const valueClass =
    tone === 'success'
      ? 'text-emerald-300'
      : tone === 'warning'
        ? 'text-amber-300'
        : 'text-white/[0.94]';

  return (
    <div className="border-l border-white/[0.07] px-5 py-4 first:border-l-0">
      <div className="text-[9px] font-medium uppercase tracking-[0.10em] text-white/[0.34]">
        {label}
      </div>
      <div className={`mt-1 text-[26px] font-medium tracking-[-0.03em] ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}
