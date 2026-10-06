'use client';

import { useMemo, type ComponentType } from 'react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  CalendarDays,
  Clock3,
  GripVertical,
   ListChecks,
  Repeat2,
} from 'lucide-react';
import { eachDayOfInterval, startOfWeek } from 'date-fns';
import { CSS } from '@dnd-kit/utilities';

import type { Task } from '@/lib/tasks';
import { RedcomSelect } from '@/components/ui/redcom-select';
import { toYMD } from '../date';

export type TaskViewMode = 'week' | 'list' | 'kanban' | 'calendar';

const STATUS_LABELS: Record<Task['status'], string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  done: 'Completada',
  cancelled: 'Cancelada',
};

const STATUS_TONES: Record<Task['status'], 'neutral' | 'blue' | 'green' | 'red'> = {
  pending: 'neutral',
  in_progress: 'blue',
  done: 'green',
  cancelled: 'red',
};

const STATUS_DOT: Record<Task['status'], string> = {
  pending: 'bg-white/35',
  in_progress: 'bg-sky-300',
  done: 'bg-emerald-300',
  cancelled: 'bg-rose-300',
};

function timeLabel(task: Task) {
  return new Date(task.scheduled_at).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function recurrenceLabel(task: Task) {
  if (task.recurrence_type === 'daily') return 'Diaria';
  if (task.recurrence_type === 'weekly') return 'Semanal';
  if (task.recurrence_type === 'first_business_day_month') return 'Mensual';
  if (task.recurrence_type === 'every_n_days') {
    return `Cada ${task.recurrence_interval_days ?? 1} días`;
  }
  return null;
}

export function TaskListView({
  tasks,
  onSelectTask,
  onStatusChange,
  changingStatusId,
}: {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onStatusChange: (task: Task, status: Task['status']) => Promise<Task>;
  changingStatusId: number | null;
}) {
  const sorted = useMemo(
    () =>
      [...tasks].sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
      ),
    [tasks],
  );

  if (sorted.length === 0) {
    return <EmptyState icon={ListChecks} text="No hay tareas para mostrar en esta vista." />;
  }

  return (
    <section className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#151517] shadow-[0_16px_45px_rgba(0,0,0,.12)]">
      <div className="grid grid-cols-[110px_minmax(0,1fr)_150px_110px] gap-3 border-b border-white/[0.07] px-4 py-3 text-[9px] font-medium uppercase tracking-[0.1em] text-white/[0.32]">
        <span>Fecha</span>
        <span>Tarea</span>
        <span>Estado</span>
        <span>Hora</span>
      </div>

      <div className="divide-y divide-white/[0.055]">
        {sorted.map((task) => {
          const recurrent = recurrenceLabel(task);
          const date = new Date(task.scheduled_at);
          return (
            <div
              key={task.id}
              onClick={() => onSelectTask(task)}
              className="grid cursor-pointer grid-cols-[110px_minmax(0,1fr)_150px_110px] items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.025]"
            >
              <div>
                <div className="text-[11px] font-medium text-white/[0.78]">
                  {date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                </div>
                <div className="mt-0.5 text-[9px] uppercase tracking-[0.08em] text-white/[0.28]">
                  {date.toLocaleDateString('es-AR', { weekday: 'short' })}
                </div>
              </div>

              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium text-white/[0.88]">{task.title}</div>
                <div className="mt-1 flex items-center gap-2">
                  {task.description ? (
                    <span className="truncate text-[10px] text-white/[0.35]">{task.description}</span>
                  ) : null}
                  {recurrent ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#0a84ff]/10 px-2 py-0.5 text-[9px] text-[#5ac8fa]">
                      <Repeat2 className="h-3 w-3" />
                      {recurrent}
                    </span>
                  ) : null}
                </div>
              </div>

              <div
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <RedcomSelect
                  value={task.status}
                  options={[
                    { value: 'pending', label: STATUS_LABELS.pending },
                    { value: 'in_progress', label: STATUS_LABELS.in_progress },
                    { value: 'done', label: STATUS_LABELS.done },
                    { value: 'cancelled', label: STATUS_LABELS.cancelled },
                  ]}
                  onValueChange={(value) =>
                    void onStatusChange(task, value as Task['status'])
                  }
                  disabled={changingStatusId === task.id}
                  surface="dark"
                  triggerTone={STATUS_TONES[task.status]}
                  className="h-8 rounded-full !border-transparent px-2 text-[10px] hover:!border-transparent focus-visible:!border-transparent data-[state=open]:!border-transparent"
                />
              </div>

              <span className="inline-flex items-center gap-1.5 text-[10px] text-white/[0.38]">
                <Clock3 className="h-3.5 w-3.5" />
                {timeLabel(task)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const KANBAN_COLUMNS: Array<{ status: Task['status']; label: string }> = [
  { status: 'pending', label: 'Pendiente' },
  { status: 'in_progress', label: 'En progreso' },
  { status: 'done', label: 'Completada' },
  { status: 'cancelled', label: 'Cancelada' },
];

export function TaskKanbanView({
  tasks,
  onSelectTask,
  onStatusChange,
}: {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onStatusChange: (task: Task, status: Task['status']) => Promise<Task>;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const taskId = Number(String(event.active.id).replace('kanban-task:', ''));
    const status = String(event.over?.id ?? '').replace('kanban-column:', '') as Task['status'];
    const task = tasks.find((item) => item.id === taskId);

    if (!task || !KANBAN_COLUMNS.some((column) => column.status === status)) return;
    if (task.status === status) return;

    await onStatusChange(task, status);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <section className="grid gap-3 xl:grid-cols-4">
        {KANBAN_COLUMNS.map((column) => (
          <KanbanColumn
            key={column.status}
            status={column.status}
            label={column.label}
            tasks={tasks.filter((task) => task.status === column.status)}
            onSelectTask={onSelectTask}
          />
        ))}
      </section>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  label,
  tasks,
  onSelectTask,
}: {
  status: Task['status'];
  label: string;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `kanban-column:${status}` });

  return (
    <div
      ref={setNodeRef}
      className={[
        'min-h-[360px] rounded-[20px] border border-white/[0.08] bg-[#151517] p-3.5 shadow-[0_14px_35px_rgba(0,0,0,.10)] transition',
        isOver ? 'ring-2 ring-[#5ac8fa]/25' : '',
      ].join(' ')}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
          <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-white/[0.62]">
            {label}
          </span>
        </div>
        <span className="rounded-full bg-white/[0.045] px-2 py-0.5 text-[9px] text-white/[0.35]">
          {tasks.length}
        </span>
      </div>

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="grid min-h-[260px] place-items-center rounded-[14px] border border-dashed border-white/[0.06] text-[10px] text-white/[0.22]">
            Soltá una tarea aquí
          </div>
        ) : (
          tasks.map((task) => (
            <KanbanTask key={task.id} task={task} onSelectTask={onSelectTask} />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanTask({
  task,
  onSelectTask,
}: {
  task: Task;
  onSelectTask: (task: Task) => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging, transform } = useDraggable({
    id: `kanban-task:${task.id}`,
  });

  const dragStyle = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 60 : undefined,
    position: 'relative' as const,
  };

  return (
    <article
      ref={setNodeRef}
      style={dragStyle}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) onSelectTask(task);
      }}
      className={[
        'cursor-grab rounded-[14px] border border-white/[0.07] bg-[#1c1c1e] p-3 transition-[border-color,background-color,box-shadow,opacity] duration-150 hover:border-white/[0.12] hover:bg-[#202023] active:cursor-grabbing',
        isDragging
          ? 'border-[#5ac8fa]/35 bg-[#242426] opacity-95 shadow-[0_20px_55px_rgba(0,0,0,.42)] ring-1 ring-[#5ac8fa]/15'
          : '',
      ].join(' ')}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[9px] text-white/[0.32]">
          <Clock3 className="h-3 w-3" />
          {timeLabel(task)}
        </span>
        <GripVertical className="h-3.5 w-3.5 text-white/[0.20]" />
      </div>
      <div className="text-[11px] font-medium leading-4 text-white/[0.88]">{task.title}</div>
      {task.description ? (
        <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-white/[0.36]">
          {task.description}
        </p>
      ) : null}
      {task.recurrence_type ? (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#0a84ff]/10 px-2 py-0.5 text-[9px] text-[#5ac8fa]">
          <Repeat2 className="h-3 w-3" />
          {recurrenceLabel(task)}
        </div>
      ) : null}
    </article>
  );
}

export function TaskCalendarView({
  tasks,
  range,
  onSelectTask,
}: {
  tasks: Task[];
  range: { from: Date; to: Date };
  onSelectTask: (task: Task) => void;
}) {
  const days = useMemo(
    () => eachDayOfInterval({ start: range.from, end: range.to }),
    [range.from, range.to],
  );

  const leading = useMemo(() => {
    if (days.length === 0) return 0;
    const monday = startOfWeek(days[0], { weekStartsOn: 1 });
    return Math.max(
      0,
      Math.round((days[0].getTime() - monday.getTime()) / 86400000),
    );
  }, [days]);

  const grouped = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      const key = toYMD(new Date(task.scheduled_at));
      (map[key] ||= []).push(task);
    });
    return map;
  }, [tasks]);

  return (
    <section className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#151517] shadow-[0_16px_45px_rgba(0,0,0,.12)]">
      <div className="grid grid-cols-7 border-b border-white/[0.07] bg-white/[0.015]">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
          <div
            key={day}
            className="px-3 py-2.5 text-center text-[9px] font-medium uppercase tracking-[0.09em] text-white/[0.30]"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: leading }).map((_, index) => (
          <div key={`blank-${index}`} className="min-h-[150px] border-b border-r border-white/[0.045] bg-black/[0.08]" />
        ))}

        {days.map((day) => {
          const key = toYMD(day);
          const dayTasks = grouped[key] ?? [];
          const isToday = toYMD(new Date()) === key;

          return (
            <div
              key={key}
              className="min-h-[150px] border-b border-r border-white/[0.045] p-2.5 last:border-r-0"
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={[
                    'grid h-7 w-7 place-items-center rounded-full text-[10px] font-medium',
                    isToday
                      ? 'bg-[#0a84ff] text-white'
                      : 'text-white/[0.48]',
                  ].join(' ')}
                >
                  {day.getDate()}
                </span>
                {dayTasks.length > 0 ? (
                  <span className="text-[9px] text-white/[0.25]">{dayTasks.length}</span>
                ) : null}
              </div>

              <div className="space-y-1.5">
                {dayTasks.slice(0, 4).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onSelectTask(task)}
                    className="flex w-full items-center gap-2 rounded-[9px] border border-white/[0.055] bg-white/[0.025] px-2 py-1.5 text-left transition hover:bg-white/[0.055]"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[task.status]}`} />
                    <span className="min-w-0 flex-1 truncate text-[9px] font-medium text-white/[0.68]">
                      {task.title}
                    </span>
                    <span className="text-[8px] text-white/[0.25]">{timeLabel(task)}</span>
                  </button>
                ))}
                {dayTasks.length > 4 ? (
                  <div className="px-1 text-[9px] text-white/[0.28]">
                    +{dayTasks.length - 4} más
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="grid min-h-[260px] place-items-center rounded-[22px] border border-dashed border-white/[0.08] bg-[#151517]">
      <div className="text-center">
        <Icon className="mx-auto h-5 w-5 text-white/[0.22]" />
        <p className="mt-2 text-[10px] text-white/[0.30]">{text}</p>
      </div>
    </div>
  );
}
