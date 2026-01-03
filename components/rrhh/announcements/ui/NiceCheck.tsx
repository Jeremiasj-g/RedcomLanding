'use client';

import { Checkbox } from '@/components/ui/checkbox';

export function NiceCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 px-3 py-3 flex items-center justify-between">
      <div className="text-sm font-extrabold text-slate-900">{label}</div>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
    </div>
  );
}
