'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Check, Clock, Loader2, Pencil, Repeat2, Save, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Task, TaskRecurrenceType } from '@/lib/tasks';
import { supabase } from '@/lib/supabaseClient';
import { errorMessage, notify } from '@/lib/notifications';

import TaskChecklistSection from '../TaskChecklistSection';
import TaskCommentsTimeline from './TaskCommentsTimeline';
import { buildISOFromLocal, toYMD } from '../date';

// shadcn/ui
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RedcomSelect } from '@/components/ui/redcom-select';


type Props = {
  task: Task | null;
  briefStatusLabel: (status: Task['status']) => string;
  onClose: () => void;
  onTaskUpdate: (next: Task) => void;
  onAllDone: (task: Task) => Promise<Task>;
};

function hhmmLocal(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function buildTimeOptions(stepMinutes = 30) {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += stepMinutes) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return out;
}

function normalizeTimeInput(raw: string) {
  const v = (raw ?? '').trim();
  if (!v) return '';

  const m = v.match(/^([0-9]{1,2}):([0-9]{1,2})$/);
  if (m) {
    const hh = Math.min(23, Math.max(0, Number(m[1])));
    const mm = Math.min(59, Math.max(0, Number(m[2])));
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  const digits = v.replace(/[^0-9]/g, '');
  if (!digits) return '';

  if (digits.length <= 2) {
    const hh = Math.min(23, Math.max(0, Number(digits)));
    return `${String(hh).padStart(2, '0')}:00`;
  }

  const hh = Math.min(23, Math.max(0, Number(digits.slice(0, 2))));
  const mm = Math.min(59, Math.max(0, Number(digits.slice(2, 4))));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function timeSuggestions(query: string, options: string[]) {
  const q = (query ?? '').trim();
  if (!q) return options.slice(0, 12);

  const digits = q.replace(/[^0-9]/g, '');
  if ((digits.length === 1 || digits.length === 2) && !q.includes(':')) {
    const hh = String(Math.min(23, Math.max(0, Number(digits)))).padStart(2, '0');
    // 13 -> 13:00, 13:30...
    return options.filter((t) => t.startsWith(`${hh}:`)).slice(0, 10);
  }

  const q2 = q.toLowerCase();
  return options.filter((t) => t.toLowerCase().includes(q2)).slice(0, 12);
}

function TimePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const options = useMemo(() => buildTimeOptions(30), []);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  const suggestions = useMemo(() => {
    const list = timeSuggestions(query || value, options);
    return list;
  }, [query, value, options]);

  // cerrar al clickear afuera (más estable que popover)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const commitNormalize = () => {
    const n = normalizeTimeInput(value);
    if (n) onChange(n);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          inputMode="numeric"
          disabled={disabled}
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setActiveIdx(0);
          }}
          onChange={(e) => {
            if (disabled) return;
            const raw = e.target.value;
            onChange(raw); // permite tipear 13
            setQuery(raw);
            setOpen(true);
            setActiveIdx(0);
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === 'Escape') {
              setOpen(false);
              setQuery('');
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActiveIdx((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIdx((i) => Math.max(0, i - 1));
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              if (open && suggestions[activeIdx]) {
                onChange(suggestions[activeIdx]);
                setOpen(false);
                setQuery('');
                return;
              }
              commitNormalize();
              setOpen(false);
              setQuery('');
            }
          }}
          onBlur={() => {
            if (disabled) return;
            // normaliza sin cerrar abrupto (si el usuario clickea una opción usamos onMouseDown)
            commitNormalize();
            setTimeout(() => {
              setOpen(false);
              setQuery('');
            }, 120);
          }}
          placeholder="Ej: 13 ó 13:30"
          className="h-10 rounded-[12px] border-white/[0.08] bg-[#1c1c1e] pr-9 text-[11px] font-normal text-white/[0.82] placeholder:text-white/[0.26] focus-visible:border-[#0a84ff]/45 focus-visible:ring-2 focus-visible:ring-[#0a84ff]/10"
        />
        <Clock className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-white/[0.32]" />
      </div>

      {open && !disabled && (
        <div className="absolute z-[90] mt-2 w-full overflow-hidden rounded-[14px] border border-white/[0.09] bg-[#242426] shadow-[0_24px_70px_rgba(0,0,0,.45)] backdrop-blur">
          <div className="max-h-56 overflow-auto p-1">
            {suggestions.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-white/[0.38]">No hay coincidencias.</div>
            ) : (
              suggestions.map((t, idx) => {
                const active = idx === activeIdx;
                const selected = value === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onMouseDown={(e) => {
                      // evita que el blur cierre el dropdown antes de seleccionar
                      e.preventDefault();
                      onChange(t);
                      setOpen(false);
                      setQuery('');
                    }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                      active ? 'bg-white/[0.08] text-white' : 'text-white/[0.62] hover:bg-white/[0.05]'
                    }`}
                  >
                    <span>{t}</span>
                    {selected ? <Check className="h-4 w-4 text-[#5ac8fa]" /> : <span className="h-4 w-4" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TaskDetailModal({
  task,
  briefStatusLabel,
  onClose,
  onTaskUpdate,
  onAllDone,
}: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('09:00');
  const [recurrence, setRecurrence] = useState<'none' | TaskRecurrenceType>('none');
  const [recurrenceIntervalDays, setRecurrenceIntervalDays] = useState(15);

  const [editTitle, setEditTitle] = useState(false);
  const [editDescription, setEditDescription] = useState(false);
  const [editTime, setEditTime] = useState(false);

  const titleRef = useRef<HTMLInputElement | null>(null);
  const descRef = useRef<HTMLTextAreaElement | null>(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title ?? '');
    setDescription(task.description ?? '');
    setTime(hhmmLocal(task.scheduled_at));
    setRecurrence(task.recurrence_type ?? 'none');
    setRecurrenceIntervalDays(task.recurrence_interval_days ?? 15);
    setEditTitle(false);
    setEditDescription(false);
    setEditTime(false);
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dateLabel = useMemo(() => {
    if (!task) return '';
    return new Date(task.scheduled_at).toLocaleString('es-AR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [task?.scheduled_at]);

  const hasChanges = useMemo(() => {
    if (!task) return false;
    const originalTitle = task.title ?? '';
    const originalDesc = task.description ?? '';
    const originalTime = hhmmLocal(task.scheduled_at);
    return (
      title.trim() !== originalTitle.trim() ||
      (description ?? '').trim() !== originalDesc.trim() ||
      normalizeTimeInput(time) !== normalizeTimeInput(originalTime) ||
      recurrence !== (task.recurrence_type ?? 'none') ||
      (recurrence === 'every_n_days' &&
        recurrenceIntervalDays !== (task.recurrence_interval_days ?? 15))
    );
  }, [task, title, description, time, recurrence, recurrenceIntervalDays]);

  async function saveEdits() {
    if (!task) return;
    const nextTitle = title.trim();
    if (!nextTitle) return;

    const normalizedTime = normalizeTimeInput(time);
    if (!normalizedTime || !/^\d{2}:\d{2}$/.test(normalizedTime)) {
      notify.warning('Hora inválida. Ejemplo válido: 13:00 ó 09:30.');
      return;
    }

    try {
      setSaving(true);

      const dayYMD = toYMD(new Date(task.scheduled_at));
      const nextScheduledAt = buildISOFromLocal(dayYMD, normalizedTime);

      const patch: any = {
        title: nextTitle,
        description: description?.trim() ? description.trim() : null,
        scheduled_at: nextScheduledAt,
        recurrence_type: recurrence === 'none' ? null : recurrence,
        recurrence_interval_days:
          recurrence === 'every_n_days' ? recurrenceIntervalDays : null,
        recurrence_series_id:
          recurrence === 'none'
            ? null
            : (task.recurrence_series_id ?? crypto.randomUUID()),
      };

      const { data, error } = await supabase
        .from('tasks')
        .update(patch)
        .eq('id', task.id)
        .select('*')
        .single();

      if (error) throw error;

      onTaskUpdate(data as Task);
      setEditTitle(false);
      setEditDescription(false);
      setEditTime(false);
      notify.success('Tarea guardada correctamente.');
    } catch (err) {
      console.error('Error al editar tarea', err);
      notify.error(errorMessage(err, 'No se pudo guardar la tarea. Intentá nuevamente.'));
    } finally {
      setSaving(false);
    }
  }

  const toggleEditTitle = () => {
    setEditTitle((v) => !v);
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  const toggleEditDesc = () => {
    setEditDescription((v) => !v);
    requestAnimationFrame(() => descRef.current?.focus());
  };

  const toggleEditTime = () => {
    setEditTime((v) => !v);
  };

  return (
    <AnimatePresence>
      {task && (
        <motion.div
          key={task.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/[0.58] p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="relative h-[88dvh] w-full max-w-[1120px] overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#17181b] text-white shadow-[0_28px_90px_rgba(0,0,0,.48)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-6 py-4">
              <div className="min-w-0">
                <div className="text-[9px] font-medium uppercase tracking-[0.12em] text-white/[0.34]">
                  Tarea personal
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-normal text-white/[0.48]">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.035] px-2.5 py-1">
                    <CalendarDays className="h-3 w-3 text-[#5ac8fa]" />
                    {dateLabel}
                  </span>
                  <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2.5 py-1">
                    {briefStatusLabel(task.status)}
                  </span>
                  {task.recurrence_type ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#0a84ff]/15 bg-[#0a84ff]/10 px-2.5 py-1 text-[#5ac8fa]">
                      <Repeat2 className="h-3 w-3" />
                      Recurrente
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-[11px] border border-white/[0.07] bg-white/[0.035] text-white/[0.48] transition hover:bg-white/[0.07] hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body: izquierda edición | derecha checklist */}
            <div className="grid h-[calc(88dvh-73px)] min-h-0 grid-cols-1 md:grid-cols-[0.92fr,1.08fr]">
              {/* Left */}
              <div className="min-h-0 overflow-y-auto border-b border-white/[0.07] p-6 md:border-b-0 md:border-r">
                <div className="space-y-5">
                  {/* Título */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.42]">Título</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={toggleEditTitle}
                        className="h-8 w-8 rounded-[9px] border border-white/[0.07] bg-white/[0.035] text-white/[0.42] transition hover:bg-white/[0.07] hover:text-white"
                        title={editTitle ? 'Bloquear edición' : 'Editar título'}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      ref={titleRef}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={!editTitle}
                      className="h-10 rounded-[12px] border-white/[0.08] bg-[#1c1c1e] text-[11px] font-normal text-white/[0.82] disabled:cursor-default disabled:opacity-100 focus-visible:border-[#0a84ff]/45 focus-visible:ring-2 focus-visible:ring-[#0a84ff]/10"
                    />
                    {!editTitle && (
                      <p className="text-[10px] font-normal text-white/[0.30]">
                        Tocá el lápiz para habilitar edición.
                      </p>
                    )}
                  </div>

                  {/* Descripción */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.42]">Descripción</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={toggleEditDesc}
                        className="h-8 w-8 rounded-[9px] border border-white/[0.07] bg-white/[0.035] text-white/[0.42] transition hover:bg-white/[0.07] hover:text-white"
                        title={editDescription ? 'Bloquear edición' : 'Editar descripción'}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      ref={descRef}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={!editDescription}
                      className="min-h-[135px] resize-none rounded-[12px] border-white/[0.08] bg-[#1c1c1e] text-[11px] font-normal leading-5 text-white/[0.82] disabled:cursor-default disabled:opacity-100 focus-visible:border-[#0a84ff]/45 focus-visible:ring-2 focus-visible:ring-[#0a84ff]/10"
                    />
                  </div>

                  {/* Hora */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.42]">Hora</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={toggleEditTime}
                        className="h-8 w-8 rounded-[9px] border border-white/[0.07] bg-white/[0.035] text-white/[0.42] transition hover:bg-white/[0.07] hover:text-white"
                        title={editTime ? 'Bloquear edición' : 'Editar hora'}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>

                    <TimePicker value={time} onChange={setTime} disabled={!editTime} />
                    <p className="text-[10px] font-normal text-white/[0.30]">
                      Escribí “13” y te sugiere <span className="text-white/[0.64]">13:00</span>,{' '}
                      <span className="text-white/[0.64]">13:30</span>, etc. (Enter autocompleta).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-white/[0.42]">
                        <Repeat2 className="h-3.5 w-3.5 text-[#5ac8fa]" />
                        Repetición
                      </Label>
                    </div>

                    <RedcomSelect
                      value={recurrence}
                      onValueChange={(value) =>
                        setRecurrence(value as 'none' | TaskRecurrenceType)
                      }
                      surface="dark"
                      options={[
                        { value: 'none', label: 'No repetir' },
                        { value: 'daily', label: 'Todos los días' },
                        { value: 'weekly', label: 'Semanal · mismo día' },
                        { value: 'first_business_day_month', label: 'Primer día hábil del mes' },
                        { value: 'every_n_days', label: 'Cada cierta cantidad de días' },
                      ]}
                      aria-label="Frecuencia de repetición"
                      className="h-10 rounded-[12px] text-[11px]"
                    />

                    {recurrence === 'every_n_days' ? (
                      <label className="flex items-center gap-2 text-[10px] text-white/[0.40]">
                        Repetir cada
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={recurrenceIntervalDays}
                          onChange={(e) =>
                            setRecurrenceIntervalDays(
                              Math.max(1, Number(e.target.value || 1)),
                            )
                          }
                          className="h-9 w-20 rounded-[10px] border border-white/[0.08] bg-[#1c1c1e] px-2 text-center text-[11px] text-white/[0.82] outline-none focus:border-[#0a84ff]/45 focus:ring-2 focus:ring-[#0a84ff]/10"
                        />
                        días
                      </label>
                    ) : null}

                    <p className="text-[10px] leading-4 text-white/[0.30]">
                      La próxima instancia se crea únicamente cuando esta tarea se marca como completada.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      onClick={saveEdits}
                      disabled={saving || !title.trim() || !hasChanges}
                      className="h-10 rounded-[12px] bg-white px-4 text-[11px] font-medium text-[#0b1020] shadow-none transition hover:bg-white/[0.90] disabled:opacity-30"
                    >
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Guardar cambios
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right */}
              <div className="min-h-0 overflow-y-auto bg-[#151517]">
                <TaskChecklistSection
                  taskId={task.id}
                  notes={task.notes ?? null}
                  editable={true}
                  variant="owner"
                  onAllDoneChange={async (allDone) => {
                    if (!allDone) return;
                    const updated = await onAllDone(task);
                    onTaskUpdate(updated);
                  }}
                />
                <TaskCommentsTimeline taskId={task.id} />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
