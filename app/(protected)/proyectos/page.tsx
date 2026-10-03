'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Ban,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  CircleDot,
  FolderKanban,
  Loader2,
  LockKeyhole,
  Plus,
  Sparkles,
  Trash2,
  Users2,
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
import { errorMessage, notify } from '@/lib/notifications';
import { RedcomDatePicker } from '@/components/ui/redcom-date-picker';
import { RedcomSelect } from '@/components/ui/redcom-select';

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
      pillClass: 'bg-slate-100 text-slate-700',
      dotClass: 'bg-slate-400',
    },
    {
      value: 'in_progress',
      label: 'En curso',
      pillClass: 'bg-indigo-50 text-indigo-700',
      dotClass: 'bg-indigo-500',
    },
    {
      value: 'done',
      label: 'Completada',
      pillClass: 'bg-teal-50 text-teal-700',
      dotClass: 'bg-teal-500',
    },
    {
      value: 'cancelled',
      label: 'Cancelada',
      pillClass: 'bg-rose-50 text-rose-700',
      dotClass: 'bg-rose-500',
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
      pillClass: 'bg-teal-50 text-teal-700',
      dotClass: 'bg-teal-500',
    },
    {
      value: 'medium',
      label: 'Media',
      pillClass: 'bg-amber-50 text-amber-700',
      dotClass: 'bg-amber-500',
    },
    {
      value: 'high',
      label: 'Alta',
      pillClass: 'bg-rose-50 text-rose-700',
      dotClass: 'bg-rose-500',
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

  // confirmar cierre (lock)
  const [closeConfirmTask, setCloseConfirmTask] =
    useState<ProjectTaskWithAssignees | null>(null);
  const [closingTask, setClosingTask] = useState(false);

  const [loading, setLoading] = useState(true);

  // creación rápida (admin + JDV)
  const [creating, setCreating] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
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
    showClosed: true,
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
        setTasks((tasksData ?? []).slice().sort((a: any, b: any) => {
          const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
          const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
          return db - da;
        }));
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
    // ✅ Por defecto NO mostramos completadas ni cerradas
    if (filters.status === 'all' && t.status === 'done') return false;

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
      setQuickCreateOpen(false);
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

  // Cerrar tarea (lock)
  // ✅ Ahora pedimos confirmación antes de cerrar porque es irreversible (no se puede editar ni agregar más info)

  const doCloseTask = async (task: ProjectTaskWithAssignees) => {
    if (!canManage) return;
    if ((task as any).is_locked) return;

    try {
      setClosingTask(true);
      const updatedRow = await updateProjectTask(task.id, {
        is_locked: true,
      } as any);

      const updated: ProjectTaskWithAssignees = {
        ...updatedRow,
        assignees: task.assignees,
      };

      patchTask(updated);
      setSelectedTask((prev) =>
        prev && prev.id === task.id ? updated : prev
      );
      notify.success('Tarea cerrada correctamente.');
    } catch (err) {
      console.error('Error al cerrar tarea', err);
      notify.error(errorMessage(err, 'No se pudo cerrar la tarea.'));
    } finally {
      setClosingTask(false);
      closeAllPopovers();
    }
  };


  const requestCloseTask = (task: ProjectTaskWithAssignees) => {
    if (!canManage) return;
    if ((task as any).is_locked) return;
    setCloseConfirmTask(task);
  };



  // Eliminar tarea
  const handleDeleteTask = async (task: ProjectTaskWithAssignees) => {
    if (!canManage) return;
    const ok = window.confirm(
      `¿Seguro que querés eliminar la tarea "${task.title}
{task.is_locked && (
  <span className="ml-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
    Cerrada
  </span>
)}"? Esta acción no se puede deshacer.`,
    );
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('project_tasks')
        .delete()
        .eq('id', task.id);

      if (error) throw error;
      removeTask(task.id);
      notify.success('Tarea eliminada.');
    } catch (err) {
      console.error('Error deleting task', err);
      notify.error(errorMessage(err, 'No se pudo eliminar la tarea.'));
    } finally {
      setAssigneesOpenFor(null);
    }
  };

  // ─────────────────────────────────────────
  // 4) Loading inicial de usuario
  // ─────────────────────────────────────────
  if (loadingMe && !me) {
    return (
      <RequireAuth roles={['admin', 'supervisor', 'jdv']}>
        <div className="grid min-h-[80vh] place-items-center">
          <DualSpinner size={60} thickness={4} />
        </div>
      </RequireAuth>
    );
  }



  return (
    <RequireAuth roles={['admin', 'supervisor', 'jdv']}>
      <div className="min-h-[calc(100vh-72px)] bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(13,148,136,.08),transparent_26%),linear-gradient(to_bottom,#f8fafc,#f1f5f9)]">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <header className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-[linear-gradient(120deg,#0f172a_0%,#172554_52%,#115e59_120%)] px-6 py-7 text-white shadow-[0_24px_70px_rgba(15,23,42,.20)] sm:px-8 lg:px-10 lg:py-9">
            <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-indigo-400/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-teal-300/10 blur-3xl" />

            <div className="relative flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-100 backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  Workspace de proyectos
                </div>

                <h1 className="mt-5 text-[clamp(2rem,4vw,3.8rem)] font-black leading-[.96] tracking-[-0.055em]">
                  Proyectos y tareas
                </h1>
                <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-slate-300 sm:text-base">
                  Un espacio operativo para priorizar trabajo, coordinar responsables y mantener cada proyecto visible de punta a punta.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.07] px-3 py-1.5 text-xs font-bold text-slate-200">
                    <FolderKanban className="h-3.5 w-3.5 text-indigo-300" />
                    {totalVisible} tareas visibles
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.07] px-3 py-1.5 text-xs font-bold text-slate-200">
                    <Users2 className="h-3.5 w-3.5 text-teal-300" />
                    {isAdmin ? 'Vista administrativa completa' : 'Solo proyectos asignados'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row xl:flex-col xl:items-end">
                <div className="min-w-[220px] rounded-2xl border border-white/10 bg-white/[.07] p-4 backdrop-blur">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Avance general</div>
                      <div className="mt-1 text-3xl font-black tracking-tight">{completionRate}%</div>
                    </div>
                    <div className="text-right text-xs font-semibold text-slate-400">
                      {completedTasks} de {totalTasks}
                      <div>completadas</div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-teal-300 transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(completionRate, 100))}%` }}
                    />
                  </div>
                </div>

                {canManage ? (
                  <button
                    type="button"
                    onClick={() => setQuickCreateOpen((open) => !open)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-slate-950 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-indigo-50"
                  >
                    <Plus className="h-4 w-4" />
                    {quickCreateOpen ? 'Cerrar creación' : 'Nueva tarea'}
                  </button>
                ) : null}
              </div>
            </div>
          </header>

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

          <AnimatePresence initial={false}>
            {canManage && quickCreateOpen ? (
              <motion.section
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden rounded-[1.75rem] border border-indigo-100 bg-white shadow-[0_18px_50px_rgba(79,70,229,.08)]"
              >
                <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
                        <Plus className="h-4 w-4" />
                      </span>
                      Crear nueva tarea
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Cargá lo esencial ahora. El detalle completo se puede completar desde la tarea.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
                      Sin empezar
                    </span>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
                      Prioridad media
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,.9fr)_220px_auto] xl:items-end">
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        Tarea
                      </label>
                      <input
                        value={newTitle}
                        onChange={(event) => setNewTitle(event.target.value)}
                        placeholder="Ej: Actualizar tablero de cobertura"
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                      />
                    </div>
                    <input
                      value={newSummary}
                      onChange={(event) => setNewSummary(event.target.value)}
                      placeholder="Resumen breve (opcional)"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      Proyecto
                    </label>
                    <input
                      value={newProject}
                      onChange={(event) => setNewProject(event.target.value)}
                      placeholder="Ej: Portal REDCOM V2"
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      Fecha límite
                    </label>
                    <RedcomDatePicker
                      value={newDueDate}
                      onChange={setNewDueDate}
                      placeholder="Sin fecha"
                      accent="teal"
                      aria-label="Fecha límite de la nueva tarea"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating || !newTitle.trim()}
                    className="inline-flex h-11 min-w-[150px] items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-45"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {creating ? 'Creando...' : 'Crear tarea'}
                  </button>
                </div>
              </motion.section>
            ) : null}
          </AnimatePresence>

          <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,.08)]">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-700">
                    <BriefcaseBusiness className="h-4 w-4" />
                  </span>
                  <h2 className="text-sm font-black text-slate-950">Bandeja de trabajo</h2>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Editá estado y prioridad en línea o abrí una tarea para ver el detalle completo.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-600">
                {filteredTasks.length} resultado{filteredTasks.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[1120px]">
                <div className="grid grid-cols-[minmax(330px,2.2fr)_190px_180px_170px_minmax(340px,2fr)] border-b border-slate-200 bg-slate-50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  <div>Tarea / proyecto</div>
                  <div>Estado</div>
                  <div>Prioridad</div>
                  <div>Fecha límite</div>
                  <div>Responsables y acciones</div>
                </div>

                {loading ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm font-semibold text-slate-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-indigo-500" />
                    Cargando tareas...
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="grid min-h-[260px] place-items-center px-6 text-center">
                    <div>
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                        <FolderKanban className="h-5 w-5" />
                      </div>
                      <div className="mt-4 text-sm font-black text-slate-900">No encontramos tareas</div>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        Probá ajustando los filtros o creando una nueva tarea.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <AnimatePresence initial={false}>
                      {visibleTasks.map((task) => {
                        const statusCfg = getStatusConfig(task.status);
                        const priorityCfg = getPriorityConfig(task.priority);
                        const isLocked = !!(task as any).is_locked;

                        const filteredUsers = supervisors.filter((user) => {
                          const text = (user.full_name ?? user.email ?? '').toLowerCase();
                          return text.includes(assigneeSearch.toLowerCase());
                        });

                        const isAssigneesOpen =
                          canManage && assigneesOpenFor === task.id && !isLocked;

                        return (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.16 }}
                            className="group grid cursor-pointer grid-cols-[minmax(330px,2.2fr)_190px_180px_170px_minmax(340px,2fr)] items-center border-b border-slate-100 px-5 py-3.5 transition hover:bg-indigo-50/35"
                            onClick={() => setSelectedTask(task)}
                          >
                            <div className="min-w-0 pr-6">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-black text-slate-950">{task.title}</span>
                                {isLocked ? (
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700">
                                    <LockKeyhole className="h-2.5 w-2.5" />
                                    Cerrada
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 flex min-w-0 items-center gap-2">
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                  <FolderKanban className="h-3 w-3" />
                                  {task.project || 'Proyecto general'}
                                </span>
                                {task.summary ? (
                                  <span className="truncate text-[11px] font-medium text-slate-400">{task.summary}</span>
                                ) : null}
                              </div>
                            </div>

                            <div onClick={(event) => event.stopPropagation()} className="pr-3">
                              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
                                <span className={`h-2 w-2 rounded-full ${statusCfg.dotClass}`} />
                                {statusCfg.label}
                              </div>
                              <RedcomSelect
                                value={task.status}
                                accent="indigo"
                                disabled={isLocked}
                                className="h-9 rounded-xl text-xs"
                                onValueChange={(next) =>
                                  void handleChangeStatus(task, next as ProjectTaskStatus)
                                }
                                options={STATUS_OPTIONS.map((option) => ({
                                  value: option.value,
                                  label: option.label,
                                }))}
                                aria-label={`Estado de ${task.title}`}
                              />
                            </div>

                            <div onClick={(event) => event.stopPropagation()} className="pr-3">
                              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
                                <span className={`h-2 w-2 rounded-full ${priorityCfg.dotClass}`} />
                                {priorityCfg.label}
                              </div>
                              <RedcomSelect
                                value={task.priority}
                                accent="teal"
                                disabled={isLocked}
                                className="h-9 rounded-xl text-xs"
                                onValueChange={(next) =>
                                  void handleChangePriority(task, next as ProjectTaskPriority)
                                }
                                options={PRIORITY_OPTIONS.map((option) => ({
                                  value: option.value,
                                  label: option.label,
                                }))}
                                aria-label={`Prioridad de ${task.title}`}
                              />
                            </div>

                            <div>
                              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-black text-slate-700">
                                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                                {formatDueDate(task.due_date)}
                              </div>
                            </div>

                            <div
                              className="relative flex min-w-0 flex-wrap items-center gap-1.5"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                                {task.assignees.length === 0 ? (
                                  <span className="text-[10px] font-semibold text-slate-400">Sin responsables</span>
                                ) : (
                                  task.assignees.slice(0, 3).map((assignee) => {
                                    const supervisor = supervisors.find(
                                      (person) => String(person.id) === String(assignee.user_id),
                                    );
                                    const label =
                                      assignee.full_name ??
                                      supervisor?.full_name ??
                                      assignee.email ??
                                      supervisor?.email ??
                                      'Sin nombre';

                                    return (
                                      <span
                                        key={assignee.user_id}
                                        className="max-w-[150px] truncate rounded-full border border-indigo-100 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700"
                                      >
                                        {label}
                                      </span>
                                    );
                                  })
                                )}
                                {task.assignees.length > 3 ? (
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
                                    +{task.assignees.length - 3}
                                  </span>
                                ) : null}
                              </div>

                              {canManage ? (
                                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (isLocked) return;
                                      setAssigneesOpenFor((current) =>
                                        current === task.id ? null : task.id,
                                      );
                                    }}
                                    disabled={isLocked}
                                    className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[10px] font-black text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-45"
                                  >
                                    Gestionar
                                    {!isLocked ? <ChevronDown className="h-3 w-3" /> : null}
                                  </button>

                                  {isAdmin ? (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        requestCloseTask(task);
                                      }}
                                      disabled={isLocked}
                                      className="inline-flex h-8 items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 text-[10px] font-black text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                      <Ban className="h-3 w-3" />
                                      Cerrar
                                    </button>
                                  ) : null}

                                  {isAdmin ? (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void handleDeleteTask(task);
                                      }}
                                      className="inline-flex h-8 items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 text-[10px] font-black text-rose-700 transition hover:bg-rose-100"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      Eliminar
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}

                              {isAssigneesOpen ? (
                                <>
                                  <div className="fixed inset-0 z-30" onClick={closeAllPopovers} />
                                  <div
                                    className="absolute right-0 top-10 z-40 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-[0_20px_60px_rgba(15,23,42,.18)]"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <div className="p-1 pb-2">
                                      <input
                                        className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                                        placeholder="Buscar responsable..."
                                        value={assigneeSearch}
                                        onChange={(event) => setAssigneeSearch(event.target.value)}
                                      />
                                    </div>

                                    <div className="max-h-60 overflow-y-auto">
                                      {filteredUsers.length === 0 ? (
                                        <p className="px-3 py-6 text-center text-xs font-semibold text-slate-400">
                                          No se encontraron responsables.
                                        </p>
                                      ) : (
                                        filteredUsers.map((user) => {
                                          const selected = task.assignees.some(
                                            (assignee) => assignee.user_id === user.id,
                                          );
                                          return (
                                            <button
                                              key={user.id}
                                              type="button"
                                              onClick={() => void handleToggleAssignee(task, user.id)}
                                              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-indigo-50"
                                            >
                                              <span className="min-w-0">
                                                <span className="block truncate text-xs font-bold text-slate-800">
                                                  {user.full_name ?? user.email}
                                                </span>
                                                {user.email ? (
                                                  <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-400">
                                                    {user.email}
                                                  </span>
                                                ) : null}
                                              </span>
                                              <span
                                                className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border ${
                                                  selected
                                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                                    : 'border-slate-200 bg-white text-transparent'
                                                }`}
                                              >
                                                <CircleDot className="h-3.5 w-3.5" />
                                              </span>
                                            </button>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>
                                </>
                              ) : null}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>

                    <div className="flex items-center justify-between gap-4 bg-slate-50 px-5 py-3 text-[11px] font-semibold text-slate-500">
                      <span>
                        Mostrando <strong className="text-slate-900">{startIndex + 1}</strong>–
                        <strong className="text-slate-900">{Math.min(endIndex, filteredTasks.length)}</strong> de{' '}
                        <strong className="text-slate-900">{filteredTasks.length}</strong>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPage((current) => Math.max(1, current - 1))}
                          disabled={page === 1}
                          className="h-8 rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Anterior
                        </button>
                        <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                          Página <strong className="text-slate-900">{page}</strong> de{' '}
                          <strong className="text-slate-900">{totalPages}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                          disabled={page === totalPages}
                          className="h-8 rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
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

      <AnimatePresence>
        {closeConfirmTask && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => !closingTask && setCloseConfirmTask(null)}
          >
            <motion.div
              className="w-full max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,.30)]"
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 6 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-start gap-3">
                <div className="mt-0.5 rounded-2xl bg-amber-50 p-2.5 text-amber-700 ring-1 ring-amber-200">
                  <Ban className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-950">
                    ¿Cerrar tarea definitivamente?
                  </h3>
                  <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
                    Al cerrar esta tarea quedará <span className="font-bold text-slate-800">bloqueada</span>:
                    no se podrá editar, reasignar ni agregar información.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-600">
                    <span className="font-black text-slate-900">Tarea:</span>{' '}
                    {closeConfirmTask.title}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={closingTask}
                  onClick={() => setCloseConfirmTask(null)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={closingTask}
                  onClick={async () => {
                    const t = closeConfirmTask;
                    if (!t) return;
                    await doCloseTask(t);
                    setCloseConfirmTask(null);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-amber-500 px-4 text-xs font-black text-white transition hover:bg-amber-600 disabled:opacity-50"
                >
                  {closingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Confirmar cierre
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </RequireAuth>
  );
}
