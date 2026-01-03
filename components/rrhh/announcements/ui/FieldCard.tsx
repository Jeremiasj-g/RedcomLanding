'use client';

import React from 'react';

export function FieldCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4">
      <div>
        <div className="text-xs font-extrabold text-slate-700">{title}</div>
        {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
