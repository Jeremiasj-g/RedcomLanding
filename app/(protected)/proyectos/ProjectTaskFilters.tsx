"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Filter, Search, Users2, X } from "lucide-react";

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

const DEFAULT_FILTERS: ProjectTaskFiltersState = {
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

function statusTone(value: ProjectTaskFiltersState["status"]) {
  if (value === "in_progress") return "blue" as const;
  if (value === "done") return "green" as const;
  if (value === "cancelled") return "red" as const;
  return "neutral" as const;
}

function priorityTone(value: ProjectTaskFiltersState["priority"]) {
  if (value === "low") return "green" as const;
  if (value === "medium") return "amber" as const;
  if (value === "high") return "red" as const;
  return "neutral" as const;
}

export default function ProjectTaskFilters({
  supervisors,
  value,
  stats,
  onChange,
}: Props) {
  const safeValue = value ?? DEFAULT_FILTERS;
  const safeSupervisors = supervisors ?? [];
  const safeStats = stats ?? {
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

  const selectedSupervisors = useMemo(
    () => safeSupervisors.filter((person) => responsibleIds.includes(person.id)),
    [safeSupervisors, responsibleIds],
  );

  const filteredSupervisors = useMemo(() => {
    const term = responsibleSearch.trim().toLowerCase();
    if (!term) return safeSupervisors;
    return safeSupervisors.filter((person) =>
      `${person.full_name ?? ""} ${person.email ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [responsibleSearch, safeSupervisors]);

  const activeCount = [
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
    handleChange({
      responsibleIds: responsibleIds.includes(id)
        ? responsibleIds.filter((current) => current !== id)
        : [...responsibleIds, id],
    });
  };

  const clearResponsibles = () => {
    handleChange({ responsibleIds: [] });
    setResponsibleSearch("");
  };

  const resetAll = () => {
    onChange({
      ...DEFAULT_FILTERS,
      viewMode: safeValue.viewMode,
      showClosed: safeValue.showClosed,
    });
    setResponsibleSearch("");
  };

  const responsibleLabel =
    responsibleIds.length === 0
      ? "Todos"
      : responsibleIds.length === 1
        ? selectedSupervisors[0]?.full_name ??
          selectedSupervisors[0]?.email ??
          "1 seleccionado"
        : `${responsibleIds.length} seleccionados`;

  return (
    <section className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#17181b] shadow-[0_14px_40px_rgba(0,0,0,.18)]">
      <div className="grid grid-cols-2 border-b border-white/[0.07] md:grid-cols-4">
        <Metric label="Visibles" value={safeStats.total} />
        <Metric label="Completadas" value={safeStats.completed} />
        <Metric label="Pendientes" value={safeStats.pending} />
        <Metric label="Avance" value={`${safeStats.completionRate}%`} last />
      </div>

      <div className="px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/[0.58]" />
            <input
              value={search}
              onChange={(event) => handleChange({ search: event.target.value })}
              placeholder="Buscar tarea, resumen o proyecto"
              className="h-11 w-full rounded-[14px] border border-white/[0.08] bg-white/[0.04] pl-10 pr-3 text-sm font-normal text-[#f5f5f7] outline-none transition placeholder:text-white/[0.58] hover:bg-white/[0.055] focus:border-[#0a84ff]/60 focus:bg-white/[0.06] focus:ring-4 focus:ring-[#0a84ff]/10"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:w-[390px]">
            <RedcomSelect
              value={status}
              surface="dark"
              accent="indigo"
              triggerTone={statusTone(status)}
              className="h-11 rounded-[14px]"
              onValueChange={(next) =>
                handleChange({ status: next as ProjectTaskFiltersState["status"] })
              }
              options={[
                { value: "all", label: "Estado · Todos" },
                { value: "not_started", label: "Estado · Sin empezar" },
                { value: "in_progress", label: "Estado · En curso" },
                { value: "done", label: "Estado · Completadas" },
                { value: "cancelled", label: "Estado · Canceladas" },
              ]}
              aria-label="Filtrar por estado"
            />
            <RedcomSelect
              value={priority}
              surface="dark"
              accent="teal"
              triggerTone={priorityTone(priority)}
              className="h-11 rounded-[14px]"
              onValueChange={(next) =>
                handleChange({ priority: next as ProjectTaskFiltersState["priority"] })
              }
              options={[
                { value: "all", label: "Prioridad · Todas" },
                { value: "low", label: "Prioridad · Baja" },
                { value: "medium", label: "Prioridad · Media" },
                { value: "high", label: "Prioridad · Alta" },
              ]}
              aria-label="Filtrar por prioridad"
            />
          </div>
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_190px_190px]">
          <input
            value={project}
            onChange={(event) => handleChange({ project: event.target.value })}
            placeholder="Proyecto"
            className="h-11 w-full rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-normal text-[#f5f5f7] outline-none transition placeholder:text-white/[0.58] hover:bg-white/[0.055] focus:border-[#0a84ff]/60 focus:bg-white/[0.06] focus:ring-4 focus:ring-[#0a84ff]/10"
          />

          <Popover open={responsibleOpen} onOpenChange={setResponsibleOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-11 w-full items-center justify-between gap-3 rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-3 text-left text-sm font-normal text-[#f5f5f7] outline-none transition hover:bg-white/[0.055] focus-visible:border-[#0a84ff]/60 focus-visible:ring-4 focus-visible:ring-[#0a84ff]/10 data-[state=open]:border-[#0a84ff]/60 data-[state=open]:bg-white/[0.06]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Users2 className="h-4 w-4 shrink-0 text-white/[0.65]" />
                  <span className="truncate">Responsables · {responsibleLabel}</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-white/[0.58]" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={8}
              className="z-[240] w-[var(--radix-popover-trigger-width)] min-w-[320px] rounded-[18px] border border-white/[0.09] bg-[#1c1c1e] p-2 text-[#f5f5f7] shadow-[0_24px_70px_rgba(0,0,0,.38)]"
            >
              <div className="relative border-b border-white/[0.07] p-1 pb-2">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-[calc(50%+2px)] text-white/[0.50]" />
                <input
                  value={responsibleSearch}
                  onChange={(event) => setResponsibleSearch(event.target.value)}
                  placeholder="Buscar responsable"
                  className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.05] pl-9 pr-3 text-sm font-normal text-white outline-none placeholder:text-white/[0.46] focus:border-[#0a84ff]/[0.55] focus:ring-4 focus:ring-[#0a84ff]/10"
                />
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {filteredSupervisors.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm font-normal text-white/[0.65]">
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
                        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.055]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-white/[0.94]">
                            {person.full_name ?? person.email ?? "Sin nombre"}
                          </span>
                          {person.email ? (
                            <span className="mt-0.5 block truncate text-xs font-normal text-white/[0.65]">
                              {person.email}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition ${
                            selected
                              ? "border-[#0a84ff] bg-[#0a84ff] text-white"
                              : "border-white/[0.15] bg-transparent text-transparent"
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.07] p-1 pt-2">
                <button
                  type="button"
                  onClick={clearResponsibles}
                  disabled={responsibleIds.length === 0}
                  className="rounded-xl px-3 py-2 text-xs font-medium text-white/[0.72] transition hover:bg-white/[0.05] hover:text-white/[0.88] disabled:opacity-30"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => setResponsibleOpen(false)}
                  className="rounded-xl bg-[#0a84ff] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#409cff]"
                >
                  Aplicar
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <RedcomDatePicker
            value={dueFrom}
            onChange={(next) => handleChange({ dueFrom: next })}
            placeholder="Desde"
            surface="dark"
            accent="indigo"
            className="h-11 rounded-[14px]"
            aria-label="Vencimiento desde"
          />
          <RedcomDatePicker
            value={dueTo}
            onChange={(next) => handleChange({ dueTo: next })}
            placeholder="Hasta"
            surface="dark"
            accent="indigo"
            className="h-11 rounded-[14px]"
            aria-label="Vencimiento hasta"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-3">
          <div className="mr-auto flex items-center gap-2 text-xs font-normal text-white/[0.68]">
            <Filter className="h-3.5 w-3.5" />
            {activeCount === 0
              ? "Sin filtros activos"
              : `${activeCount} filtro${activeCount === 1 ? "" : "s"} activo${activeCount === 1 ? "" : "s"}`}
          </div>

          {status !== "all" ? (
            <Chip label={STATUS_LABELS[status]} onClear={() => handleChange({ status: "all" })} />
          ) : null}
          {priority !== "all" ? (
            <Chip label={PRIORITY_LABELS[priority]} onClear={() => handleChange({ priority: "all" })} />
          ) : null}
          {responsibleIds.length > 0 ? (
            <Chip label={`${responsibleIds.length} responsables`} onClear={clearResponsibles} />
          ) : null}

          {activeCount > 0 ? (
            <button
              type="button"
              onClick={resetAll}
              className="ml-1 rounded-lg px-2 py-1 text-xs font-normal text-[#0a84ff] transition hover:bg-[#0a84ff]/10"
            >
              Restablecer
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  last = false,
}: {
  label: string;
  value: number | string;
  last?: boolean;
}) {
  return (
    <div className={`px-4 py-4 sm:px-5 ${last ? "" : "border-r border-white/[0.07]"}`}>
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.65]">{label}</div>
      <div className="mt-1 text-2xl font-medium tracking-[-0.035em] text-white">{value}</div>
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-white/[0.055] px-2 py-1 text-[11px] font-normal text-white/[0.78]">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="rounded-md p-0.5 text-white/[0.58] transition hover:bg-white/[0.07] hover:text-white/[0.82]"
        aria-label={`Quitar filtro ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
