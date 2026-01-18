'use client';

import { useEffect, useState } from 'react';
import type { Task } from '@/lib/tasks';

import { TasksProvider } from './TasksContext';
import { useTasks } from './TasksContext';
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
  const { tasks } = useTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // mantener la modal sincronizada cuando se actualiza una tarea (estado/notas) desde cards
  useEffect(() => {
    if (!selectedTask) return;
    const fresh = tasks.find((t) => t.id === selectedTask.id);
    if (fresh) setSelectedTask(fresh);
  }, [tasks, selectedTask]);

  return (
    <>
      <NewTaskForm />

      <TasksGrid
        range={range}
        loading={loading}
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
        onTaskUpdate={(next) => setSelectedTask(next)}
        onAllDone={async (task) => {
          const updated = await actions.markDoneIfNeeded(task);
          return updated;
        }}
      />
    </>
  );
}
