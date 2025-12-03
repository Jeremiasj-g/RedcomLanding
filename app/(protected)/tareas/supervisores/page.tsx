'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  Users2,
  Loader2,
  Filter,
  Search,
} from 'lucide-react';
import {
  TaskStatus,
  TaskWithOwner,
  fetchSupervisorTasksByRange,
} from '@/lib/tasks';
import { RequireAuth } from '@/components/RouteGuards';
import { addDays, endOfWeek, startOfWeek } from 'date-fns';
import { useMe } from '@/hooks/useMe';

type WeekRange = {
  from: Date;
  to: Date;
};

type StatusFilter = 'all' | TaskStatus;

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  done: 'Completada',
  cancelled: 'Cancelada',
};

const STATUS_BADGE_CLASSES: Record<TaskStatus, string> = {
  pending: 'bg-slate-700/70 text-slate-100',
  in_progress: 'bg-sky-500/15 text-sky-300',
  done: 'bg-emerald-500/15 text-emerald-300',
  cancelled: 'bg-rose-500/15 text-rose-300',
};

function getCurrentWeek(): WeekRange {
  const now = new Date();
  const from = startOfWeek(now, { weekStartsOn: 1 }); // lunes
  const to = endOfWeek(now, { weekStartsOn: 1 });
  return { from, to };
}

function formatDate(d: Date) {
  return d.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function formatTimeFromISO(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SupervisorTasksPage() {
  const { me, loading: loadingMe } = useMe();

  const [week, setWeek] = useState<WeekRange>(() => getCurrentWeek());
  const [branchFilter, setBranchFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [supervisorFilter, setSupervisorFilter] = useState<'all' | string>('all');
  const [search, setSearch] = useState('');

  const [tasks, setTasks] = useState<TaskWithOwner[]>([]);
  const [loading, setLoading] = useState(true);

  // ─────────────────────────────────────────
  // 1) Cargar tareas (backend) por semana / sucursal / estado
  // ─────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const fromISO = week.from.toISOString();
        const toISO = week.to.toISOString();

        const data = await fetchSupervisorTasksByRange({
          from: fromISO,
          to: toISO,
          branch: branchFilter === 'all' ? undefined : branchFilter,
          status: statusFilter === 'all' ? undefined : statusFilter,
        });

        setTasks(data);
      } catch (err) {
        console.error('Error fetching supervisor tasks', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [week, branchFilter, statusFilter]);

  // ─────────────────────────────────────────
  // 2) Filtrado por branches del ADMIN (según usuario logueado)
  // ─────────────────────────────────────────
  const tasksFilteredByRole = useMemo(() => {
    if (!me || me.role !== 'admin') {
      // supervisor (u otro rol) ve todo lo que trae el backend
      return tasks;
    }

    const allowed = new Set(
      (me.branches ?? []).map((b: string) => b.toLowerCase()),
    );

    return tasks.filter((t) => {
      const branches = t.owner_branches ?? [];
      if (branches.length === 0) return false;
      return branches.some((b) => allowed.has(b.toLowerCase()));
    });
  }, [tasks, me]);

  // ─────────────────────────────────────────
  // 3) Opciones de sucursal del filtro
  // ─────────────────────────────────────────
  const branchesFromData = useMemo(() => {
    const set = new Set<string>();

    if (me?.role === 'admin') {
      (me.branches ?? []).forEach((b: string) =>
        set.add(String(b).toLowerCase()),
      );
    } else {
      tasksFilteredByRole.forEach((t) => {
        t.owner_branches?.forEach((b) => {
          if (b) set.add(b.toLowerCase());
        });
      });
    }

    return Array.from(set).sort();
  }, [tasksFilteredByRole, me]);

  // ─────────────────────────────────────────
  // 4) Opciones de supervisor del filtro
  // ─────────────────────────────────────────
  const supervisorsFromData = useMemo(() => {
    const set = new Set<string>();
    tasksFilteredByRole.forEach((t) => {
      if (t.owner_full_name) set.add(t.owner_full_name);
    });
    return Array.from(set).sort();
  }, [tasksFilteredByRole]);

  const weekLabel = useMemo(() => {
    const fmt = (d: Date) =>
      d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    return `${fmt(week.from)} – ${fmt(week.to)}`;
  }, [week]);

  // ─────────────────────────────────────────
  // 5) Filtro de búsqueda + filtro por supervisor (frontend)
  // ─────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    let base = tasksFilteredByRole;

    if (supervisorFilter !== 'all') {
      const target = supervisorFilter.toLowerCase();
      base = base.filter(
        (t) => (t.owner_full_name ?? '').toLowerCase() === target,
      );
    }

    if (!search.trim()) return base;

    const q = search.toLowerCase();
    return base.filter((t) => {
      const branchText = (t.owner_branches ?? []).join(' ');
      const parts = [
        t.title,
        t.description ?? '',
        t.owner_full_name ?? '',
        branchText,
      ]
        .join(' ')
        .toLowerCase();
      return parts.includes(q);
    });
  }, [tasksFilteredByRole, search, supervisorFilter]);

  // ─────────────────────────────────────────
  // 6) Métricas resumen
  // ─────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    const done = filteredTasks.filter((t) => t.status === 'done').length;
    const pending = filteredTasks.filter((t) => t.status === 'pending').length;
    const inProgress = filteredTasks.filter(
      (t) => t.status === 'in_progress',
    ).length;

    return {
      total,
      done,
      pending,
      inProgress,
      completion: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [filteredTasks]);

  const changeWeek = (direction: 'prev' | 'next') => {
    const delta = direction === 'prev' ? -7 : 7;
    const newFrom = addDays(week.from, delta);
    const newTo = addDays(week.to, delta);
    setWeek({ from: newFrom, to: newTo });
  };

  if (loadingMe && !me) {
    return (
      <RequireAuth roles={['admin', 'supervisor']}>
        <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-300">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Cargando información de usuario...
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth roles={['admin']}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-black">
              <Users2 className="h-5 w-5 font-bold text-black" />
              Tareas de supervisores
            </h1>
            <p className="text-sm text-slate-500">
              Vista de seguimiento de tareas por supervisor (solo lectura).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700/70">
              <button
                onClick={() => changeWeek('prev')}
                className="mr-1 rounded-full px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                ‹
              </button>
              <span className="font-medium">{weekLabel}</span>
              <button
                onClick={() => changeWeek('next')}
                className="ml-1 rounded-full px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                ›
              </button>
            </div>
          </div>
        </header>

        {/* Resumen */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-3 shadow-md shadow-slate-950/40">
            <p className="text-xs text-slate-400">Tareas en la semana</p>
            <p className="mt-1 text-2xl font-semibold text-slate-100">
              {metrics.total}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-3 shadow-md shadow-slate-950/40">
            <p className="text-xs text-slate-400">Completadas</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-400">
              {metrics.done}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-3 shadow-md shadow-slate-950/40">
            <p className="text-xs text-slate-400">Pendientes</p>
            <p className="mt-1 text-2xl font-semibold text-amber-300">
              {metrics.pending}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-3 shadow-md shadow-slate-950/40">
            <p className="text-xs text-slate-400">Nivel de cumplimiento</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${metrics.completion}%` }}
                />
              </div>
              <span className="text-xs text-slate-200">
                {metrics.completion}%
              </span>
            </div>
          </div>
        </section>

        {/* Filtros */}
        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-3 shadow-md shadow-slate-950/40">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-300">
            <Filter className="h-4 w-4 text-sky-400" />
            Filtros
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,2fr)]">
            {/* Sucursal */}
            <div className="flex flex-col gap-1 text-xs text-slate-300">
              <span>Sucursal</span>
              <select
                value={branchFilter}
                onChange={(e) =>
                  setBranchFilter(e.target.value as 'all' | string)
                }
                className="rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="all">
                  {me?.role === 'admin'
                    ? 'Todas mis sucursales'
                    : 'Todas las sucursales'}
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
                  setStatusFilter(e.target.value as StatusFilter)
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
                  setSupervisorFilter(e.target.value as 'all' | string)
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
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ej: matinal, corrientes, control..."
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-8 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Tabla de tareas (solo lectura) */}
        <section className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-3 shadow-lg shadow-slate-950/50">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span>
              {filteredTasks.length} tarea
              {filteredTasks.length !== 1 && 's'} encontradas
            </span>
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center text-xs text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando tareas...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-xs text-slate-500">
              No se encontraron tareas con los filtros actuales.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/80">
              <div className="grid grid-cols-[1.3fr_1.1fr_0.8fr_0.8fr_1.2fr_1.4fr] border-b border-slate-800/80 bg-slate-900/80 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                <div>Supervisor</div>
                <div>Tarea</div>
                <div>Fecha</div>
                <div>Hora</div>
                <div>Sucursal</div>
                <div>Estado / Notas</div>
              </div>

              <AnimatePresence initial={false}>
                {filteredTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="grid grid-cols-[1.3fr_1.1fr_0.8fr_0.8fr_1.2fr_1.4fr] border-t border-slate-900/70 px-3 py-2 text-[11px] text-slate-100 hover:bg-slate-900/70"
                  >
                    {/* Supervisor */}
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {task.owner_full_name ?? '—'}
                      </span>
                    </div>

                    {/* Tarea */}
                    <div className="flex flex-col">
                      <span className="font-medium line-clamp-1">
                        {task.title}
                      </span>
                      {task.description && (
                        <span className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">
                          {task.description}
                        </span>
                      )}
                    </div>

                    {/* Fecha */}
                    <div className="flex items-center text-[10px] text-slate-300">
                      {formatDate(new Date(task.scheduled_at)).replace('.', '')}
                    </div>

                    {/* Hora */}
                    <div className="flex items-center text-[10px] text-slate-400">
                      {formatTimeFromISO(task.scheduled_at)}
                    </div>

                    {/* Sucursal */}
                    <div className="flex items-center text-[10px] text-slate-300">
                      {task.owner_branches && task.owner_branches.length > 0
                        ? task.owner_branches
                            .map(
                              (b) => b.charAt(0).toUpperCase() + b.slice(1),
                            )
                            .join(' · ')
                        : '—'}
                    </div>

                    {/* Estado / Notas (solo lectura) */}
                    <div className="flex flex-col gap-1">
                      {/* Chip de estado, sin onClick */}
                      <div
                        className={`inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE_CLASSES[task.status]}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                        {STATUS_LABEL[task.status]}
                      </div>

                      {/* Notas como texto plano */}
                      <div className="rounded-lg border border-slate-900 bg-slate-950/60 px-2 py-1 text-[10px] text-slate-200">
                        {task.notes && task.notes.trim().length > 0
                          ? task.notes
                          : 'Sin notas registradas.'}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </RequireAuth>
  );
}
