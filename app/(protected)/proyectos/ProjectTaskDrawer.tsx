'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CalendarDays, Tag } from 'lucide-react';
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
    pillClass: 'bg-slate-800 text-slate-100',
    dotClass: 'bg-slate-300',
  },
  {
    value: 'in_progress',
    label: 'En curso',
    pillClass: 'bg-sky-900/60 text-sky-200',
    dotClass: 'bg-sky-400',
  },
  {
    value: 'done',
    label: 'Completada',
    pillClass: 'bg-emerald-900/60 text-emerald-200',
    dotClass: 'bg-emerald-400',
  },
  {
    value: 'cancelled',
    label: 'Cancelada',
    pillClass: 'bg-rose-900/60 text-rose-200',
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
    pillClass: 'bg-emerald-900/40 text-emerald-200',
    dotClass: 'bg-emerald-400',
  },
  {
    value: 'medium',
    label: 'Media',
    pillClass: 'bg-amber-900/40 text-amber-200',
    dotClass: 'bg-amber-400',
  },
  {
    value: 'high',
    label: 'Alta',
    pillClass: 'bg-rose-900/40 text-rose-200',
    dotClass: 'bg-rose-400',
  },
];

export default function ProjectTaskDrawer({
  task,
  supervisors,
  currentUserRole,
  onClose,
  onUpdated,
}: Props) {
  const isAdmin = currentUserRole === 'admin';

  // ── state básico ─────────────────────────────────────
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
  }, [task]);

  // cerrar dropdowns con ESC / click global
  useEffect(() => {
    const closeMenus = () => {
      setStatusMenuOpen(false);
      setPriorityMenuOpen(false);
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenus();
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('click', closeMenus);

    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('click', closeMenus);
    };
  }, []);

  if (!task) return null;

  const isLocked = task.is_locked; // <- viene de la DB
  const currentStatusOpt =
    STATUS_OPTIONS.find((opt) => opt.value === status) ?? STATUS_OPTIONS[0];
  const currentPriorityOpt =
    PRIORITY_OPTIONS.find((opt) => opt.value === priority) ??
    PRIORITY_OPTIONS[0];

  const toggleAssignee = (id: string) => {
    // si está bloqueada, nadie edita (ni admin)
    if (isLocked) return;
    if (!isAdmin) return; // supervisores no pueden tocar responsables

    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const save = async () => {
    // seguridad extra: si está bloqueada, no guardamos
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

      // 2) actualizar responsables solo si es admin y no está bloqueada
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
        className="fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col border-l border-slate-800 bg-slate-950 px-6 py-5"
        initial={{ x: 420 }}
        animate={{ x: 0 }}
        exit={{ x: 420 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        onClick={(e) => e.stopPropagation()} // que no cierre al hacer click dentro
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-5 w-5 rounded bg-slate-900" />
            <span>Introducción a Proyectos y Tareas</span>
          </div>
          <div className="flex items-center gap-2">
            {isLocked && (
              <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                Tarea cerrada
              </span>
            )}
            <button onClick={onClose}>
              <X className="h-5 w-5 text-slate-400 hover:text-slate-100" />
            </button>
          </div>
        </div>

        {/* Título grande */}
        <input
          className="mb-4 w-full border-none bg-transparent text-2xl font-semibold tracking-tight text-slate-100 outline-none placeholder:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nombre de la tarea"
          disabled={isLocked}
        />

        {/* Propiedades tipo Notion */}
        <div className="space-y-2 border-b border-slate-800 pb-4 text-sm">
          {/* Responsables */}
          <div className="flex items-start gap-3">
            <span className="mt-[3px] w-24 text-xs font-medium uppercase text-slate-500">
              Responsable
            </span>
            <div className="flex flex-wrap gap-1">
              {supervisors.length === 0 && (
                <span className="text-xs text-slate-500">
                  Sin supervisores
                </span>
              )}
              {supervisors.map((sup) => {
                const selected = selectedAssignees.includes(sup.id);
                const baseClasses =
                  'rounded-full border px-2 py-0.5 text-xs transition';
                const selectedClasses =
                  'border-sky-500 bg-sky-600/20 text-sky-100';
                const unselectedClasses = isAdmin
                  ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-800 bg-slate-900 text-slate-400';

                const disabledClasses = isLocked
                  ? 'cursor-not-allowed opacity-60 hover:bg-slate-900'
                  : '';

                return (
                  <button
                    key={sup.id}
                    type="button"
                    onClick={() => toggleAssignee(sup.id)}
                    disabled={!isAdmin || isLocked}
                    className={`${baseClasses} ${
                      selected ? selectedClasses : unselectedClasses
                    } ${disabledClasses}`}
                  >
                    {sup.full_name ?? sup.email ?? 'Sin nombre'}
                  </button>
                );
              })}
              {isAdmin && supervisors.length === 0 && (
                <span className="text-xs text-slate-500">
                  No hay supervisores cargados.
                </span>
              )}
            </div>
          </div>

          {/* Estado */}
          <div className="flex items-center gap-3">
            <span className="w-24 text-xs font-medium uppercase text-slate-500">
              Estado
            </span>
            <div
              className="relative"
              onClick={(e) => e.stopPropagation()} // no propagar al window.click
            >
              <button
                type="button"
                onClick={() => {
                  if (isLocked) return;
                  setStatusMenuOpen((o) => !o);
                }}
                disabled={isLocked}
                className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs ${currentStatusOpt.pillClass} ${
                  isLocked ? 'cursor-not-allowed opacity-70' : ''
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${currentStatusOpt.dotClass}`}
                />
                {currentStatusOpt.label}
              </button>

              {statusMenuOpen && !isLocked && (
                <div className="absolute z-20 mt-1 min-w-[160px] rounded-lg border border-slate-800 bg-slate-950 p-1 text-xs shadow-lg">
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
                          ? 'bg-slate-800'
                          : 'hover:bg-slate-900'
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
                </div>
              )}
            </div>
          </div>

          {/* Resumen */}
          <div className="flex items-center gap-3">
            <span className="w-24 text-xs font-medium uppercase text-slate-500">
              Resumen
            </span>
            <input
              className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Breve resumen de la tarea..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={isLocked}
            />
          </div>

          {/* Fecha límite */}
          <div className="flex items-center gap-3">
            <span className="w-24 text-xs font-medium uppercase text-slate-500">
              Fecha límite
            </span>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-slate-500" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLocked}
              />
            </div>
          </div>

          {/* Proyecto */}
          <div className="flex items-center gap-3">
            <span className="w-24 text-xs font-medium uppercase text-slate-500">
              Proyecto
            </span>
            <div className="flex flex-1 items-center gap-2">
              <Tag className="h-4 w-4 text-slate-500" />
              <input
                className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Nombre del proyecto"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                disabled={isLocked}
              />
            </div>
          </div>

          {/* Prioridad */}
          <div className="flex items-center gap-3">
            <span className="w-24 text-xs font-medium uppercase text-slate-500">
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
                className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs ${currentPriorityOpt.pillClass} ${
                  isLocked ? 'cursor-not-allowed opacity-70' : ''
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${currentPriorityOpt.dotClass}`}
                />
                {currentPriorityOpt.label}
              </button>

              {priorityMenuOpen && !isLocked && (
                <div className="absolute z-20 mt-1 min-w-[140px] rounded-lg border border-slate-800 bg-slate-950 p-1 text-xs shadow-lg">
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
                          ? 'bg-slate-800'
                          : 'hover:bg-slate-900'
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
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Descripción larga */}
        <div className="mt-4 flex-1">
          <p className="mb-2 text-xs font-medium uppercase text-slate-500">
            Descripción
          </p>
          <textarea
            className="h-[180px] w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="Agrega aquí los detalles de la tarea, checklist, decisiones, etc."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLocked}
          />
        </div>

        {/* Botón guardar */}
        <div className="mt-4 flex justify-end border-t border-slate-800 pt-4">
          <button
            onClick={save}
            disabled={loading || isLocked}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              isLocked
                ? 'cursor-not-allowed bg-slate-700 text-slate-300'
                : 'bg-sky-600 text-slate-950 hover:bg-sky-500'
            } disabled:opacity-60`}
          >
            {isLocked
              ? 'Tarea cerrada'
              : loading
              ? 'Guardando...'
              : 'Guardar cambios'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
