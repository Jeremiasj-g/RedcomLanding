'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Columns3,
  ListChecks,
  Loader2,
  ShieldCheck,
  Users2,
} from 'lucide-react';

import {
  type Task,
  type TaskStatus,
  type TaskWithOwner,
  fetchSupervisorTasksByRange,
} from '@/lib/tasks';
import { RequireAuth } from '@/components/RouteGuards';
import { addDays } from 'date-fns';
import { useMe } from '@/hooks/useMe';
import DualSpinner from '@/components/ui/DualSpinner';
import { supabase } from '@/lib/supabaseClient';

import {
  DateRangeSelector,
  type DateRangeState,
  getInitialDateRange,
  getRangeLabel,
} from './DateRangeSelector';
import { SummaryCards, type SummaryMetrics } from './SummaryCards';
import FiltersBar from './FiltersBar';
import TasksGrid from './TasksGrid';
import TaskDetailsModal from './TaskDetailsModal';
import {
  TaskCalendarView,
  TaskKanbanView,
  TaskListView,
  type TaskViewMode,
} from '../components/TaskViews';

type StatusFilter = 'all' | TaskStatus;
type RoleOption = { value: string; label: string };

function prettyRoleLabel(value: string) {
  const raw = (value ?? '').trim();
  if (!raw) return '—';
  if (raw.toLowerCase() === 'rrhh') return 'RRHH';
  if (raw.toLowerCase() === 'jdv') return 'JDV';

  return raw
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

async function fetchTaskOwnerRoleOptions(): Promise<RoleOption[]> {
  try {
    const { data, error } = await supabase
      .from('user_types')
      .select('code,name')
      .order('id', { ascending: true });

    if (error || !Array.isArray(data)) return [];

    const seen = new Set<string>();

    return data
      .map((row: any) => ({
        value: String(row.code ?? '').trim().toLowerCase(),
        label: String(row.name ?? '').trim(),
      }))
      .filter((option) => {
        if (!option.value || seen.has(option.value)) return false;
        seen.add(option.value);
        return true;
      })
      .map((option) => ({
        value: option.value,
        label: option.label || prettyRoleLabel(option.value),
      }));
  } catch {
    return [];
  }
}

export default function PanelTasksPage() {
  const { me, loading: loadingMe } = useMe();
  const normalizedRole = (me?.role ?? '').toLowerCase();
  const isAdmin = normalizedRole === 'admin';
  const isJDV = normalizedRole === 'jdv';

  const [rangeState, setRangeState] = useState<DateRangeState>(() =>
    getInitialDateRange(),
  );
  const { range } = rangeState;
  const rangeLabel = getRangeLabel(rangeState);

  const [branchFilter, setBranchFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [supervisorFilter, setSupervisorFilter] =
    useState<'all' | string>('all');
  const [search, setSearch] = useState('');
  const [ownerRoleFilter, setOwnerRoleFilter] =
    useState<'all' | string>('all');
  const [ownerRoleOptions, setOwnerRoleOptions] = useState<RoleOption[]>([]);
  const [viewMode, setViewMode] = useState<TaskViewMode>('week');

  const [branchesFallback, setBranchesFallback] = useState<string[]>([]);
  const [didAutoPickBranch, setDidAutoPickBranch] = useState(false);

  const [tasks, setTasks] = useState<TaskWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] =
    useState<TaskWithOwner | null>(null);

  useEffect(() => {
    if (!me?.id) return;

    let cancelled = false;

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('user_branches')
          .select('branch_id, branches:branches(name)')
          .eq('user_id', me.id);

        if (error) throw error;
        if (cancelled) return;

        const list = (data ?? [])
          .map((row: any) => row?.branches?.name)
          .filter(Boolean)
          .map((name: string) => String(name).toLowerCase());

        setBranchesFallback(Array.from(new Set(list)));
      } catch (error) {
        console.warn('[TASKS] branches fallback error', error);
        if (!cancelled) setBranchesFallback([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me?.id]);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    void (async () => {
      const options = await fetchTaskOwnerRoleOptions();
      if (!cancelled) setOwnerRoleOptions(options);
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        if (!me) return;

        const roleValues =
          ownerRoleOptions.length > 0
            ? ownerRoleOptions.map((option) => option.value)
            : ['supervisor', 'jdv', 'admin', 'vendedor'];

        const ownerRoles = isAdmin
          ? ownerRoleFilter === 'all'
            ? roleValues
            : [ownerRoleFilter]
          : ['supervisor'];

        const data = await fetchSupervisorTasksByRange({
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          ownerRoles,
          branch: branchFilter === 'all' ? undefined : branchFilter,
          status: statusFilter === 'all' ? undefined : statusFilter,
        });

        if (!cancelled) setTasks(data);
      } catch (error) {
        console.error('Error fetching supervised tasks', error);
        if (!cancelled) setTasks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    me,
    isAdmin,
    range.from,
    range.to,
    branchFilter,
    statusFilter,
    ownerRoleFilter,
    ownerRoleOptions,
  ]);

  useEffect(() => {
    if (!isJDV) return;
    if (didAutoPickBranch || branchFilter !== 'all') return;
    if (!branchesFallback.length || tasks.length > 0) return;

    setBranchFilter(branchesFallback[0]);
    setDidAutoPickBranch(true);
  }, [
    isJDV,
    didAutoPickBranch,
    branchFilter,
    branchesFallback,
    tasks.length,
  ]);

  const branchesFromData = useMemo(() => {
    const values = new Set<string>();

    tasks.forEach((task) => {
      task.owner_branches?.forEach((branch) => {
        if (branch) values.add(String(branch).toLowerCase());
      });
    });

    branchesFallback.forEach((branch) => {
      if (branch) values.add(String(branch).toLowerCase());
    });

    return Array.from(values).sort();
  }, [tasks, branchesFallback]);

  const supervisorsFromData = useMemo(() => {
    const values = new Set<string>();
    tasks.forEach((task) => {
      if (task.owner_full_name) values.add(task.owner_full_name);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'es'));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (supervisorFilter !== 'all') {
      const expected = supervisorFilter.toLowerCase();
      result = result.filter(
        (task) => (task.owner_full_name ?? '').toLowerCase() === expected,
      );
    }

    const query = search.trim().toLowerCase();
    if (!query) return result;

    return result.filter((task) => {
      const haystack = [
        task.title,
        task.description ?? '',
        task.notes ?? '',
        task.owner_full_name ?? '',
        task.owner_role ?? '',
        ...(task.owner_branches ?? []),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [tasks, supervisorFilter, search]);

  const metrics: SummaryMetrics = useMemo(() => {
    const total = filteredTasks.length;
    const done = filteredTasks.filter((task) => task.status === 'done').length;
    const pending = filteredTasks.filter(
      (task) => task.status === 'pending',
    ).length;
    const inProgress = filteredTasks.filter(
      (task) => task.status === 'in_progress',
    ).length;

    return {
      total,
      done,
      pending,
      inProgress,
      completion: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [filteredTasks]);

  const daysInRange = useMemo(() => {
    const days: Date[] = [];
    let current = range.from;

    while (current <= range.to) {
      days.push(current);
      current = addDays(current, 1);
    }

    return days;
  }, [range.from, range.to]);

  const tasksByDay = useMemo(() => {
    const map: Record<string, TaskWithOwner[]> = {};

    daysInRange.forEach((day) => {
      map[day.toISOString().slice(0, 10)] = [];
    });

    filteredTasks.forEach((task) => {
      const key = task.scheduled_at.slice(0, 10);
      (map[key] ||= []).push(task);
    });

    return map;
  }, [daysInRange, filteredTasks]);

  const supervisionMeta = (task: Task) => {
    const supervised = task as TaskWithOwner;
    const branch =
      supervised.owner_branches?.[0]
        ? supervised.owner_branches[0].charAt(0).toUpperCase() +
          supervised.owner_branches[0].slice(1)
        : null;

    return [supervised.owner_full_name, branch].filter(Boolean).join(' · ');
  };

  const openTask = (task: Task) => {
    setSelectedTask(task as TaskWithOwner);
  };

  if (loadingMe && !me) {
    return (
      <RequireAuth roles={['admin', 'jdv']}>
        <div className="grid min-h-[80vh] place-items-center bg-[#0f1012]">
          <DualSpinner size={60} thickness={4} />
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth roles={['admin', 'jdv']}>
      <div className="min-h-screen bg-[#0f1012] text-white">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-7 sm:px-6 lg:px-8">
          <header className="rounded-[24px] border border-white/[0.08] bg-[#151517] px-5 py-5 shadow-[0_18px_55px_rgba(0,0,0,.16)] sm:px-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-[#0a84ff]/15 bg-[#0a84ff]/10 text-[#5ac8fa]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] font-medium uppercase tracking-[0.12em] text-white/[0.32]">
                    Supervisión operativa
                  </div>
                  <h1 className="mt-1 text-xl font-medium tracking-[-0.02em] text-white/[0.94]">
                    Seguimiento de tareas
                  </h1>
                  <p className="mt-1 max-w-2xl text-[11px] leading-5 text-white/[0.38]">
                    Revisá actividad, checklist, comentarios y planillas de los usuarios
                    desde un único espacio de supervisión.
                  </p>
                </div>
              </div>

              <DateRangeSelector
                state={rangeState}
                onChange={setRangeState}
              />
            </div>
          </header>

          <SummaryCards metrics={metrics} />

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
            isAdmin={isAdmin}
            ownerRoleFilter={ownerRoleFilter}
            onOwnerRoleFilterChange={setOwnerRoleFilter}
            ownerRoleOptions={ownerRoleOptions}
          />

          <section className="flex flex-col gap-3 rounded-[18px] border border-white/[0.07] bg-[#151517] p-2.5 shadow-[0_10px_28px_rgba(0,0,0,.08)] sm:flex-row sm:items-center sm:justify-between">
            <div className="px-2">
              <div className="flex items-center gap-2">
                <Users2 className="h-3.5 w-3.5 text-[#5ac8fa]" />
                <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-white/[0.38]">
                  {filteredTasks.length} tarea
                  {filteredTasks.length === 1 ? '' : 's'} visible
                  {filteredTasks.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="mt-1 inline-flex items-center gap-1.5 text-[9px] text-white/[0.24]">
                <CalendarDays className="h-3 w-3" />
                {rangeLabel}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1 rounded-[14px] bg-white/[0.035] p-1">
              {[
                { value: 'week' as const, label: 'Semana', icon: Columns3 },
                { value: 'list' as const, label: 'Lista', icon: ListChecks },
                { value: 'kanban' as const, label: 'Kanban', icon: Columns3 },
                { value: 'calendar' as const, label: 'Calendario', icon: CalendarDays },
              ].map((option) => {
                const Icon = option.icon;
                const active = viewMode === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setViewMode(option.value)}
                    className={[
                      'inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] px-3 text-[10px] font-medium transition',
                      active
                        ? 'bg-white text-[#0b1020] shadow-sm'
                        : 'text-white/[0.42] hover:bg-white/[0.05] hover:text-white/[0.72]',
                    ].join(' ')}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {loading ? (
            <div className="grid min-h-[320px] place-items-center rounded-[22px] border border-white/[0.07] bg-[#151517]">
              <div className="flex items-center gap-2 text-[11px] text-white/[0.38]">
                <Loader2 className="h-4 w-4 animate-spin text-[#5ac8fa]" />
                Cargando tareas...
              </div>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="grid min-h-[240px] place-items-center rounded-[22px] border border-dashed border-white/[0.07] bg-[#151517] px-6 text-center">
              <div>
                <Users2 className="mx-auto h-6 w-6 text-white/[0.20]" />
                <div className="mt-3 text-sm font-medium text-white/[0.70]">
                  No hay tareas para mostrar
                </div>
                <p className="mt-1 text-[11px] text-white/[0.30]">
                  Probá modificando el rango o alguno de los filtros.
                </p>
              </div>
            </div>
          ) : viewMode === 'week' ? (
            <TasksGrid
              daysInRange={daysInRange}
              tasksByDay={tasksByDay}
              onSelectTask={setSelectedTask}
            />
          ) : viewMode === 'list' ? (
            <TaskListView
              tasks={filteredTasks}
              onSelectTask={openTask}
              getMeta={supervisionMeta}
            />
          ) : viewMode === 'kanban' ? (
            <TaskKanbanView
              tasks={filteredTasks}
              onSelectTask={openTask}
              getMeta={supervisionMeta}
            />
          ) : (
            <TaskCalendarView
              tasks={filteredTasks}
              range={range}
              onSelectTask={openTask}
              getMeta={supervisionMeta}
            />
          )}
        </div>

        <TaskDetailsModal
          task={selectedTask}
          currentUserId={me?.id ?? null}
          onClose={() => setSelectedTask(null)}
        />
      </div>
    </RequireAuth>
  );
}
