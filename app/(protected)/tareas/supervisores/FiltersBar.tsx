import { Filter, LayoutGrid, Search, Table as TableIcon } from 'lucide-react';
import type { TaskStatus } from '@/lib/tasks';

type StatusFilter = 'all' | TaskStatus;
type ViewMode = 'table' | 'grid';

type Props = {
  branchFilter: 'all' | string;
  onBranchFilterChange: (value: 'all' | string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  supervisorFilter: 'all' | string;
  onSupervisorFilterChange: (value: 'all' | string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  branchesFromData: string[];
  supervisorsFromData: string[];
  viewMode: ViewMode;
  onViewModeChange: (value: ViewMode) => void;
  isAdmin: boolean;
};

export default function FiltersBar({
  branchFilter,
  onBranchFilterChange,
  statusFilter,
  onStatusFilterChange,
  supervisorFilter,
  onSupervisorFilterChange,
  search,
  onSearchChange,
  branchesFromData,
  supervisorsFromData,
  viewMode,
  onViewModeChange,
  isAdmin,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-800/80 bg-gray-900/95 p-3 shadow-md shadow-slate-950/40">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <Filter className="h-4 w-4 text-sky-400" />
          Filtros
        </div>

        {/* Toggle vista tabla / grid */}
        <div className="inline-flex items-center gap-1 rounded-full bg-slate-950/80 p-1 text-[11px] text-slate-300">
          <button
            type="button"
            onClick={() => onViewModeChange('table')}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
              viewMode === 'table'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <TableIcon className="h-3 w-3" />
            Tabla
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
              viewMode === 'grid'
                ? 'bg-sky-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <LayoutGrid className="h-3 w-3" />
            Grid
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,2fr)]">
        {/* Sucursal */}
        <div className="flex flex-col gap-1 text-xs text-slate-300">
          <span>Sucursal</span>
          <select
            value={branchFilter}
            onChange={(e) =>
              onBranchFilterChange(e.target.value as 'all' | string)
            }
            className="rounded-xl border border-slate-700/80 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="all">
              {isAdmin ? 'Todas mis sucursales' : 'Todas las sucursales'}
            </option>
            {branchesFromData.map((b) => (
              <option key={b} value={b}>
                {b.charAt(0).toUpperCase() + b.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Estado */}
        <div className="flex flex-col gap-1 text-xs text-slate-300">
          <span>Estado</span>
          <select
            value={statusFilter}
            onChange={(e) =>
              onStatusFilterChange(e.target.value as StatusFilter)
            }
            className="rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="in_progress">En progreso</option>
            <option value="done">Completada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>

        {/* Supervisor */}
        <div className="flex flex-col gap-1 text-xs text-slate-300">
          <span>Supervisor</span>
          <select
            value={supervisorFilter}
            onChange={(e) =>
              onSupervisorFilterChange(e.target.value as 'all' | string)
            }
            className="rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="all">Todos</option>
            {supervisorsFromData.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Búsqueda */}
        <div className="flex flex-col gap-1 text-xs text-slate-300">
          <span>Búsqueda rápida</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Ej: matinal, corrientes, control..."
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-8 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
