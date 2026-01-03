'use client';

import { Switch } from '@/components/ui/switch';
import type { BranchOption } from '../types';
import { ChipGroup } from './ChipGroup';
import { MultiSelectCommand } from './MultiSelectCommand';

export function AudienceCard({
  audAll,
  onAudAll,
  roles,
  selectedRoles,
  onRoles,
  branches,
  branchesLoading,
  selectedBranches,
  onBranches,
}: {
  audAll: boolean;
  onAudAll: (v: boolean) => void;

  roles: string[];
  selectedRoles: string[];
  onRoles: (v: string[]) => void;

  branches: BranchOption[];
  branchesLoading?: boolean;
  selectedBranches: string[];
  onBranches: (v: string[]) => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-300 bg-white shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-extrabold text-slate-900">Audiencia</div>
            <div className="text-sm text-slate-600">A quién le aparece (RLS filtra)</div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <Switch checked={audAll} onCheckedChange={onAudAll} />
            <span className="text-sm font-semibold text-slate-800">Todos</span>
          </div>
        </div>
      </div>

      {!audAll ? (
        <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 p-4 bg-white">
            <div className="text-xs font-extrabold text-slate-700">Roles</div>

            <ChipGroup
              className="mt-3"
              options={roles.map((r) => ({ value: r, label: r.toUpperCase() }))}
              value={selectedRoles}
              onChange={onRoles}
            />

            <div className="mt-3 text-xs text-slate-500">Si dejás vacío, se interpreta como “todos los roles”.</div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 bg-white">
            <div className="text-xs font-extrabold text-slate-700">Sucursales (branches)</div>

            <div className="mt-3 flex flex-wrap gap-2">
              {selectedBranches.length === 0 ? (
                <span className="text-xs text-slate-500">Sin filtro (todas)</span>
              ) : (
                selectedBranches.map((v) => {
                  const found = branches.find((b) => b.value === v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onBranches(selectedBranches.filter((x) => x !== v))}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      title="Quitar"
                    >
                      {found?.label ?? v}
                      <span className="text-slate-400">×</span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-3">
              <MultiSelectCommand
                loading={branchesLoading}
                labelWhenEmpty="Sin filtro (todas)"
                options={branches.map((b) => ({
                  key: b.id,
                  value: b.value,
                  title: b.label,
                  subtitle: b.value,
                }))}
                value={selectedBranches}
                onChange={onBranches}
                placeholder="Buscar sucursal…"
              />
            </div>

            <div className="mt-3 text-xs text-slate-500">Dejá vacío para “todas”.</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
