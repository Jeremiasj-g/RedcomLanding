'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Columns3, LayoutList, ListChecks, Table2 } from 'lucide-react';
import type { Task } from '@/lib/tasks';

import { TasksProvider } from './TasksContext';
import { useTasks } from './TasksContext';

import { SummaryCards } from './panel-tareas/SummaryCards';
import MyTasksFiltersBar, { type StatusFilter } from './components/MyTasksFiltersBar';
import { useTasksLoader } from './hooks/useTasksLoader';
import { useTaskActions } from './hooks/useTaskActions';

import NewTaskForm from './components/NewTaskForm';
import TasksGrid from './components/TasksGrid';
import TaskDetailModal from './components/TaskDetailModal';
import {
  TaskCalendarView,
  TaskKanbanView,
  TaskListView,
  TaskTableView,
  type TaskViewMode,
} from './components/TaskViews';

type Props = {
  userId: string;
  range: { from: Date; to: Date };
};

export default function MyTasksBoard(props: Props) {
  return (
    <TasksProvider>
      <BoardInner {...props} />
    </TasksProvider>
  );
}

function BoardInner({ userId, range }: Props) {
  const { loading } = useTasksLoader(userId, range);
  const actions = useTaskActions(range);
  const { tasks, setTasks } = useTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<TaskViewMode>('week');
  const [layoutMode, setLayoutMode] = useState<'normal' | 'table'>('normal');

  // ✅ Filtros (similar a /panel-tareas)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${t.title ?? ''} ${t.description ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tasks, statusFilter, search]);

  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    const done = filteredTasks.filter((t) => t.status === 'done').length;
    const pending = filteredTasks.filter((t) => t.status === 'pending').length;
    const inProgress = filteredTasks.filter((t) => t.status === 'in_progress').length;
    const completion = total ? Math.round((done / total) * 100) : 0;
    return { total, done, pending, inProgress, completion };
  }, [filteredTasks]);

  // mantener la modal sincronizada cuando se actualiza una tarea (estado/notas) desde cards
  useEffect(() => {
    if (!selectedTask) return;
    const fresh = tasks.find((t) => t.id === selectedTask.id);
    if (fresh) setSelectedTask(fresh);
  }, [tasks, selectedTask]);

  return (
    <>
      <NewTaskForm />

      <SummaryCards metrics={metrics} />

      <MyTasksFiltersBar
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        search={search}
        onSearchChange={setSearch}
      />

      <div className="flex flex-col gap-3 rounded-[18px] border border-white/[0.07] bg-[#151517] p-2.5 shadow-[0_10px_28px_rgba(0,0,0,.08)] sm:flex-row sm:items-center sm:justify-between">
        <div className="px-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.09em] text-white/[0.34]">
            Vista
          </div>
          <div className="mt-0.5 text-[10px] text-white/[0.24]">
            Alterná entre trabajo visual y revisión tabular.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-[11px] border border-white/[0.08] bg-white/[0.035] p-1">
            <button
              type="button"
              onClick={() => setLayoutMode('normal')}
              className={[
                'inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[10px] font-medium transition',
                layoutMode === 'normal'
                  ? 'bg-white/[0.09] text-white'
                  : 'text-white/[0.42] hover:text-white/[0.76]',
              ].join(' ')}
              aria-pressed={layoutMode === 'normal'}
            >
              <LayoutList className="h-3.5 w-3.5" />
              Normal
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('table')}
              className={[
                'inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[10px] font-medium transition',
                layoutMode === 'table'
                  ? 'bg-white/[0.09] text-white'
                  : 'text-white/[0.42] hover:text-white/[0.76]',
              ].join(' ')}
              aria-pressed={layoutMode === 'table'}
            >
              <Table2 className="h-3.5 w-3.5" />
              Tabla
            </button>
          </div>

          {layoutMode === 'normal' ? (
            <div className="grid grid-cols-4 gap-1 rounded-[14px] bg-white/[0.035] p-1">
              {[
                { value: 'week' as const, label: 'Semana', icon: Columns3 },
                { value: 'list' as const, label: 'Lista', icon: ListChecks },
                { value: 'kanban' as const, label: 'Kanban', icon: Columns3 },
                { value: 'calendar' as const, label: 'Calendario', icon: CalendarDays },
              ].map((item) => {
                const Icon = item.icon;
                const active = viewMode === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setViewMode(item.value)}
                    className={[
                      'inline-flex h-8 items-center justify-center gap-1.5 rounded-[9px] px-2.5 text-[10px] font-medium transition',
                      active
                        ? 'bg-white text-[#0b1020] shadow-sm'
                        : 'text-white/[0.42] hover:bg-white/[0.05] hover:text-white/[0.72]',
                    ].join(' ')}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {layoutMode === 'table' ? (
        <TaskTableView
          tasks={filteredTasks}
          onSelectTask={setSelectedTask}
          onStatusChange={actions.setStatus}
          changingStatusId={actions.changingStatusId}
        />
      ) : (
        <>
          {viewMode === 'week' ? (
            <TasksGrid
              range={range}
              loading={loading}
              statusFilter={statusFilter}
              search={search}
              onSelectTask={(t) => setSelectedTask(t)}
              BRIEF_STATUS={actions.BRIEF_STATUS}
              changingStatusId={actions.changingStatusId}
              savingNotesId={actions.savingNotesId}
              deletingId={actions.deletingId}
              onStatusChange={actions.setStatus}
              onSaveNotes={actions.saveNotes}
              onDelete={actions.removeTask}
              onDeleteDay={async (dayKey, dayTasks) => {
                await actions.removeDay(dayKey, dayTasks);
              }}
              deletingDayKey={actions.deletingDayKey}
            />
          ) : null}

          {viewMode === 'list' ? (
            <TaskListView
              tasks={filteredTasks}
              onSelectTask={setSelectedTask}
              onStatusChange={actions.setStatus}
              changingStatusId={actions.changingStatusId}
            />
          ) : null}

          {viewMode === 'kanban' ? (
            <TaskKanbanView
              tasks={filteredTasks}
              onSelectTask={setSelectedTask}
              onStatusChange={actions.setStatus}
            />
          ) : null}

          {viewMode === 'calendar' ? (
            <TaskCalendarView
              tasks={filteredTasks}
              range={range}
              onSelectTask={setSelectedTask}
            />
          ) : null}
        </>
      )}

      <TaskDetailModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        briefStatusLabel={(s) => actions.BRIEF_STATUS[s]}
        onTaskUpdate={(next) => {
          // 🔁 Refrescar inmediatamente la UI (grid + modal) sin recargar la página
          setSelectedTask(next);
          setTasks((prev) => {
            const exists = prev.some((t) => t.id === next.id);
            if (!exists) return prev;
            return prev.map((t) => (t.id === next.id ? next : t));
          });
        }}
        onAllDone={async (task) => {
          const updated = await actions.markDoneIfNeeded(task);
          return updated;
        }}
      />
    </>
  );
}
