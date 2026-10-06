"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  CircleX,
  Clock3,
  GripVertical,
  LockKeyhole,
  Users2,
} from "lucide-react";
import { useMemo, useState } from "react";

import type {
  ProjectTaskPriority,
  ProjectTaskStatus,
  ProjectTaskWithAssignees,
} from "@/lib/projectTasks";

type KanbanMove = {
  task: ProjectTaskWithAssignees;
  targetStatus: ProjectTaskStatus;
  overTaskId: number | null;
};

type Props = {
  tasks: ProjectTaskWithAssignees[];
  onOpenTask: (task: ProjectTaskWithAssignees) => void;
  onMoveTask: (move: KanbanMove) => Promise<void> | void;
  movingTaskId?: number | null;
};

type ColumnConfig = {
  status: ProjectTaskStatus;
  label: string;
  description: string;
  icon: typeof Circle;
  dotClass: string;
  countClass: string;
};

const COLUMNS: ColumnConfig[] = [
  {
    status: "not_started",
    label: "Sin empezar",
    description: "Pendientes de iniciar",
    icon: Circle,
    dotClass: "bg-white/[0.35]",
    countClass: "bg-white/[0.07] text-white/[0.72]",
  },
  {
    status: "in_progress",
    label: "En curso",
    description: "Trabajo activo",
    icon: Clock3,
    dotClass: "bg-sky-400",
    countClass: "bg-sky-400/10 text-sky-200",
  },
  {
    status: "done",
    label: "Completadas",
    description: "Trabajo finalizado",
    icon: CheckCircle2,
    dotClass: "bg-emerald-400",
    countClass: "bg-emerald-400/10 text-emerald-200",
  },
  {
    status: "cancelled",
    label: "Canceladas",
    description: "Fuera de alcance",
    icon: CircleX,
    dotClass: "bg-rose-400",
    countClass: "bg-rose-400/10 text-rose-200",
  },
];

function taskOrder(task: ProjectTaskWithAssignees) {
  return task.kanban_order ?? task.id * 1000;
}

function priorityStyles(priority: ProjectTaskPriority) {
  if (priority === "high") {
    return {
      label: "Alta",
      className: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    };
  }

  if (priority === "medium") {
    return {
      label: "Media",
      className: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    };
  }

  return {
    label: "Baja",
    className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  };
}

function formatDueDate(date: string | null) {
  if (!date) return "Sin fecha";

  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date.slice(0, 10);

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  }).format(parsed);
}

function isOverdue(task: ProjectTaskWithAssignees) {
  if (!task.due_date || task.status === "done" || task.status === "cancelled") {
    return false;
  }

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const due = new Date(`${task.due_date.slice(0, 10)}T00:00:00`);

  return due < startOfToday;
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function ProjectKanbanBoard({
  tasks,
  onOpenTask,
  onMoveTask,
  movingTaskId = null,
}: Props) {
  const [activeTask, setActiveTask] =
    useState<ProjectTaskWithAssignees | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const grouped = useMemo(() => {
    const map = new Map<ProjectTaskStatus, ProjectTaskWithAssignees[]>();

    COLUMNS.forEach((column) => map.set(column.status, []));

    tasks.forEach((task) => {
      const list = map.get(task.status) ?? [];
      list.push(task);
      map.set(task.status, list);
    });

    map.forEach((list, status) => {
      map.set(
        status,
        [...list].sort((a, b) => taskOrder(a) - taskOrder(b)),
      );
    });

    return map;
  }, [tasks]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const task = event.active.data.current?.task as
      | ProjectTaskWithAssignees
      | undefined;
    const over = event.over;

    setActiveTask(null);

    if (!task || !over || task.is_locked) return;

    const targetStatus = over.data.current?.status as
      | ProjectTaskStatus
      | undefined;

    if (!targetStatus) return;

    const overTask = over.data.current?.task as
      | ProjectTaskWithAssignees
      | undefined;

    if (overTask?.id === task.id && targetStatus === task.status) return;

    await onMoveTask({
      task,
      targetStatus,
      overTaskId: overTask?.id ?? null,
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event) => {
        const task = event.active.data.current?.task as
          | ProjectTaskWithAssignees
          | undefined;
        if (task) setActiveTask(task);
      }}
      onDragCancel={() => setActiveTask(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto">
        <div className="grid min-w-[1180px] grid-cols-4 gap-3 p-4">
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.status}
              config={column}
              tasks={grouped.get(column.status) ?? []}
              onOpenTask={onOpenTask}
              movingTaskId={movingTaskId}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 160, easing: "ease-out" }}>
        {activeTask ? (
          <div className="w-[280px] rotate-[1deg] opacity-95">
            <KanbanCardBody task={activeTask} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  config,
  tasks,
  onOpenTask,
  movingTaskId,
}: {
  config: ColumnConfig;
  tasks: ProjectTaskWithAssignees[];
  onOpenTask: (task: ProjectTaskWithAssignees) => void;
  movingTaskId: number | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${config.status}`,
    data: {
      type: "column",
      status: config.status,
    },
  });

  const Icon = config.icon;

  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-[440px] min-w-0 flex-col rounded-[18px] border transition-colors ${
        isOver
          ? "border-[#0a84ff]/[0.45] bg-[#0a84ff]/[0.045]"
          : "border-white/[0.07] bg-white/[0.025]"
      }`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-3.5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
            <h3 className="truncate text-[13px] font-medium text-white/[0.90]">
              {config.label}
            </h3>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-normal text-white/[0.46]">
            <Icon className="h-3 w-3" />
            {config.description}
          </div>
        </div>

        <span
          className={`rounded-lg px-2 py-1 text-[10px] font-medium ${config.countClass}`}
        >
          {tasks.length}
        </span>
      </header>

      <SortableContext
        items={tasks.map((task) => `task-${task.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2 p-2.5">
          {tasks.map((task) => (
            <SortableKanbanCard
              key={task.id}
              task={task}
              onOpen={() => onOpenTask(task)}
              moving={movingTaskId === task.id}
            />
          ))}

          {tasks.length === 0 ? (
            <div
              className={`grid min-h-[110px] place-items-center rounded-[14px] border border-dashed px-4 text-center transition-colors ${
                isOver
                  ? "border-[#0a84ff]/[0.35] bg-[#0a84ff]/[0.035] text-[#5ac8fa]"
                  : "border-white/[0.07] text-white/[0.30]"
              }`}
            >
              <div>
                <div className="text-xs font-normal">
                  {isOver ? "Soltá la tarea acá" : "Sin tareas"}
                </div>
                {!isOver ? (
                  <div className="mt-1 text-[10px] text-white/[0.22]">
                    Arrastrá una tarea a esta columna
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableKanbanCard({
  task,
  onOpen,
  moving,
}: {
  task: ProjectTaskWithAssignees;
  onOpen: () => void;
  moving: boolean;
}) {
  const locked = Boolean(task.is_locked);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `task-${task.id}`,
    disabled: locked || moving,
    data: {
      type: "task",
      task,
      status: task.status,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`relative ${
        isDragging ? "z-20 opacity-25" : "opacity-100"
      }`}
    >
      <KanbanCardBody
        task={task}
        onOpen={onOpen}
        moving={moving}
        dragging={isDragging}
        dragProps={
          locked
            ? undefined
            : {
                ...attributes,
                ...listeners,
              }
        }
      />
    </article>
  );
}

function KanbanCardBody({
  task,
  onOpen,
  dragProps,
  dragging = false,
  moving = false,
  overlay = false,
}: {
  task: ProjectTaskWithAssignees;
  onOpen?: () => void;
  dragProps?: any;
  dragging?: boolean;
  moving?: boolean;
  overlay?: boolean;
}) {
  const priority = priorityStyles(task.priority);
  const overdue = isOverdue(task);
  const locked = Boolean(task.is_locked);

  return (
    <div
      role={overlay ? undefined : "button"}
      tabIndex={overlay ? undefined : 0}
      {...(overlay ? {} : dragProps ?? {})}
      onClick={
        overlay
          ? undefined
          : (event) => {
              if (dragging) {
                event.preventDefault();
                return;
              }
              onOpen?.();
            }
      }
      onKeyDown={
        overlay
          ? undefined
          : (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen?.();
              }
            }
      }
      className={`group rounded-[15px] border bg-[#1c1c1e] p-3 text-left shadow-[0_8px_24px_rgba(0,0,0,.13)] transition ${
        !overlay && !locked ? "cursor-grab select-none active:cursor-grabbing" : ""
      } ${
        overlay
          ? "border-[#0a84ff]/40 shadow-[0_18px_50px_rgba(0,0,0,.35)]"
          : "border-white/[0.075] hover:border-white/[0.13] hover:bg-[#202023]"
      } ${moving ? "pointer-events-none opacity-55" : ""}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium leading-5 text-white/[0.92]">
            {task.title}
          </div>
          <div className="mt-1 truncate text-[10px] font-normal text-white/[0.48]">
            {task.project || "Proyecto general"}
          </div>
        </div>

        {locked ? (
          <span
            title="Tarea cerrada"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.045] text-white/[0.36]"
          >
            <LockKeyhole className="h-3.5 w-3.5" />
          </span>
        ) : dragProps ? (
          <span
            aria-hidden="true"
            title="Arrastrar tarea"
            className="pointer-events-none grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/[0.28] transition group-hover:bg-white/[0.06] group-hover:text-white/[0.64]"
          >
            <GripVertical className="h-4 w-4" />
          </span>
        ) : null}
      </div>

      {task.summary ? (
        <p className="mt-2 line-clamp-2 text-[10px] font-normal leading-4 text-white/[0.42]">
          {task.summary}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-lg border px-2 py-1 text-[9px] font-medium ${priority.className}`}
        >
          {priority.label}
        </span>

        <span
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-normal ${
            overdue
              ? "bg-rose-400/10 text-rose-200"
              : "bg-white/[0.045] text-white/[0.52]"
          }`}
        >
          <CalendarDays className="h-3 w-3" />
          {formatDueDate(task.due_date)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.055] pt-2.5">
        <div className="flex min-w-0 items-center">
          {task.assignees.length ? (
            <div className="flex -space-x-1.5">
              {task.assignees.slice(0, 3).map((assignee, index) => {
                const label =
                  assignee.full_name ??
                  assignee.email ??
                  `Responsable ${index + 1}`;

                return (
                  <span
                    key={assignee.user_id}
                    title={label}
                    className="grid h-6 w-6 place-items-center rounded-full border border-[#1c1c1e] bg-white/[0.08] text-[8px] font-medium text-white/[0.72]"
                  >
                    {initials(label)}
                  </span>
                );
              })}
              {task.assignees.length > 3 ? (
                <span className="grid h-6 w-6 place-items-center rounded-full border border-[#1c1c1e] bg-white/[0.055] text-[8px] font-medium text-white/[0.50]">
                  +{task.assignees.length - 3}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-[9px] font-normal text-white/[0.30]">
              <Users2 className="h-3 w-3" />
              Sin responsables
            </span>
          )}
        </div>

        {moving ? (
          <span className="text-[9px] font-normal text-[#5ac8fa]">
            Guardando…
          </span>
        ) : null}
      </div>
    </div>
  );
}
