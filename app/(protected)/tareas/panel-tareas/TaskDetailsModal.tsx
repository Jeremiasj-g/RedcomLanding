'use client';

import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Clock3,
  Columns3,
  Loader2,
  Repeat2,
  Save,
  Table2,
  UserRound,
  X,
} from 'lucide-react';

import type { TaskWithOwner } from '@/lib/tasks';
import TaskChecklistSection from '../TaskChecklistSection';
import TaskCommentsTimeline from '../components/TaskCommentsTimeline';
import type { ProjectTaskSheetSaveState } from '../../proyectos/ProjectTaskSheetGrid';
import { STATUS_LABEL } from './supervisorTasksUtils';

const ProjectTaskSheetGrid = dynamic(
  () => import('../../proyectos/ProjectTaskSheetGrid'),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full min-h-[460px] place-items-center bg-[#17181b] text-[11px] text-white/[0.42]">
        Preparando planilla...
      </div>
    ),
  },
);

type Props = {
  task: TaskWithOwner | null;
  currentUserId: string | null;
  onClose: () => void;
};

function recurrenceLabel(task: TaskWithOwner) {
  if (task.recurrence_type === 'daily') return 'Todos los días';
  if (task.recurrence_type === 'weekly') return 'Semanal · mismo día';
  if (task.recurrence_type === 'first_business_day_month') {
    return 'Primer día hábil del mes';
  }
  if (task.recurrence_type === 'every_n_days') {
    return `Cada ${task.recurrence_interval_days ?? 1} días`;
  }
  return 'No repetir';
}

function statusClass(status: TaskWithOwner['status']) {
  if (status === 'done') return 'bg-emerald-400/10 text-emerald-300';
  if (status === 'in_progress') return 'bg-sky-400/10 text-sky-300';
  if (status === 'cancelled') return 'bg-rose-400/10 text-rose-300';
  return 'bg-white/[0.05] text-white/[0.52]';
}

export default function TaskDetailsModal({
  task,
  currentUserId,
  onClose,
}: Props) {
  const [detailView, setDetailView] = useState<'normal' | 'sheet'>('normal');
  const [sheetSaveState, setSheetSaveState] =
    useState<ProjectTaskSheetSaveState>('idle');

  useEffect(() => {
    if (!task) return;
    setSheetSaveState('idle');

    if (typeof window === 'undefined') {
      setDetailView('normal');
      return;
    }

    const key = `supervision-task-detail-view:${task.id}`;
    setDetailView(
      window.localStorage.getItem(key) === 'sheet' ? 'sheet' : 'normal',
    );
  }, [task?.id]);

  const changeDetailView = (next: 'normal' | 'sheet') => {
    setDetailView(next);
    if (!task || typeof window === 'undefined') return;
    window.localStorage.setItem(
      `supervision-task-detail-view:${task.id}`,
      next,
    );
  };

  const sheetSaveLabel =
    sheetSaveState === 'error'
      ? 'No se pudo cargar'
      : sheetSaveState === 'idle'
        ? 'Cargando...'
        : 'Solo lectura';

  const sheetSaveClass =
    sheetSaveState === 'error' ? 'text-rose-300' : 'text-white/[0.38]';

  return (
    <AnimatePresence>
      {task ? (
        <motion.div
          key={task.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/[0.62] p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 22, scale: 0.975, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 22, scale: 0.975, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="relative h-[88dvh] w-full max-w-[1120px] overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#17181b] text-white shadow-[0_30px_90px_rgba(0,0,0,.52)]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex min-h-[74px] items-center justify-between gap-4 border-b border-white/[0.07] bg-[#171719] px-6 py-3.5">
              <div className="min-w-0">
                <div className="text-[9px] font-medium uppercase tracking-[0.12em] text-white/[0.32]">
                  Supervisión · tarea de usuario
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.035] px-2.5 py-1 text-[10px] text-white/[0.48]">
                    <CalendarDays className="h-3 w-3 text-[#5ac8fa]" />
                    {new Date(task.scheduled_at).toLocaleString('es-AR', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.035] px-2.5 py-1 text-[10px] text-white/[0.52]">
                    <UserRound className="h-3 w-3" />
                    {task.owner_full_name ?? 'Sin nombre'}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${statusClass(task.status)}`}
                  >
                    {STATUS_LABEL[task.status]}
                  </span>
                  {task.recurrence_type ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#0a84ff]/10 px-2.5 py-1 text-[10px] text-[#5ac8fa]">
                      <Repeat2 className="h-3 w-3" />
                      Recurrente
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {detailView === 'sheet' ? (
                  <div
                    className={`hidden min-w-[88px] items-center justify-end gap-1.5 text-[10px] sm:inline-flex ${sheetSaveClass}`}
                  >
                    {sheetSaveState === 'idle' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    <span>{sheetSaveLabel}</span>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() =>
                    changeDetailView(detailView === 'sheet' ? 'normal' : 'sheet')
                  }
                  className={`inline-flex h-9 items-center gap-2 rounded-[11px] border px-3 text-[10px] font-medium transition ${
                    detailView === 'sheet'
                      ? 'border-[#0a84ff]/30 bg-[#0a84ff]/10 text-[#5ac8fa]'
                      : 'border-white/[0.08] bg-white/[0.035] text-white/[0.68] hover:bg-white/[0.06] hover:text-white/[0.90]'
                  }`}
                >
                  {detailView === 'sheet' ? (
                    <Columns3 className="h-3.5 w-3.5" />
                  ) : (
                    <Table2 className="h-3.5 w-3.5" />
                  )}
                  {detailView === 'sheet' ? 'Vista normal' : 'Modo tabla'}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-9 w-9 place-items-center rounded-[11px] border border-white/[0.07] bg-white/[0.035] text-white/[0.45] transition hover:bg-white/[0.07] hover:text-white"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {detailView === 'sheet' ? (
              <div className="h-[calc(88dvh-74px)] min-h-0 overflow-hidden bg-[#17181b]">
                <ProjectTaskSheetGrid
                  taskId={task.id}
                  currentUserId={currentUserId}
                  canEdit={false}
                  scope="personal"
                  onSaveStateChange={setSheetSaveState}
                />
              </div>
            ) : (
              <div className="grid h-[calc(88dvh-74px)] min-h-0 grid-cols-1 md:grid-cols-[0.84fr,1.16fr]">
                <aside className="min-h-0 overflow-y-auto border-b border-white/[0.07] p-5 md:border-b-0 md:border-r">
                  <div className="space-y-4">
                    <DetailBlock label="Título">
                      <p className="text-sm font-medium leading-5 text-white/[0.90]">
                        {task.title}
                      </p>
                    </DetailBlock>

                    <DetailBlock label="Descripción">
                      <p className="whitespace-pre-wrap text-[11px] leading-5 text-white/[0.58]">
                        {task.description?.trim() || 'Sin descripción registrada.'}
                      </p>
                    </DetailBlock>

                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
                      <DetailBlock label="Hora">
                        <div className="inline-flex items-center gap-2 text-[11px] text-white/[0.64]">
                          <Clock3 className="h-3.5 w-3.5 text-white/[0.30]" />
                          {new Date(task.scheduled_at).toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </DetailBlock>

                      <DetailBlock label="Repetición">
                        <div className="inline-flex items-center gap-2 text-[11px] text-white/[0.64]">
                          <Repeat2 className="h-3.5 w-3.5 text-[#5ac8fa]" />
                          {recurrenceLabel(task)}
                        </div>
                      </DetailBlock>
                    </div>

                    <DetailBlock label="Usuario">
                      <div className="text-[11px] font-medium text-white/[0.74]">
                        {task.owner_full_name ?? 'Sin nombre'}
                      </div>
                      <div className="mt-1 text-[10px] text-white/[0.32]">
                        {task.owner_role
                          ? task.owner_role.toUpperCase()
                          : 'Rol no informado'}
                      </div>
                    </DetailBlock>

                    <DetailBlock label="Sucursales / alcance">
                      <div className="flex flex-wrap gap-1.5">
                        {task.owner_branches?.length ? (
                          task.owner_branches.map((branch) => (
                            <span
                              key={branch}
                              className="rounded-[8px] bg-white/[0.045] px-2 py-1 text-[9px] text-white/[0.50]"
                            >
                              {branch.charAt(0).toUpperCase() + branch.slice(1)}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-white/[0.28]">
                            Sin sucursales asociadas.
                          </span>
                        )}
                      </div>
                    </DetailBlock>

                    {task.notes?.trim() ? (
                      <DetailBlock label="Nota breve">
                        <p className="whitespace-pre-wrap text-[11px] leading-5 text-white/[0.56]">
                          {task.notes}
                        </p>
                      </DetailBlock>
                    ) : null}

                    <div className="rounded-[14px] border border-[#0a84ff]/12 bg-[#0a84ff]/[0.045] px-3 py-2.5 text-[10px] leading-4 text-[#8bc7ff]/70">
                      Esta vista es de supervisión. Los datos del usuario, checklist,
                      comentarios y planilla se muestran sin habilitar modificaciones.
                    </div>
                  </div>
                </aside>

                <main className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[#151517]">
                  <div className="min-h-0">
                    <TaskChecklistSection
                      taskId={task.id}
                      notes={null}
                      editable={false}
                      variant="supervisor"
                      compact
                    />
                  </div>
                  <div className="min-h-0 overflow-hidden border-t border-white/[0.04]">
                    <TaskCommentsTimeline
                      taskId={task.id}
                      compact
                      readOnly
                    />
                  </div>
                </main>
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function DetailBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-white/[0.07] bg-white/[0.025] p-3.5">
      <div className="mb-2 text-[9px] font-medium uppercase tracking-[0.09em] text-white/[0.30]">
        {label}
      </div>
      {children}
    </section>
  );
}
