'use client';

import 'react-day-picker/dist/style.css';
import { useMemo, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { CalendarDays, Clock3, Loader2, Plus } from 'lucide-react';
import { es } from 'date-fns/locale';

import { useTaskCreator } from '../hooks/useTaskCreator';

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

  const timeOptions = useMemo(
    () =>
      Array.from({ length: 24 * 2 }, (_, i) => {
        const h = String(Math.floor(i / 2)).padStart(2, '0');
        const m = i % 2 === 0 ? '00' : '30';
        return `${h}:${m}`;
      }),
    [],
  );

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
      await createByRange({
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        time: newTask.time,
        from,
        to,
      });
      setNewTask((p) => ({ ...p, title: '', description: '' }));
    } catch (err) {
      console.error('Error creating tasks', err);
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
    <section className="relative rounded-2xl border border-slate-800/80 bg-gray-900/95 p-4 shadow-lg shadow-slate-950/40">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
        <Plus className="h-4 w-4 text-emerald-400" /> Nueva tarea
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,3.4fr)_auto]">
        <input
          className="w-full rounded-xl border border-slate-700/70 bg-gray-700/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          placeholder="Título (ej: Enviar reporte de ventas)"
          value={newTask.title}
          onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
        />

        <input
          className="w-full rounded-xl border border-slate-700/70 bg-gray-700/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          placeholder="Descripción / detalle"
          value={newTask.description}
          onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
        />

        {/* selector de rango + hora */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Rango fechas */}
          <div className="relative flex-1">
            <button
              type="button"
              onClick={() => {
                setCalendarOpen((o) => !o);
                setTimePickerOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-xl border border-slate-700/70 bg-gray-700/70 px-3 py-2 text-left text-sm text-slate-100 hover:border-sky-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <span className="truncate text-xs text-slate-300">{rangeLabel}</span>
              <CalendarDays className="ml-2 h-4 w-4 text-slate-400" />
            </button>

            {calendarOpen && (
              <div className="absolute z-50 mt-2 w-[320px] max-w-[90vw] rounded-2xl border border-slate-800 bg-slate-950/95 p-3 text-xs text-slate-100 shadow-xl shadow-slate-950/60">
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
                    selected: 'bg-sky-500 text-slate-950',
                    range_start: 'bg-sky-500 text-slate-950 rounded-l-full',
                    range_end: 'bg-sky-500 text-slate-950 rounded-r-full',
                    range_middle: 'bg-sky-500/25 text-slate-50',
                    today: 'border border-sky-400',
                  }}
                />

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex gap-1 text-[10px] text-slate-400">
                    <button
                      type="button"
                      onClick={handleCalendarClear}
                      className="rounded-full px-2 py-1 hover:bg-slate-900"
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={handleCalendarToday}
                      className="rounded-full px-2 py-1 hover:bg-slate-900"
                    >
                      Hoy
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCalendarOpen(false)}
                    className="rounded-full bg-sky-500 px-3 py-1 text-[11px] font-medium text-slate-950 hover:bg-sky-400"
                  >
                    Listo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Selector de hora */}
          <div className="relative w-full sm:w-[140px]">
            <button
              type="button"
              onClick={() => {
                setTimePickerOpen((o) => !o);
                setCalendarOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-xl border border-slate-700/70 bg-gray-700/70 px-3 py-2 text-left text-sm text-slate-100 hover:border-sky-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <span className="text-xs text-slate-300">{timeLabel}</span>
              <Clock3 className="ml-2 h-4 w-4 text-slate-400" />
            </button>

            {timePickerOpen && (
              <div className="absolute right-0 z-50 mt-2 w-[180px] rounded-2xl border border-slate-800 bg-slate-950/95 p-2 text-xs text-slate-100 shadow-xl shadow-slate-950/60">
                <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Seleccionar hora</span>
                </div>
                <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                  {timeOptions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setNewTask((prev) => ({ ...prev, time: t }));
                        setTimePickerOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-[11px] ${
                        newTask.time === t
                          ? 'bg-sky-500 text-slate-950'
                          : 'text-slate-100 hover:bg-slate-800'
                      }`}
                    >
                      <span>{t}</span>
                      {newTask.time === t && (
                        <span className="text-[9px] font-semibold uppercase">Seleccionado</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating || !newTask.title.trim() || !dateRange?.from}
          className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 shadow-md shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700/60"
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

      <p className="mt-2 text-[11px] text-gray-400">
        Tip: seleccioná un rango de días y una hora para crear la misma tarea en todos esos días.
      </p>
    </section>
  );
}
