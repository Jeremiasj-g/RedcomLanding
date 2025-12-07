'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  CalendarDays,
  Tag,
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
  type ProjectTaskWithAssignees,
  type SupervisorOption,
  type ProjectTaskStatus,
  type ProjectTaskPriority,
} from '@/lib/projectTasks';

type Props = {
  task: ProjectTaskWithAssignees | null;
  supervisors: SupervisorOption[];
  currentUserRole: string; // 'admin' | 'supervisor' | ...
  currentUserId: string | null;
  onClose: () => void;
  onUpdated: (t: ProjectTaskWithAssignees) => void;
};

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

// Tipos para el “entorno de tareas” (workspace)
type TodoItem = {
  id: string;
  text: string;
  done: boolean;
};

export default function ProjectTaskDrawer({
  task,
  supervisors,
  currentUserRole,
  currentUserId,
  onClose,
  onUpdated,
}: Props) {
  if (!task) return null;

  const isAdmin = currentUserRole === 'admin';
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

  // workspace derecho
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [quickNotes, setQuickNotes] = useState('');
  const [resourceLinks, setResourceLinks] = useState<
    { id: string; label: string; url: string }[]
  >([]);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // ── sincronizar cuando cambia la tarea ─────────────────
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setSummary(task.summary ?? '');
    setDescription(task.description ?? '');
    setProject(task.project ?? '');
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.due_date ? task.due_date.slice(0, 10) : '');
    setSelectedAssignees(task.assignees.map((a) => a.user_id));

    // por ahora el entorno de tareas es solo frontend,
    // arrancamos vacío para cada proyecto:
    setTodos([]);
    setQuickNotes('');
    setResourceLinks([]);
    setNewTodoText('');
    setNewLinkLabel('');
    setNewLinkUrl('');
  }, [task]);

  // cerrar dropdowns con ESC
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStatusMenuOpen(false);
        setPriorityMenuOpen(false);
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

  // quién puede usar el entorno de tareas de la derecha
  const canEditWorkspace = !isLocked && (isAdmin || isAssignee);

  const toggleAssignee = (id: string) => {
    if (isLocked) return;
    if (!isAdmin) return; // solo admin toca responsables

    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const save = async () => {
    if (task.is_locked) return;

    setLoading(true);
    try {
      // 1) actualizar datos básicos
      const updatedRow = await updateProjectTask(task.id, {
        title,
        summary,
        description,
        project,
        status,
        priority,
        due_date: dueDate || null,
      });

      // 2) actualizar responsables (solo admin)
      let finalAssignees = task.assignees;
      if (isAdmin && !isLocked) {
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

  // ── helpers workspace derecho ─────────────────────────
  const addTodo = () => {
    if (!newTodoText.trim()) return;
    setTodos((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: newTodoText.trim(), done: false },
    ]);
    setNewTodoText('');
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  };

  const updateTodoText = (id: string, text: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text } : t)),
    );
  };

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const addLink = () => {
    if (!newLinkUrl.trim()) return;
    setResourceLinks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: newLinkLabel.trim() || newLinkUrl.trim(),
        url: newLinkUrl.trim(),
      },
    ]);
    setNewLinkLabel('');
    setNewLinkUrl('');
  };

  const deleteLink = (id: string) => {
    setResourceLinks((prev) => prev.filter((l) => l.id !== id));
  };

  // ── UI ────────────────────────────────────────────────
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

      {/* drawer desde la izquierda */}
      <motion.div
        className="fixed left-0 top-0 z-50 flex h-full w-full max-w-5xl flex-col border-r border-gray-700 bg-gray-800"
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
            {isLocked && (
              <span className="rounded-full bg-amber-900/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                Tarea cerrada
              </span>
            )}
            {!canEditWorkspace && !isLocked && (
              <span className="rounded-full bg-gray-700 px-3 py-1 text-[10px] text-gray-200">
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

        {/* contenido 2 columnas */}
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          {/* Columna izquierda: datos del proyecto */}
          <div className="flex h-full flex-col border-b border-gray-700/70 px-6 py-4 md:w-[52%] md:border-b-0 md:border-r">
            {/* título */}
            <input
              className="mb-3 w-full border-none bg-transparent text-xl font-semibold tracking-tight text-gray-50 outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre de la tarea"
              disabled={isLocked}
            />

            {/* propiedades estilo Notion */}
            <div className="space-y-3 border-b border-gray-700/80 pb-4 text-xs">
              {/* responsables */}
              <div className="flex items-start gap-3">
                <span className="mt-[3px] w-24 text-[11px] font-semibold uppercase text-gray-400">
                  Responsable
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {supervisors.length === 0 && (
                    <span className="text-[11px] text-gray-400">
                      Sin supervisores configurados.
                    </span>
                  )}
                  {supervisors.map((sup) => {
                    const selected = selectedAssignees.includes(sup.id);
                    const base =
                      'rounded-full border px-2 py-0.5 text-[11px] transition';
                    const selectedCls =
                      'border-sky-400 bg-sky-900/60 text-sky-100';
                    const unselectedCls = isAdmin
                      ? 'border-gray-600 bg-gray-900 text-gray-200 hover:bg-gray-700'
                      : 'border-gray-700 bg-gray-900 text-gray-400';
                    const disabledCls = isLocked
                      ? 'cursor-not-allowed opacity-60 hover:bg-gray-900'
                      : '';

                    return (
                      <button
                        key={sup.id}
                        type="button"
                        onClick={() => toggleAssignee(sup.id)}
                        disabled={!isAdmin || isLocked}
                        className={`${base} ${
                          selected ? selectedCls : unselectedCls
                        } ${disabledCls}`}
                      >
                        {sup.full_name ?? sup.email ?? 'Sin nombre'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* estado */}
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
                        className="absolute z-20 mt-1 min-w-[170px] rounded-lg border border-gray-700 bg-gray-900 p-1 text-[11px] shadow-xl shadow-black/60"
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

              {/* prioridad */}
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
                        className="absolute z-20 mt-1 min-w-[150px] rounded-lg border border-gray-700 bg-gray-900 p-1 text-[11px] shadow-xl shadow-black/60"
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

              {/* fecha límite */}
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
                    className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-[11px] text-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isLocked}
                  />
                </div>
              </div>

              {/* proyecto */}
              <div className="flex items-center gap-3">
                <span className="w-24 text-[11px] font-semibold uppercase text-gray-400">
                  Proyecto
                </span>
                <div className="flex flex-1 items-center gap-2">
                  <Tag className="h-4 w-4 text-gray-400" />
                  <input
                    className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-[11px] text-gray-100 placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder="Nombre del proyecto"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    disabled={isLocked}
                  />
                </div>
              </div>

              {/* resumen corto */}
              <div className="flex items-center gap-3">
                <span className="w-24 text-[11px] font-semibold uppercase text-gray-400">
                  Resumen
                </span>
                <input
                  className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-[11px] text-gray-100 placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Breve descripción de la tarea..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  disabled={isLocked}
                />
              </div>
            </div>

            {/* descripción larga */}
            <div className="mt-4 flex-1 overflow-auto">
              <p className="mb-2 text-[11px] font-semibold uppercase text-gray-400">
                Descripción general
              </p>
              <textarea
                className="min-h-[140px] w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Contexto, objetivos, entregables, decisiones clave..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLocked}
              />
            </div>

            {/* footer izquierda: guardar */}
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

          {/* Columna derecha: entorno de tareas */}
          <div className="flex h-full flex-1 flex-col gap-4 bg-gray-900/60 px-6 py-4">
            {/* header workspace */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-sky-300" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">
                    Entorno de tareas
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Checklist, notas y recursos compartidos del proyecto.
                  </span>
                </div>
              </div>
              {canEditWorkspace && (
                <span className="rounded-full bg-sky-900/60 px-3 py-1 text-[10px] text-sky-100">
                  Editado por responsables del proyecto
                </span>
              )}
            </div>

            {/* checklist principal */}
            <div className="flex flex-1 flex-col gap-3 rounded-xl border border-gray-700 bg-gray-900/70 p-3">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckSquare className="h-4 w-4 text-emerald-300" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">
                    Checklist de avance
                  </span>
                </div>
                <span className="text-[11px] text-gray-400">
                  {todos.length === 0
                    ? 'Sin tareas internas'
                    : `${todos.filter((t) => t.done).length} / ${
                        todos.length
                      } completadas`}
                </span>
              </div>

              <div className="space-y-1 overflow-auto">
                {todos.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-800"
                  >
                    <button
                      type="button"
                      disabled={!canEditWorkspace}
                      onClick={() => canEditWorkspace && toggleTodo(item.id)}
                      className="flex h-5 w-5 items-center justify-center rounded border border-gray-500 text-gray-200 disabled:cursor-not-allowed"
                    >
                      {item.done ? (
                        <CheckSquare className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                    <input
                      value={item.text}
                      onChange={(e) =>
                        canEditWorkspace &&
                        updateTodoText(item.id, e.target.value)
                      }
                      disabled={!canEditWorkspace}
                      className={`flex-1 bg-transparent text-xs text-gray-100 outline-none placeholder:text-gray-500 disabled:cursor-not-allowed ${
                        item.done ? 'line-through text-gray-400' : ''
                      }`}
                      placeholder="Detalle de la tarea..."
                    />
                    {canEditWorkspace && (
                      <button
                        type="button"
                        onClick={() => deleteTodo(item.id)}
                        className="hidden text-[10px] text-gray-400 hover:text-rose-300 group-hover:inline"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                ))}

                {todos.length === 0 && (
                  <p className="rounded-lg bg-gray-800/80 px-3 py-2 text-[11px] text-gray-400">
                    Usá este espacio para dividir el proyecto en pasos
                    accionables, como “Reunir requerimientos”, “Diseñar
                    interfaz”, “Implementar API”, etc.
                  </p>
                )}
              </div>

              {/* input para nueva tarea */}
              <div className="mt-2 flex items-center gap-2 border-t border-gray-700 pt-2">
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
                  className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
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
            </div>

            {/* notas rápidas + links */}
            <div className="grid gap-3 md:grid-cols-2">
              {/* notas */}
              <div className="flex flex-col rounded-xl border border-gray-700 bg-gray-900/70 p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <StickyNote className="h-4 w-4 text-amber-300" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">
                    Notas rápidas
                  </span>
                </div>
                <textarea
                  value={quickNotes}
                  onChange={(e) =>
                    canEditWorkspace && setQuickNotes(e.target.value)
                  }
                  disabled={!canEditWorkspace}
                  placeholder={
                    canEditWorkspace
                      ? 'Anotá decisiones, pendientes, ideas o cosas a revisar en las reuniones.'
                      : 'Solo lectura'
                  }
                  className="mt-1 min-h-[90px] flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-[11px] text-gray-100 placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {/* links / recursos */}
              <div className="flex flex-col rounded-xl border border-gray-700 bg-gray-900/70 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="h-4 w-4 text-sky-300" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">
                      Recursos del proyecto
                    </span>
                  </div>
                </div>

                <div className="mb-2 space-y-1 overflow-auto">
                  {resourceLinks.length === 0 && (
                    <p className="text-[11px] text-gray-400">
                      Guardá links útiles: tablero de Looker, Figma, documentación,
                      Google Sheets, etc.
                    </p>
                  )}
                  {resourceLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between rounded-lg bg-gray-800/80 px-2 py-1.5 text-[11px]"
                    >
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
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
                  <div className="mt-auto border-t border-gray-700 pt-2">
                    <div className="mb-1 flex flex-col gap-1">
                      <input
                        value={newLinkLabel}
                        onChange={(e) => setNewLinkLabel(e.target.value)}
                        placeholder="Nombre del recurso (opcional)"
                        className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-[11px] text-gray-100 placeholder:text-gray-500"
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
                        className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-[11px] text-gray-100 placeholder:text-gray-500"
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
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
