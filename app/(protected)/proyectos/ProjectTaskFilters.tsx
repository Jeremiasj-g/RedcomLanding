'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Filter, Search, ChevronDown, X, Users2 } from 'lucide-react';
import type { AssigneeOption } from '@/lib/projectTasks';

export type ProjectTaskFiltersState = {
  search: string;
  status: 'all' | 'not_started' | 'in_progress' | 'done' | 'cancelled';
  priority: 'all' | 'low' | 'medium' | 'high';
  project: string;
  responsibleIds: string[];
  dueFrom: string;
  dueTo: string;
  viewMode: 'table' | 'grid';
};

type Stats = {
  total: number;
  completed: number;
  pending: number;
  completionRate: number;
};

type Props = {
  supervisors?: AssigneeOption[];
  value?: ProjectTaskFiltersState;
  stats?: Stats; // 👈 ahora opcional
  onChange: (next: ProjectTaskFiltersState) => void;
};

const STATUS_LABELS: Record<ProjectTaskFiltersState['status'], string> = {
  all: 'Todos',
  not_started: 'Sin empezar',
  in_progress: 'En curso',
  done: 'Completadas',
  cancelled: 'Canceladas',
};

const PRIORITY_LABELS: Record<ProjectTaskFiltersState['priority'], string> = {
  all: 'Todas',
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

export default function ProjectTaskFilters({
  supervisors,
  value,
  stats,
  onChange,
}: Props) {
  // 🔒 defaults
  const defaultFilters: ProjectTaskFiltersState = {
    search: '',
    status: 'all',
    priority: 'all',
    project: '',
    responsibleIds: [],
    dueFrom: '',
    dueTo: '',
    viewMode: 'table',
  };

  const safeValue = value ?? defaultFilters;
  const safeSupervisors = supervisors ?? [];
  const safeStats: Stats = stats ?? {
    total: 0,
    completed: 0,
    pending: 0,
    completionRate: 0,
  };

  const {
    search,
    status,
    priority,
    project,
    responsibleIds,
    dueFrom,
    dueTo,
    viewMode,
  } = safeValue;

  // dropdown responsables
  const [responsibleOpen, setResponsibleOpen] = useState(false);
  const [responsibleSearch, setResponsibleSearch] = useState('');

  // cerrar con ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setResponsibleOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filteredSupervisors = useMemo(() => {
    const term = responsibleSearch.trim().toLowerCase();
    if (!term) return safeSupervisors;
    return safeSupervisors.filter((s) => {
      const text = `${s.full_name ?? ''} ${s.email ?? ''}`.toLowerCase();
      return text.includes(term);
    });
  }, [safeSupervisors, responsibleSearch]);

  const selectedSupervisors = useMemo(
    () => safeSupervisors.filter((s) => responsibleIds.includes(s.id)),
    [safeSupervisors, responsibleIds],
  );

  const handleChange = (patch: Partial<ProjectTaskFiltersState>) => {
    onChange({ ...safeValue, ...patch });
  };

  const toggleResponsible = (id: string) => {
    const has = responsibleIds.includes(id);
    const next = has
      ? responsibleIds.filter((x) => x !== id)
      : [...responsibleIds, id];
    handleChange({ responsibleIds: next });
  };

  const clearResponsibles = () => {
    handleChange({ responsibleIds: [] });
    setResponsibleSearch('');
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl">
      {/* Resumen / métricas */}
      <div className="grid gap-3 sm:grid-cols-4">
        <MetricCard
          label="Tareas filtradas"
          value={safeStats.total}
          description="Total de tareas que cumplen los filtros."
        />
        <MetricCard
          label="Completadas"
          value={safeStats.completed}
          description="Tareas marcadas como realizadas."
          accent="emerald"
        />
        <MetricCard
          label="Pendientes"
          value={safeStats.pending}
          description="Tareas en curso o sin empezar."
          accent="amber"
        />
        <MetricCard
          label="Avance"
          value={`${safeStats.completionRate}%`}
          description="Porcentaje completado del total."
          accent="sky"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/90 p-3 text-xs text-slate-100">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <Filter className="h-3.5 w-3.5" />
          Filtros de vista
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search principal + proyecto */}
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => handleChange({ search: e.target.value })}
                  placeholder="Buscar por título, resumen o proyecto..."
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-7 pr-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <input
                value={project}
                onChange={(e) => handleChange({ project: e.target.value })}
                placeholder="Filtrar por nombre de proyecto..."
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Estado / Prioridad */}
          <div className="flex flex-wrap gap-2 md:w-[280px] md:justify-end">
            <select
              value={status}
              onChange={(e) =>
                handleChange({
                  status: e.target.value as ProjectTaskFiltersState['status'],
                })
              }
              className="min-w-[130px] rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[11px] text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">Estado: Todos</option>
              <option value="not_started">Estado: Sin empezar</option>
              <option value="in_progress">Estado: En curso</option>
              <option value="done">Estado: Completadas</option>
              <option value="cancelled">Estado: Canceladas</option>
            </select>

            <select
              value={priority}
              onChange={(e) =>
                handleChange({
                  priority: e.target
                    .value as ProjectTaskFiltersState['priority'],
                })
              }
              className="min-w-[130px] rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[11px] text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">Prioridad: Todas</option>
              <option value="low">Prioridad: Baja</option>
              <option value="medium">Prioridad: Media</option>
              <option value="high">Prioridad: Alta</option>
            </select>
          </div>
        </div>

        {/* Responsables + fechas */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Dropdown responsables */}
          <div className="relative md:w-[380px]">
            <button
              type="button"
              onClick={() => setResponsibleOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-100 hover:bg-slate-800"
            >
              <span className="flex items-center gap-2">
                <Users2 className="h-3.5 w-3.5 text-slate-400" />
                {responsibleIds.length === 0 ? (
                  <span className="text-slate-400">
                    Responsables: Todos
                  </span>
                ) : responsibleIds.length === 1 ? (
                  <span>
                    Responsable:{' '}
                    <strong>
                      {selectedSupervisors[0]?.full_name ??
                        selectedSupervisors[0]?.email ??
                        'Sin nombre'}
                    </strong>
                  </span>
                ) : (
                  <span>
                    Responsables seleccionados:{' '}
                    <strong>{responsibleIds.length}</strong>
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1">
                {responsibleIds.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearResponsibles();
                    }}
                    className="rounded-full p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </div>
            </button>

            <AnimatePresence>
              {responsibleOpen && (
                <>
                  {/* overlay para cerrar con click fuera */}
                  <motion.div
                    className="fixed inset-0 z-20"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setResponsibleOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16 }}
                    className="absolute z-30 mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/95 p-2 text-[11px] text-slate-100 shadow-xl shadow-slate-950/70"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-2 flex items-center gap-1">
                      <Search className="h-3.5 w-3.5 text-slate-500" />
                      <input
                        value={responsibleSearch}
                        onChange={(e) =>
                          setResponsibleSearch(e.target.value)
                        }
                        placeholder="Buscar supervisor..."
                        className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    {filteredSupervisors.length === 0 ? (
                      <p className="px-1 py-1 text-[10px] text-slate-500">
                        No se encontraron supervisores.
                      </p>
                    ) : (
                      <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                        {filteredSupervisors.map((sup) => {
                          const isSelected = responsibleIds.includes(sup.id);
                          return (
                            <button
                              key={sup.id}
                              type="button"
                              onClick={() => toggleResponsible(sup.id)}
                              className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-left hover:bg-slate-800 ${
                                isSelected
                                  ? 'text-sky-200'
                                  : 'text-slate-100'
                              }`}
                            >
                              <span className="flex flex-col">
                                <span className="text-[11px]">
                                  {sup.full_name ?? sup.email ?? 'Sin nombre'}
                                </span>
                                {sup.email && (
                                  <span className="text-[10px] text-slate-500">
                                    {sup.email}
                                  </span>
                                )}
                              </span>
                              <span
                                className={`h-3 w-3 rounded-sm border border-slate-500 ${
                                  isSelected
                                    ? 'bg-sky-500/80 border-sky-400'
                                    : 'bg-transparent'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2">
                      <button
                        type="button"
                        onClick={clearResponsibles}
                        className="text-[10px] text-slate-400 hover:text-slate-200"
                      >
                        Limpiar selección
                      </button>
                      <button
                        type="button"
                        onClick={() => setResponsibleOpen(false)}
                        className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-medium text-sky-50 hover:bg-sky-500"
                      >
                        Aplicar
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Rango de fechas */}
          <div className="flex flex-wrap gap-2 md:justify-end">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400">Desde</span>
              <input
                type="date"
                value={dueFrom}
                onChange={(e) => handleChange({ dueFrom: e.target.value })}
                className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400">Hasta</span>
              <input
                type="date"
                value={dueTo}
                onChange={(e) => handleChange({ dueTo: e.target.value })}
                className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-100 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          </div>
        </div>

        {/* Chips resumen filtros activos */}
        <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-300">
          {search ||
          project ||
          status !== 'all' ||
          priority !== 'all' ||
          responsibleIds.length > 0 ||
          dueFrom ||
          dueTo ? (
            <>
              <span className="mr-1 text-slate-500">Filtros activos:</span>

              {search && (
                <FilterChip
                  label={`Texto: "${search}"`}
                  onClear={() => handleChange({ search: '' })}
                />
              )}

              {project && (
                <FilterChip
                  label={`Proyecto: "${project}"`}
                  onClear={() => handleChange({ project: '' })}
                />
              )}

              {status !== 'all' && (
                <FilterChip
                  label={`Estado: ${STATUS_LABELS[status]}`}
                  onClear={() => handleChange({ status: 'all' })}
                />
              )}

              {priority !== 'all' && (
                <FilterChip
                  label={`Prioridad: ${PRIORITY_LABELS[priority]}`}
                  onClear={() => handleChange({ priority: 'all' })}
                />
              )}

              {responsibleIds.length > 0 && (
                <FilterChip
                  label={`Responsables: ${responsibleIds.length}`}
                  onClear={clearResponsibles}
                />
              )}

              {dueFrom && (
                <FilterChip
                  label={`Desde: ${dueFrom}`}
                  onClear={() => handleChange({ dueFrom: '' })}
                />
              )}

              {dueTo && (
                <FilterChip
                  label={`Hasta: ${dueTo}`}
                  onClear={() => handleChange({ dueTo: '' })}
                />
              )}

              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...defaultFilters,
                    viewMode, // respetamos el modo de vista actual
                  })
                }
                className="ml-2 rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
              >
                Limpiar todo
              </button>
            </>
          ) : (
            <span className="text-slate-500">
              Sin filtros activos. Mostrando todas las tareas permitidas.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  description,
  accent = 'slate',
}: {
  label: string;
  value: number | string;
  description: string;
  accent?: 'slate' | 'emerald' | 'amber' | 'sky';
}) {
  const accentClasses: Record<string, string> = {
    slate: 'border-slate-700/70 bg-slate-900 text-slate-100',
    emerald: 'border-emerald-700/60 bg-emerald-900 text-emerald-50',
    amber: 'border-amber-700/60 bg-yellow-600 text-amber-50',
    sky: 'border-sky-700/60 bg-sky-950 text-sky-50',
  };

  return (
    <div
      className={`flex flex-col rounded-xl border px-3 py-2 text-xs shadow-sm ${accentClasses[accent]}`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/90">
        {label}
      </span>
      <span className="mt-1 text-lg font-semibold">{value}</span>
      <span className="mt-1 text-[10px] text-white/90">
        {description}
      </span>
    </div>
  );
}

function FilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5">
      <span>{label}</span>
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
