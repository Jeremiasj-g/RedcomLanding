'use client';

import type { ReactNode } from 'react';

type WorkTableProps = {
  title?: string;
  subtitle?: string;
  resultCount?: number;
  minWidth?: string;
  columns: string;
  headers: ReactNode[];
  children: ReactNode;
  empty?: boolean;
  emptyContent?: ReactNode;
  loading?: boolean;
  loadingContent?: ReactNode;
  actions?: ReactNode;
  embedded?: boolean;
};

function WorkTableBody({
  minWidth,
  columns,
  headers,
  children,
  empty,
  emptyContent,
  loading,
  loadingContent,
}: Pick<
  WorkTableProps,
  | 'minWidth'
  | 'columns'
  | 'headers'
  | 'children'
  | 'empty'
  | 'emptyContent'
  | 'loading'
  | 'loadingContent'
>) {
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth }}>
        <div
          className="grid border-b border-white/[0.07] bg-white/[0.025] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.52]"
          style={{ gridTemplateColumns: columns }}
        >
          {headers.map((header, index) => (
            <div key={index}>{header}</div>
          ))}
        </div>

        {loading ? loadingContent : empty ? emptyContent : children}
      </div>
    </div>
  );
}

export function WorkTable({
  title,
  subtitle,
  resultCount,
  minWidth = '1160px',
  columns,
  headers,
  children,
  empty = false,
  emptyContent,
  loading = false,
  loadingContent,
  actions,
  embedded = false,
}: WorkTableProps) {
  const body = (
    <WorkTableBody
      minWidth={minWidth}
      columns={columns}
      headers={headers}
      empty={empty}
      emptyContent={emptyContent}
      loading={loading}
      loadingContent={loadingContent}
    >
      {children}
    </WorkTableBody>
  );

  if (embedded) return body;

  return (
    <section className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#151517] shadow-[0_16px_45px_rgba(0,0,0,.18)]">
      {(title || subtitle || actions || typeof resultCount === 'number') ? (
        <div className="flex flex-col gap-3 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title ? <h2 className="text-sm font-medium text-white/[0.94]">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-xs font-normal text-white/[0.58]">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            {typeof resultCount === 'number' ? (
              <span className="text-xs font-normal text-white/[0.58]">
                {resultCount} resultado{resultCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      {body}
    </section>
  );
}

export function WorkTableRow({
  columns,
  children,
  onClick,
  className = '',
}: {
  columns: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`group grid items-center border-b border-white/[0.055] px-5 py-3.5 transition hover:bg-white/[0.035] ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ gridTemplateColumns: columns }}
    >
      {children}
    </div>
  );
}
