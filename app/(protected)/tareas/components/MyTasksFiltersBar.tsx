
'use client';

import { Filter, Search } from 'lucide-react';
import type { TaskStatus } from '@/lib/tasks';

export type StatusFilter = 'all' | TaskStatus;

type Props = {
  statusFilter: StatusFilter;
  onStatusFilterChange: (v: StatusFilter) => void;
  search: string;
  onSearchChange: (v: string) => void;
};

export default function MyTasksFiltersBar({
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-800/80 bg-gray-900/95 p-3 shadow-md shadow-slate-950/40">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-300">
        <Filter className="h-4 w-4 text-sky-400" />
        Filtros
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
        {/* Estado */}
        <div className="flex flex-col gap-1 text-xs text-slate-300">
          <span>Estado</span>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
            className="rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="in_progress">En progreso</option>
            <option value="done">Completada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>

        {/* Buscar */}
        <div className="flex flex-col gap-1 text-xs text-slate-300">
          <span>Buscar</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por título o descripción…"
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 py-2 pl-9 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
