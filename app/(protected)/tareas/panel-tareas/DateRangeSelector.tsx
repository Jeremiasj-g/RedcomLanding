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
  surface?: 'light' | 'dark';
};

export function DateRangeSelector({
  state,
  onChange,
  surface = 'light',
}: Props) {
  const { range, mode, weeksSpan } = state;
  const label = getRangeLabel(state);

  const isDark = surface === 'dark';
  const shellClass = isDark
    ? 'border-white/[0.08] bg-white/[0.035]'
    : 'border-slate-300/70 bg-[#E7E9ED] shadow-[0_4px_14px_rgba(15,23,42,.08)]';
  const activeClass = isDark
    ? 'bg-white text-[#0b1020] shadow-sm'
    : 'bg-white text-[#0b1020] shadow-[0_2px_8px_rgba(15,23,42,.10)]';
  const inactiveClass = isDark
    ? 'text-white/[0.42] hover:bg-white/[0.05] hover:text-white/[0.72]'
    : 'text-slate-600 hover:bg-white/65 hover:text-slate-900';
  const navTextClass = isDark ? 'text-white/[0.68]' : 'text-slate-700';
  const navButtonClass = isDark
    ? 'text-white/[0.40] hover:bg-white/[0.05] hover:text-white'
    : 'text-slate-500 hover:bg-white/70 hover:text-slate-900';

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
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <div className={`inline-flex h-10 items-center rounded-[12px] border p-1 ${shellClass}`}>
        {[
          { value: 'week' as const, label: 'Semana' },
          { value: 'month' as const, label: 'Mes' },
          { value: 'multi-week' as const, label: 'Multi-semana' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            className={[
              'h-8 rounded-[9px] px-3 text-[10px] font-medium transition',
              mode === option.value ? activeClass : inactiveClass,
            ].join(' ')}
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode === 'multi-week' ? (
        <div className={`inline-flex h-10 items-center rounded-[12px] border p-1 ${shellClass}`}>
          {[1, 2, 3, 4].map((span) => (
            <button
              key={span}
              type="button"
              onClick={() => setWeeksSpan(span)}
              className={[
                'h-8 rounded-[9px] px-2.5 text-[10px] font-medium transition',
                weeksSpan === span
                  ? isDark
                    ? 'bg-[#0a84ff]/15 text-[#8bc7ff]'
                    : 'bg-[#0b1020] text-white shadow-[0_2px_8px_rgba(15,23,42,.16)]'
                  : inactiveClass,
              ].join(' ')}
            >
              {span} sem
            </button>
          ))}
        </div>
      ) : null}

      <div className={`inline-flex h-10 items-center rounded-[12px] border p-1 ${shellClass}`}>
        <button
          type="button"
          onClick={() => go(-1)}
          className={`grid h-8 w-8 place-items-center rounded-[9px] transition ${navButtonClass}`}
          aria-label="Rango anterior"
        >
          ‹
        </button>
        <span className={`min-w-[130px] px-2 text-center text-[10px] font-medium ${navTextClass}`}>
          {label}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          className={`grid h-8 w-8 place-items-center rounded-[9px] transition ${navButtonClass}`}
          aria-label="Rango siguiente"
        >
          ›
        </button>
      </div>
    </div>
  );
}
