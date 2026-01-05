'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type Props = React.HTMLAttributes<HTMLDivElement> & {
  value?: number | null;
  max?: number;
};

export function Progress({ value = 0, max = 100, className, ...props }: Props) {
  const safeMax = typeof max === 'number' && max > 0 ? max : 100;
  const safeVal = typeof value === 'number' ? Math.min(Math.max(value, 0), safeMax) : 0;
  const pct = (safeVal / safeMax) * 100;

  return (
    <div
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-slate-100',
        className
      )}
      {...props}
    >
      <div
        className="h-full rounded-full bg-slate-900 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
