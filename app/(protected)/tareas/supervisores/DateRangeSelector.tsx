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
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
      {/* Modos: Semana / Mes / Multi-semana */}
      <div className="inline-flex items-center rounded-full bg-slate-900/80 p-1 text-[11px] text-slate-300 ring-1 ring-slate-700/70">
        <button
          onClick={() => setMode('week')}
          className={`rounded-full px-3 py-1 ${
            mode === 'week'
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Semana
        </button>
        <button
          onClick={() => setMode('month')}
          className={`rounded-full px-3 py-1 ${
            mode === 'month'
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Mes
        </button>
        <button
          onClick={() => setMode('multi-week')}
          className={`rounded-full px-3 py-1 ${
            mode === 'multi-week'
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Multi-semana
        </button>
      </div>

      {/* Cantidad de semanas cuando estamos en multi-semana */}
      {mode === 'multi-week' && (
        <select
          className="rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1 text-[11px] text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          value={weeksSpan}
          onChange={(e) => setWeeksSpan(Number(e.target.value) || 1)}
        >
          <option value={1}>1 semana</option>
          <option value={2}>2 semanas</option>
          <option value={3}>3 semanas</option>
        </select>
      )}

      {/* Navegación anterior / siguiente */}
      <div className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700/70">
        <button
          onClick={() => go(-1)}
          className="mr-1 rounded-full px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          ‹
        </button>
        <span className="font-medium">{label}</span>
        <button
          onClick={() => go(1)}
          className="ml-1 rounded-full px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          ›
        </button>
      </div>
    </div>
  );
}
