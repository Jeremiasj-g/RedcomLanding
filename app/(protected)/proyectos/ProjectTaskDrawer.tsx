'use client';

import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  X,
  CalendarDays,
  CheckSquare,
  Square,
  Plus,
  Link2,
  ListChecks,
  GripVertical,
  Pencil,
  Check,
  ChevronDown,
  Table2,
  Columns3,
  Loader2,
  Save,
  UsersRound,
} from 'lucide-react';
import {
  updateProjectTask,
  setTaskAssignees,
  fetchTaskWorkspace,
  upsertTaskWorkspace,
  type ProjectTaskWithAssignees,
  type AssigneeOption,
  type ProjectTaskStatus,
  type ProjectTaskPriority,
  type ProjectTaskWorkspaceTodo,
  type ProjectTaskWorkspaceTodoGroup,
  type ProjectTaskWorkspaceGroupPriority,
  type ProjectTaskWorkspaceLink,
} from '@/lib/projectTasks';
import { RedcomDatePicker } from '@/components/ui/redcom-date-picker';
import { RedcomSelect } from '@/components/ui/redcom-select';
import type { ProjectWithMembers } from '@/lib/projects';
import ProjectTaskActivityPanel from './ProjectTaskActivityPanel';
import type { ProjectTaskSheetSaveState } from './ProjectTaskSheetGrid';
import { errorMessage, notify } from '@/lib/notifications';
import { isPastIsoDate, localTodayIso } from '@/lib/dateValidation';

const ProjectTaskSheetGrid = dynamic(
  () => import('./ProjectTaskSheetGrid'),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full min-h-[460px] place-items-center bg-[#17181b] text-[11px] text-white/[0.45]">
        Preparando planilla...
      </div>
    ),
  },
);

type Props = {
  task: ProjectTaskWithAssignees;
  supervisors: AssigneeOption[];
  projects: ProjectWithMembers[];
  currentUserRole: string; // 'admin' | 'jdv' | 'supervisor' | ...
  currentUserId: string | null;
  onClose: () => void;
  onUpdated: (t: ProjectTaskWithAssignees) => void;
};

// ──────────────────────────────────────────────
// Opciones de estado / prioridad
// ──────────────────────────────────────────────

const STATUS_OPTIONS: {
  value: ProjectTaskStatus;
  label: string;
  pillClass: string;
  dotClass: string;
}[] = [
  {
    value: 'not_started',
    label: 'Sin empezar',
    pillClass: 'border border-white/10 bg-white/[0.07] text-white/[0.82]',
    dotClass: 'bg-gray-300',
  },
  {
    value: 'in_progress',
    label: 'En curso',
    pillClass: 'border border-sky-400/20 bg-sky-400/10 text-sky-200',
    dotClass: 'bg-sky-400',
  },
  {
    value: 'done',
    label: 'Completada',
    pillClass: 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    dotClass: 'bg-emerald-400',
  },
  {
    value: 'cancelled',
    label: 'Cancelada',
    pillClass: 'border border-rose-400/20 bg-rose-400/10 text-rose-200',
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
    pillClass: 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    dotClass: 'bg-emerald-400',
  },
  {
    value: 'medium',
    label: 'Media',
    pillClass: 'border border-amber-400/20 bg-amber-400/10 text-amber-200',
    dotClass: 'bg-amber-400',
  },
  {
    value: 'high',
    label: 'Alta',
    pillClass: 'border border-rose-400/20 bg-rose-400/10 text-rose-200',
    dotClass: 'bg-rose-400',
  },
];

const TODO_GROUP_PRIORITY_OPTIONS: {
  value: ProjectTaskWorkspaceGroupPriority;
  label: string;
  lineClass: string;
  selectedClass: string;
}[] = [
  {
    value: 'low',
    label: 'Baja',
    lineClass: 'bg-emerald-400',
    selectedClass:
      'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  },
  {
    value: 'medium',
    label: 'Media',
    lineClass: 'bg-amber-400',
    selectedClass:
      'border-amber-400/25 bg-amber-400/10 text-amber-200',
  },
  {
    value: 'high',
    label: 'Alta',
    lineClass: 'bg-rose-400',
    selectedClass:
      'border-rose-400/25 bg-rose-400/10 text-rose-200',
  },
];

const getTodoGroupPriorityOption = (
  priority?: ProjectTaskWorkspaceGroupPriority | null,
) =>
  TODO_GROUP_PRIORITY_OPTIONS.find((option) => option.value === priority) ??
  null;

// ──────────────────────────────────────────────
// Helpers generales
// ──────────────────────────────────────────────

const makeId = () => Math.random().toString(36).slice(2);

const normalizeUrl = (raw: string): string => {
  let url = raw.trim();
  if (!url) return '#';

  url = url.replace(/^\/+/, '');

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
};

const needsReadMore = (text: string, limit = 80) => text.length > limit;

// snapshot de workspace para comparar
const buildWorkspaceSnapshot = (args: {
  todos: ProjectTaskWorkspaceTodo[];
  todoGroups: ProjectTaskWorkspaceTodoGroup[];
  resourceLinks: ProjectTaskWorkspaceLink[];
}) =>
  JSON.stringify({
    todos: args.todos,
    todoGroups: args.todoGroups,
    resourceLinks: args.resourceLinks,
  });

// ──────────────────────────────────────────────
// Tailwind comunes
// ──────────────────────────────────────────────

const INPUT_BASE =
  'rounded-xl border border-white/[0.08] bg-white/[0.04] text-[11px] font-normal text-white/[0.90] outline-none placeholder:text-white/[0.46] transition hover:bg-white/[0.055] focus:border-[#0a84ff]/[0.55] focus:bg-white/[0.06] focus:ring-4 focus:ring-[#0a84ff]/10 disabled:cursor-not-allowed disabled:opacity-50';

const BADGE_BASE =
  'rounded-lg px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em]';

const PANEL_BASE =
  'flex flex-1 min-h-0 flex-col';

const BUTTON_TINY_GRAY =
  'rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-medium text-white/[0.78] transition hover:bg-white/[0.10] hover:text-white/[0.90]';

export default function ProjectTaskDrawer({
  task,
  supervisors,
  projects,
  currentUserRole,
  currentUserId,
  onClose,
  onUpdated,
}: Props) {
  const canManage = currentUserRole === 'admin' || currentUserRole === 'jdv';

  // ───── FICHA IZQUIERDA ────────────────────────────────
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [project, setProject] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState<ProjectTaskStatus>('not_started');
  const [priority, setPriority] = useState<ProjectTaskPriority>('low');
  const [dueDate, setDueDate] = useState(''); // yyyy-mm-dd
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);

  // dropdown responsables
  const [assigneesMenuOpen, setAssigneesMenuOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  // project/summary lectura vs edición + expandido
  const [editingProject, setEditingProject] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [expandedProject, setExpandedProject] = useState(false);
  const [expandedSummary, setExpandedSummary] = useState(false);

  // ───── WORKSPACE DERECHO (persistido) ────────────────
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [todos, setTodos] = useState<ProjectTaskWorkspaceTodo[]>([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [resourceLinks, setResourceLinks] = useState<ProjectTaskWorkspaceLink[]>(
    [],
  );
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [rightPanel, setRightPanel] = useState<'notes' | 'activity'>('notes');
  const [workspaceViewMode, setWorkspaceViewMode] =
    useState<'workspace' | 'sheet'>('workspace');
  const [sheetSaveState, setSheetSaveState] =
    useState<ProjectTaskSheetSaveState>('idle');


  // ───── CHECKLIST AGRUPADO (columna 2) ────────────────
  const TODO_GROUP_PREFIX = '§§';
  const TODO_NO_GROUP_KEY = '__NO_GROUP__';

  const newTodoInputRef = useRef<HTMLInputElement | null>(null);

  const decodeTodo = (text: string) => {
    if (!text?.startsWith(TODO_GROUP_PREFIX)) return { group: null as string | null, label: text ?? '' };
    const idx = text.indexOf(TODO_GROUP_PREFIX, 2);
    if (idx === -1) return { group: null as string | null, label: text ?? '' };
    const group = text.slice(2, idx).trim() || null;
    const label = text.slice(idx + 2).trimStart();
    return { group, label };
  };

  const encodeTodo = (group: string | null, label: string) => {
    if (!group) return label;
    return `${TODO_GROUP_PREFIX}${group}${TODO_GROUP_PREFIX} ${label}`;
  };

  const [todoGroups, setTodoGroups] = useState<ProjectTaskWorkspaceTodoGroup[]>([]);
  const [todoGroupSelected, setTodoGroupSelected] = useState<string | null>(null);
  const [todoGroupMenuOpen, setTodoGroupMenuOpen] = useState(false);
  const [newTodoGroupName, setNewTodoGroupName] = useState('');
  const [newTodoGroupPriority, setNewTodoGroupPriority] =
    useState<ProjectTaskWorkspaceGroupPriority>('medium');
  const [newTodoGroupAssigneeIds, setNewTodoGroupAssigneeIds] = useState<string[]>([]);
  const [newTodoGroupPanelOpen, setNewTodoGroupPanelOpen] = useState(false);
  const [editingTodoGroupName, setEditingTodoGroupName] = useState<string | null>(null);
  const [editingTodoGroupValue, setEditingTodoGroupValue] = useState('');
  const [editingTodoGroupPriority, setEditingTodoGroupPriority] =
    useState<ProjectTaskWorkspaceGroupPriority>('medium');
  const [editingTodoGroupAssigneeIds, setEditingTodoGroupAssigneeIds] =
    useState<string[]>([]);
  const [deleteTodoGroupConfirm, setDeleteTodoGroupConfirm] = useState<{
    name: string;
    itemCount: number;
  } | null>(null);
  const todoGroupPickerRef = useRef<HTMLDivElement | null>(null);

  // edición inline
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoValue, setEditingTodoValue] = useState('');

  // DnD
  const [activeTodoDropId, setActiveTodoDropId] = useState('');
  const [activeTodoId, setActiveTodoId] = useState<string | null>(null);
  const todoDndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // cerrar dropdown grupo al click afuera
  useEffect(() => {
    if (!todoGroupMenuOpen) return;

    const onDown = (e: MouseEvent) => {
      const el = todoGroupPickerRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) {
        setTodoGroupMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [todoGroupMenuOpen]);

  const groupAssigneeOptions = useMemo(
    () =>
      task.assignees
        .map((assignee) => ({
          id: assignee.user_id,
          full_name: assignee.full_name,
          email: assignee.email,
        }))
        .sort((a, b) =>
          (a.full_name ?? a.email ?? '').localeCompare(
            b.full_name ?? b.email ?? '',
            'es',
          ),
        ),
    [task.assignees],
  );

  const groupAssigneeById = useMemo(
    () =>
      new Map(
        groupAssigneeOptions.map((assignee) => [assignee.id, assignee]),
      ),
    [groupAssigneeOptions],
  );

  const sanitizeGroupAssigneeIds = (ids: string[]) => {
    const allowed = new Set(groupAssigneeOptions.map((assignee) => assignee.id));
    return Array.from(new Set(ids)).filter((id) => allowed.has(id));
  };

  const toggleAssigneeId = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setter((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const getGroupAssigneeNames = (ids?: string[]) =>
    (ids ?? [])
      .map((id) => groupAssigneeById.get(id))
      .filter(Boolean)
      .map(
        (assignee) =>
          assignee?.full_name ?? assignee?.email ?? 'Sin nombre',
      );

  useEffect(() => {
    const allowed = new Set(task.assignees.map((assignee) => assignee.user_id));

    setTodoGroups((current) => {
      let changed = false;

      const next = current.map((group) => {
        const assigned = group.assignee_ids ?? [];
        const valid = assigned.filter((id) => allowed.has(id));

        if (valid.length === assigned.length) return group;

        changed = true;
        return {
          ...group,
          assignee_ids: valid,
        };
      });

      return changed ? next : current;
    });
  }, [task.assignees]);

  const addTodoGroup = (
    name: string,
    priority: ProjectTaskWorkspaceGroupPriority = 'medium',
    assigneeIds: string[] = [],
  ) => {
    const cleanName = name.trim();

    if (!cleanName) {
      notify.error('Ingresá un nombre para el grupo.');
      return false;
    }

    if (cleanName.length > 50) {
      notify.error('El nombre del grupo no puede superar los 50 caracteres.');
      return false;
    }

    const duplicate = todoGroups.some(
      (group) =>
        group.name.localeCompare(cleanName, 'es', {
          sensitivity: 'base',
        }) === 0,
    );

    if (duplicate) {
      notify.error('Ya existe un grupo con ese nombre.');
      return false;
    }

    const cleanAssigneeIds = sanitizeGroupAssigneeIds(assigneeIds);

    setTodoGroups((prev) =>
      [
        ...prev,
        {
          name: cleanName,
          priority,
          assignee_ids: cleanAssigneeIds,
        },
      ].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    );

    return true;
  };

  const createTodoGroupFromDraft = () => {
    const name = newTodoGroupName.trim();
    if (
      !addTodoGroup(
        name,
        newTodoGroupPriority,
        newTodoGroupAssigneeIds,
      )
    ) {
      return;
    }

    setTodoGroupSelected(name);
    setNewTodoGroupName('');
    setNewTodoGroupPriority('medium');
    setNewTodoGroupAssigneeIds([]);
    setNewTodoGroupPanelOpen(false);
    setTodoGroupMenuOpen(false);
  };

  // Compatibilidad con grupos históricos guardados dentro del texto del todo.
  useEffect(() => {
    const discoveredNames = Array.from(
      new Set(
        (todos ?? [])
          .map((todo) => decodeTodo((todo as any).text).group)
          .filter(Boolean) as string[],
      ),
    );

    if (discoveredNames.length === 0) return;

    setTodoGroups((prev) => {
      const byName = new Map(prev.map((group) => [group.name, group]));

      for (const name of discoveredNames) {
        if (!byName.has(name)) {
          byName.set(name, {
            name,
            priority: 'medium',
            assignee_ids: [],
          });
        }
      }

      return Array.from(byName.values()).sort((a, b) =>
        a.name.localeCompare(b.name, 'es'),
      );
    });
  }, [todos]);

  const todosUi = useMemo(() => {
    return (todos ?? []).map((todo) => {
      const { group, label } = decodeTodo((todo as any).text);
      return { ...todo, group, label };
    });
  }, [todos]);

  const { todoGroupKeys, todosByGroup } = useMemo(() => {
    const map = new Map<string, any[]>();

    for (const todo of todosUi as any[]) {
      const key = todo.group ?? TODO_NO_GROUP_KEY;
      const current = map.get(key) ?? [];
      current.push(todo);
      map.set(key, current);
    }

    const keys = Array.from(
      new Set([...map.keys(), ...todoGroups.map((group) => group.name)]),
    ).sort((a, b) => {
      if (a === TODO_NO_GROUP_KEY) return -1;
      if (b === TODO_NO_GROUP_KEY) return 1;
      return a.localeCompare(b, 'es');
    });

    return { todoGroupKeys: keys, todosByGroup: map };
  }, [todoGroups, todosUi]);

  const getTodoGroup = (name: string | null) =>
    name ? todoGroups.find((group) => group.name === name) ?? null : null;

  const startEditTodoGroup = (name: string) => {
    const group = getTodoGroup(name);
    if (!group) return;

    setEditingTodoGroupName(name);
    setEditingTodoGroupValue(group.name);
    setEditingTodoGroupPriority(group.priority);
    setEditingTodoGroupAssigneeIds(
      sanitizeGroupAssigneeIds(group.assignee_ids ?? []),
    );
  };

  const cancelEditTodoGroup = () => {
    setEditingTodoGroupName(null);
    setEditingTodoGroupValue('');
    setEditingTodoGroupPriority('medium');
    setEditingTodoGroupAssigneeIds([]);
  };

  const saveEditTodoGroup = () => {
    if (!editingTodoGroupName) return;

    const nextName = editingTodoGroupValue.trim();
    if (!nextName) {
      notify.error('El nombre del grupo no puede quedar vacío.');
      return;
    }

    if (nextName.length > 50) {
      notify.error('El nombre del grupo no puede superar los 50 caracteres.');
      return;
    }

    const previousName = editingTodoGroupName;
    const duplicate = todoGroups.some(
      (group) =>
        group.name !== previousName &&
        group.name.localeCompare(nextName, 'es', {
          sensitivity: 'base',
        }) === 0,
    );

    if (duplicate) {
      notify.error('Ya existe otro grupo con ese nombre.');
      return;
    }

    setTodos((prev) =>
      prev.map((todo) => {
        const decoded = decodeTodo(todo.text);
        if (decoded.group !== previousName) return todo;

        return {
          ...todo,
          text: encodeTodo(nextName, decoded.label),
        };
      }),
    );

    setTodoGroups((prev) => {
      const withoutCurrent = prev.filter(
        (group) => group.name !== previousName && group.name !== nextName,
      );

      return [
        ...withoutCurrent,
        {
          name: nextName,
          priority: editingTodoGroupPriority,
          assignee_ids: sanitizeGroupAssigneeIds(
            editingTodoGroupAssigneeIds,
          ),
        },
      ].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    });

    setTodoGroupSelected((current) =>
      current === previousName ? nextName : current,
    );

    cancelEditTodoGroup();
  };

  const requestDeleteTodoGroup = (name: string) => {
    const itemCount = todosUi.filter((todo) => todo.group === name).length;
    setDeleteTodoGroupConfirm({ name, itemCount });
  };

  const confirmDeleteTodoGroup = () => {
    if (!deleteTodoGroupConfirm) return;

    const { name } = deleteTodoGroupConfirm;

    // El grupo desaparece, pero sus pasos se conservan en "Sin grupo".
    setTodos((prev) =>
      prev.map((todo) => {
        const decoded = decodeTodo(todo.text);
        if (decoded.group !== name) return todo;

        return {
          ...todo,
          text: encodeTodo(null, decoded.label),
        };
      }),
    );

    setTodoGroups((prev) => prev.filter((group) => group.name !== name));
    setTodoGroupSelected((current) => (current === name ? null : current));

    if (editingTodoGroupName === name) {
      cancelEditTodoGroup();
    }

    setDeleteTodoGroupConfirm(null);
    notify.success('Grupo eliminado. Sus pasos quedaron en Sin grupo.');
  };

  const startEditTodo = (t: any) => {
    setEditingTodoId(t.id);
    setEditingTodoValue(t.label ?? '');
  };

  const cancelEditTodo = () => {
    setEditingTodoId(null);
    setEditingTodoValue('');
  };

  const saveEditTodo = (t: any) => {
    const nextLabel = editingTodoValue.trim();

    if (!nextLabel) {
      notify.error('El paso no puede quedar vacío.');
      return;
    }

    if (nextLabel.length > 180) {
      notify.error('Cada paso puede tener hasta 180 caracteres.');
      return;
    }

    const nextText = encodeTodo(t.group ?? null, nextLabel);

    setTodos((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, text: nextText } : x)),
    );

    cancelEditTodo();
  };

  const handleTodoDragEnd = (e: DragEndEvent) => {
    const activeId = String(e.active?.id ?? '');
    const overId = String(e.over?.id ?? '');

    setActiveTodoDropId('');
    setActiveTodoId(null);

    if (!activeId || !overId.startsWith('drop:')) return;

    const dropKey = overId.replace('drop:', '');
    const newGroup = dropKey === TODO_NO_GROUP_KEY ? null : dropKey;

    const t = (todosUi as any[]).find((x) => x.id === activeId);
    if (!t) return;

    if ((t.group ?? null) === (newGroup ?? null)) return;

    const nextText = encodeTodo(newGroup, t.label ?? '');

    setTodos((prev) =>
      prev.map((x) => (x.id === activeId ? { ...x, text: nextText } : x)),
    );
  };

  const activeTodo =
    activeTodoId === null
      ? null
      : (todosUi as any[]).find((todo) => todo.id === activeTodoId) ?? null;

  function TodoGroup({
    dropId,
    groupName,
    title,
    count,
    priority,
    assigneeIds,
    isActiveDrop,
    children,
  }: {
    dropId: string;
    groupName: string | null;
    title: string;
    count: string;
    priority: ProjectTaskWorkspaceGroupPriority | null;
    assigneeIds: string[];
    isActiveDrop: boolean;
    children: React.ReactNode;
  }) {
    const { setNodeRef } = useDroppable({ id: dropId });
    const [open, setOpen] = useState(true);
    const isEditingGroup =
      groupName !== null && editingTodoGroupName === groupName;

    return (
      <div
        ref={setNodeRef}
        className={`rounded-xl border border-white/[0.08] bg-white/[0.025] transition ${
          isActiveDrop
            ? 'border-[#0a84ff]/40 bg-[#0a84ff]/[0.035] ring-2 ring-[#0a84ff]/15'
            : ''
        }`}
      >
        {isEditingGroup ? (
          <div className="border-b border-white/[0.06] px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={editingTodoGroupValue}
                maxLength={50}
                onChange={(event) =>
                  setEditingTodoGroupValue(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    saveEditTodoGroup();
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelEditTodoGroup();
                  }
                }}
                className={`h-9 min-w-0 flex-1 px-2.5 text-xs ${INPUT_BASE}`}
                placeholder="Nombre del grupo"
              />

              <button
                type="button"
                onClick={saveEditTodoGroup}
                disabled={!editingTodoGroupValue.trim()}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#0a84ff] text-white transition hover:bg-[#409cff] disabled:opacity-35"
                aria-label="Guardar grupo"
              >
                <Check className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={cancelEditTodoGroup}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white/[0.055] text-white/[0.60] transition hover:bg-white/[0.09] hover:text-white/[0.88]"
                aria-label="Cancelar edición"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {TODO_GROUP_PRIORITY_OPTIONS.map((option) => {
                const selected =
                  editingTodoGroupPriority === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setEditingTodoGroupPriority(option.value)
                    }
                    className={`flex h-8 items-center justify-center gap-1.5 rounded-[9px] border px-2 text-[10px] font-medium transition ${
                      selected
                        ? option.selectedClass
                        : 'border-white/[0.07] bg-white/[0.025] text-white/[0.50] hover:bg-white/[0.055] hover:text-white/[0.75]'
                    }`}
                  >
                    <span
                      className={`h-[3px] w-4 rounded-full ${option.lineClass}`}
                    />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 border-t border-white/[0.06] pt-3">
              <div className="mb-2 flex items-center gap-1.5">
                <UsersRound className="h-3.5 w-3.5 text-[#5ac8fa]" />
                <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.48]">
                  Responsables
                </span>
              </div>

              {groupAssigneeOptions.length === 0 ? (
                <p className="rounded-[10px] bg-white/[0.035] px-2.5 py-2 text-[10px] font-normal text-white/[0.42]">
                  Esta tarea todavía no tiene responsables asignados.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {groupAssigneeOptions.map((assignee) => {
                    const selected =
                      editingTodoGroupAssigneeIds.includes(assignee.id);
                    const label =
                      assignee.full_name ?? assignee.email ?? 'Sin nombre';

                    return (
                      <button
                        key={assignee.id}
                        type="button"
                        onClick={() =>
                          toggleAssigneeId(
                            assignee.id,
                            setEditingTodoGroupAssigneeIds,
                          )
                        }
                        className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-normal transition ${
                          selected
                            ? 'border-[#0a84ff]/30 bg-[#0a84ff]/10 text-[#8bc7ff]'
                            : 'border-white/[0.07] bg-white/[0.025] text-white/[0.50] hover:bg-white/[0.055] hover:text-white/[0.76]'
                        }`}
                      >
                        <span
                          className={`grid h-3.5 w-3.5 place-items-center rounded-full border ${
                            selected
                              ? 'border-[#0a84ff] bg-[#0a84ff] text-white'
                              : 'border-white/[0.18] text-transparent'
                          }`}
                        >
                          <Check className="h-2.5 w-2.5" />
                        </span>
                        <span className="truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-3 py-2">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-white/[0.76]">
                    {title}
                  </div>
                  <span
                    className={`h-[3px] w-9 shrink-0 rounded-full ${
                      getTodoGroupPriorityOption(priority)?.lineClass ??
                      'bg-white/[0.18]'
                    }`}
                    title={
                      priority
                        ? `Prioridad ${
                            getTodoGroupPriorityOption(priority)?.label ?? ''
                          }`
                        : 'Sin prioridad'
                    }
                  />
                </div>
                <div className="text-[11px] font-normal text-white/[0.65]">
                  {count}
                </div>
                {assigneeIds.length > 0 ? (
                  <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[9px] font-normal text-white/[0.44]">
                    <UsersRound className="h-3 w-3 shrink-0 text-[#5ac8fa]/80" />
                    <span className="truncate">
                      {(() => {
                        const names = getGroupAssigneeNames(assigneeIds);
                        if (names.length <= 2) return names.join(', ');
                        return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
                      })()}
                    </span>
                  </div>
                ) : null}
              </div>
            </button>

            {groupName && canEditWorkspace && !isLocked ? (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => startEditTodoGroup(groupName)}
                  className="grid h-7 w-7 place-items-center rounded-lg text-white/[0.28] transition hover:bg-white/[0.06] hover:text-white/[0.72]"
                  aria-label={`Editar grupo ${groupName}`}
                  title="Editar grupo"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => requestDeleteTodoGroup(groupName)}
                  className="grid h-7 w-7 place-items-center rounded-lg text-white/[0.28] transition hover:bg-rose-400/10 hover:text-rose-300"
                  aria-label={`Eliminar grupo ${groupName}`}
                  title="Eliminar grupo y mover sus pasos a Sin grupo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/[0.42] transition hover:bg-white/[0.05] hover:text-white/[0.72]"
              aria-label={open ? 'Contraer grupo' : 'Expandir grupo'}
            >
              <motion.span
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ duration: 0.18 }}
              >
                <ChevronDown className="h-4 w-4" />
              </motion.span>
            </button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="space-y-1 px-3 pb-3 pt-1">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  function TodoRow({
    todo,
    canEdit,
    isEditing,
    editingValue,
    onStartEdit,
    onChangeEditingValue,
    onCancelEdit,
    onSaveEdit,
    onToggle,
    onDelete,
  }: {
    todo: any;
    canEdit: boolean;
    isEditing: boolean;
    editingValue: string;
    onStartEdit: () => void;
    onChangeEditingValue: (v: string) => void;
    onCancelEdit: () => void;
    onSaveEdit: () => void;
    onToggle: () => void;
    onDelete: () => void;
  }) {
    const { attributes, listeners, setNodeRef, isDragging } =
      useDraggable({ id: todo.id });

    return (
      <div
        ref={setNodeRef}
        className={`group relative z-10 flex items-center gap-2 rounded-lg bg-white/[0.035] px-2 py-1.5 pr-16 transition hover:bg-white/[0.055] ${
          isDragging ? 'opacity-25' : 'opacity-100'
        }`}
      >
        <button
          type="button"
          disabled={!canEdit}
          {...attributes}
          {...listeners}
          className="mt-0.5 flex h-5 w-5 touch-none items-center justify-center rounded border-white/20 text-white/[0.80] disabled:cursor-not-allowed"
          aria-label="Arrastrar"
        >
          <GripVertical className="h-4 w-4 text-white/[0.65]" />
        </button>

        <button
          type="button"
          disabled={!canEdit}
          onClick={onToggle}
          className="mt-0.5 flex h-5 w-5 items-center justify-center rounded border-white/20 text-white/[0.80] disabled:cursor-not-allowed"
          aria-label="Completar"
        >
          {todo.done ? (
            <CheckSquare className="h-4 w-4 text-emerald-400" />
          ) : (
            <Square className="h-4 w-4 text-white/[0.65]" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {!isEditing ? (
            <p
              className={`whitespace-pre-wrap break-words text-xs text-white/[0.88] ${
                todo.done ? 'line-through text-white/[0.65]' : ''
              }`}
            >
              {todo.label}
            </p>
          ) : (
            <input
              autoFocus
              value={editingValue}
              maxLength={180}
              onChange={(e) => onChangeEditingValue(e.target.value)}
              className={`w-full px-2 py-1 text-xs ${INPUT_BASE}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSaveEdit();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelEdit();
                }
              }}
            />
          )}
        </div>

        {canEdit && !isEditing && (
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={onStartEdit}
              className="rounded-md p-1 text-white/[0.65] hover:bg-white/[0.07] hover:text-white/[0.88]"
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md p-1 text-white/[0.65] hover:bg-white/[0.07] hover:text-rose-300"
              aria-label="Eliminar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {canEdit && isEditing && (
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <button
              type="button"
              onClick={onSaveEdit}
              className="rounded-md p-1 text-white/[0.65] hover:bg-white/[0.07] hover:text-emerald-300"
              aria-label="Guardar"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-md p-1 text-white/[0.65] hover:bg-white/[0.07] hover:text-white/[0.88]"
              aria-label="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // autosave workspace
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceDirty, setWorkspaceDirty] = useState(false);
  const workspaceLoadedRef = useRef(false);

  // último snapshot guardado (local o remoto)
  const lastSavedSnapshotRef = useRef<string | null>(null);

  // ───── SYNC FICHA AL CAMBIAR TAREA ───────────────────
  useEffect(() => {
    setTitle(task.title);
    setSummary(task.summary ?? '');
    setDescription(task.description ?? '');
    setProject(task.project ?? '');
    setProjectId(
      task.project_id
        ? String(task.project_id)
        : String(
            projects.find(
              (item) =>
                item.name.toLowerCase() === (task.project ?? '').toLowerCase(),
            )?.id ?? '',
          ),
    );
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.due_date ? task.due_date.slice(0, 10) : '');
    setSelectedAssignees(task.assignees.map((a) => a.user_id));
    setEditingProject(false);
    setEditingSummary(false);
    setExpandedProject(false);
    setExpandedSummary(false);
  }, [task, projects]);

  // ───── CARGAR WORKSPACE TABLA HIJA ───────────────────
  useEffect(() => {
    let cancelled = false;
    workspaceLoadedRef.current = false;

    const loadWorkspace = async () => {
      try {
        setWorkspaceLoading(true);
        const ws = await fetchTaskWorkspace(task.id);

        if (cancelled) return;

        if (ws) {
          const safeTodos = ws.todos ?? [];
          const safeTodoGroups = ws.todo_groups ?? [];
          const safeLinks = ws.resource_links ?? [];

          setTodos(safeTodos);
          setTodoGroups(safeTodoGroups);
          setResourceLinks(safeLinks);

          lastSavedSnapshotRef.current = buildWorkspaceSnapshot({
            todos: safeTodos,
            todoGroups: safeTodoGroups,
            resourceLinks: safeLinks,
          });
        } else {
          setTodos([]);
          setTodoGroups([]);
          setResourceLinks([]);
          lastSavedSnapshotRef.current = buildWorkspaceSnapshot({
            todos: [],
            todoGroups: [],
            resourceLinks: [],
          });
        }

        setNewTodoText('');
        setNewLinkLabel('');
        setNewLinkUrl('');
        setWorkspaceDirty(false);
      } catch (err) {
        console.error('Error loading workspace', err);
      } finally {
        if (!cancelled) {
          setWorkspaceLoading(false);
          workspaceLoadedRef.current = true;
        }
      }
    };

    loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  // 🔥 REALTIME: escuchar cambios de otros usuarios
  useEffect(() => {
    const channel = supabase
      .channel(`task_workspace_${task.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'project_task_workspace',
          filter: `task_id=eq.${task.id}`,
        },
        (payload) => {
          const ws: any = payload.new;
          if (!ws) return;

          // si el update lo hizo este mismo usuario, ignoramos
          if (currentUserId && ws.updated_by === currentUserId) {
            return;
          }

          console.log(
            '%c[REALTIME] Workspace actualizado por otro usuario',
            'color:#4ade80',
          );

          const safeTodos = ws.todos ?? [];
          const safeTodoGroups = ws.todo_groups ?? [];
          const safeLinks = ws.resource_links ?? [];

          setTodos(safeTodos);
          setTodoGroups(safeTodoGroups);
          setResourceLinks(safeLinks);

          lastSavedSnapshotRef.current = buildWorkspaceSnapshot({
            todos: safeTodos,
            todoGroups: safeTodoGroups,
            resourceLinks: safeLinks,
          });

          setWorkspaceDirty(false);
          setWorkspaceSaving(false);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [task.id, currentUserId]);

  // cerrar dropdowns con ESC
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStatusMenuOpen(false);
        setPriorityMenuOpen(false);
        setAssigneesMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const isLocked = !!task.is_locked;
  const currentStatusOpt =
    STATUS_OPTIONS.find((opt) => opt.value === status) ?? STATUS_OPTIONS[0];
  const currentPriorityOpt =
    PRIORITY_OPTIONS.find((opt) => opt.value === priority) ??
    PRIORITY_OPTIONS[0];

  const isAssignee = useMemo(
    () => !!currentUserId && selectedAssignees.includes(currentUserId),
    [currentUserId, selectedAssignees],
  );

  const canEditWorkspace = !isLocked && (canManage || isAssignee);
  const todayIso = localTodayIso();

  const toggleAssignee = (id: string) => {
    if (isLocked || !canManage) return;
    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const filteredSupervisors = useMemo(() => {
    const q = assigneeSearch.toLowerCase().trim();
    if (!q) return supervisors;
    return supervisors.filter((s) => {
      const haystack = `${s.full_name ?? ''} ${s.email ?? ''}`
        .toLowerCase()
        .trim();
      return haystack.includes(q);
    });
  }, [supervisors, assigneeSearch]);

  const selectedSupervisorNames = useMemo(
    () =>
      supervisors
        .filter((s) => selectedAssignees.includes(s.id))
        .map((s) => s.full_name ?? s.email ?? 'Sin nombre'),
    [supervisors, selectedAssignees],
  );

  useEffect(() => {
    setSheetSaveState('idle');
    if (typeof window === 'undefined') return;

    const storageKey = `project-task-drawer-view:${currentUserId ?? 'anon'}:${task.id}`;
    const saved = window.localStorage.getItem(storageKey);

    if (saved === 'sheet' || saved === 'workspace') {
      setWorkspaceViewMode(saved);
    } else {
      setWorkspaceViewMode('workspace');
    }
  }, [currentUserId, task.id]);

  const changeWorkspaceViewMode = (next: 'workspace' | 'sheet') => {
    setWorkspaceViewMode(next);

    if (typeof window !== 'undefined') {
      const storageKey = `project-task-drawer-view:${currentUserId ?? 'anon'}:${task.id}`;
      window.localStorage.setItem(storageKey, next);
    }
  };

  // ───── GUARDAR FICHA PRINCIPAL (botón) ───────────────
  const save = async () => {
    if (task.is_locked) return;

    const cleanTitle = title.trim();
    const cleanSummary = summary.trim();
    const cleanDescription = description.trim();
    const originalDueDate = task.due_date ? task.due_date.slice(0, 10) : '';

    if (!cleanTitle) {
      notify.error('El nombre de la tarea es obligatorio.');
      return;
    }

    if (cleanTitle.length > 160) {
      notify.error('El nombre de la tarea no puede superar los 160 caracteres.');
      return;
    }

    if (cleanSummary.length > 300) {
      notify.error('El resumen no puede superar los 300 caracteres.');
      return;
    }

    if (cleanDescription.length > 5000) {
      notify.error('La descripción no puede superar los 5000 caracteres.');
      return;
    }

    if (
      dueDate &&
      dueDate !== originalDueDate &&
      isPastIsoDate(dueDate, todayIso)
    ) {
      notify.error('La fecha límite no puede ser anterior a hoy.');
      return;
    }

    const selectedProject =
      projects.find((item) => String(item.id) === projectId) ??
      projects.find(
        (item) => item.name.toLowerCase() === project.toLowerCase(),
      );

    if (!selectedProject) {
      notify.error('Seleccioná un proyecto válido.');
      return;
    }

    setLoading(true);
    try {
      const updatedRow = await updateProjectTask(task.id, {
        title: cleanTitle,
        summary: cleanSummary || null,
        description: cleanDescription || null,
        project: selectedProject.name,
        project_id: selectedProject.id,
        status,
        priority,
        due_date: dueDate || null,
      });

      let finalAssignees = task.assignees;
      if (canManage && !isLocked) {
        await setTaskAssignees(task.id, selectedAssignees);

        const mapById = new Map(supervisors.map((s) => [s.id, s]));
        finalAssignees = selectedAssignees.map((id) => {
          const sup = mapById.get(id);
          return {
            user_id: id,
            full_name: sup?.full_name ?? null,
            email: sup?.email ?? null,
            role: 'supervisor' as const,
          };
        });
      }

      const enriched: ProjectTaskWithAssignees = {
        ...updatedRow,
        assignees: finalAssignees,
      };

      onUpdated(enriched);
      notify.success('Cambios guardados.');
      onClose();
    } catch (err) {
      console.error('Error saving task', err);
      notify.error(errorMessage(err, 'No se pudieron guardar los cambios.'));
    } finally {
      setLoading(false);
    }
  };

  // ───── AUTOSAVE WORKSPACE ────────────────────────────
  useEffect(() => {
    if (!workspaceLoadedRef.current) return;
    if (!canEditWorkspace) return;
    if (task.is_locked) return;

    const currentSnapshot = buildWorkspaceSnapshot({
      todos,
      todoGroups,
      resourceLinks,
    });

    // si no hay cambios respecto a lo último guardado, no hacemos nada
    if (lastSavedSnapshotRef.current === currentSnapshot) {
      return;
    }

    setWorkspaceDirty(true);

    const handle = setTimeout(async () => {
      try {
        setWorkspaceSaving(true);
        await upsertTaskWorkspace({
          taskId: task.id,
          todos,
          todoGroups,
          resourceLinks,
          updatedBy: currentUserId,
        });

        lastSavedSnapshotRef.current = currentSnapshot;
        setWorkspaceDirty(false);
      } catch (err) {
        console.error('Error autosaving workspace', err);
        // si falla, dejamos dirty en true
      } finally {
        setWorkspaceSaving(false);
      }
    }, 1200); // debounce 1.2s

    return () => clearTimeout(handle);
  }, [
    todos,
    todoGroups,
    resourceLinks,
    canEditWorkspace,
    task.id,
    currentUserId,
    task.is_locked,
  ]);

  // ───── HELPERS WORKSPACE ─────────────────────────────
  const addTodo = () => {
    const label = newTodoText.trim();

    if (!label) {
      notify.error('Escribí un paso antes de añadirlo.');
      return;
    }

    if (label.length > 180) {
      notify.error('Cada paso puede tener hasta 180 caracteres.');
      return;
    }

    const text = encodeTodo(todoGroupSelected, label);

    setTodos((prev) => [
      ...prev,
      { id: makeId(), text, done: false },
    ]);

    setNewTodoText('');
    // foco para flujo escribir → Enter → escribir
    requestAnimationFrame(() => newTodoInputRef.current?.focus());
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  };

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const addLink = () => {
    const rawUrl = newLinkUrl.trim();
    const cleanLabel = newLinkLabel.trim();

    if (!rawUrl) {
      notify.error('Ingresá una URL para guardar el recurso.');
      return;
    }

    if (rawUrl.length > 2048) {
      notify.error('La URL es demasiado larga.');
      return;
    }

    if (cleanLabel.length > 120) {
      notify.error('El nombre del recurso no puede superar los 120 caracteres.');
      return;
    }

    const normalized = normalizeUrl(rawUrl);

    try {
      const parsed = new URL(normalized);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('invalid protocol');
      }
    } catch {
      notify.error('Ingresá una URL válida.');
      return;
    }

    if (
      resourceLinks.some(
        (link) => link.url.toLowerCase() === normalized.toLowerCase(),
      )
    ) {
      notify.error('Ese recurso ya está agregado.');
      return;
    }

    setResourceLinks((prev) => [
      ...prev,
      {
        id: makeId(),
        label: cleanLabel || rawUrl,
        url: normalized,
      },
    ]);
    setNewLinkLabel('');
    setNewLinkUrl('');
  };

  const deleteLink = (id: string) => {
    setResourceLinks((prev) => prev.filter((l) => l.id !== id));
  };

  // ───── UI ────────────────────────────────────────────
  const drawerSaveState: ProjectTaskSheetSaveState | 'loading' =
    workspaceViewMode === 'sheet'
      ? sheetSaveState === 'idle'
        ? 'loading'
        : sheetSaveState
      : workspaceLoading
        ? 'loading'
        : workspaceSaving
          ? 'saving'
          : workspaceDirty
            ? 'dirty'
            : 'saved';

  const drawerSaveLabel =
    drawerSaveState === 'loading'
      ? 'Cargando...'
      : drawerSaveState === 'saving'
        ? 'Guardando cambios...'
        : drawerSaveState === 'dirty'
          ? 'Cambios sin guardar'
          : drawerSaveState === 'error'
            ? 'Error al guardar'
            : 'Guardado';

  const drawerSaveClass =
    drawerSaveState === 'error'
      ? 'text-rose-300'
      : drawerSaveState === 'dirty'
        ? 'text-amber-300'
        : drawerSaveState === 'saving' || drawerSaveState === 'loading'
          ? 'text-[#5ac8fa]'
          : 'text-emerald-300';

  return (
    <AnimatePresence>
      {/* overlay */}
      <motion.div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* drawer */}
      <motion.div
        className="fixed left-0 top-0 z-50 flex h-full w-full max-w-7xl flex-col border-r border-white/[0.08] bg-[#151517] text-[#f5f5f7] shadow-[28px_0_80px_rgba(0,0,0,.32)]"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#171719] px-6 py-3.5">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/[0.65]">
              Proyecto
            </span>
            <span className="text-xs font-normal text-white/[0.72]">
              Gestión detallada de la tarea y espacio de trabajo.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isLocked && (
              <span
                className={`${BADGE_BASE} bg-amber-900/60 text-amber-100`}
              >
                Tarea cerrada
              </span>
            )}

            {!canEditWorkspace && !isLocked && (
              <span className={`${BADGE_BASE} bg-white/[0.06] text-white/[0.78]`}>
                Solo lectura
              </span>
            )}

            {canEditWorkspace && !isLocked && (
              <div
                className={`inline-flex min-w-[104px] items-center justify-end gap-1.5 text-[10px] font-normal ${drawerSaveClass}`}
                aria-live="polite"
                aria-label={drawerSaveLabel}
              >
                {drawerSaveState === 'saving' ||
                drawerSaveState === 'loading' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>{drawerSaveLabel}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                changeWorkspaceViewMode(
                  workspaceViewMode === 'sheet' ? 'workspace' : 'sheet',
                )
              }
              className={`inline-flex h-9 items-center gap-2 rounded-[11px] border px-3 text-[10px] font-medium transition ${
                workspaceViewMode === 'sheet'
                  ? 'border-[#0a84ff]/30 bg-[#0a84ff]/10 text-[#5ac8fa]'
                  : 'border-white/[0.08] bg-white/[0.035] text-white/[0.68] hover:bg-white/[0.06] hover:text-white/[0.90]'
              }`}
              aria-pressed={workspaceViewMode === 'sheet'}
            >
              {workspaceViewMode === 'sheet' ? (
                <Columns3 className="h-3.5 w-3.5" />
              ) : (
                <Table2 className="h-3.5 w-3.5" />
              )}
              {workspaceViewMode === 'sheet' ? 'Vista normal' : 'Modo tabla'}
            </button>

            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-white/[0.65] transition hover:bg-white/[0.06] hover:text-white/[0.88]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* contenido 3 columnas */}
        <div className="flex flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,1.1fr)]">
          {/* Columna 1: ficha del proyecto */}
          <div className="flex h-full min-h-0 flex-col border-b border-white/[0.07] bg-[#151517] px-6 py-5 lg:border-b-0 lg:border-r">
            {/* Título */}
            <textarea
              rows={2}
              className="mb-4 w-full max-h-24 resize-none overflow-y-auto rounded-xl border border-transparent bg-transparent px-0 text-xl font-medium tracking-[-0.025em] text-white/[0.94] outline-none placeholder:text-white/[0.46] focus:border-white/[0.08] focus:bg-white/[0.025] disabled:cursor-not-allowed disabled:opacity-50"
              value={title}
              maxLength={160}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre de la tarea"
              disabled={isLocked}
            />

            {/* propiedades */}
            <div className="space-y-3 border-b border-white/[0.07] pb-4 text-xs">
              {/* Responsable */}
              <div className="flex items-start gap-3">
                <span className="mt-[3px] w-24 text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.65]">
                  Responsable
                </span>

                <div className="relative flex-1">
                  <button
                    type="button"
                    disabled={isLocked || !canManage}
                    onClick={() => {
                      if (isLocked || !canManage) return;
                      setAssigneesMenuOpen((o) => !o);
                    }}
                    className={`flex w-full items-start px-3 py-1.5 text-left text-[11px] text-white/[0.88] ${INPUT_BASE}`}
                  >
                    <span className="flex-1 whitespace-normal break-words">
                      {selectedSupervisorNames.length === 0
                        ? 'Seleccionar responsables...'
                        : selectedSupervisorNames.join(', ')}
                    </span>
                  </button>

                  <AnimatePresence>
                    {assigneesMenuOpen && !isLocked && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.16 }}
                        className="absolute z-20 mt-2 w-full overflow-hidden rounded-[16px] border border-white/[0.09] bg-[#1c1c1e] text-[11px] text-white/[0.88] shadow-[0_24px_70px_rgba(0,0,0,.40)]"
                      >
                        <div className="border-b border-white/[0.07] p-1.5">
                          <input
                            autoFocus
                            value={assigneeSearch}
                            onChange={(e) => setAssigneeSearch(e.target.value)}
                            placeholder="Buscar supervisor..."
                            className={`w-full px-2 py-1 ${INPUT_BASE}`}
                          />
                        </div>

                        <div className="max-h-60 overflow-y-auto">
                          {filteredSupervisors.length === 0 && (
                            <p className="px-3 py-2 text-white/[0.65]">
                              Sin resultados.
                            </p>
                          )}

                          {filteredSupervisors.map((sup) => {
                            const selected =
                              selectedAssignees.includes(sup.id);
                            return (
                              <button
                                key={sup.id}
                                type="button"
                                onClick={() => toggleAssignee(sup.id)}
                                className={`flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-white/[0.055] ${
                                  selected ? 'bg-white/[0.055]' : ''
                                }`}
                              >
                                <span className="flex-1 whitespace-normal break-words">
                                  {sup.full_name ?? sup.email ?? 'Sin nombre'}
                                </span>
                                {selected && (
                                  <CheckSquare className="h-3.5 w-3.5 text-emerald-400" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Estado */}
              <div className="flex items-center gap-3">
                <span className="w-24 text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.65]">
                  Estado
                </span>
                <div
                  className="relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isLocked) return;
                      setStatusMenuOpen((o) => !o);
                    }}
                    disabled={isLocked}
                    className={`flex items-center gap-2 rounded-full px-3 py-1 text-[11px] ${currentStatusOpt.pillClass} ${
                      isLocked ? 'cursor-not-allowed opacity-70' : ''
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${currentStatusOpt.dotClass}`}
                    />
                    {currentStatusOpt.label}
                  </button>

                  <AnimatePresence>
                    {statusMenuOpen && !isLocked && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.16 }}
                        className="absolute z-20 mt-1 min-w-[170px] rounded-[14px] border border-white/[0.09] bg-[#1c1c1e] p-1.5 text-[11px] text-white/[0.84] shadow-[0_20px_60px_rgba(0,0,0,.38)]"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setStatus(opt.value);
                              setStatusMenuOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left ${
                              opt.value === status
                                ? opt.pillClass
                                : 'text-white/[0.78] hover:bg-white/[0.055]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={`h-2 w-2 rounded-full ${opt.dotClass}`}
                              />
                              {opt.label}
                            </span>
                            {opt.value === status && (
                              <span className="text-[10px] text-[#5ac8fa]">
                                Actual
                              </span>
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Prioridad */}
              <div className="flex items-center gap-3">
                <span className="w-24 text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.65]">
                  Prioridad
                </span>
                <div
                  className="relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isLocked) return;
                      setPriorityMenuOpen((o) => !o);
                    }}
                    disabled={isLocked}
                    className={`flex items-center gap-2 rounded-full px-3 py-1 text-[11px] ${currentPriorityOpt.pillClass} ${
                      isLocked ? 'cursor-not-allowed opacity-70' : ''
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${currentPriorityOpt.dotClass}`}
                    />
                    {currentPriorityOpt.label}
                  </button>

                  <AnimatePresence>
                    {priorityMenuOpen && !isLocked && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.16 }}
                        className="absolute z-20 mt-1 min-w-[150px] rounded-[14px] border border-white/[0.09] bg-[#1c1c1e] p-1.5 text-[11px] text-white/[0.84] shadow-[0_20px_60px_rgba(0,0,0,.38)]"
                      >
                        {PRIORITY_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setPriority(opt.value);
                              setPriorityMenuOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left ${
                              opt.value === priority
                                ? opt.pillClass
                                : 'text-white/[0.78] hover:bg-white/[0.055]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={`h-2 w-2 rounded-full ${opt.dotClass}`}
                              />
                              {opt.label}
                            </span>
                            {opt.value === priority && (
                              <span className="text-[10px] text-[#5ac8fa]">
                                Actual
                              </span>
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Fecha límite */}
              <div className="flex items-center gap-3">
                <span className="w-24 text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.65]">
                  Fecha límite
                </span>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-white/[0.65]" />
                  <RedcomDatePicker
                    value={dueDate}
                    onChange={setDueDate}
                    minDate={todayIso}
                    placeholder="Sin fecha"
                    accent="indigo"
                    surface="dark"
                    disabled={isLocked}
                    className="h-9 min-w-[190px] rounded-[12px]"
                    aria-label="Fecha límite"
                  />
                </div>
              </div>

              {/* Proyecto */}
              <div className="flex items-start gap-3">
                <span className="mt-[3px] w-24 text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.65]">
                  Proyecto
                </span>
                {editingProject && !isLocked ? (
                  <div className="flex flex-1 items-center gap-2">
                    <RedcomSelect
                      value={projectId}
                      surface="dark"
                      accent="indigo"
                      className="h-9 flex-1 rounded-[12px]"
                      onValueChange={(value) => {
                        setProjectId(value);
                        const selected = projects.find(
                          (item) => String(item.id) === value,
                        );
                        if (selected) setProject(selected.name);
                      }}
                      options={projects
                        .filter((item) => item.status !== 'archived')
                        .map((item) => ({
                          value: String(item.id),
                          label: item.name,
                        }))}
                      placeholder="Seleccionar proyecto"
                      aria-label="Proyecto de la tarea"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingProject(false)}
                      className={BUTTON_TINY_GRAY}
                    >
                      Listo
                    </button>
                  </div>
                ) : (
                  <div className="group relative flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] font-normal text-white/[0.88]">
                    <p
                      className={
                        project
                          ? expandedProject || !needsReadMore(project)
                            ? 'whitespace-pre-wrap'
                            : 'line-clamp-1'
                          : 'text-white/[0.50]'
                      }
                    >
                      {project || 'Nombre del proyecto'}
                    </p>
                    {project && needsReadMore(project) && (
                      <button
                        type="button"
                        onClick={() => setExpandedProject((v) => !v)}
                        className="mt-1 text-[10px] font-normal text-[#5ac8fa] hover:underline"
                      >
                        {expandedProject ? 'Ver menos' : 'Ver más'}
                      </button>
                    )}
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => setEditingProject(true)}
                        className="absolute right-2 top-1.5 hidden rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/[0.80] group-hover:inline-flex"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Resumen */}
              <div className="flex items-start gap-3">
                <span className="mt-[3px] w-24 text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.65]">
                  Resumen
                </span>
                {editingSummary && !isLocked ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      className={`flex-1 px-3 py-1.5 ${INPUT_BASE}`}
                      placeholder="Breve descripción de la tarea..."
                      value={summary}
                      maxLength={300}
                      onChange={(e) => setSummary(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setEditingSummary(false)}
                      className={BUTTON_TINY_GRAY}
                    >
                      Listo
                    </button>
                  </div>
                ) : (
                  <div className="group relative flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] font-normal text-white/[0.88]">
                    <p
                      className={
                        summary
                          ? expandedSummary || !needsReadMore(summary)
                            ? 'whitespace-pre-wrap'
                            : 'line-clamp-1'
                          : 'text-white/[0.50]'
                      }
                    >
                      {summary || 'Breve descripción de la tarea...'}
                    </p>
                    {summary && needsReadMore(summary) && (
                      <button
                        type="button"
                        onClick={() => setExpandedSummary((v) => !v)}
                        className="mt-1 text-[10px] font-normal text-[#5ac8fa] hover:underline"
                      >
                        {expandedSummary ? 'Ver menos' : 'Ver más'}
                      </button>
                    )}
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => setEditingSummary(true)}
                        className="absolute right-2 top-1.5 hidden rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/[0.80] group-hover:inline-flex"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Descripción */}
            <div className="mt-4 flex-1 overflow-hidden">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.65]">
                Descripción general
              </p>
              <textarea
                className="h-full w-full min-h-[120px] rounded-[14px] border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-sm font-normal text-white/[0.88] outline-none placeholder:text-white/[0.46] transition focus:border-[#0a84ff]/50 focus:bg-white/[0.05] focus:ring-4 focus:ring-[#0a84ff]/10 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Contexto, objetivos, entregables, decisiones clave..."
                value={description}
                maxLength={5000}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLocked}
              />
            </div>

            {/* footer izquierda */}
            <div className="mt-4 flex justify-end border-t border-white/[0.07] pt-3">
              <button
                onClick={save}
                disabled={loading || isLocked}
                className={`rounded-[12px] px-4 py-2 text-sm font-medium transition ${
                  isLocked
                    ? 'cursor-not-allowed bg-white/[0.06] text-white/[0.58]'
                    : 'bg-[#0a84ff] text-white hover:bg-[#409cff]'
                } disabled:opacity-60`}
              >
                {isLocked
                  ? 'Tarea cerrada'
                  : loading
                  ? 'Guardando...'
                  : 'Guardar cambios'}
              </button>
            </div>
          </div>

          {workspaceViewMode === 'workspace' ? (
            <>
          {/* Columna 2: checklist */}
          <div className="flex h-full min-h-0 flex-col gap-3 border-b border-white/[0.07] bg-[#17181b] px-6 py-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-emerald-300" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.75]">
                    Checklist de avance
                  </span>
                  <span className="text-[11px] font-normal text-white/[0.65]">
                    Dividí el proyecto en pasos accionables.
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-normal text-white/[0.65]">
                {todos.length === 0
                  ? 'Sin tareas internas'
                  : `${todos.filter((t) => t.done).length} / ${
                      todos.length
                    } completadas`}
              </span>
            </div>

            {/* Composer de checklist */}
            <div className="border-b border-white/[0.07] pb-3">
              <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.025] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.72]">
                      Nuevo paso
                    </div>
                    <div className="mt-0.5 text-[10px] font-normal text-white/[0.38]">
                      Escribí la tarea y elegí dónde organizarla.
                    </div>
                  </div>

                  {canEditWorkspace && !isLocked ? (
                    <button
                      type="button"
                      onClick={() => {
                        setTodoGroupMenuOpen(false);
                        setNewTodoGroupPanelOpen((open) => !open);
                      }}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] bg-white/[0.055] px-2.5 text-[10px] font-medium text-white/[0.62] transition hover:bg-white/[0.085] hover:text-white/[0.88]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nuevo grupo
                    </button>
                  ) : null}
                </div>

                <AnimatePresence initial={false}>
                  {newTodoGroupPanelOpen && canEditWorkspace && !isLocked ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0, y: -4 }}
                      animate={{ height: 'auto', opacity: 1, y: 0 }}
                      exit={{ height: 0, opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 rounded-[13px] border border-white/[0.07] bg-black/[0.10] p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.58]">
                            Crear grupo
                          </span>
                          <button
                            type="button"
                            onClick={() => setNewTodoGroupPanelOpen(false)}
                            className="grid h-6 w-6 place-items-center rounded-lg text-white/[0.30] transition hover:bg-white/[0.06] hover:text-white/[0.70]"
                            aria-label="Cerrar creador de grupo"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <input
                          value={newTodoGroupName}
                          maxLength={50}
                          onChange={(event) =>
                            setNewTodoGroupName(event.target.value)
                          }
                          placeholder="Nombre del grupo, ej: Horarios"
                          className={`h-9 w-full px-2.5 text-xs ${INPUT_BASE}`}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              createTodoGroupFromDraft();
                            }
                          }}
                        />

                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          {TODO_GROUP_PRIORITY_OPTIONS.map((option) => {
                            const selected =
                              newTodoGroupPriority === option.value;

                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                  setNewTodoGroupPriority(option.value)
                                }
                                className={`flex h-8 items-center justify-center gap-1.5 rounded-[9px] border px-2 text-[10px] font-medium transition ${
                                  selected
                                    ? option.selectedClass
                                    : 'border-white/[0.07] bg-white/[0.025] text-white/[0.50] hover:bg-white/[0.055] hover:text-white/[0.75]'
                                }`}
                              >
                                <span
                                  className={`h-[3px] w-4 rounded-full ${option.lineClass}`}
                                />
                                {option.label}
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-3 border-t border-white/[0.06] pt-3">
                          <div className="mb-2 flex items-center gap-1.5">
                            <UsersRound className="h-3.5 w-3.5 text-[#5ac8fa]" />
                            <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.48]">
                              Responsables
                            </span>
                          </div>

                          {groupAssigneeOptions.length === 0 ? (
                            <p className="rounded-[10px] bg-white/[0.035] px-2.5 py-2 text-[10px] font-normal text-white/[0.42]">
                              Primero asigná responsables a la tarea.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {groupAssigneeOptions.map((assignee) => {
                                const selected =
                                  newTodoGroupAssigneeIds.includes(assignee.id);
                                const label =
                                  assignee.full_name ??
                                  assignee.email ??
                                  'Sin nombre';

                                return (
                                  <button
                                    key={assignee.id}
                                    type="button"
                                    onClick={() =>
                                      toggleAssigneeId(
                                        assignee.id,
                                        setNewTodoGroupAssigneeIds,
                                      )
                                    }
                                    className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-normal transition ${
                                      selected
                                        ? 'border-[#0a84ff]/30 bg-[#0a84ff]/10 text-[#8bc7ff]'
                                        : 'border-white/[0.07] bg-white/[0.025] text-white/[0.50] hover:bg-white/[0.055] hover:text-white/[0.76]'
                                    }`}
                                  >
                                    <span
                                      className={`grid h-3.5 w-3.5 place-items-center rounded-full border ${
                                        selected
                                          ? 'border-[#0a84ff] bg-[#0a84ff] text-white'
                                          : 'border-white/[0.18] text-transparent'
                                      }`}
                                    >
                                      <Check className="h-2.5 w-2.5" />
                                    </span>
                                    <span className="truncate">{label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={createTodoGroupFromDraft}
                          disabled={!newTodoGroupName.trim()}
                          className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-white/[0.07] px-3 text-[10px] font-medium text-white/[0.80] transition hover:bg-white/[0.10] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Crear grupo
                        </button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="mt-3">
                  <input
                    ref={newTodoInputRef}
                    value={newTodoText}
                    maxLength={180}
                    onChange={(event) => setNewTodoText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && canEditWorkspace) {
                        event.preventDefault();
                        addTodo();
                      }
                    }}
                    disabled={!canEditWorkspace}
                    placeholder={
                      canEditWorkspace
                        ? '¿Qué hay que hacer?'
                        : 'Solo lectura'
                    }
                    className={`h-10 w-full px-3 text-xs ${INPUT_BASE}`}
                  />

                  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <div className="relative" ref={todoGroupPickerRef}>
                      <button
                        type="button"
                        disabled={!canEditWorkspace}
                        onClick={() => {
                          if (!canEditWorkspace) return;
                          setNewTodoGroupPanelOpen(false);
                          setTodoGroupMenuOpen((open) => !open);
                        }}
                        className={`flex h-9 w-full items-center justify-between rounded-[11px] px-3 text-left text-[10px] ${INPUT_BASE}`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="text-white/[0.38]">Grupo</span>
                          <span className="truncate text-white/[0.78]">
                            {todoGroupSelected ?? 'Sin grupo'}
                          </span>
                          <span
                            className={`h-[3px] w-7 shrink-0 rounded-full ${
                              getTodoGroupPriorityOption(
                                getTodoGroup(todoGroupSelected)?.priority ?? null,
                              )?.lineClass ?? 'bg-white/[0.18]'
                            }`}
                          />
                        </span>

                        <motion.span
                          animate={{ rotate: todoGroupMenuOpen ? 180 : 0 }}
                          transition={{ duration: 0.16 }}
                        >
                          <ChevronDown className="h-3.5 w-3.5 text-white/[0.45]" />
                        </motion.span>
                      </button>

                      <AnimatePresence>
                        {todoGroupMenuOpen &&
                        canEditWorkspace &&
                        !isLocked ? (
                          <motion.div
                            initial={{ opacity: 0, y: -5, scale: 0.985 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -5, scale: 0.985 }}
                            transition={{ duration: 0.15 }}
                            className="absolute z-30 mt-2 w-full overflow-hidden rounded-[14px] border border-white/[0.09] bg-[#1c1c1e] p-1.5 shadow-[0_20px_60px_rgba(0,0,0,.38)]"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setTodoGroupSelected(null);
                                setTodoGroupMenuOpen(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-[9px] px-2.5 py-2 text-left text-[10px] transition hover:bg-white/[0.055] ${
                                todoGroupSelected === null
                                  ? 'bg-white/[0.06] text-white/[0.88]'
                                  : 'text-white/[0.58]'
                              }`}
                            >
                              <span>Sin grupo</span>
                              <span className="h-[3px] w-7 rounded-full bg-white/[0.18]" />
                            </button>

                            {todoGroups.map((group) => (
                              <button
                                key={group.name}
                                type="button"
                                onClick={() => {
                                  setTodoGroupSelected(group.name);
                                  setTodoGroupMenuOpen(false);
                                }}
                                className={`flex w-full items-center justify-between gap-3 rounded-[9px] px-2.5 py-2 text-left text-[10px] transition hover:bg-white/[0.055] ${
                                  todoGroupSelected === group.name
                                    ? 'bg-white/[0.06] text-white/[0.88]'
                                    : 'text-white/[0.58]'
                                }`}
                              >
                                <span className="truncate">{group.name}</span>
                                <span
                                  className={`h-[3px] w-7 shrink-0 rounded-full ${
                                    getTodoGroupPriorityOption(group.priority)
                                      ?.lineClass
                                  }`}
                                />
                              </button>
                            ))}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>

                    <button
                      type="button"
                      onClick={addTodo}
                      disabled={!canEditWorkspace || !newTodoText.trim()}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[11px] bg-[#0a84ff] px-3.5 text-[10px] font-medium text-white transition hover:bg-[#409cff] disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/[0.40]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Añadir paso
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* lista todos agrupada + DnD */}
            <div className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
              <DndContext
                sensors={todoDndSensors}
                onDragStart={(event) =>
                  setActiveTodoId(String(event.active.id))
                }
                onDragCancel={() => {
                  setActiveTodoId(null);
                  setActiveTodoDropId('');
                }}
                onDragEnd={handleTodoDragEnd}
                onDragOver={(event) =>
                  setActiveTodoDropId(String(event.over?.id ?? ''))
                }
              >
                {todoGroupKeys.map((key) => {
                  const groupName = key === TODO_NO_GROUP_KEY ? null : key;
                  const arr = todosByGroup.get(key) ?? [];
                  const done = arr.filter((t) => t.done).length;
                  const total = arr.length;

                  const dropId = `drop:${key}`;
                  const isActiveDrop = activeTodoDropId === dropId;

                  return (
                    <TodoGroup
                      key={key}
                      dropId={dropId}
                      groupName={groupName}
                      title={groupName ?? 'Sin grupo'}
                      count={`${done}/${total}`}
                      priority={getTodoGroup(groupName)?.priority ?? null}
                      assigneeIds={
                        getTodoGroup(groupName)?.assignee_ids ?? []
                      }
                      isActiveDrop={isActiveDrop}
                    >
                      {arr.map((t) => (
                        <TodoRow
                          key={t.id}
                          todo={t}
                          canEdit={canEditWorkspace}
                          isEditing={editingTodoId === t.id}
                          editingValue={editingTodoValue}
                          onStartEdit={() => startEditTodo(t)}
                          onChangeEditingValue={setEditingTodoValue}
                          onCancelEdit={cancelEditTodo}
                          onSaveEdit={() => saveEditTodo(t)}
                          onToggle={() => canEditWorkspace && toggleTodo(t.id)}
                          onDelete={() => canEditWorkspace && deleteTodo(t.id)}
                        />
                      ))}

                      {arr.length === 0 && groupName && (
                        <p className="rounded-lg bg-white/[0.045] px-3 py-2 text-[11px] font-normal text-white/[0.65]">
                          Arrastrá items acá para agruparlos.
                        </p>
                      )}
                    </TodoGroup>
                  );
                })}

                <DragOverlay
                  dropAnimation={{ duration: 160, easing: 'ease-out' }}
                >
                  {activeTodo ? (
                    <div className="w-[280px] rotate-[1deg]">
                      <div className="flex items-center gap-2 rounded-[12px] border border-[#0a84ff]/40 bg-[#242426] px-2.5 py-2 shadow-[0_18px_50px_rgba(0,0,0,.35)]">
                        <div className="grid h-5 w-5 place-items-center text-white/[0.52]">
                          <GripVertical className="h-4 w-4" />
                        </div>

                        <div className="grid h-5 w-5 place-items-center text-white/[0.65]">
                          {activeTodo.done ? (
                            <CheckSquare className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </div>

                        <span
                          className={`min-w-0 flex-1 truncate text-xs font-normal ${
                            activeTodo.done
                              ? 'text-white/[0.48] line-through'
                              : 'text-white/[0.90]'
                          }`}
                        >
                          {activeTodo.label}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>

              {todos.length === 0 && (
                <p className="rounded-lg bg-white/[0.055] px-3 py-2 text-[11px] font-normal text-white/[0.65]">
                  Usá este checklist para definir pasos como “Relevar
                  requerimientos”, “Diseñar UI”, “Implementar API”, etc.
                </p>
              )}
            </div>
          </div>

{/* Columna 3: Notas + recursos / actividad */}
          <div className="flex h-full min-h-0 flex-col bg-[#17181b] px-6 py-5">
            <div className="mb-4 flex items-center rounded-[11px] border border-white/[0.07] bg-white/[0.025] p-1">
              <button
                type="button"
                onClick={() => setRightPanel('notes')}
                className={`h-8 flex-1 rounded-[8px] px-3 text-[10px] font-medium transition ${
                  rightPanel === 'notes'
                    ? 'bg-white/[0.09] text-white/[0.90]'
                    : 'text-white/[0.46] hover:text-white/[0.70]'
                }`}
              >
                Comentarios y recursos
              </button>
              <button
                type="button"
                onClick={() => setRightPanel('activity')}
                className={`h-8 flex-1 rounded-[8px] px-3 text-[10px] font-medium transition ${
                  rightPanel === 'activity'
                    ? 'bg-white/[0.09] text-white/[0.90]'
                    : 'text-white/[0.46] hover:text-white/[0.70]'
                }`}
              >
                Actividad
              </button>
            </div>

            {rightPanel === 'notes' ? (
              <div className="flex min-h-0 flex-1 flex-col gap-5">
            {/* Comentarios */}
            <div className={PANEL_BASE}>
              <ProjectTaskActivityPanel
                taskId={task.id}
                currentUserId={currentUserId}
                canComment={canEditWorkspace}
                locked={isLocked}
                mode="comments"
              />
            </div>

            {/* Recursos */}
            <div className={PANEL_BASE}>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-4 w-4 text-[#5ac8fa]" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.75]">
                    Recursos del proyecto
                  </span>
                </div>
              </div>

              <div className="flex-1 min-h-0 space-y-1 overflow-y-auto pr-1">
                {resourceLinks.length === 0 && (
                  <p className="text-[11px] font-normal text-white/[0.65]">
                    Guardá acá links a Figma, Looker, documentación, Sheets,
                    etc.
                  </p>
                )}
                {resourceLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between rounded-xl bg-white/[0.045] px-2.5 py-2 text-[11px]"
                  >
                    <a
                      href={normalizeUrl(link.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate text-[#5ac8fa] hover:underline"
                    >
                      {link.label}
                    </a>
                    {canEditWorkspace && (
                      <button
                        type="button"
                        onClick={() => deleteLink(link.id)}
                        className="ml-2 text-[10px] text-white/[0.65] hover:text-rose-300"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {canEditWorkspace && (
                <div className="mt-2 border-t border-white/[0.07] pt-2">
                  <div className="mb-1 flex flex-col gap-1">
                    <input
                      value={newLinkLabel}
                      maxLength={120}
                      onChange={(e) => setNewLinkLabel(e.target.value)}
                      placeholder="Nombre del recurso (opcional)"
                      className={`w-full px-2 py-1 ${INPUT_BASE}`}
                    />
                    <input
                      value={newLinkUrl}
                      maxLength={2048}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addLink();
                        }
                      }}
                      placeholder="URL (Figma, Looker, Docs, etc.)"
                      className={`w-full px-2 py-1 ${INPUT_BASE}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addLink}
                    disabled={!newLinkUrl.trim()}
                    className="mt-1 inline-flex items-center gap-1 rounded-xl bg-[#0a84ff] px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#409cff] disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/[0.50]"
                  >
                    <Plus className="h-3 w-3" />
                    Guardar recurso
                  </button>
                </div>
              )}
            </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1">
                <ProjectTaskActivityPanel
                  taskId={task.id}
                  currentUserId={currentUserId}
                  canComment={false}
                  locked={isLocked}
                  mode="activity"
                />
              </div>
            )}
          </div>
            </>
          ) : (
            <div className="relative flex h-full min-h-0 flex-col overflow-hidden border-b border-white/[0.07] bg-[#17181b] lg:col-span-2 lg:border-b-0">
              <ProjectTaskSheetGrid
                taskId={task.id}
                currentUserId={currentUserId}
                canEdit={canEditWorkspace && !isLocked}
                onSaveStateChange={setSheetSaveState}
              />
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {deleteTodoGroupConfirm ? (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/[0.58] p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setDeleteTodoGroupConfirm(null)}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-checklist-group-title"
              className="w-full max-w-md rounded-[22px] border border-white/[0.09] bg-[#1c1c1e] p-6 text-[#f5f5f7] shadow-[0_28px_80px_rgba(0,0,0,.45)]"
              initial={{ scale: 0.97, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 6 }}
              transition={{ duration: 0.16 }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-400/10 text-rose-300">
                  <X className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3
                    id="delete-checklist-group-title"
                    className="text-base font-medium text-white/[0.94]"
                  >
                    ¿Eliminar el grupo?
                  </h3>
                  <p className="mt-1 text-sm font-normal leading-6 text-white/[0.65]">
                    Se eliminará el grupo <span className="font-medium text-white/[0.90]">{deleteTodoGroupConfirm.name}</span>.
                    Sus pasos no se perderán.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-[14px] border border-white/[0.07] bg-white/[0.035] px-3.5 py-3">
                <div className="text-xs font-medium text-white/[0.82]">
                  {deleteTodoGroupConfirm.itemCount === 0
                    ? 'Este grupo está vacío.'
                    : `${deleteTodoGroupConfirm.itemCount} paso${
                        deleteTodoGroupConfirm.itemCount === 1 ? '' : 's'
                      } se moverán a “Sin grupo”.`}
                </div>
                <div className="mt-1 text-[10px] font-normal text-white/[0.42]">
                  Podés volver a organizarlos después mediante drag & drop.
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTodoGroupConfirm(null)}
                  className="h-10 rounded-xl px-4 text-xs font-normal text-white/[0.72] transition hover:bg-white/[0.055] hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteTodoGroup}
                  className="h-10 rounded-xl bg-rose-500 px-4 text-xs font-medium text-white transition hover:bg-rose-400"
                >
                  Eliminar grupo
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </AnimatePresence>
  );
}
