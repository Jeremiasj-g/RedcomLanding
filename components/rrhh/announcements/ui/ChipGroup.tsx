'use client';

import { cn } from '../utils/cn';

export function ChipGroup({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
  className?: string;
}) {
  const toggle = (val: string) => {
    const active = value.includes(val);
    onChange(active ? value.filter((x) => x !== val) : [...value, val]);
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((opt) => {
        const active = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              'px-3 py-2 rounded-2xl border text-xs font-extrabold transition',
              active
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
