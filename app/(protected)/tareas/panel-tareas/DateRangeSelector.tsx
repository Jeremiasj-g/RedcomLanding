'use client';

import {
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addMonths,
} from 'date-fns';

export type DateRange = {
  from: Date;
  to: Date;
};

export type RangeMode = 'week' | 'month' | 'multi-week';

export type DateRangeState = {
  range: DateRange;
  mode: RangeMode;
  weeksSpan: number;
};

export const WEEK_STARTS_ON: 0 | 1 = 1; // lunes

function computeRangeForToday(mode: RangeMode, span: number): DateRange {
  const today = new Date();

  if (mode === 'week') {
    const from = startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON });
    const to = endOfWeek(today, { weekStartsOn: WEEK_STARTS_ON });
    return { from, to };
  }

  if (mode === 'month') {
    const from = startOfMonth(today);
    const to = endOfMonth(today);
    return { from, to };
  }

  // multi-week
  const from = startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON });
  const to = addDays(from, span * 7 - 1);
  return { from, to };
}

function shiftRange(
  mode: RangeMode,
  span: number,
  current: DateRange,
  direction: -1 | 1,
): DateRange {
  if (mode === 'week') {
    return {
      from: addWeeks(current.from, direction),
      to: addWeeks(current.to, direction),
    };
  }

  if (mode === 'month') {
    const base = startOfMonth(addMonths(current.from, direction));
    return {
      from: base,
      to: endOfMonth(base),
    };
  }

  // multi-week → movemos bloques de `span` semanas
  const deltaDays = span * 7 * direction;
  return {
    from: addDays(current.from, deltaDays),
    to: addDays(current.to, deltaDays),
  };
}

export function getInitialDateRange(): DateRangeState {
  const range = computeRangeForToday('week', 1);
  return {
    range,
    mode: 'week',
    weeksSpan: 1,
  };
}

export function getRangeLabel(state: DateRangeState): string {
  const { range, mode } = state;

  if (mode === 'month') {
    return range.from.toLocaleDateString('es-AR', {
      month: 'short',
      year: 'numeric',
    });
  }

  const fmt = (d: Date) =>
    d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });

  return `${fmt(range.from)} – ${fmt(range.to)}`;
}

type Props = {
  state: DateRangeState;
  onChange: (next: DateRangeState) => void;
};

export function DateRangeSelector({ state, onChange }: Props) {
  const { range, mode, weeksSpan } = state;
  const label = getRangeLabel(state);

  const update = (partial: Partial<DateRangeState>) => {
    onChange({ ...state, ...partial });
  };

  const setMode = (newMode: RangeMode) => {
    const newRange = computeRangeForToday(newMode, weeksSpan);
    update({ mode: newMode, range: newRange });
  };

  const setWeeksSpan = (span: number) => {
    const newRange = computeRangeForToday('multi-week', span);
    update({ weeksSpan: span, mode: 'multi-week', range: newRange });
  };

  const go = (direction: -1 | 1) => {
    const newRange = shiftRange(mode, weeksSpan, range, direction);
    update({ range: newRange });
  };

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-2">
      {/* Modos: Semana / Mes / Multi-semana */}
      <div className="inline-flex h-10 items-center rounded-[13px] border border-black/[0.08] bg-[#f5f5f7] p-1 text-[11px] font-normal text-slate-500 shadow-sm">
        <button
          onClick={() => setMode('week')}
          className={`rounded-[9px] px-3 py-1.5 ${
            mode === 'week'
              ? 'bg-white text-[#0b1020] shadow-sm'
              : 'text-slate-500 hover:bg-black/[0.045] hover:text-slate-800'
          }`}
        >
          Semana
        </button>
        <button
          onClick={() => setMode('month')}
          className={`rounded-[9px] px-3 py-1.5 ${
            mode === 'month'
              ? 'bg-white text-[#0b1020] shadow-sm'
              : 'text-slate-500 hover:bg-black/[0.045] hover:text-slate-800'
          }`}
        >
          Mes
        </button>
        <button
          onClick={() => setMode('multi-week')}
          className={`rounded-[9px] px-3 py-1.5 ${
            mode === 'multi-week'
              ? 'bg-white text-[#0b1020] shadow-sm'
              : 'text-slate-500 hover:bg-black/[0.045] hover:text-slate-800'
          }`}
        >
          Multi-semana
        </button>
      </div>

      {/* Cantidad de semanas cuando estamos en multi-semana */}
      {mode === 'multi-week' && (
        <select
          className="h-10 rounded-[13px] border border-black/[0.08] bg-[#f5f5f7] px-3 text-[11px] text-slate-700 outline-none transition focus:border-[#0a84ff]/40 focus:ring-2 focus:ring-[#0a84ff]/10"
          value={weeksSpan}
          onChange={(e) => setWeeksSpan(Number(e.target.value) || 1)}
        >
          <option value={1}>1 semana</option>
          <option value={2}>2 semanas</option>
          <option value={3}>3 semanas</option>
        </select>
      )}

      {/* Navegación anterior / siguiente */}
      <div className="inline-flex h-10 items-center gap-1 rounded-[13px] border border-black/[0.08] bg-[#f5f5f7] px-2 text-xs text-slate-600 shadow-sm">
        <button
          onClick={() => go(-1)}
          className="mr-1 rounded-[9px] px-2 py-1 text-slate-400 transition hover:bg-black/[0.05] hover:text-slate-800"
        >
          ‹
        </button>
        <span className="min-w-[110px] text-center font-medium text-[#0b1020]">{label}</span>
        <button
          onClick={() => go(1)}
          className="ml-1 rounded-[9px] px-2 py-1 text-slate-400 transition hover:bg-black/[0.05] hover:text-slate-800"
        >
          ›
        </button>
      </div>
    </div>
  );
}
