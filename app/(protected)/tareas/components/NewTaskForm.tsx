'use client';

import 'react-day-picker/dist/style.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { CalendarDays, Clock3, Loader2, Plus } from 'lucide-react';
import { es } from 'date-fns/locale';

import { useTaskCreator } from '../hooks/useTaskCreator';
import { errorMessage, notify } from '@/lib/notifications';

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

  const m = v.match(/^(\d{1,2}):(\d{1,2})$/);
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
    return options.filter((t) => t.startsWith(`${hh}:`)).slice(0, 10);
  }

  const q2 = q.toLowerCase();
  return options.filter((t) => t.toLowerCase().includes(q2)).slice(0, 12);
}

export default function NewTaskForm() {
  const { createByRange } = useTaskCreator();
  const [creating, setCreating] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', time: '09:00' });

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: today, to: today };
  });

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  const calendarWrapRef = useRef<HTMLDivElement | null>(null);
  const timeWrapRef = useRef<HTMLDivElement | null>(null);

  const timeOptions = useMemo(() => buildTimeOptions(30), []);
  const [timeQuery, setTimeQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  // UX: cerrar al clickear afuera (calendar y hora)
  useEffect(() => {
    if (!calendarOpen && !timePickerOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (calendarOpen) {
        const cal = calendarWrapRef.current;
        if (cal && !cal.contains(target)) setCalendarOpen(false);
      }
      if (timePickerOpen) {
        const tp = timeWrapRef.current;
        if (tp && !tp.contains(target)) {
          setTimePickerOpen(false);
          setTimeQuery('');
        }
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [calendarOpen, timePickerOpen]);

  const suggestions = useMemo(() => {
    return timeSuggestions(timeQuery || newTask.time, timeOptions);
  }, [timeQuery, newTask.time, timeOptions]);

  const rangeLabel = useMemo(() => {
    if (!dateRange?.from) return 'Seleccionar días';
    const fmt = (d: Date) =>
      d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    if (!dateRange.to) return fmt(dateRange.from);
    return `${fmt(dateRange.from)} – ${fmt(dateRange.to)}`;
  }, [dateRange]);

  const timeLabel = useMemo(() => newTask.time || 'Seleccionar hora', [newTask.time]);

  const handleCreate = async () => {
    if (!newTask.title.trim() || !dateRange?.from || !newTask.time) return;
    const from = dateRange.from;
    const to = dateRange.to ?? dateRange.from;

    try {
      setCreating(true);
      const created = await createByRange({
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        time: newTask.time,
        from,
        to,
      });
      setNewTask((p) => ({ ...p, title: '', description: '' }));
      notify.success(
        created.length === 1
          ? 'Tarea creada correctamente.'
          : `${created.length} tareas creadas correctamente.`,
      );
    } catch (err) {
      console.error('Error creating tasks', err);
      notify.error(errorMessage(err, 'No se pudo crear la tarea.'));
    } finally {
      setCreating(false);
    }
  };

  const handleCalendarToday = () => {
    const today = new Date();
    setDateRange({ from: today, to: today });
  };

  const handleCalendarClear = () => {
    setDateRange(undefined);
  };

  return (
    <section className="relative rounded-[22px] border border-white/[0.08] bg-[#151517] p-4 shadow-[0_16px_45px_rgba(0,0,0,.14)]">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-medium text-white/[0.82]">
        <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-[#0a84ff]/10 text-[#5ac8fa]">
          <Plus className="h-3.5 w-3.5" />
        </span>
        Nueva tarea
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,3.4fr)_auto]">
        <input
          className="h-10 w-full rounded-[12px] border border-white/[0.08] bg-[#1c1c1e] px-3 text-[11px] font-normal text-white/[0.84] outline-none transition placeholder:text-white/[0.28] focus:border-[#0a84ff]/45 focus:ring-2 focus:ring-[#0a84ff]/10"
          placeholder="Título (ej: Enviar reporte de ventas)"
          value={newTask.title}
          onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
        />

        <input
          className="h-10 w-full rounded-[12px] border border-white/[0.08] bg-[#1c1c1e] px-3 text-[11px] font-normal text-white/[0.84] outline-none transition placeholder:text-white/[0.28] focus:border-[#0a84ff]/45 focus:ring-2 focus:ring-[#0a84ff]/10"
          placeholder="Descripción / detalle"
          value={newTask.description}
          onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
        />

        {/* selector de rango + hora */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Rango fechas */}
          <div ref={calendarWrapRef} className="relative flex-1">
            <button
              type="button"
              onClick={() => {
                setCalendarOpen((o) => !o);
                setTimePickerOpen(false);
              }}
              className="flex h-10 w-full items-center justify-between rounded-[12px] border border-white/[0.08] bg-[#1c1c1e] px-3 text-left text-[11px] font-normal text-white/[0.80] outline-none transition hover:border-white/[0.14] focus:border-[#0a84ff]/45 focus:ring-2 focus:ring-[#0a84ff]/10"
            >
              <span className="truncate text-[11px] text-white/[0.64]">{rangeLabel}</span>
              <CalendarDays className="ml-2 h-4 w-4 text-white/[0.32]" />
            </button>

            {calendarOpen && (
              <div className="absolute z-50 mt-2 w-[320px] max-w-[90vw] rounded-[18px] border border-white/[0.09] bg-[#242426] p-3 text-xs text-white/[0.82] shadow-[0_24px_70px_rgba(0,0,0,.48)]">
                <DayPicker
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  locale={es}
                  weekStartsOn={1}
                  numberOfMonths={1}
                  showOutsideDays
                  pagedNavigation
                  modifiersClassNames={{
                    selected: 'bg-[#0a84ff] text-white',
                    range_start: 'bg-[#0a84ff] text-white rounded-l-full',
                    range_end: 'bg-[#0a84ff] text-white rounded-r-full',
                    range_middle: 'bg-[#0a84ff]/18 text-white',
                    today: 'border border-[#5ac8fa]',
                  }}
                />

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex gap-1 text-[10px] text-white/[0.38]">
                    <button
                      type="button"
                      onClick={handleCalendarClear}
                      className="rounded-[8px] px-2 py-1 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={handleCalendarToday}
                      className="rounded-[8px] px-2 py-1 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      Hoy
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCalendarOpen(false)}
                    className="rounded-[9px] bg-[#0a84ff] px-3 py-1.5 text-[10px] font-medium text-white transition hover:bg-[#409cff]"
                  >
                    Listo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Selector de hora */}
          <div ref={timeWrapRef} className="relative w-full sm:w-[140px]">
            <button
              type="button"
              onClick={() => {
                setTimePickerOpen((o) => !o);
                setCalendarOpen(false);
                setTimeQuery('');
                setActiveIdx(0);
              }}
              className="flex h-10 w-full items-center justify-between rounded-[12px] border border-white/[0.08] bg-[#1c1c1e] px-3 text-left text-[11px] font-normal text-white/[0.80] outline-none transition hover:border-white/[0.14] focus:border-[#0a84ff]/45 focus:ring-2 focus:ring-[#0a84ff]/10"
            >
              <span className="text-[11px] text-white/[0.64]">{timeLabel}</span>
              <Clock3 className="ml-2 h-4 w-4 text-white/[0.32]" />
            </button>

            {timePickerOpen && (
              <div className="absolute right-0 z-50 mt-2 w-[240px] max-w-[85vw] rounded-[18px] border border-white/[0.09] bg-[#242426] p-2 text-xs text-white/[0.82] shadow-[0_24px_70px_rgba(0,0,0,.48)]">
                <div className="px-1 pb-2">
                  <div className="mb-1 flex items-center justify-between text-[10px] text-white/[0.38]">
                    <span>Hora</span>
                    <span className="text-slate-500">Ej: 13 → 13:00 / 13:30</span>
                  </div>
                  <input
                    autoFocus
                    value={timeQuery || newTask.time}
                    inputMode="numeric"
                    onChange={(e) => {
                      const raw = e.target.value;
                      setTimeQuery(raw);
                      setActiveIdx(0);
                      setNewTask((p) => ({ ...p, time: raw }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setTimePickerOpen(false);
                        setTimeQuery('');
                        return;
                      }
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
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
                        const pick = suggestions[activeIdx];
                        if (pick) {
                          setNewTask((p) => ({ ...p, time: pick }));
                          setTimePickerOpen(false);
                          setTimeQuery('');
                          return;
                        }
                        const n = normalizeTimeInput(timeQuery || newTask.time);
                        if (n) setNewTask((p) => ({ ...p, time: n }));
                        setTimePickerOpen(false);
                        setTimeQuery('');
                      }
                    }}
                    onBlur={() => {
                      const n = normalizeTimeInput(timeQuery || newTask.time);
                      if (n) setNewTask((p) => ({ ...p, time: n }));
                      // no cierres instantáneo: si el usuario clickea una opción, usamos onMouseDown
                      setTimeout(() => {
                        setTimePickerOpen(false);
                        setTimeQuery('');
                      }, 120);
                    }}
                    placeholder="Ej: 13 o 13:30"
                    className="h-9 w-full rounded-[10px] border border-white/[0.08] bg-[#1c1c1e] px-3 text-[11px] text-white/[0.84] outline-none placeholder:text-white/[0.28] focus:border-[#0a84ff]/45 focus:ring-2 focus:ring-[#0a84ff]/10"
                  />
                </div>

                <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                  {suggestions.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-slate-400">No hay coincidencias.</div>
                  ) : (
                    suggestions.map((t, idx) => {
                      const active = idx === activeIdx;
                      const selected = normalizeTimeInput(newTask.time) === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setNewTask((p) => ({ ...p, time: t }));
                            setTimePickerOpen(false);
                            setTimeQuery('');
                          }}
                          onMouseEnter={() => setActiveIdx(idx)}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[11px] transition ${
                            active
                              ? 'bg-white/[0.08] text-white'
                              : 'text-white/[0.62] hover:bg-white/[0.05]'
                          }`}
                        >
                          <span>{t}</span>
                          {selected ? (
                            <span className="text-[9px] font-medium uppercase text-[#5ac8fa]">OK</span>
                          ) : (
                            <span className="h-4 w-4" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating || !newTask.title.trim() || !dateRange?.from}
          className="inline-flex h-10 items-center justify-center rounded-[12px] bg-white px-4 text-[11px] font-medium text-[#0b1020] shadow-sm transition hover:bg-white/[0.90] disabled:cursor-not-allowed disabled:opacity-35"
        >
          {creating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" /> Agregar
            </>
          )}
        </button>
      </div>

      <p className="mt-3 text-[10px] font-normal text-white/[0.34]">
        Tip: seleccioná un rango de días y una hora para crear la misma tarea en todos esos días.
      </p>
    </section>
  );
}
