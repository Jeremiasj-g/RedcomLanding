"use client";

import { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  ListChecks,
  RotateCcw,
  Search,
  TrendingUp,
  Users2,
  X,
} from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RedcomDatePicker } from "@/components/ui/redcom-date-picker";
import { RedcomSelect } from "@/components/ui/redcom-select";
import type { AssigneeOption } from "@/lib/projectTasks";

export type ProjectTaskFiltersState = {
  search: string;
  status: "all" | "not_started" | "in_progress" | "done" | "cancelled";
  priority: "all" | "low" | "medium" | "high";
  project: string;
  responsibleIds: string[];
  dueFrom: string;
  dueTo: string;
  viewMode: "table" | "grid";
  showClosed: boolean;
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
  stats?: Stats;
  onChange: (next: ProjectTaskFiltersState) => void;
};

const STATUS_LABELS: Record<ProjectTaskFiltersState["status"], string> = {
  all: "Todos",
  not_started: "Sin empezar",
  in_progress: "En curso",
  done: "Completadas",
  cancelled: "Canceladas",
};

const PRIORITY_LABELS: Record<ProjectTaskFiltersState["priority"], string> = {
  all: "Todas",
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

const defaultFilters: ProjectTaskFiltersState = {
  search: "",
  status: "all",
  priority: "all",
  project: "",
  responsibleIds: [],
  dueFrom: "",
  dueTo: "",
  viewMode: "table",
  showClosed: true,
};

export default function ProjectTaskFilters({
  supervisors,
  value,
  stats,
  onChange,
}: Props) {
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
  } = safeValue;

  const [responsibleOpen, setResponsibleOpen] = useState(false);
  const [responsibleSearch, setResponsibleSearch] = useState("");

  const filteredSupervisors = useMemo(() => {
    const term = responsibleSearch.trim().toLowerCase();
    if (!term) return safeSupervisors;

    return safeSupervisors.filter((person) =>
      `${person.full_name ?? ""} ${person.email ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [responsibleSearch, safeSupervisors]);

  const selectedSupervisors = useMemo(
    () => safeSupervisors.filter((person) => responsibleIds.includes(person.id)),
    [responsibleIds, safeSupervisors],
  );

  const activeFilterCount = [
    Boolean(search),
    Boolean(project),
    status !== "all",
    priority !== "all",
    responsibleIds.length > 0,
    Boolean(dueFrom),
    Boolean(dueTo),
  ].filter(Boolean).length;

  const handleChange = (patch: Partial<ProjectTaskFiltersState>) => {
    onChange({ ...safeValue, ...patch });
  };

  const toggleResponsible = (id: string) => {
    const next = responsibleIds.includes(id)
      ? responsibleIds.filter((current) => current !== id)
      : [...responsibleIds, id];

    handleChange({ responsibleIds: next });
  };

  const clearResponsibles = () => {
    handleChange({ responsibleIds: [] });
    setResponsibleSearch("");
  };

  const clearAll = () => {
    onChange({
      ...defaultFilters,
      viewMode: safeValue.viewMode,
      showClosed: safeValue.showClosed,
    });
    setResponsibleSearch("");
  };

  const responsibleLabel =
    responsibleIds.length === 0
      ? "Todos los responsables"
      : responsibleIds.length === 1
        ? selectedSupervisors[0]?.full_name ??
          selectedSupervisors[0]?.email ??
          "1 responsable"
        : `${responsibleIds.length} responsables seleccionados`;

  return (
    <section className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Tareas visibles"
          value={safeStats.total}
          helper="Según los filtros actuales"
          icon={<ListChecks className="h-5 w-5" />}
          tone="indigo"
        />
        <MetricCard
          label="Completadas"
          value={safeStats.completed}
          helper="Marcadas como realizadas"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="teal"
        />
        <MetricCard
          label="Pendientes"
          value={safeStats.pending}
          helper="En curso o por iniciar"
          icon={<Clock3 className="h-5 w-5" />}
          tone="amber"
        />
        <MetricCard
          label="Avance global"
          value={`${safeStats.completionRate}%`}
          helper="Sobre todas las tareas visibles"
          icon={<TrendingUp className="h-5 w-5" />}
          tone="sky"
          progress={safeStats.completionRate}
        />
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,.07)]">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-950">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                <Filter className="h-4 w-4" />
              </span>
              Filtros inteligentes
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Encontrá tareas por estado, prioridad, responsable, proyecto o fecha.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700">
                {activeFilterCount} activo{activeFilterCount === 1 ? "" : "s"}
              </span>
            ) : null}
            <button
              type="button"
              onClick={clearAll}
              disabled={activeFilterCount === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restablecer
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(220px,.8fr)_190px_190px]">
            <Field label="Buscar">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => handleChange({ search: event.target.value })}
                  placeholder="Título, resumen o proyecto..."
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 hover:border-indigo-200 hover:bg-white focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
            </Field>

            <Field label="Proyecto">
              <input
                value={project}
                onChange={(event) => handleChange({ project: event.target.value })}
                placeholder="Nombre del proyecto"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 hover:border-indigo-200 hover:bg-white focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
              />
            </Field>

            <Field label="Estado">
              <RedcomSelect
                value={status}
                accent="indigo"
                onValueChange={(next) =>
                  handleChange({
                    status: next as ProjectTaskFiltersState["status"],
                  })
                }
                options={[
                  { value: "all", label: "Todos" },
                  { value: "not_started", label: "Sin empezar" },
                  { value: "in_progress", label: "En curso" },
                  { value: "done", label: "Completadas" },
                  { value: "cancelled", label: "Canceladas" },
                ]}
                aria-label="Filtrar por estado"
              />
            </Field>

            <Field label="Prioridad">
              <RedcomSelect
                value={priority}
                accent="teal"
                onValueChange={(next) =>
                  handleChange({
                    priority: next as ProjectTaskFiltersState["priority"],
                  })
                }
                options={[
                  { value: "all", label: "Todas" },
                  { value: "low", label: "Baja" },
                  { value: "medium", label: "Media" },
                  { value: "high", label: "Alta" },
                ]}
                aria-label="Filtrar por prioridad"
              />
            </Field>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_220px_220px]">
            <Field label="Responsables">
              <Popover open={responsibleOpen} onOpenChange={setResponsibleOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="group flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 text-left text-sm font-bold text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,.04)] outline-none transition hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:border-indigo-600 focus-visible:ring-4 focus-visible:ring-indigo-600/10 data-[state=open]:border-indigo-600 data-[state=open]:ring-4 data-[state=open]:ring-indigo-600/10"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                        <Users2 className="h-4 w-4" />
                      </span>
                      <span className="truncate">{responsibleLabel}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-data-[state=open]:rotate-180" />
                  </button>
                </PopoverTrigger>

                <PopoverContent
                  align="start"
                  sideOffset={8}
                  className="z-[240] w-[var(--radix-popover-trigger-width)] min-w-[320px] rounded-3xl border border-slate-200 bg-white p-2 shadow-[0_22px_60px_rgba(15,23,42,.16)]"
                >
                  <div className="relative border-b border-slate-100 p-2 pb-3">
                    <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-[calc(50%+2px)] text-slate-400" />
                    <input
                      value={responsibleSearch}
                      onChange={(event) => setResponsibleSearch(event.target.value)}
                      placeholder="Buscar responsable..."
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto p-1">
                    {filteredSupervisors.length === 0 ? (
                      <div className="px-3 py-8 text-center text-sm font-semibold text-slate-400">
                        No se encontraron responsables.
                      </div>
                    ) : (
                      filteredSupervisors.map((person) => {
                        const selected = responsibleIds.includes(person.id);
                        return (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() => toggleResponsible(person.id)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-indigo-50"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold text-slate-800">
                                {person.full_name ?? person.email ?? "Sin nombre"}
                              </span>
                              {person.email ? (
                                <span className="mt-0.5 block truncate text-xs font-medium text-slate-400">
                                  {person.email}
                                </span>
                              ) : null}
                            </span>
                            <span
                              className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition ${
                                selected
                                  ? "border-indigo-600 bg-indigo-600 text-white"
                                  : "border-slate-200 bg-white text-transparent"
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-2 pt-3">
                    <button
                      type="button"
                      onClick={clearResponsibles}
                      disabled={responsibleIds.length === 0}
                      className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={() => setResponsibleOpen(false)}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white transition hover:bg-indigo-700"
                    >
                      Aplicar
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </Field>

            <Field label="Vencimiento desde">
              <RedcomDatePicker
                value={dueFrom}
                onChange={(next) => handleChange({ dueFrom: next })}
                placeholder="Desde"
                accent="indigo"
                aria-label="Vencimiento desde"
              />
            </Field>

            <Field label="Vencimiento hasta">
              <RedcomDatePicker
                value={dueTo}
                onChange={(next) => handleChange({ dueTo: next })}
                placeholder="Hasta"
                accent="teal"
                aria-label="Vencimiento hasta"
              />
            </Field>
          </div>

          {activeFilterCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <span className="mr-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                Filtros activos
              </span>
              {search ? (
                <FilterChip label={`Texto: “${search}”`} onClear={() => handleChange({ search: "" })} />
              ) : null}
              {project ? (
                <FilterChip label={`Proyecto: “${project}”`} onClear={() => handleChange({ project: "" })} />
              ) : null}
              {status !== "all" ? (
                <FilterChip label={`Estado: ${STATUS_LABELS[status]}`} onClear={() => handleChange({ status: "all" })} />
              ) : null}
              {priority !== "all" ? (
                <FilterChip label={`Prioridad: ${PRIORITY_LABELS[priority]}`} onClear={() => handleChange({ priority: "all" })} />
              ) : null}
              {responsibleIds.length > 0 ? (
                <FilterChip label={`Responsables: ${responsibleIds.length}`} onClear={clearResponsibles} />
              ) : null}
              {dueFrom ? (
                <FilterChip label={`Desde: ${dueFrom}`} onClear={() => handleChange({ dueFrom: "" })} />
              ) : null}
              {dueTo ? (
                <FilterChip label={`Hasta: ${dueTo}`} onClear={() => handleChange({ dueTo: "" })} />
              ) : null}
            </div>
          ) : (
            <div className="border-t border-slate-100 pt-4 text-xs font-medium text-slate-400">
              Sin filtros activos. Se muestran todas las tareas permitidas para tu usuario.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  tone,
  progress,
}: {
  label: string;
  value: number | string;
  helper: string;
  icon: React.ReactNode;
  tone: "indigo" | "teal" | "amber" | "sky";
  progress?: number;
}) {
  const toneClasses = {
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    teal: "bg-teal-50 text-teal-700 ring-teal-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    sky: "bg-sky-50 text-sky-700 ring-sky-100",
  }[tone];

  const barClasses = {
    indigo: "bg-indigo-600",
    teal: "bg-teal-600",
    amber: "bg-amber-500",
    sky: "bg-sky-600",
  }[tone];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,.05)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
          <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</div>
          <div className="mt-1 text-xs font-medium text-slate-500">{helper}</div>
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-2xl ring-1 ${toneClasses}`}>
          {icon}
        </div>
      </div>
      {typeof progress === "number" ? (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${barClasses}`} style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }} />
        </div>
      ) : null}
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
    <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
      <span>{label}</span>
      <button
        type="button"
        onClick={onClear}
        className="grid h-4 w-4 place-items-center rounded-full text-indigo-400 transition hover:bg-indigo-100 hover:text-indigo-800"
        aria-label={`Quitar filtro ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
