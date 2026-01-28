'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const actions = useTaskActions();
  const { tasks, setTasks } = useTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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

      <TasksGrid
        range={range}
        loading={loading}
        statusFilter={statusFilter}
        search={search}
        onSelectTask={(t) => setSelectedTask(t)}

        // ✅ props que necesita TaskCard (evita BRIEF_STATUS undefined)
        BRIEF_STATUS={actions.BRIEF_STATUS}
        changingStatusId={actions.changingStatusId}
        savingNotesId={actions.savingNotesId}
        deletingId={actions.deletingId}
        onToggleStatus={actions.toggleStatus}
        onSaveNotes={actions.saveNotes}
        onDelete={actions.removeTask}
        onDeleteDay={async (dayKey, dayTasks) => {
          await actions.removeDay(dayKey, dayTasks);
        }}
        deletingDayKey={actions.deletingDayKey}
      />

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
