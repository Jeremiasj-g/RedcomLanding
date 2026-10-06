
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
    <section className="rounded-[22px] border border-white/[0.08] bg-[#151517] p-4 shadow-[0_16px_45px_rgba(0,0,0,.14)]">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.54]">
        <Filter className="h-4 w-4 text-[#5ac8fa]" />
        Filtros
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
        {/* Estado */}
        <div className="flex flex-col gap-1 text-[10px] font-normal text-white/[0.46]">
          <span>Estado</span>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
            className="h-10 rounded-[12px] border border-white/[0.08] bg-[#1c1c1e] px-3 text-[11px] font-normal text-white/[0.82] outline-none transition focus:border-[#0a84ff]/45 focus:ring-2 focus:ring-[#0a84ff]/10"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="in_progress">En progreso</option>
            <option value="done">Completada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>

        {/* Buscar */}
        <div className="flex flex-col gap-1 text-[10px] font-normal text-white/[0.46]">
          <span>Buscar</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/[0.30]" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por título o descripción…"
              className="h-10 w-full rounded-[12px] border border-white/[0.08] bg-[#1c1c1e] py-2 pl-9 pr-3 text-[11px] font-normal text-white/[0.82] outline-none transition placeholder:text-white/[0.28] focus:border-[#0a84ff]/45 focus:ring-2 focus:ring-[#0a84ff]/10"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
