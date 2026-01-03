'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '../utils/cn';

export function InlineCheck({
  title,
  desc,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  desc?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 flex items-center justify-between', disabled && 'opacity-60')}>
      <div>
        <div className="text-sm font-extrabold text-slate-900">{title}</div>
        {desc ? <div className="text-xs text-slate-500">{desc}</div> : null}
      </div>
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={(v) => onChange(Boolean(v))} />
    </div>
  );
}
