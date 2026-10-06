'use client';

import { Search, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TaskStatus } from '@/lib/tasks';
import { RedcomSelect } from '@/components/ui/redcom-select';

type StatusFilter = 'all' | TaskStatus;
type RoleOption = { value: string; label: string };

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
  isAdmin: boolean;
  ownerRoleFilter: 'all' | string;
  onOwnerRoleFilterChange: (value: 'all' | string) => void;
  ownerRoleOptions: RoleOption[];
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
  isAdmin,
  ownerRoleFilter,
  onOwnerRoleFilterChange,
  ownerRoleOptions,
}: Props) {
  return (
    <section className="rounded-[22px] border border-white/[0.08] bg-[#151517] p-4 shadow-[0_16px_45px_rgba(0,0,0,.12)]">
      <div className="mb-3 flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-[#5ac8fa]" />
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.10em] text-white/[0.48]">
            Filtros de supervisión
          </div>
          <p className="mt-0.5 text-[10px] text-white/[0.28]">
            Acotá la cartera por sucursal, usuario, estado o búsqueda.
          </p>
        </div>
      </div>

      <div
        className={[
          'grid gap-3',
          isAdmin
            ? 'md:grid-cols-2 xl:grid-cols-[1fr_0.9fr_0.95fr_1.15fr_1.6fr]'
            : 'md:grid-cols-2 xl:grid-cols-[1fr_0.9fr_1.15fr_1.7fr]',
        ].join(' ')}
      >
        <FilterField label="Sucursal">
          <RedcomSelect
            value={branchFilter}
            onValueChange={(value) => onBranchFilterChange(value)}
            surface="dark"
            options={[
              {
                value: 'all',
                label: isAdmin ? 'Todas mis sucursales' : 'Todas las sucursales',
              },
              ...branchesFromData.map((branch) => ({
                value: branch,
                label: branch.charAt(0).toUpperCase() + branch.slice(1),
              })),
            ]}
            className="h-10 rounded-[12px] text-[11px]"
            aria-label="Filtrar por sucursal"
          />
        </FilterField>

        <FilterField label="Estado">
          <RedcomSelect
            value={statusFilter}
            onValueChange={(value) =>
              onStatusFilterChange(value as StatusFilter)
            }
            surface="dark"
            options={[
              { value: 'all', label: 'Todos los estados' },
              { value: 'pending', label: 'Pendiente' },
              { value: 'in_progress', label: 'En progreso' },
              { value: 'done', label: 'Completada' },
              { value: 'cancelled', label: 'Cancelada' },
            ]}
            className="h-10 rounded-[12px] text-[11px]"
            aria-label="Filtrar por estado"
          />
        </FilterField>

        {isAdmin ? (
          <FilterField label="Tipo de usuario">
            <RedcomSelect
              value={ownerRoleFilter}
              onValueChange={(value) => onOwnerRoleFilterChange(value)}
              surface="dark"
              options={[
                { value: 'all', label: 'Todos los tipos' },
                ...ownerRoleOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                })),
              ]}
              className="h-10 rounded-[12px] text-[11px]"
              aria-label="Filtrar por tipo de usuario"
            />
          </FilterField>
        ) : null}

        <FilterField label="Usuario">
          <RedcomSelect
            value={supervisorFilter}
            onValueChange={(value) => onSupervisorFilterChange(value)}
            surface="dark"
            options={[
              { value: 'all', label: 'Todos los usuarios' },
              ...supervisorsFromData.map((name) => ({
                value: name,
                label: name,
              })),
            ]}
            className="h-10 rounded-[12px] text-[11px]"
            aria-label="Filtrar por usuario"
          />
        </FilterField>

        <FilterField label="Búsqueda">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/[0.28]" />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Título, descripción, usuario o sucursal..."
              className="h-10 w-full rounded-[12px] border border-white/[0.08] bg-[#1c1c1e] pl-9 pr-3 text-[11px] text-white/[0.82] outline-none placeholder:text-white/[0.24] transition focus:border-[#0a84ff]/45 focus:ring-2 focus:ring-[#0a84ff]/10"
            />
          </div>
        </FilterField>
      </div>
    </section>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1.5 block text-[9px] font-medium uppercase tracking-[0.08em] text-white/[0.32]">
        {label}
      </span>
      {children}
    </label>
  );
}
