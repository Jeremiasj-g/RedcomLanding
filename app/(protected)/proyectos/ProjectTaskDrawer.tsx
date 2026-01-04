'use client';

import { supabase } from '@/lib/supabaseClient';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  CalendarDays,
  CheckSquare,
  Square,
  Plus,
  Link2,
  ListChecks,
  StickyNote,
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
    setTodos((prev) => [
      ...prev,
      { id: makeId(), text: newTodoText.trim(), done: false },
    ]);
    setNewTodoText('');
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

            {/* input arriba */}
            <div className="flex items-center gap-2 border-b border-gray-700 pb-2">
              <input
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
                    ? 'Agregar nueva tarea interna y presionar Enter...'
                    : 'Solo lectura'
                }
                className={`flex-1 px-3 py-1.5 text-xs ${INPUT_BASE}`}
              />
              <button
                type="button"
                onClick={addTodo}
                disabled={!canEditWorkspace || !newTodoText.trim()}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-emerald-950 shadow-sm shadow-emerald-500/30 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-300"
              >
                <Plus className="h-3 w-3" />
                Añadir
              </button>
            </div>

            {/* lista todos */}
            <div className="flex-1 min-h-0 space-y-1 overflow-y-auto pr-1">
              {todos.map((item) => (
                <div
                  key={item.id}
                  className="group relative flex items-start gap-2 rounded-lg px-2 py-1.5 pr-8 hover:bg-gray-800"
                >
                  <button
                    type="button"
                    disabled={!canEditWorkspace}
                    onClick={() => canEditWorkspace && toggleTodo(item.id)}
                    className="mt-0.5 flex h-5 w-5 items-center justify-center rounded border border-gray-500 text-gray-200 disabled:cursor-not-allowed"
                  >
                    {item.done ? (
                      <CheckSquare className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-400" />
                    )}
                  </button>

                  <p
                    className={`flex-1 whitespace-pre-wrap break-words text-xs text-gray-100 ${
                      item.done ? 'line-through text-gray-400' : ''
                    }`}
                  >
                    {item.text}
                  </p>

                  {canEditWorkspace && (
                    <button
                      type="button"
                      onClick={() => deleteTodo(item.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              ))}

              {todos.length === 0 && (
                <p className="mt-2 rounded-lg bg-gray-800/80 px-3 py-2 text-[11px] text-gray-400">
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
