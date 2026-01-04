'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Loader2,
  Plus,
  ChevronDown,
  Users2,
  Trash2,
  Ban,
} from 'lucide-react';

import {
  fetchProjectTasksForUser,
  fetchEligibleAssignees,
  createProjectTask,
  updateProjectTask,
  setTaskAssignees,
  type ProjectTaskWithAssignees,
  type ProjectTaskStatus,
  type ProjectTaskPriority,
  type AssigneeOption,
} from '@/lib/projectTasks';
import { RequireAuth } from '@/components/RouteGuards';
import { useMe } from '@/hooks/useMe';
import ProjectTaskDrawer from './ProjectTaskDrawer';
import { supabase } from '@/lib/supabaseClient';
import ProjectTaskFilters, {
  ProjectTaskFiltersState,
} from './ProjectTaskFilters';
import DualSpinner from '@/components/ui/DualSpinner';

// ─────────────────────────────────────────
//  Tailwind helpers
// ─────────────────────────────────────────
const TABLE_GRID_COLS =
  'grid grid-cols-[minmax(0,2.5fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,2fr)]';

const TABLE_HEADER_CELL =
  'border-b border-slate-800 bg-slate-950 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400';

const TABLE_ROW_BASE =
  'border-t border-slate-900/70 bg-slate-900/70 px-4 py-2 text-[11px] text-slate-100 hover:bg-slate-900';

const BADGE_PILL_BASE =
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium';

const SMALL_PILL_BASE =
  'rounded-full px-2 py-0.5 text-[10px]';

const POPOVER_OVERLAY = 'fixed inset-0 z-10';

const STATUS_POPOVER_PANEL =
  'absolute z-20 mt-1 w-44 rounded-xl border border-slate-800 bg-slate-950/95 p-1 text-[11px] text-slate-100 shadow-xl shadow-slate-950/70';

const PRIORITY_POPOVER_PANEL =
  'absolute z-20 mt-1 w-40 rounded-xl border border-slate-800 bg-slate-950/95 p-1 text-[11px] text-slate-100 shadow-xl shadow-slate-950/70';

const ASSIGNEES_POPOVER_PANEL =
  'absolute right-0 top-6 z-20 w-64 rounded-xl border border-slate-800 bg-slate-950/95 p-2 text-[11px] text-slate-100 shadow-xl shadow-slate-950/70';

const PAGINATION_BTN_BASE =
  'rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';

// ─────────────────────────────────────────
//  Config visual Estado / Prioridad (Notion-like)
// ─────────────────────────────────────────
const STATUS_OPTIONS: {
  value: ProjectTaskStatus;
  label: string;
  pillClass: string;
  dotClass: string;
}[] = [
    {
      value: 'not_started',
      label: 'Sin empezar',
      pillClass: 'bg-slate-800 text-slate-100',
      dotClass: 'bg-slate-300',
    },
    {
      value: 'in_progress',
      label: 'En curso',
      pillClass: 'bg-sky-500/15 text-sky-300',
      dotClass: 'bg-sky-400',
    },
    {
      value: 'done',
      label: 'Completada',
      pillClass: 'bg-emerald-500/15 text-emerald-300',
      dotClass: 'bg-emerald-400',
    },
    {
      value: 'cancelled',
      label: 'Cancelada',
      pillClass: 'bg-rose-500/15 text-rose-300',
      dotClass: 'bg-rose-400',
    },
  ];

const PRIORITY_OPTIONS: {
  value: ProjectTaskPriority;
  label: string;
  pillClass: string;
  dotClass: string;
}[] = [
    {
      value: 'low',
      label: 'Baja',
      pillClass: 'bg-emerald-500/15 text-emerald-300',
      dotClass: 'bg-emerald-400',
    },
    {
      value: 'medium',
      label: 'Media',
      pillClass: 'bg-amber-500/20 text-amber-200',
      dotClass: 'bg-amber-400',
    },
    {
      value: 'high',
      label: 'Alta',
      pillClass: 'bg-rose-500/15 text-rose-300',
      dotClass: 'bg-rose-400',
    },
  ];

function getStatusConfig(value: ProjectTaskStatus) {
  return STATUS_OPTIONS.find((s) => s.value === value) ?? STATUS_OPTIONS[0];
}

function getPriorityConfig(value: ProjectTaskPriority) {
  return (
    PRIORITY_OPTIONS.find((p) => p.value === value) ?? PRIORITY_OPTIONS[1]
  );
}

const PAGE_SIZE = 15;

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return 'Sin fecha';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    // por si viene solo "yyyy-mm-dd"
    return dateStr.slice(0, 10);
  }
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function ProyectosPage() {
  const { me, loading: loadingMe } = useMe();

  const [tasks, setTasks] = useState<ProjectTaskWithAssignees[]>([]);
  const [supervisors, setSupervisors] = useState<AssigneeOption[]>([]);
  const [selectedTask, setSelectedTask] =
    useState<ProjectTaskWithAssignees | null>(null);

  const [loading, setLoading] = useState(true);

  // creación rápida (admin + JDV)
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newProject, setNewProject] = useState('');
  const [newDueDate, setNewDueDate] = useState(''); // yyyy-mm-dd

  // dropdowns por fila
  const [statusOpenFor, setStatusOpenFor] = useState<number | null>(null);
  const [priorityOpenFor, setPriorityOpenFor] = useState<number | null>(null);
  const [assigneesOpenFor, setAssigneesOpenFor] =
    useState<number | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  // filtros
  const [filters, setFilters] = useState<ProjectTaskFiltersState>({
    search: '',
    status: 'all',
    priority: 'all',
    project: '',
    responsibleIds: [], // multi
    dueFrom: '',
    dueTo: '',
    viewMode: 'table',
  });

  // vista (tabla / grid) – por ahora solo tabla pero lo dejamos listo
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // paginación
  const [page, setPage] = useState(1);

  const isAdmin = me?.role === 'admin';
  const canManage = isAdmin || me?.role === 'jdv';

  const closeAllPopovers = () => {
    setStatusOpenFor(null);
    setPriorityOpenFor(null);
    setAssigneesOpenFor(null);
  };

  // ─────────────────────────────────────────
  // 1) Cargar tareas visibles + supervisores
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!me) return;

    const load = async () => {
      try {
        setLoading(true);
        const [tasksData, supervisorsData] = await Promise.all([
          fetchProjectTasksForUser(me.id, me.role),
          fetchEligibleAssignees(me.role),
        ]);
        setTasks(tasksData);
        setSupervisors(supervisorsData);
      } catch (err) {
        console.error('Error cargando proyectos/tareas', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [me]);

  // reset search cuando cerramos el popup de responsables
  useEffect(() => {
    if (assigneesOpenFor === null) {
      setAssigneeSearch('');
    }
  }, [assigneesOpenFor]);

  // cerrar todos los popovers con ESC
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAllPopovers();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  // ─────────────────────────────────────────
  // 1b) Hidratar responsables con nombres/emails
  // ─────────────────────────────────────────
  const supervisorById = useMemo(() => {
    const map = new Map<string, AssigneeOption>();
    supervisors.forEach((s) => {
      map.set(s.id, s);
    });
    return map;
  }, [supervisors]);

  const hydratedTasks = useMemo(
    () =>
      tasks.map((t) => ({
        ...t,
        assignees: t.assignees.map((a) => {
          // si ya vino con nombre/email desde el backend, respetamos eso
          if (a.full_name || a.email) return a;

          const sup = supervisorById.get(a.user_id);
          if (!sup) return a;

          return {
            ...a,
            full_name: sup.full_name ?? a.full_name,
            email: sup.email ?? a.email,
          };
        }),
      })),
    [tasks, supervisorById],
  );

  // ─────────────────────────────────────────
  // Filtro + métricas
  // ─────────────────────────────────────────
  const filteredTasks = hydratedTasks.filter((t) => {
    // search
    if (filters.search) {
      const text = `${t.title} ${t.summary ?? ''} ${t.project ?? ''}`.toLowerCase();
      if (!text.includes(filters.search.toLowerCase())) return false;
    }

    // estado
    if (filters.status !== 'all' && t.status !== filters.status) return false;

    // prioridad
    if (filters.priority !== 'all' && t.priority !== filters.priority) {
      return false;
    }

    // proyecto
    if (
      filters.project &&
      !(t.project ?? '').toLowerCase().includes(filters.project.toLowerCase())
    ) {
      return false;
    }

    // responsables (multi)
    if (filters.responsibleIds.length > 0) {
      const ids = new Set(filters.responsibleIds);
      if (!t.assignees.some((a) => ids.has(a.user_id))) return false;
    }

    // fechas (comparación sencilla yyyy-mm-dd)
    if (filters.dueFrom && (!t.due_date || t.due_date < filters.dueFrom)) {
      return false;
    }
    if (filters.dueTo && (!t.due_date || t.due_date > filters.dueTo)) {
      return false;
    }

    return true;
  });

  // métricas
  const totalTasks = hydratedTasks.length;
  const completedTasks = hydratedTasks.filter(
    (t) => t.status === 'done',
  ).length;
  const pendingTasks = totalTasks - completedTasks;
  const completionRate =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const totalVisible = filteredTasks.length;
  const completedVisible = filteredTasks.filter(
    (t) => t.status === 'done',
  ).length;
  const pendingVisible = totalVisible - completedVisible;

  // ajustar página si cambia la cantidad filtrada
  useEffect(() => {
    setPage((prev) => {
      const maxPage = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
      return Math.min(prev, maxPage);
    });
  }, [filteredTasks.length]);

  // Helpers de vista (paginación)
  const totalPages = Math.max(
    1,
    Math.ceil(filteredTasks.length / PAGE_SIZE),
  );
  const startIndex = (page - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const visibleTasks = filteredTasks.slice(startIndex, endIndex);

  // ─────────────────────────────────────────
  // 2) Crear tarea nueva (solo admin)
  // ─────────────────────────────────────────
  const handleCreate = async () => {
    if (!canManage) return;
    if (!me) return;
    if (!newTitle.trim()) return;

    try {
      setCreating(true);

      const payload = {
        title: newTitle.trim(),
        project: newProject.trim() || 'Proyecto general',
        summary: newSummary.trim() || null,
        status: 'not_started' as ProjectTaskStatus,
        priority: 'medium' as ProjectTaskPriority,
        due_date: newDueDate || null,
        assigneeIds: [me.id],
      };

      const created = await createProjectTask(me.id, payload);
      setTasks((prev) => [created, ...prev]);
      setNewTitle('');
      setNewSummary('');
      setNewProject('');
      setNewDueDate('');
      setPage(1);
    } catch (err) {
      console.error('Error creating project task', err);
    } finally {
      setCreating(false);
    }
  };

  // ─────────────────────────────────────────
  // 3) Helpers de actualización local
  // ─────────────────────────────────────────
  const patchTask = (updated: ProjectTaskWithAssignees) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const removeTask = (id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedTask((prev) => (prev && prev.id === id ? null : prev));
  };

  const handleChangeStatus = async (
    task: ProjectTaskWithAssignees,
    status: ProjectTaskStatus,
  ) => {
    if ((task as any).is_locked) return;

    try {
      const updatedRow = await updateProjectTask(task.id, { status });
      const updated: ProjectTaskWithAssignees = {
        ...updatedRow,
        assignees: task.assignees,
      };
      patchTask(updated);
    } catch (err) {
      console.error('Error updating status', err);
    } finally {
      setStatusOpenFor(null);
    }
  };



  const handleChangePriority = async (
    task: ProjectTaskWithAssignees,
    priority: ProjectTaskPriority,
  ) => {
    if ((task as any).is_locked) return;

    try {
      const updatedRow = await updateProjectTask(task.id, { priority });
      const updated: ProjectTaskWithAssignees = {
        ...updatedRow,
        assignees: task.assignees,
      };
      patchTask(updated);
    } catch (err) {
      console.error('Error updating priority', err);
    } finally {
      setPriorityOpenFor(null);
    }
  };

  const handleToggleAssignee = async (
    task: ProjectTaskWithAssignees,
    userId: string,
  ) => {
    if (!canManage) return;
    if ((task as any).is_locked) return;

    const currentIds = new Set(task.assignees.map((a) => a.user_id));
    if (currentIds.has(userId)) currentIds.delete(userId);
    else currentIds.add(userId);
    const newIds = Array.from(currentIds);

    try {
      await setTaskAssignees(task.id, newIds);

      const mapById = new Map(supervisors.map((s) => [s.id, s]));
      const newAssignees = newIds.map((id) => {
        const sup = mapById.get(id);
        return {
          user_id: id,
          full_name: sup?.full_name ?? null,
          email: sup?.email ?? null,
          role: (sup?.role ?? null) as any,
        };
      });

      const updated: ProjectTaskWithAssignees = {
        ...task,
        assignees: newAssignees,
      };
      patchTask(updated);
    } catch (err) {
      console.error('Error updating assignees', err);
    }
  };

  const handleTaskUpdatedFromDrawer = (updated: ProjectTaskWithAssignees) => {
    patchTask(updated);
    setSelectedTask(updated);
  };

  // Cerrar tarea
  const handleCloseTask = async (task: ProjectTaskWithAssignees) => {
    if (!canManage) return;
    if ((task as any).is_locked) return;

    try {
      const updatedRow = await updateProjectTask(task.id, {
        is_locked: true,
      } as any);
      const updated: ProjectTaskWithAssignees = {
        ...updatedRow,
        assignees: task.assignees,
      };
      patchTask(updated);
      setSelectedTask((prev) => (prev && prev.id === task.id ? updated : prev));
    } catch (err) {
      console.error('Error al cerrar tarea', err);
    } finally {
      closeAllPopovers();
    }
  };

  // Eliminar tarea
  const handleDeleteTask = async (task: ProjectTaskWithAssignees) => {
    if (!canManage) return;
    const ok = window.confirm(
      `¿Seguro que querés eliminar la tarea "${task.title}"? Esta acción no se puede deshacer.`,
    );
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('project_tasks')
        .delete()
        .eq('id', task.id);

      if (error) {
        console.error('Error deleting task', error);
        return;
      }
      removeTask(task.id);
    } catch (err) {
      console.error('Error deleting task', err);
    } finally {
      setAssigneesOpenFor(null);
    }
  };

  // ─────────────────────────────────────────
  // 4) Loading inicial de usuario
  // ─────────────────────────────────────────
  if (loadingMe && !me) {
    return (
      <RequireAuth roles={['admin', 'supervisor']}>
        <div className="grid min-h-[80vh] place-items-center">
          <DualSpinner size={60} thickness={4} />
        </div>
      </RequireAuth>
    );
  }



  return (
    <RequireAuth roles={['admin', 'supervisor']}>
      <div className="mx-auto flex min-h-[80vh] max-w-7xl flex-col gap-6 px-4 py-10">
        {/* Header */}
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
              <Users2 className="h-5 w-5 text-slate-900" />
              Proyectos y tareas
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Vista de tareas grupales. Solo ves los proyectos en los que sos
              responsable (el admin ve todos).
            </p>
          </div>
        </header>

        {/* Resumen + filtros */}
        <ProjectTaskFilters
          supervisors={supervisors}
          value={filters}
          onChange={setFilters}
          stats={{
            total: totalVisible,
            completed: completedVisible,
            pending: pendingVisible,
            completionRate,
          }}
        />

        {/* Tabla estilo Notion (por ahora solo vista tabla) */}
        <section className="rounded-2xl border border-slate-200 bg-slate-950/90 shadow-lg shadow-slate-900/40">
          {/* Encabezado */}
          <div className={`${TABLE_GRID_COLS} ${TABLE_HEADER_CELL}`}>
            <div>Tarea / Proyecto</div>
            <div>Estado</div>
            <div>Prioridad</div>
            <div>Fecha límite</div>
            <div>Responsables</div>
          </div>

          {/* Fila creación rápida */}
          {canManage && (
            <div
              className={`${TABLE_GRID_COLS} border-b border-slate-800 bg-slate-900/80 px-4 py-2 text-xs text-slate-100`}
            >
              <div className="flex flex-col gap-1 pr-2">
                <input
                  className="w-full rounded-md border border-slate-700/80 bg-slate-900 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  placeholder="Nombre de la tarea (ej: Consumo de APIs)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <input
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  placeholder="Resumen breve (opcional)"
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                />
                <input
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Proyecto (ej: Portal Redcom V2)"
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                />
              </div>

              <div className="flex items-center text-[11px] text-slate-500">
                <span
                  className={`${BADGE_PILL_BASE} bg-slate-800 text-slate-100`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  Sin empezar
                </span>
              </div>

              <div className="flex items-center text-[11px] text-slate-500">
                <span
                  className={`${BADGE_PILL_BASE} bg-amber-500/20 text-amber-200`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Media
                </span>
              </div>

              <div className="flex items-center text-[11px] text-slate-500">
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end">
                <button
                  onClick={handleCreate}
                  disabled={creating || !newTitle.trim()}
                  className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-medium text-emerald-950 shadow-md shadow-emerald-500/30 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700/60"
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1 h-3 w-3" />
                      Nueva tarea
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Contenido */}
          {loading ? (
            <div className="flex h-32 items-center justify-center text-xs text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando tareas...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex h-32 items-center justify-center px-4 text-xs text-slate-400">
              No se encontraron tareas con los filtros actuales.
            </div>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {visibleTasks.map((task) => {
                  const statusCfg = getStatusConfig(task.status);
                  const priorityCfg = getPriorityConfig(task.priority);
                  const isLocked = !!(task as any).is_locked;

                  const filteredUsers = supervisors.filter((u) => {
                    const text = (u.full_name ?? u.email ?? '').toLowerCase();
                    return text.includes(assigneeSearch.toLowerCase());
                  });

                  const isStatusOpen = statusOpenFor === task.id && !isLocked;
                  const isPriorityOpen =
                    priorityOpenFor === task.id && !isLocked;
                  const isAssigneesOpen =
                    canManage && assigneesOpenFor === task.id && !isLocked;

                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16 }}
                      className={`${TABLE_GRID_COLS} ${TABLE_ROW_BASE} group cursor-pointer`}
                      onClick={() => setSelectedTask(task)}
                    >
                      <div className="flex flex-col gap-0.5 pr-2">
                        <span className="text-sm font-medium">
                          {task.title}
                        </span>
                        {task.project && (
                          <span className="text-[10px] text-slate-400">
                            {task.project}
                          </span>
                        )}
                        {task.summary && (
                          <span className="line-clamp-1 text-[10px] text-slate-400">
                            {task.summary}
                          </span>
                        )}
                      </div>

                      {/* Estado */}
                      <div
                        className="relative flex items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isLocked) return;
                            setStatusOpenFor((prev) =>
                              prev === task.id ? null : task.id,
                            );
                            setPriorityOpenFor(null);
                            setAssigneesOpenFor(null);
                          }}
                          disabled={isLocked}
                          className={`${BADGE_PILL_BASE} ${statusCfg.pillClass} ${isLocked ? 'cursor-not-allowed opacity-70' : ''
                            }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${statusCfg.dotClass}`}
                          />
                          {statusCfg.label}
                          {!isLocked && (
                            <ChevronDown className="ml-1 h-3 w-3 opacity-80" />
                          )}
                        </button>

                        {isStatusOpen && (
                          <>
                            {/* Overlay para cerrar al click fuera */}
                            <div
                              className={POPOVER_OVERLAY}
                              onClick={closeAllPopovers}
                            />
                            <div
                              className={STATUS_POPOVER_PANEL}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {STATUS_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() =>
                                    handleChangeStatus(task, opt.value)
                                  }
                                  className="flex w-full items-center justify-between rounded-lg px-2 py-1 hover:bg-slate-800"
                                >
                                  <span className="flex items-center gap-2">
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${opt.dotClass}`}
                                    />
                                    {opt.label}
                                  </span>
                                  {opt.value === task.status && (
                                    <span className="text-[10px] text-sky-300">
                                      Actual
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Prioridad */}
                      <div
                        className="relative flex items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isLocked) return;
                            setPriorityOpenFor((prev) =>
                              prev === task.id ? null : task.id,
                            );
                            setStatusOpenFor(null);
                            setAssigneesOpenFor(null);
                          }}
                          disabled={isLocked}
                          className={`${BADGE_PILL_BASE} ${priorityCfg.pillClass} ${isLocked ? 'cursor-not-allowed opacity-70' : ''
                            }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${priorityCfg.dotClass}`}
                          />
                          {priorityCfg.label}
                          {!isLocked && (
                            <ChevronDown className="ml-1 h-3 w-3 opacity-80" />
                          )}
                        </button>

                        {isPriorityOpen && (
                          <>
                            {/* Overlay para cerrar al click fuera */}
                            <div
                              className={POPOVER_OVERLAY}
                              onClick={closeAllPopovers}
                            />
                            <div
                              className={PRIORITY_POPOVER_PANEL}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {PRIORITY_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() =>
                                    handleChangePriority(task, opt.value)
                                  }
                                  className="flex w-full items-center justify-between rounded-lg px-2 py-1 hover:bg-slate-800"
                                >
                                  <span className="flex items-center gap-2">
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${opt.dotClass}`}
                                    />
                                    {opt.label}
                                  </span>
                                  {opt.value === task.priority && (
                                    <span className="text-[10px] text-sky-300">
                                      Actual
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Fecha límite */}
                      <div className="flex items-center text-[10px] font-bold text-black/50">
                        <span
                          className={`${SMALL_PILL_BASE} bg-slate-800 text-slate-100`}
                        >
                          {formatDueDate(task.due_date)}
                        </span>
                      </div>

                      {/* Responsables + acciones admin */}
                      <div
                        className="relative flex flex-wrap items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {task.assignees.length === 0 ? (
                          <span className="text-[10px] text-slate-500">
                            Sin responsables
                          </span>
                        ) : (
                          task.assignees.map((a) => {
                            // Buscar datos del supervisor a partir del user_id
                            const sup = supervisors.find(
                              (s) => String(s.id) === String(a.user_id),
                            );

                            const label =
                              a.full_name ??
                              sup?.full_name ??
                              a.email ??
                              sup?.email ??
                              'Sin nombre';

                            return (
                              <span
                                key={a.user_id}
                                className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-200"
                              >
                                {label}
                              </span>
                            );
                          })
                        )}

                        {canManage && (
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isLocked) return;
                                setAssigneesOpenFor((prev) =>
                                  prev === task.id ? null : task.id,
                                );
                                setStatusOpenFor(null);
                                setPriorityOpenFor(null);
                              }}
                              disabled={isLocked}
                              className={`inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800 ${isLocked ? 'cursor-not-allowed opacity-60' : ''
                                }`}
                            >
                              Gestionar
                              {!isLocked && (
                                <ChevronDown className="ml-1 h-3 w-3" />
                              )}
                            </button>

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCloseTask(task);
                                }}
                                disabled={isLocked}
                                className={`inline-flex items-center rounded-full border border-amber-600/60 bg-amber-900/40 px-2 py-0.5 text-[10px] text-amber-200 hover:bg-amber-800/70 ${isLocked ? 'cursor-not-allowed opacity-60' : ''
                                  }`}
                              >
                                <Ban className="mr-1 h-3 w-3" />
                                Cerrar
                              </button>
                            )}

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTask(task);
                                }}
                                className="inline-flex items-center rounded-full border border-rose-700/70 bg-rose-900/50 px-2 py-0.5 text-[10px] text-rose-200 hover:bg-rose-800/80"
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                Eliminar
                              </button>
                            )}
                          </div>
                        )}

                        {isAssigneesOpen && (
                          <>
                            {/* Overlay para cerrar al click fuera */}
                            <div
                              className="fixed inset-0 z-10"
                              onClick={closeAllPopovers}
                            />
                            <div
                              className="absolute right-0 top-6 z-20 w-64 rounded-xl border border-slate-800 bg-slate-950/95 p-2 text-[11px] text-slate-100 shadow-xl shadow-slate-950/70"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="mb-2">
                                <input
                                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                  placeholder="Buscar supervisor..."
                                  value={assigneeSearch}
                                  onChange={(e) => setAssigneeSearch(e.target.value)}
                                />
                              </div>

                              {filteredUsers.length === 0 ? (
                                <p className="text-[10px] text-slate-500">
                                  No se encontraron supervisores.
                                </p>
                              ) : (
                                <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                                  {filteredUsers.map((user) => {
                                    const isSelected = task.assignees.some(
                                      (a) => a.user_id === user.id,
                                    );
                                    return (
                                      <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => handleToggleAssignee(task, user.id)}
                                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-left hover:bg-slate-800 ${isSelected ? 'text-sky-200' : 'text-slate-100'
                                          }`}
                                      >
                                        <span className="flex flex-col">
                                          <span className="text-[11px]">
                                            {user.full_name ?? user.email}
                                          </span>
                                          {user.email && (
                                            <span className="text-[10px] text-slate-500">
                                              {user.email}
                                            </span>
                                          )}
                                        </span>
                                        {isSelected && (
                                          <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-300">
                                            Asignado
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Footer paginación */}
              <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2 text-[11px] text-slate-400">
                <span>
                  Mostrando{' '}
                  <span className="font-semibold text-slate-200">
                    {startIndex + 1}
                  </span>{' '}
                  -{' '}
                  <span className="font-semibold text-slate-200">
                    {Math.min(endIndex, filteredTasks.length)}
                  </span>{' '}
                  de{' '}
                  <span className="font-semibold text-slate-200">
                    {filteredTasks.length}
                  </span>{' '}
                  tareas filtradas
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className={PAGINATION_BTN_BASE}
                  >
                    Anterior
                  </button>
                  <span>
                    Página{' '}
                    <span className="font-semibold text-slate-200">
                      {page}
                    </span>{' '}
                    de{' '}
                    <span className="font-semibold text-slate-200">
                      {totalPages}
                    </span>
                  </span>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={page === totalPages}
                    className={PAGINATION_BTN_BASE}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <AnimatePresence>
        {selectedTask && (
          <ProjectTaskDrawer
            key={selectedTask.id}
            task={selectedTask}
            supervisors={supervisors}
            currentUserRole={me?.role ?? 'vendedor'}
            currentUserId={me?.id ?? null}
            onClose={() => setSelectedTask(null)}
            onUpdated={handleTaskUpdatedFromDrawer}
          />
        )}
      </AnimatePresence>
    </RequireAuth>
  );
}
