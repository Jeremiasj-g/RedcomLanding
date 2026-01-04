'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Users2, Loader2 } from 'lucide-react';
import {
  TaskStatus,
  TaskWithOwner,
  fetchSupervisorTasksByRange,
} from '@/lib/tasks';
import { RequireAuth } from '@/components/RouteGuards';
import { addDays } from 'date-fns';
import { useMe } from '@/hooks/useMe';
import DualSpinner from '@/components/ui/DualSpinner';
import TaskChecklistSection from '../TaskChecklistSection';
import { supabase } from '@/lib/supabaseClient';

import {
  DateRangeSelector,
  DateRangeState,
  getInitialDateRange,
  getRangeLabel,
} from './DateRangeSelector';
import { SummaryCards, type SummaryMetrics } from './SummaryCards';
import FiltersBar from './FiltersBar';
import TasksTable from './TasksTable';
import TasksGrid from './TasksGrid';
import TaskDetailsModal from './TaskDetailsModal';

type StatusFilter = 'all' | TaskStatus;
type ViewMode = 'table' | 'grid';

type RoleOption = { value: string; label: string };

function prettyRoleLabel(v: string) {
  const raw = (v ?? '').trim();
  if (!raw) return '—';
  if (raw.toLowerCase() === 'rrhh') return 'RRHH';
  return raw
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

async function fetchTaskOwnerRoleOptions(): Promise<RoleOption[]> {
  // ✅ Fuente oficial: public.user_types (code, name)
  // Para esta vista solo nos interesan los roles que pueden “tener tareas”: supervisor, jdv, admin
  const allow = new Set(['supervisor', 'jdv', 'admin']);

  try {
    const { data, error } = await supabase
      .from('user_types')
      .select('code,name')
      .order('id', { ascending: true });

    if (error || !Array.isArray(data)) return [];

    const opts = data
      .map((r: any) => ({
        value: String(r.code ?? '').trim().toLowerCase(),
        label: String(r.name ?? '').trim(),
      }))
      .filter((x) => x.value && allow.has(x.value))
      .map((x) => ({
        value: x.value,
        label: x.label || prettyRoleLabel(x.value),
      }));

    // de-dupe
    const seen = new Set<string>();
    return opts.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
  } catch {
    return [];
  }
}

export default function PanelTasksPage() {
  const { me, loading: loadingMe } = useMe();

  const [rangeState, setRangeState] = useState<DateRangeState>(() =>
    getInitialDateRange(),
  );
  const rangeLabel = getRangeLabel(rangeState);
  const { range } = rangeState;

  const [branchFilter, setBranchFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [supervisorFilter, setSupervisorFilter] =
    useState<'all' | string>('all');
  const [search, setSearch] = useState('');

  // ✅ Nuevo (solo admin): filtrar por tipo de usuario que “posee” la tarea (supervisor/jdv/admin)
  const isAdmin = me?.role === 'admin';
  const [ownerRoleFilter, setOwnerRoleFilter] = useState<'all' | string>('supervisor');
  const [ownerRoleOptions, setOwnerRoleOptions] = useState<RoleOption[]>([]);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const [tasks, setTasks] = useState<TaskWithOwner[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTask, setSelectedTask] = useState<TaskWithOwner | null>(null);

  // Cargar opciones de roles (solo admin) desde user_types
  useEffect(() => {
    let cancelled = false;
    if (!isAdmin) return;

    (async () => {
      const opts = await fetchTaskOwnerRoleOptions();
      if (cancelled) return;
      setOwnerRoleOptions(opts);
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // 1) Cargar tareas por rango / sucursal / estado / rol dueño
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        // Esperar a tener el usuario (evita requests innecesarios)
        if (!me) return;

        const fromISO = range.from.toISOString();
        const toISO = range.to.toISOString();

        // JDV: siempre ve tareas de supervisores (filtros iguales a hoy)
        // Admin: puede ver supervisor / jdv / admin (con dropdown)
        const adminAllRoles = ownerRoleOptions.length
          ? ownerRoleOptions.map((o) => o.value)
          : ['supervisor', 'jdv', 'admin'];

        const ownerRoles = me.role === 'admin'
          ? (ownerRoleFilter === 'all' ? adminAllRoles : [String(ownerRoleFilter)])
          : ['supervisor'];

        const data = await fetchSupervisorTasksByRange({
          from: fromISO,
          to: toISO,
          ownerRoles,
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
  }, [range.from, range.to, branchFilter, statusFilter, ownerRoleFilter, ownerRoleOptions]);

  // 2) Filtrado por sucursales permitidas (admin)
  const tasksFilteredByRole = useMemo(() => {
    if (!me || me.role !== 'admin') {
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

  // 3) Opciones sucursal
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

  // 4) Opciones supervisor
  const supervisorsFromData = useMemo(() => {
    const set = new Set<string>();
    tasksFilteredByRole.forEach((t) => {
      if (t.owner_full_name) set.add(t.owner_full_name);
    });
    return Array.from(set).sort();
  }, [tasksFilteredByRole]);

  // 5) Filtros frontend (supervisor + búsqueda)
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

  // 6) Métricas resumen
  const metrics: SummaryMetrics = useMemo(() => {
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

  // 7) Días en el rango + tareas por día (para GRID)
  const daysInRange = useMemo(() => {
    const days: Date[] = [];
    let current = range.from;
    while (current <= range.to) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [range]);

  const tasksByDay = useMemo(() => {
    const map: Record<string, TaskWithOwner[]> = {};
    daysInRange.forEach((d) => {
      const key = d.toISOString().slice(0, 10);
      map[key] = [];
    });

    filteredTasks.forEach((t) => {
      const key = t.scheduled_at.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });

    return map;
  }, [daysInRange, filteredTasks]);

  if (loadingMe && !me) {
    return (
      <RequireAuth roles={['admin', 'jdv']}>
        <div className="grid min-h-[80vh] place-items-center">
          <DualSpinner size={60} thickness={4} />
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth roles={['admin', 'jdv']}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-12">
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

          <DateRangeSelector state={rangeState} onChange={setRangeState} />
        </header>

        {/* Resumen */}
        <SummaryCards metrics={metrics} />

        {/* Filtros */}
        <FiltersBar
          branchFilter={branchFilter}
          onBranchFilterChange={setBranchFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          supervisorFilter={supervisorFilter}
          onSupervisorFilterChange={setSupervisorFilter}
          search={search}
          onSearchChange={setSearch}
          branchesFromData={branchesFromData}
          supervisorsFromData={supervisorsFromData}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          isAdmin={isAdmin}
          ownerRoleFilter={ownerRoleFilter}
          onOwnerRoleFilterChange={setOwnerRoleFilter}
          ownerRoleOptions={ownerRoleOptions}
        />

        {/* Vista de tareas */}
        <section className="rounded-2xl border shadow-slate-950/50">
          <div className="mb-2 flex items-center justify-between text-xl font-bold text-black">
            <span>
              {filteredTasks.length} tarea
              {filteredTasks.length !== 1 && 's'} encontradas
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 text-[10px] text-slate-300">
              <CalendarDays className="h-3 w-3" />
              Rango: {rangeLabel}
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
          ) : viewMode === 'table' ? (
            <TasksTable
              tasks={filteredTasks}
              onSelectTask={setSelectedTask}
            />
          ) : (
            <TasksGrid
              daysInRange={daysInRange}
              tasksByDay={tasksByDay}
              onSelectTask={setSelectedTask}
            />
          )}
        </section>
      </div>

      <TaskDetailsModal task={selectedTask} onClose={() => setSelectedTask(null)} />
    </RequireAuth>
  );
}
