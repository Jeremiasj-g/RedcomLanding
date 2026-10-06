"use client";

import {
  Archive,
  CalendarDays,
  CheckCircle2,
  CirclePause,
  FolderKanban,
  Loader2,
  Plus,
  Users2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { RedcomDatePicker } from "@/components/ui/redcom-date-picker";
import { RedcomSelect } from "@/components/ui/redcom-select";
import { errorMessage, notify } from "@/lib/notifications";
import { isPastIsoDate, laterIsoDate, localTodayIso } from "@/lib/dateValidation";
import type { ProjectTaskWithAssignees } from "@/lib/projectTasks";
import {
  createProject,
  updateProject,
  type ProjectStatus,
  type ProjectWithMembers,
} from "@/lib/projects";

type Props = {
  projects: ProjectWithMembers[];
  tasks: ProjectTaskWithAssignees[];
  currentUserId: string;
  canManage: boolean;
  onProjectCreated: (project: ProjectWithMembers) => void;
  onProjectUpdated: (project: ProjectWithMembers) => void;
  onOpenTasks: (project: ProjectWithMembers) => void;
};

const STATUS_OPTIONS: Array<{
  value: ProjectStatus;
  label: string;
}> = [
  { value: "active", label: "Activo" },
  { value: "paused", label: "En pausa" },
  { value: "completed", label: "Finalizado" },
  { value: "archived", label: "Archivado" },
];

function statusTone(status: ProjectStatus) {
  if (status === "active") return "blue" as const;
  if (status === "completed") return "green" as const;
  if (status === "paused") return "amber" as const;
  return "neutral" as const;
}

function statusLabel(status: ProjectStatus) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function initials(value: string) {
  const pieces = value.trim().split(/\s+/).filter(Boolean);
  if (!pieces.length) return "?";
  return pieces
    .slice(0, 2)
    .map((piece) => piece[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ProjectPortfolio({
  projects,
  tasks,
  currentUserId,
  canManage,
  onProjectCreated,
  onProjectUpdated,
  onOpenTasks,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const todayIso = localTodayIso();

  const metrics = useMemo(() => {
    const active = projects.filter((project) => project.status === "active").length;
    const paused = projects.filter((project) => project.status === "paused").length;
    const completed = projects.filter((project) => project.status === "completed").length;
    return { total: projects.length, active, paused, completed };
  }, [projects]);

  const taskStats = useMemo(() => {
    const map = new Map<
      number,
      {
        total: number;
        done: number;
        pending: number;
        members: Map<
          string,
          ProjectTaskWithAssignees["assignees"][number]
        >;
        firstTaskDate: string | null;
        lastDueDate: string | null;
      }
    >();

    for (const project of projects) {
      map.set(project.id, {
        total: 0,
        done: 0,
        pending: 0,
        members: new Map(),
        firstTaskDate: null,
        lastDueDate: null,
      });
    }

    for (const task of tasks) {
      if (!task.project_id) continue;
      const current = map.get(task.project_id);
      if (!current) continue;

      current.total += 1;
      if (task.status === "done") current.done += 1;
      else if (task.status !== "cancelled") current.pending += 1;

      task.assignees.forEach((assignee) => {
        current.members.set(assignee.user_id, assignee);
      });

      const createdDate = task.created_at?.slice(0, 10) ?? null;
      if (
        createdDate &&
        (!current.firstTaskDate || createdDate < current.firstTaskDate)
      ) {
        current.firstTaskDate = createdDate;
      }

      if (
        task.due_date &&
        (!current.lastDueDate || task.due_date > current.lastDueDate)
      ) {
        current.lastDueDate = task.due_date;
      }
    }

    return map;
  }, [projects, tasks]);

  const resetCreate = () => {
    setName("");
    setDescription("");
    setStartDate("");
    setDueDate("");
  };

  const handleCreate = async () => {
    const cleanName = name.trim();
    const cleanDescription = description.trim();

    if (!cleanName) {
      notify.error("Ingresá un nombre para el proyecto.");
      return;
    }

    if (cleanName.length > 120) {
      notify.error("El nombre del proyecto no puede superar los 120 caracteres.");
      return;
    }

    if (cleanDescription.length > 500) {
      notify.error("La descripción no puede superar los 500 caracteres.");
      return;
    }

    const duplicate = projects.some(
      (project) =>
        project.name.localeCompare(cleanName, "es", {
          sensitivity: "base",
        }) === 0,
    );

    if (duplicate) {
      notify.error("Ya existe un proyecto con ese nombre.");
      return;
    }

    if (dueDate && isPastIsoDate(dueDate, todayIso)) {
      notify.error("La fecha objetivo no puede ser anterior a hoy.");
      return;
    }

    if (startDate && dueDate && dueDate < startDate) {
      notify.error("La fecha objetivo no puede ser anterior a la fecha de inicio.");
      return;
    }

    try {
      setSaving(true);
      const created = await createProject(currentUserId, {
        name: cleanName,
        description: cleanDescription,
        start_date: startDate || null,
        due_date: dueDate || null,
      });

      onProjectCreated(created);
      resetCreate();
      setCreating(false);
      notify.success("Proyecto creado.");
    } catch (error) {
      notify.error(errorMessage(error, "No se pudo crear el proyecto."));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (
    project: ProjectWithMembers,
    status: ProjectStatus,
  ) => {
    if (project.status === status) return;

    try {
      setUpdatingId(project.id);
      const updated = await updateProject(project.id, { status });
      onProjectUpdated(updated);
      notify.success(`Proyecto · ${statusLabel(status)}`);
    } catch (error) {
      notify.error(errorMessage(error, "No se pudo actualizar el proyecto."));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#151517] shadow-[0_16px_45px_rgba(0,0,0,.18)]">
      <div className="flex flex-col gap-4 border-b border-white/[0.07] px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-[#5ac8fa]" />
            <h2 className="text-sm font-medium text-white/[0.94]">
              Portafolio de proyectos
            </h2>
          </div>
          <p className="mt-1 text-xs font-normal text-white/[0.62]">
            Cada proyecto ahora existe por sí mismo y agrupa sus tareas, responsables, fechas y progreso.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-normal text-white/[0.58]">
          <span>{metrics.total} proyectos</span>
          <span className="text-white/[0.20]">•</span>
          <span>{metrics.active} activos</span>
          <span className="text-white/[0.20]">•</span>
          <span>{metrics.completed} finalizados</span>
          {metrics.paused ? (
            <>
              <span className="text-white/[0.20]">•</span>
              <span>{metrics.paused} en pausa</span>
            </>
          ) : null}

          {canManage ? (
            <button
              type="button"
              onClick={() => setCreating((current) => !current)}
              className="ml-2 inline-flex h-9 items-center gap-1.5 rounded-[11px] bg-white/[0.08] px-3 text-[11px] font-medium text-white/[0.86] transition hover:bg-white/[0.12] hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              {creating ? "Cancelar" : "Nuevo proyecto"}
            </button>
          ) : null}
        </div>
      </div>

      {creating ? (
        <div className="border-b border-white/[0.07] bg-white/[0.02] p-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_190px_190px_auto] xl:items-end">
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.48]">
                Nombre
              </label>
              <input
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej: Portal comercial 2027"
                className="h-11 w-full rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-medium text-white/[0.92] outline-none transition placeholder:font-normal placeholder:text-white/[0.40] focus:border-[#0a84ff]/60 focus:bg-white/[0.06] focus:ring-4 focus:ring-[#0a84ff]/10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.48]">
                Descripción
              </label>
              <input
                value={description}
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Objetivo o alcance del proyecto"
                className="h-11 w-full rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-normal text-white/[0.88] outline-none transition placeholder:text-white/[0.40] focus:border-[#0a84ff]/60 focus:bg-white/[0.06] focus:ring-4 focus:ring-[#0a84ff]/10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.48]">
                Inicio
              </label>
              <RedcomDatePicker
                value={startDate}
                onChange={(value) => {
                  setStartDate(value);
                  if (value && dueDate && dueDate < value) {
                    setDueDate("");
                  }
                }}
                placeholder="Sin fecha"
                surface="dark"
                accent="indigo"
                className="h-11 rounded-[14px]"
                aria-label="Fecha de inicio del proyecto"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.48]">
                Objetivo
              </label>
              <RedcomDatePicker
                value={dueDate}
                onChange={setDueDate}
                minDate={laterIsoDate(todayIso, startDate)}
                placeholder="Sin fecha"
                surface="dark"
                accent="indigo"
                className="h-11 rounded-[14px]"
                aria-label="Fecha objetivo del proyecto"
              />
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="inline-flex h-11 min-w-[120px] items-center justify-center gap-2 rounded-[13px] bg-[#0a84ff] px-4 text-sm font-medium text-white transition hover:bg-[#409cff] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <div className="min-w-[1050px]">
          <div className="grid grid-cols-[minmax(280px,1.6fr)_150px_220px_190px_minmax(220px,1fr)_120px] border-b border-white/[0.07] bg-white/[0.025] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.55]">
            <div>Proyecto</div>
            <div>Estado</div>
            <div>Progreso</div>
            <div>Fechas</div>
            <div>Equipo</div>
            <div />
          </div>

          {projects.length === 0 ? (
            <div className="grid min-h-[220px] place-items-center px-6 text-center">
              <div>
                <FolderKanban className="mx-auto h-6 w-6 text-white/[0.28]" />
                <div className="mt-3 text-sm font-medium text-white/[0.78]">
                  Todavía no hay proyectos
                </div>
                <p className="mt-1 text-xs font-normal text-white/[0.45]">
                  Creá el primero para empezar a organizar las tareas por iniciativa.
                </p>
              </div>
            </div>
          ) : (
            projects.map((project) => {
              const stats = taskStats.get(project.id) ?? {
                total: 0,
                done: 0,
                pending: 0,
                members: new Map<
                  string,
                  ProjectTaskWithAssignees["assignees"][number]
                >(),
                firstTaskDate: null,
                lastDueDate: null,
              };
              const progress = stats.total
                ? Math.round((stats.done / stats.total) * 100)
                : 0;

              // Administradores/JDV ven la entidad proyecto completa.
              // Un supervisor, en cambio, sólo debe ver el alcance de las
              // tareas que efectivamente tiene visibles/asignadas.
              const scopedMembers = canManage
                ? project.members
                : Array.from(stats.members.values());

              const visibleStartDate = canManage
                ? project.start_date
                : stats.firstTaskDate ?? project.start_date;

              const visibleDueDate = canManage
                ? project.due_date
                : stats.lastDueDate ?? project.due_date;
              const owner =
                project.owner_name ??
                project.owner_email ??
                project.members.find((member) => member.member_role === "owner")
                  ?.full_name ??
                "Sin responsable";

              return (
                <div
                  key={project.id}
                  className={`grid grid-cols-[minmax(280px,1.6fr)_150px_220px_190px_minmax(220px,1fr)_120px] items-center border-b border-white/[0.055] px-5 py-4 transition hover:bg-white/[0.025] ${
                    project.status === "archived" ? "opacity-55" : ""
                  }`}
                >
                  <div className="min-w-0 pr-6">
                    <div className="truncate text-sm font-medium text-white/[0.92]">
                      {project.name}
                    </div>
                    <div className="mt-1 line-clamp-1 text-[11px] font-normal text-white/[0.45]">
                      {project.description || "Sin descripción"}
                    </div>
                    <div className="mt-1.5 text-[10px] font-normal text-white/[0.36]">
                      Responsable · {owner}
                    </div>
                  </div>

                  <div className="pr-4">
                    {canManage ? (
                      <RedcomSelect
                        value={project.status}
                        surface="dark"
                        accent="indigo"
                        triggerTone={statusTone(project.status)}
                        disabled={updatingId === project.id}
                        className="h-9 rounded-[12px] text-xs"
                        onValueChange={(next) =>
                          void handleStatusChange(project, next as ProjectStatus)
                        }
                        options={STATUS_OPTIONS}
                        aria-label={`Estado de ${project.name}`}
                      />
                    ) : (
                      <span className="text-xs font-normal text-white/[0.70]">
                        {statusLabel(project.status)}
                      </span>
                    )}
                  </div>

                  <div className="pr-5">
                    <div className="flex items-center justify-between text-[10px] font-normal text-white/[0.48]">
                      <span>{stats.done} de {stats.total} tareas</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.055]">
                      <div
                        className="h-full rounded-full bg-[#0a84ff] transition-all duration-300"
                        style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
                      />
                    </div>
                    <div className="mt-1.5 text-[9px] font-normal text-white/[0.30]">
                      {stats.pending} pendientes
                    </div>
                  </div>

                  <div className="space-y-1 text-[10px] font-normal text-white/[0.55]">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3 text-white/[0.28]" />
                      {formatDate(visibleStartDate)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-white/[0.28]" />
                      {formatDate(visibleDueDate)}
                    </div>
                  </div>

                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex -space-x-1.5">
                      {scopedMembers.slice(0, 4).map((member) => {
                        const label =
                          member.full_name ?? member.email ?? "Miembro";
                        return (
                          <span
                            key={member.user_id}
                            title={label}
                            className="grid h-7 w-7 place-items-center rounded-full border border-[#151517] bg-white/[0.08] text-[9px] font-medium text-white/[0.72]"
                          >
                            {initials(label)}
                          </span>
                        );
                      })}
                      {scopedMembers.length > 4 ? (
                        <span className="grid h-7 w-7 place-items-center rounded-full border border-[#151517] bg-white/[0.055] text-[9px] font-medium text-white/[0.50]">
                          +{scopedMembers.length - 4}
                        </span>
                      ) : null}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-normal text-white/[0.38]">
                      <Users2 className="h-3 w-3" />
                      {scopedMembers.length}
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onOpenTasks(project)}
                      className="h-9 rounded-[11px] px-3 text-[10px] font-medium text-[#5ac8fa] transition hover:bg-[#0a84ff]/10"
                    >
                      Ver tareas
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-white/[0.07] px-5 py-3 text-[10px] font-normal text-white/[0.36]">
        <CirclePause className="h-3.5 w-3.5" />
        Pausar conserva el proyecto y sus tareas. Archivar lo retira del trabajo activo sin eliminar historial.
        <Archive className="ml-auto h-3.5 w-3.5 text-white/[0.22]" />
      </div>
    </section>
  );
}
