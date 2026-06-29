'use client';

import { supabase } from '@/lib/supabaseClient';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DndContext,
  DragEndEvent,
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
  StickyNote,
  GripVertical,
  Pencil,
  Check,
  ChevronDown,
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
  type ProjectTaskWorkspaceLink,
} from '@/lib/projectTasks';

// ReactQuill (editor rich text)
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

// Toolbar estilo “mini Word”
const quillModules = {
  toolbar: [
    [{ header: [false, 3, 4, 5, 6] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ align: [] }],
    [{ color: [] }, { background: [] }],
    ['clean'],
  ],
};

const quillFormats = [
  'header',
  'bold',
  'italic',
  'underline',
  'list',
  'bullet',
  'indent',
  'align',
  'color',
  'background',
];

type Props = {
  task: ProjectTaskWithAssignees;
  supervisors: AssigneeOption[];
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
    pillClass: 'bg-gray-700 text-gray-100',
    dotClass: 'bg-gray-300',
  },
  {
    value: 'in_progress',
    label: 'En curso',
    pillClass: 'bg-sky-900/70 text-sky-100',
    dotClass: 'bg-sky-400',
  },
  {
    value: 'done',
    label: 'Completada',
    pillClass: 'bg-emerald-900/70 text-emerald-100',
    dotClass: 'bg-emerald-400',
  },
  {
    value: 'cancelled',
    label: 'Cancelada',
    pillClass: 'bg-rose-900/70 text-rose-100',
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
    pillClass: 'bg-emerald-900/60 text-emerald-100',
    dotClass: 'bg-emerald-400',
  },
  {
    value: 'medium',
    label: 'Media',
    pillClass: 'bg-amber-900/60 text-amber-100',
    dotClass: 'bg-amber-400',
  },
  {
    value: 'high',
    label: 'Alta',
    pillClass: 'bg-rose-900/60 text-rose-100',
    dotClass: 'bg-rose-400',
  },
];

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
  quickNotes: string;
  resourceLinks: ProjectTaskWorkspaceLink[];
}) =>
  JSON.stringify({
    todos: args.todos,
    quickNotes: args.quickNotes,
    resourceLinks: args.resourceLinks,
  });

// ──────────────────────────────────────────────
// Tailwind comunes
// ──────────────────────────────────────────────

const INPUT_BASE =
  'rounded-md border border-gray-700 bg-gray-900 text-[11px] text-gray-100 placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-60';

const BADGE_BASE =
  'rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide';

const PANEL_BASE =
  'flex flex-1 min-h-0 flex-col rounded-xl border border-gray-700 bg-gray-900/70 p-3';

const BUTTON_TINY_GRAY =
  'rounded-md bg-gray-700 px-2 py-1 text-[10px] text-gray-100 hover:bg-gray-600';

export default function ProjectTaskDrawer({
  task,
  supervisors,
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
  const [quickNotes, setQuickNotes] = useState('');
  const [resourceLinks, setResourceLinks] = useState<ProjectTaskWorkspaceLink[]>(
    [],
  );
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');


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

  const [todoGroups, setTodoGroups] = useState<string[]>([]);
  const [todoGroupSelected, setTodoGroupSelected] = useState<string | null>(null);
  const [todoGroupMenuOpen, setTodoGroupMenuOpen] = useState(false);
  const [newTodoGroupName, setNewTodoGroupName] = useState('');
  const todoGroupPickerRef = useRef<HTMLDivElement | null>(null);

  // edición inline
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoValue, setEditingTodoValue] = useState('');

  // DnD
  const [activeTodoDropId, setActiveTodoDropId] = useState('');
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

  const addTodoGroup = (name: string) => {
    const g = name.trim();
    if (!g) return;
    setTodoGroups((prev) => {
      if (prev.includes(g)) return prev;
      return [...prev, g].sort((a, b) => a.localeCompare(b, 'es'));
    });
  };

  // recomputar grupos existentes cuando cambian todos
  useEffect(() => {
    const uniq = Array.from(
      new Set(
        (todos ?? [])
          .map((t) => decodeTodo((t as any).text).group)
          .filter(Boolean) as string[],
      ),
    ).sort((a, b) => a.localeCompare(b, 'es'));

    setTodoGroups((prev) => {
      const merged = Array.from(new Set([...(prev ?? []), ...uniq]));
      return merged.sort((a, b) => a.localeCompare(b, 'es'));
    });
  }, [todos]);

  const todosUi = useMemo(() => {
    return (todos ?? []).map((t) => {
      const { group, label } = decodeTodo((t as any).text);
      return { ...t, group, label };
    });
  }, [todos]);

  const { todoGroupKeys, todosByGroup } = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of todosUi as any[]) {
      const key = t.group ?? TODO_NO_GROUP_KEY;
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }

    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === TODO_NO_GROUP_KEY) return -1;
      if (b === TODO_NO_GROUP_KEY) return 1;
      return a.localeCompare(b, 'es');
    });

    return { todoGroupKeys: keys, todosByGroup: map };
  }, [todosUi]);

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
    if (!nextLabel) return;

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

  function TodoGroup({
    dropId,
    title,
    count,
    isActiveDrop,
    children,
  }: {
    dropId: string;
    title: string;
    count: string;
    isActiveDrop: boolean;
    children: React.ReactNode;
  }) {
    const { setNodeRef } = useDroppable({ id: dropId });
    const [open, setOpen] = useState(true);

    return (
      <div
        ref={setNodeRef}
        className={`rounded-xl border border-gray-700 bg-gray-900/40 ${
          isActiveDrop ? 'ring-2 ring-gray-500/50' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2"
        >
          <div className="min-w-0 text-left">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-200">
              {title}
            </div>
            <div className="text-[11px] text-gray-400">{count}</div>
          </div>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.18 }}
          >
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </motion.div>
        </button>

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
    const { attributes, listeners, setNodeRef, transform, isDragging } =
      useDraggable({ id: todo.id });

    const style: React.CSSProperties | undefined = transform
      ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
      : undefined;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`group relative flex items-center gap-2 rounded-lg px-2 py-1.5 pr-16 z-10 bg-gray-900 hover:bg-gray-800 ${
          isDragging ? 'opacity-70' : ''
        }`}
      >
        <button
          type="button"
          disabled={!canEdit}
          {...attributes}
          {...listeners}
          className="mt-0.5 flex h-5 w-5 items-center justify-center rounded border-gray-500 text-gray-200 disabled:cursor-not-allowed"
          aria-label="Arrastrar"
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </button>

        <button
          type="button"
          disabled={!canEdit}
          onClick={onToggle}
          className="mt-0.5 flex h-5 w-5 items-center justify-center rounded border-gray-500 text-gray-200 disabled:cursor-not-allowed"
          aria-label="Completar"
        >
          {todo.done ? (
            <CheckSquare className="h-4 w-4 text-emerald-400" />
          ) : (
            <Square className="h-4 w-4 text-gray-400" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {!isEditing ? (
            <p
              className={`whitespace-pre-wrap break-words text-xs text-gray-100 ${
                todo.done ? 'line-through text-gray-400' : ''
              }`}
            >
              {todo.label}
            </p>
          ) : (
            <input
              autoFocus
              value={editingValue}
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
              className="rounded-md p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-100"
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-700 hover:text-rose-300"
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
              className="rounded-md p-1 text-gray-400 hover:bg-gray-700 hover:text-emerald-300"
              aria-label="Guardar"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-100"
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
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.due_date ? task.due_date.slice(0, 10) : '');
    setSelectedAssignees(task.assignees.map((a) => a.user_id));
    setEditingProject(false);
    setEditingSummary(false);
    setExpandedProject(false);
    setExpandedSummary(false);
  }, [task]);

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
          const safeNotes = ws.quick_notes ?? '';
          const safeLinks = ws.resource_links ?? [];

          setTodos(safeTodos);
          setQuickNotes(safeNotes);
          setResourceLinks(safeLinks);

          lastSavedSnapshotRef.current = buildWorkspaceSnapshot({
            todos: safeTodos,
            quickNotes: safeNotes,
            resourceLinks: safeLinks,
          });
        } else {
          setTodos([]);
          setQuickNotes('');
          setResourceLinks([]);
          lastSavedSnapshotRef.current = buildWorkspaceSnapshot({
            todos: [],
            quickNotes: '',
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
          const safeNotes = ws.quick_notes ?? '';
          const safeLinks = ws.resource_links ?? [];

          setTodos(safeTodos);
          setQuickNotes(safeNotes);
          setResourceLinks(safeLinks);

          lastSavedSnapshotRef.current = buildWorkspaceSnapshot({
            todos: safeTodos,
            quickNotes: safeNotes,
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

  // ───── GUARDAR FICHA PRINCIPAL (botón) ───────────────
  const save = async () => {
    if (task.is_locked) return;

    setLoading(true);
    try {
      const updatedRow = await updateProjectTask(task.id, {
        title,
        summary,
        description,
        project,
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
      onClose();
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
      quickNotes,
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
          quickNotes,
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
    quickNotes,
    resourceLinks,
    canEditWorkspace,
    task.id,
    currentUserId,
    task.is_locked,
  ]);

  // ───── HELPERS WORKSPACE ─────────────────────────────
  const addTodo = () => {
    if (!newTodoText.trim()) return;

    const label = newTodoText.trim();
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
    if (!newLinkUrl.trim()) return;

    const normalized = normalizeUrl(newLinkUrl);

    setResourceLinks((prev) => [
      ...prev,
      {
        id: makeId(),
        label: newLinkLabel.trim() || newLinkUrl.trim(),
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
        className="fixed left-0 top-0 z-50 flex h-full w-full max-w-7xl flex-col border-r border-gray-700 bg-gray-800"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-3">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Proyecto
            </span>
            <span className="text-xs text-gray-300">
              Gestión detallada de la tarea y espacio de trabajo.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {workspaceLoading && (
              <span className="text-[11px] text-gray-400">
                Cargando entorno...
              </span>
            )}

            {workspaceSaving && !workspaceLoading && (
              <span className="text-[11px] text-sky-300">
                Guardando cambios...
              </span>
            )}

            {!workspaceSaving && workspaceDirty && !workspaceLoading && (
              <span className="text-[11px] text-amber-300">
                Cambios sin guardar
              </span>
            )}

            {isLocked && (
              <span
                className={`${BADGE_BASE} bg-amber-900/60 text-amber-100`}
              >
                Tarea cerrada
              </span>
            )}

            {!canEditWorkspace && !isLocked && (
              <span className={`${BADGE_BASE} bg-gray-700 text-gray-200`}>
                Solo lectura
              </span>
            )}

            <button
              onClick={onClose}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* contenido 3 columnas */}
        <div className="flex flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,1.1fr)]">
          {/* Columna 1: ficha del proyecto */}
          <div className="flex h-full min-h-0 flex-col border-b border-gray-700/70 px-6 py-4 lg:border-b-0 lg:border-r">
            {/* Título */}
            <textarea
              rows={2}
              className="mb-3 w-full max-h-24 resize-none overflow-y-auto rounded-md border border-transparent bg-transparent text-xl font-semibold tracking-tight text-gray-50 outline-none placeholder:text-gray-500 focus:border-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre de la tarea"
              disabled={isLocked}
            />

            {/* propiedades */}
            <div className="space-y-3 border-b border-gray-700/80 pb-4 text-xs">
              {/* Responsable */}
              <div className="flex items-start gap-3">
                <span className="mt-[3px] w-24 text-[11px] font-semibold uppercase text-gray-400">
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
                    className={`flex w-full items-start px-3 py-1.5 text-left text-[11px] text-gray-100 ${INPUT_BASE}`}
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
                        className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-900 text-[11px] text-white shadow-xl shadow-black/60"
                      >
                        <div className="border-b border-gray-700 p-1.5">
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
                            <p className="px-3 py-2 text-gray-400">
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
                                className={`flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-gray-800 ${
                                  selected ? 'bg-gray-800/80' : ''
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
                <span className="w-24 text-[11px] font-semibold uppercase text-gray-400">
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
                        className="absolute z-20 mt-1 min-w-[170px] rounded-lg border border-gray-700 bg-gray-900 p-1 text-[11px] text-white shadow-xl shadow-black/60"
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
                                ? 'bg-gray-800'
                                : 'hover:bg-gray-800/80'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={`h-2 w-2 rounded-full ${opt.dotClass}`}
                              />
                              {opt.label}
                            </span>
                            {opt.value === status && (
                              <span className="text-[10px] text-sky-300">
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
                <span className="w-24 text-[11px] font-semibold uppercase text-gray-400">
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
                        className="absolute z-20 mt-1 min-w-[150px] rounded-lg border border-gray-700 bg-gray-900 p-1 text-[11px] text-white shadow-xl shadow-black/60"
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
                                ? 'bg-gray-800'
                                : 'hover:bg-gray-800/80'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={`h-2 w-2 rounded-full ${opt.dotClass}`}
                              />
                              {opt.label}
                            </span>
                            {opt.value === priority && (
                              <span className="text-[10px] text-sky-300">
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
                <span className="w-24 text-[11px] font-semibold uppercase text-gray-400">
                  Fecha límite
                </span>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={`px-2 py-1 ${INPUT_BASE}`}
                    disabled={isLocked}
                  />
                </div>
              </div>

              {/* Proyecto */}
              <div className="flex items-start gap-3">
                <span className="mt-[3px] w-24 text-[11px] font-semibold uppercase text-gray-400">
                  Proyecto
                </span>
                {editingProject && !isLocked ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      className={`flex-1 px-3 py-1.5 ${INPUT_BASE}`}
                      placeholder="Nombre del proyecto"
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
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
                  <div className="group relative flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-[11px] text-gray-100">
                    <p
                      className={
                        project
                          ? expandedProject || !needsReadMore(project)
                            ? 'whitespace-pre-wrap'
                            : 'line-clamp-1'
                          : 'text-gray-500'
                      }
                    >
                      {project || 'Nombre del proyecto'}
                    </p>
                    {project && needsReadMore(project) && (
                      <button
                        type="button"
                        onClick={() => setExpandedProject((v) => !v)}
                        className="mt-1 text-[10px] text-sky-300 hover:underline"
                      >
                        {expandedProject ? 'Ver menos' : 'Ver más'}
                      </button>
                    )}
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => setEditingProject(true)}
                        className="absolute right-2 top-1.5 hidden rounded-md bg-gray-800 px-2 py-0.5 text-[10px] text-gray-200 group-hover:inline-flex"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Resumen */}
              <div className="flex items-start gap-3">
                <span className="mt-[3px] w-24 text-[11px] font-semibold uppercase text-gray-400">
                  Resumen
                </span>
                {editingSummary && !isLocked ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      className={`flex-1 px-3 py-1.5 ${INPUT_BASE}`}
                      placeholder="Breve descripción de la tarea..."
                      value={summary}
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
                  <div className="group relative flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-[11px] text-gray-100">
                    <p
                      className={
                        summary
                          ? expandedSummary || !needsReadMore(summary)
                            ? 'whitespace-pre-wrap'
                            : 'line-clamp-1'
                          : 'text-gray-500'
                      }
                    >
                      {summary || 'Breve descripción de la tarea...'}
                    </p>
                    {summary && needsReadMore(summary) && (
                      <button
                        type="button"
                        onClick={() => setExpandedSummary((v) => !v)}
                        className="mt-1 text-[10px] text-sky-300 hover:underline"
                      >
                        {expandedSummary ? 'Ver menos' : 'Ver más'}
                      </button>
                    )}
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => setEditingSummary(true)}
                        className="absolute right-2 top-1.5 hidden rounded-md bg-gray-800 px-2 py-0.5 text-[10px] text-gray-200 group-hover:inline-flex"
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
              <p className="mb-2 text-[11px] font-semibold uppercase text-gray-400">
                Descripción general
              </p>
              <textarea
                className="h-full w-full min-h-[120px] rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Contexto, objetivos, entregables, decisiones clave..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLocked}
              />
            </div>

            {/* footer izquierda */}
            <div className="mt-4 flex justify-end border-t border-gray-700 pt-3">
              <button
                onClick={save}
                disabled={loading || isLocked}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  isLocked
                    ? 'cursor-not-allowed bg-gray-700 text-gray-300'
                    : 'bg-sky-500 text-gray-950 hover:bg-sky-400'
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

          {/* Columna 2: checklist */}
          <div className="flex h-full min-h-0 flex-col gap-3 border-b border-gray-700/70 bg-gray-900/60 px-6 py-4 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-emerald-300" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">
                    Checklist de avance
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Dividí el proyecto en pasos accionables.
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-gray-400">
                {todos.length === 0
                  ? 'Sin tareas internas'
                  : `${todos.filter((t) => t.done).length} / ${
                      todos.length
                    } completadas`}
              </span>
            </div>

            {/* Agrupación + creación rápida */}
            <div className="flex flex-col gap-2 border-b border-gray-700 pb-3">
              {/* selector de grupo + input */}
              <div className="grid grid-cols-1 gap-2 md:items-center">
                <div className="relative" ref={todoGroupPickerRef}>
                  <button
                    type="button"
                    disabled={!canEditWorkspace}
                    onClick={() => {
                      if (!canEditWorkspace) return;
                      setTodoGroupMenuOpen((v) => !v);
                    }}
                    className={`flex w-full items-center justify-between rounded-full px-3 py-1.5 text-left text-[11px] ${INPUT_BASE}`}
                  >
                    <span className="truncate">
                      {todoGroupSelected ?? 'Sin grupo'}
                    </span>
                    <motion.span
                      animate={{ rotate: todoGroupMenuOpen ? 180 : 0 }}
                      transition={{ duration: 0.16 }}
                    >
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </motion.span>
                  </button>

                  <AnimatePresence>
                    {todoGroupMenuOpen && canEditWorkspace && !isLocked && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.16 }}
                        className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-xl shadow-black/60"
                      >
                        <div className="p-2 space-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              setTodoGroupSelected(null);
                              setTodoGroupMenuOpen(false);
                            }}
                            className={`w-full rounded-lg px-3 py-2 text-left text-[11px] text-white hover:bg-gray-800 ${
                              todoGroupSelected === null ? 'bg-gray-800' : ''
                            }`}
                          >
                            Sin grupo
                          </button>

                          {todoGroups.map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => {
                                setTodoGroupSelected(g);
                                setTodoGroupMenuOpen(false);
                              }}
                              className={`w-full rounded-lg px-3 py-2 text-left text-[11px] text-white hover:bg-gray-800 ${
                                todoGroupSelected === g ? 'bg-gray-800' : ''
                              }`}
                            >
                              {g}
                            </button>
                          ))}

                          <div className="mt-2 border-t border-gray-700 pt-2">
                            <div className="px-1 pb-1 text-[10px] uppercase tracking-wide text-gray-400">
                              Crear grupo
                            </div>
                            <div className="flex gap-2">
                              <input
                                value={newTodoGroupName}
                                onChange={(e) => setNewTodoGroupName(e.target.value)}
                                placeholder="Ej: Categorías"
                                className={`h-9 flex-1 px-2 ${INPUT_BASE}`}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const name = newTodoGroupName.trim();
                                    if (!name) return;
                                    addTodoGroup(name);
                                    setTodoGroupSelected(name);
                                    setNewTodoGroupName('');
                                    setTodoGroupMenuOpen(false);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const name = newTodoGroupName.trim();
                                  if (!name) return;
                                  addTodoGroup(name);
                                  setTodoGroupSelected(name);
                                  setNewTodoGroupName('');
                                  setTodoGroupMenuOpen(false);
                                }}
                                className="inline-flex h-9 items-center justify-center rounded-full bg-gray-700 px-4 text-[11px] font-semibold text-gray-100 hover:bg-gray-600"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <input
                  ref={newTodoInputRef}
                  value={newTodoText}
                  onChange={(e) => setNewTodoText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canEditWorkspace) {
                      e.preventDefault();
                      addTodo();
                    }
                  }}
                  disabled={!canEditWorkspace}
                  placeholder={
                    canEditWorkspace
                      ? 'Escribí y presioná Enter...'
                      : 'Solo lectura'
                  }
                  className={`flex-1 px-3 py-1.5 text-xs ${INPUT_BASE}`}
                />

                <button
                  type="button"
                  onClick={addTodo}
                  disabled={!canEditWorkspace || !newTodoText.trim()}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-emerald-950 shadow-sm shadow-emerald-500/30 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-300"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Añadir
                </button>
              </div>
            </div>

            {/* lista todos agrupada + DnD */}
            <div className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
              <DndContext
                sensors={todoDndSensors}
                onDragEnd={handleTodoDragEnd}
                onDragOver={(e) => setActiveTodoDropId(String(e.over?.id ?? ''))}
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
                      title={groupName ?? 'Sin grupo'}
                      count={`${done}/${total}`}
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
                        <p className="rounded-lg bg-gray-800/60 px-3 py-2 text-[11px] text-gray-400">
                          Arrastrá items acá para agruparlos.
                        </p>
                      )}
                    </TodoGroup>
                  );
                })}
              </DndContext>

              {todos.length === 0 && (
                <p className="rounded-lg bg-gray-800/80 px-3 py-2 text-[11px] text-gray-400">
                  Usá este checklist para definir pasos como “Relevar
                  requerimientos”, “Diseñar UI”, “Implementar API”, etc.
                </p>
              )}
            </div>
          </div>

{/* Columna 3: Notas + recursos */}
          <div className="flex h-full min-h-0 flex-col gap-3 bg-gray-900/60 px-6 py-4">
            {/* Notas rápidas */}
            <div className={PANEL_BASE}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <StickyNote className="h-4 w-4 text-amber-300" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">
                    Notas rápidas
                  </span>
                </div>
                {!canEditWorkspace && (
                  <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">
                    Solo lectura
                  </span>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-hidden rounded-md border border-gray-700 bg-gray-900">
                <ReactQuill
                  theme="snow"
                  value={quickNotes}
                  onChange={(value) => {
                    if (!canEditWorkspace) return;
                    setQuickNotes(value);
                  }}
                  readOnly={!canEditWorkspace}
                  modules={quillModules}
                  formats={quillFormats}
                  className="
                    h-full
                    [&_.ql-toolbar]:border-none
                    [&_.ql-toolbar]:bg-gray-900
                    [&_.ql-toolbar]:text-gray-100
                    [&_.ql-container]:border-none
                    [&_.ql-container]:shadow-none
                    [&_.ql-container]:h-[calc(100%-2.25rem)]
                    [&_.ql-container]:overflow-y-auto
                    [&_.ql-editor]:bg-gray-900
                    [&_.ql-editor]:text-[11px]
                    [&_.ql-editor]:text-gray-100
                    [&_.ql-editor]:min-h-0
                    [&_.ql-editor]:outline-none
                  "
                />
              </div>
            </div>

            {/* Recursos */}
            <div className={PANEL_BASE}>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-4 w-4 text-sky-300" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">
                    Recursos del proyecto
                  </span>
                </div>
              </div>

              <div className="flex-1 min-h-0 space-y-1 overflow-y-auto pr-1">
                {resourceLinks.length === 0 && (
                  <p className="text-[11px] text-gray-400">
                    Guardá acá links a Figma, Looker, documentación, Sheets,
                    etc.
                  </p>
                )}
                {resourceLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between rounded-lg bg-gray-800/80 px-2 py-1.5 text-[11px]"
                  >
                    <a
                      href={normalizeUrl(link.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate text-sky-300 hover:underline"
                    >
                      {link.label}
                    </a>
                    {canEditWorkspace && (
                      <button
                        type="button"
                        onClick={() => deleteLink(link.id)}
                        className="ml-2 text-[10px] text-gray-400 hover:text-rose-300"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {canEditWorkspace && (
                <div className="mt-2 border-t border-gray-700 pt-2">
                  <div className="mb-1 flex flex-col gap-1">
                    <input
                      value={newLinkLabel}
                      onChange={(e) => setNewLinkLabel(e.target.value)}
                      placeholder="Nombre del recurso (opcional)"
                      className={`w-full px-2 py-1 ${INPUT_BASE}`}
                    />
                    <input
                      value={newLinkUrl}
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
                    className="mt-1 inline-flex items-center gap-1 rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-sky-950 hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-300"
                  >
                    <Plus className="h-3 w-3" />
                    Guardar recurso
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
