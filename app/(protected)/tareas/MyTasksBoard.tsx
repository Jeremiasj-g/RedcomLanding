'use client';

import 'react-day-picker/dist/style.css';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CalendarDays,
    Plus,
    CheckCircle2,
    Loader2,
    StickyNote,
    Trash2,
    Copy,
    Clock3,
} from 'lucide-react';
import {
    fetchMyTasksByRange,
    createTask,
    updateTaskStatus,
    updateTaskNotes,
    deleteTask,
    fetchTaskItems,
    createTaskItem,
    toggleTaskItem,
    deleteTaskItem,
    Task,
} from '@/lib/tasks';
import { addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    DayPicker,
    type DateRange as DayPickerDateRange,
    type DayModifiers,
} from 'react-day-picker';
import TaskChecklistSection from './TaskChecklistSection';

type TaskItem = {
    id: number;
    task_id: number;
    content: string;
    is_done: boolean;
    created_at: string;
};

const BRIEF_STATUS: Record<Task['status'], string> = {
    pending: 'Pendiente',
    in_progress: 'En progreso',
    done: 'Completada',
    cancelled: 'Cancelada',
};

type Props = {
    userId: string;
    range: {
        from: Date;
        to: Date;
    };
};

export default function MyTasksBoard({ userId, range }: Props) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    const [creating, setCreating] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        time: '09:00',
    });

    // rango de fechas para crear varias tareas (DayPicker)
    const [dateRange, setDateRange] = useState<DayPickerDateRange | undefined>(
        () => {
            const today = new Date();
            return { from: today, to: today };
        },
    );
    const [calendarOpen, setCalendarOpen] = useState(false);

    // selector de hora para nueva tarea
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

    const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
    const [savingNotes, setSavingNotes] = useState<number | null>(null);
    const [changingStatus, setChangingStatus] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // duplicar tarea
    const [duplicateOpenFor, setDuplicateOpenFor] = useState<number | null>(null);
    const [duplicateDraft, setDuplicateDraft] = useState<
        Record<number, { date: string; time: string }>
    >({});
    const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

    // popovers de duplicado (calendar + hora)
    const [dupCalendarOpenFor, setDupCalendarOpenFor] = useState<number | null>(
        null,
    );
    const [dupTimePickerOpenFor, setDupTimePickerOpenFor] = useState<
        number | null
    >(null);

    // eliminar todas las tareas de un día
    const [deletingDayKey, setDeletingDayKey] = useState<string | null>(null);

    // tarea seleccionada para la modal
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    // días del rango seleccionado (semana / mes / multi-semana)
    const daysInRange = useMemo(() => {
        const days: Date[] = [];
        let current = range.from;
        while (current <= range.to) {
            days.push(current);
            current = addDays(current, 1);
        }
        return days;
    }, [range]);

    // cargar tareas del usuario para el rango seleccionado
    useEffect(() => {
        if (!userId) return;

        const load = async () => {
            try {
                setLoading(true);
                const fromISO = range.from.toISOString();
                const toISO = range.to.toISOString();

                const data = await fetchMyTasksByRange(fromISO, toISO, userId);
                setTasks(data);
            } catch (err) {
                console.error('Error fetching tasks', err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [range.from, range.to, userId]);

    const tasksByDay = useMemo(() => {
        const map: Record<string, Task[]> = {};
        for (const day of daysInRange) {
            const key = day.toISOString().slice(0, 10);
            map[key] = [];
        }
        for (const task of tasks) {
            const key = task.scheduled_at.slice(0, 10);
            if (!map[key]) map[key] = [];
            map[key].push(task);
        }
        return map;
    }, [daysInRange, tasks]);

    // modifiers para pintar todo el rango de fechas (DayPicker de creación)
    const rangeModifiers: DayModifiers | undefined =
        dateRange?.from && dateRange.to
            ? {
                in_range: { from: dateRange.from, to: dateRange.to },
                range_start: dateRange.from,
                range_end: dateRange.to,
            }
            : undefined;

    // etiqueta del rango del DayPicker (solo para la NUEVA tarea)
    const rangeLabel = useMemo(() => {
        if (!dateRange?.from) return 'Seleccionar días';
        const fmt = (d: Date) =>
            d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
        if (!dateRange.to) return fmt(dateRange.from);
        return `${fmt(dateRange.from)} – ${fmt(dateRange.to)}`;
    }, [dateRange]);

    // etiqueta de hora
    const timeLabel = useMemo(
        () => newTask.time || 'Seleccionar hora',
        [newTask.time],
    );

    // crear 1 tarea por cada día del rango [from, to] del DayPicker
    const handleCreate = async () => {
        if (!newTask.title.trim() || !dateRange?.from || !newTask.time) return;

        const fromDate = dateRange.from;
        const toDate = dateRange.to ?? dateRange.from;

        const from = fromDate <= toDate ? fromDate : toDate;
        const to = fromDate <= toDate ? toDate : fromDate;

        const createdTasks: Task[] = [];
        try {
            setCreating(true);
            let current = new Date(from);

            while (current <= to) {
                const dateStr = current.toISOString().slice(0, 10);
                const dateTimeISO = new Date(
                    `${dateStr}T${newTask.time}:00`,
                ).toISOString();

                const created = await createTask({
                    title: newTask.title.trim(),
                    description: newTask.description.trim() || undefined,
                    scheduled_at: dateTimeISO,
                });

                createdTasks.push(created);
                current = addDays(current, 1);
            }

            setTasks((prev) => [...prev, ...createdTasks]);

            setNewTask((prev) => ({
                ...prev,
                title: '',
                description: '',
            }));
        } catch (err) {
            console.error('Error creating tasks', err);
        } finally {
            setCreating(false);
        }
    };

    // ciclo de estados (incluye cancelled)
    const nextStatus = (status: Task['status']): Task['status'] => {
        if (status === 'pending') return 'in_progress';
        if (status === 'in_progress') return 'done';
        if (status === 'done') return 'cancelled';
        if (status === 'cancelled') return 'pending';
        return 'pending';
    };

    const handleToggleStatus = async (task: Task) => {
        const newStatus = nextStatus(task.status);
        try {
            setChangingStatus(task.id);
            const updated = await updateTaskStatus(task.id, newStatus);
            setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
            setSelectedTask((prev) => (prev && prev.id === task.id ? updated : prev));
        } catch (err) {
            console.error('Error updating status', err);
        } finally {
            setChangingStatus(null);
        }
    };

    const handleSaveNotes = async (task: Task) => {
        const notes = notesDraft[task.id] ?? task.notes ?? '';
        try {
            setSavingNotes(task.id);
            const updated = await updateTaskNotes(task.id, notes);
            setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
            setSelectedTask((prev) => (prev && prev.id === task.id ? updated : prev));
        } catch (err) {
            console.error('Error saving notes', err);
        } finally {
            setSavingNotes(null);
        }
    };

    const handleDelete = async (task: Task) => {
        if (!confirm('¿Eliminar esta tarea?')) return;
        try {
            setDeletingId(task.id);
            await deleteTask(task.id);
            setTasks((prev) => prev.filter((t) => t.id !== task.id));
            setSelectedTask((prev) => (prev && prev.id === task.id ? null : prev));
        } catch (err) {
            console.error('Error deleting task', err);
        } finally {
            setDeletingId(null);
        }
    };

    // eliminar todas las tareas de un día
    const handleDeleteDay = async (dayKey: string) => {
        const dayTasks = tasksByDay[dayKey] ?? [];
        if (dayTasks.length === 0) return;

        if (
            !confirm(
                `¿Eliminar todas las ${dayTasks.length} tareas de este día? Esta acción no se puede deshacer.`,
            )
        )
            return;

        try {
            setDeletingDayKey(dayKey);
            await Promise.all(dayTasks.map((t) => deleteTask(t.id)));
            setTasks((prev) =>
                prev.filter((t) => t.scheduled_at.slice(0, 10) !== dayKey),
            );
            setSelectedTask(null);
        } catch (err) {
            console.error('Error deleting day tasks', err);
        } finally {
            setDeletingDayKey(null);
        }
    };

    // preparar valores por defecto de duplicado
    const openDuplicateForTask = (task: Task) => {
        const original = new Date(task.scheduled_at);
        const date = original.toISOString().slice(0, 10);
        const time = original.toTimeString().slice(0, 5); // hh:mm
        setDuplicateDraft((prev) => ({
            ...prev,
            [task.id]: { date, time },
        }));
        setDuplicateOpenFor((current) => (current === task.id ? null : task.id));
        setDupCalendarOpenFor(null);
        setDupTimePickerOpenFor(null);
    };

    const handleDuplicate = async (task: Task) => {
        const draft = duplicateDraft[task.id];
        if (!draft?.date || !draft?.time) return;

        try {
            setDuplicatingId(task.id);
            const dateTimeISO = new Date(
                `${draft.date}T${draft.time}:00`,
            ).toISOString();
            const created = await createTask({
                title: task.title,
                description: task.description ?? undefined,
                scheduled_at: dateTimeISO,
            });
            setTasks((prev) => [...prev, created]);
            setDuplicateOpenFor(null);
            setDupCalendarOpenFor(null);
            setDupTimePickerOpenFor(null);
        } catch (err) {
            console.error('Error duplicating task', err);
        } finally {
            setDuplicatingId(null);
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
        <>
            {/* Nueva tarea */}
            <section className="relative rounded-2xl border border-slate-800/80 bg-gray-900/95 p-4 shadow-lg shadow-slate-950/40">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
                    <Plus className="h-4 w-4 text-emerald-400" />
                    Nueva tarea
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,3.4fr)_auto]">
                    <input
                        className="w-full rounded-xl border border-slate-700/70 bg-gray-700/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        placeholder="Título (ej: Enviar reporte de ventas)"
                        value={newTask.title}
                        onChange={(e) =>
                            setNewTask((p) => ({ ...p, title: e.target.value }))
                        }
                    />
                    <input
                        className="w-full rounded-xl border border-slate-700/70 bg-gray-700/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        placeholder="Descripción / detalle"
                        value={newTask.description}
                        onChange={(e) =>
                            setNewTask((p) => ({ ...p, description: e.target.value }))
                        }
                    />

                    {/* selector de rango + hora (para NUEVAS tareas) */}
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
                                <span className="truncate text-xs text-slate-300">
                                    {rangeLabel}
                                </span>
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
                                        modifiers={rangeModifiers}
                                        modifiersClassNames={{
                                            selected: 'bg-sky-500 text-slate-900',
                                            range_start: 'rounded-l-full',
                                            range_end: 'rounded-r-full',
                                            in_range: 'bg-sky-500/30 text-slate-50',
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
                                                className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-[11px] ${newTask.time === t
                                                    ? 'bg-sky-500 text-slate-950'
                                                    : 'text-slate-100 hover:bg-slate-800'
                                                    }`}
                                            >
                                                <span>{t}</span>
                                                {newTask.time === t && (
                                                    <span className="text-[9px] font-semibold uppercase">
                                                        Seleccionado
                                                    </span>
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
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creando...
                            </>
                        ) : (
                            <>
                                <Plus className="mr-2 h-4 w-4" />
                                Agregar
                            </>
                        )}
                    </button>
                </div>
                <p className="mt-2 text-[11px] text-gray-400">
                    Tip: seleccioná un rango de días en el calendario (ej: lunes a
                    sábado) y una hora en el selector para crear la misma tarea en todos
                    esos días.
                </p>
            </section>

            {/* Calendario de tareas (usa el rango que viene del selector compartido) */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {daysInRange.map((day) => {
                    const key = day.toISOString().slice(0, 10);
                    const list = tasksByDay[key] || [];
                    const label = day.toLocaleDateString('es-AR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                    });
                    const isToday =
                        new Date().toISOString().slice(0, 10) ===
                        day.toISOString().slice(0, 10);

                    return (
                        <div
                            key={key}
                            className={`group flex min-h-[180px] flex-col rounded-2xl border border-slate-800/80 bg-gray-900/95 p-3 shadow-lg shadow-slate-950/40 ${isToday ? 'ring-1 ring-sky-500/60' : ''
                                }`}
                        >
                            <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-300">
                                <span className="uppercase tracking-wide">
                                    {label.replace('.', '')}
                                </span>
                                {isToday && (
                                    <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">
                                        Hoy
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 space-y-2">
                                {loading && list.length === 0 ? (
                                    <div className="flex h-full items-center justify-center text-xs text-slate-500">
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                        Cargando...
                                    </div>
                                ) : list.length === 0 ? (
                                    <div className="flex h-full items-center justify-center text-[11px] text-gray-400">
                                        Sin tareas
                                    </div>
                                ) : (
                                    <AnimatePresence initial={false}>
                                        {list.map((task) => {
                                            const dup = duplicateDraft[task.id];
                                            const dupDate =
                                                dup?.date &&
                                                    !Number.isNaN(new Date(dup.date).getTime())
                                                    ? new Date(dup.date)
                                                    : new Date(task.scheduled_at);
                                            const dupTime = dup?.time ?? '09:00';

                                            return (
                                                <motion.div
                                                    key={task.id}
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -6 }}
                                                    transition={{ duration: 0.16 }}
                                                    onClick={() => setSelectedTask(task)}
                                                    className="group cursor-pointer rounded-xl border border-slate-800 bg-gray-700/70 p-2 text-xs text-slate-100 shadow-sm shadow-slate-950/60 hover:border-sky-500/70 hover:bg-gray-700"
                                                >
                                                    <div className="mb-1 flex items-center justify-between gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleStatus(task);
                                                            }}
                                                            disabled={changingStatus === task.id}
                                                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${task.status === 'done'
                                                                ? 'bg-emerald-500/15 text-emerald-300'
                                                                : task.status === 'in_progress'
                                                                    ? 'bg-sky-500/15 text-sky-300'
                                                                    : task.status === 'cancelled'
                                                                        ? 'bg-rose-500/15 text-rose-300'
                                                                        : 'bg-slate-700/60 text-slate-200'
                                                                }`}
                                                        >
                                                            {changingStatus === task.id ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <CheckCircle2 className="h-3 w-3" />
                                                            )}
                                                            {BRIEF_STATUS[task.status]}
                                                        </button>
                                                        <span className="text-[10px] text-slate-400">
                                                            {new Date(
                                                                task.scheduled_at,
                                                            ).toLocaleTimeString('es-AR', {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] font-medium leading-tight">
                                                        {task.title}
                                                    </div>
                                                    {task.description && (
                                                        <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
                                                            {task.description}
                                                        </div>
                                                    )}

                                                    {/* Notas + acciones */}
                                                    <div
                                                        className="mt-2 flex items-center gap-1"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <StickyNote className="h-3 w-3 text-slate-500" />
                                                        <input
                                                            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                            placeholder="Notas / observaciones..."
                                                            value={notesDraft[task.id] ?? task.notes ?? ''}
                                                            onChange={(e) =>
                                                                setNotesDraft((prev) => ({
                                                                    ...prev,
                                                                    [task.id]: e.target.value,
                                                                }))
                                                            }
                                                        />
                                                        <button
                                                            onClick={() => handleSaveNotes(task)}
                                                            disabled={savingNotes === task.id}
                                                            className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-900"
                                                        >
                                                            {savingNotes === task.id
                                                                ? 'Guardando...'
                                                                : 'OK'}
                                                        </button>
                                                        {/* botón duplicar */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openDuplicateForTask(task);
                                                            }}
                                                            className="rounded-lg bg-slate-900/80 p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                                                        >
                                                            <Copy className="h-3 w-3" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(task);
                                                            }}
                                                            disabled={deletingId === task.id}
                                                            className="rounded-lg bg-slate-900/80 p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>

                                                    {/* Panel de duplicado */}
                                                    {duplicateOpenFor === task.id && (
                                                        <div
                                                            className="mt-2 rounded-lg border border-slate-800 bg-slate-950/80 p-2 text-[11px] text-slate-200"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <div className="mb-1 text-[10px] text-slate-400">
                                                                Duplicar tarea en otra fecha/hora
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {/* Fecha (DayPicker single) */}
                                                                <div className="relative flex-1 min-w-[140px]">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setDupCalendarOpenFor((prev) =>
                                                                                prev === task.id ? null : task.id,
                                                                            );
                                                                            setDupTimePickerOpenFor(null);
                                                                        }}
                                                                        className="flex w-full items-center justify-between rounded-xl border border-slate-700/70 bg-gray-700/70 px-3 py-1.5 text-left text-[11px] text-slate-100 hover:border-sky-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                                    >
                                                                        <span className="truncate">
                                                                            {dupDate.toLocaleDateString('es-AR', {
                                                                                day: '2-digit',
                                                                                month: 'short',
                                                                                year: 'numeric',
                                                                            })}
                                                                        </span>
                                                                        <CalendarDays className="ml-2 h-3 w-3 text-slate-400" />
                                                                    </button>

                                                                    {dupCalendarOpenFor === task.id && (
                                                                        <div className="absolute z-50 mt-2 w-max max-w-[90vw] rounded-2xl border border-slate-800 bg-slate-950/95 p-3 text-[11px] text-slate-100 shadow-xl shadow-slate-950/60">
                                                                            <DayPicker
                                                                                mode="single"
                                                                                selected={dupDate}
                                                                                onSelect={(date) => {
                                                                                    if (!date) return;
                                                                                    const dateStr =
                                                                                        date.toISOString().slice(0, 10);
                                                                                    setDuplicateDraft((prev) => ({
                                                                                        ...prev,
                                                                                        [task.id]: {
                                                                                            ...(prev[task.id] ?? {
                                                                                                time: dupTime,
                                                                                            }),
                                                                                            date: dateStr,
                                                                                        },
                                                                                    }));
                                                                                }}
                                                                                locale={es}
                                                                                weekStartsOn={1}
                                                                                numberOfMonths={1}
                                                                                showOutsideDays
                                                                                pagedNavigation
                                                                                modifiersClassNames={{
                                                                                    selected:
                                                                                        'bg-sky-500 text-slate-900 rounded-full',
                                                                                    today: 'border border-sky-400',
                                                                                }}
                                                                            />
                                                                            <div className="mt-2 flex justify-end">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        setDupCalendarOpenFor(null)
                                                                                    }
                                                                                    className="rounded-full bg-sky-500 px-3 py-1 text-[11px] font-medium text-slate-950 hover:bg-sky-400"
                                                                                >
                                                                                    Listo
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Hora */}
                                                                <div className="relative w-[110px]">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setDupTimePickerOpenFor((prev) =>
                                                                                prev === task.id ? null : task.id,
                                                                            );
                                                                            setDupCalendarOpenFor(null);
                                                                        }}
                                                                        className="flex w-full items-center justify-between rounded-xl border border-slate-700/70 bg-gray-700/70 px-3 py-1.5 text-left text-[11px] text-slate-100 hover:border-sky-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                                                    >
                                                                        <span>{dupTime}</span>
                                                                        <Clock3 className="ml-2 h-3 w-3 text-slate-400" />
                                                                    </button>

                                                                    {dupTimePickerOpenFor === task.id && (
                                                                        <div className="absolute right-0 z-50 mt-2 w-[170px] rounded-2xl border border-slate-800 bg-slate-950/95 p-2 text-xs text-slate-100 shadow-xl shadow-slate-950/60">
                                                                            <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
                                                                                <span>Seleccionar hora</span>
                                                                            </div>
                                                                            <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                                                                                {timeOptions.map((t) => (
                                                                                    <button
                                                                                        key={t}
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setDuplicateDraft((prev) => ({
                                                                                                ...prev,
                                                                                                [task.id]: {
                                                                                                    ...(prev[task.id] ?? {
                                                                                                        date: dupDate
                                                                                                            .toISOString()
                                                                                                            .slice(0, 10),
                                                                                                    }),
                                                                                                    time: t,
                                                                                                },
                                                                                            }));
                                                                                            setDupTimePickerOpenFor(null);
                                                                                        }}
                                                                                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-[11px] ${dupTime === t
                                                                                            ? 'bg-sky-500 text-slate-950'
                                                                                            : 'text-slate-100 hover:bg-slate-800'
                                                                                            }`}
                                                                                    >
                                                                                        <span>{t}</span>
                                                                                        {dupTime === t && (
                                                                                            <span className="text-[9px] font-semibold uppercase">
                                                                                                Seleccionado
                                                                                            </span>
                                                                                        )}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDuplicate(task);
                                                                    }}
                                                                    disabled={duplicatingId === task.id}
                                                                    className="inline-flex items-center rounded-lg bg-emerald-500/90 px-3 py-1 text-[11px] font-medium text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700/60"
                                                                >
                                                                    {duplicatingId === task.id ? (
                                                                        <>
                                                                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                                                            Duplicando...
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Copy className="mr-1 h-3 w-3" />
                                                                            Duplicar
                                                                        </>
                                                                    )}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDuplicateOpenFor(null);
                                                                        setDupCalendarOpenFor(null);
                                                                        setDupTimePickerOpenFor(null);
                                                                    }}
                                                                    className="rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                )}
                            </div>

                            {/* botón: eliminar todas las tareas del día */}
                            {list.length > 0 && (
                                <div className="mt-2 flex justify-end">
                                    <button
                                        onClick={() => handleDeleteDay(key)}
                                        disabled={deletingDayKey === key}
                                        className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 text-[10px] text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed"
                                    >
                                        {deletingDayKey === key ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-3 w-3" />
                                        )}
                                        <span>Eliminar día</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </section>

            {/* Modal de detalle */}
            <AnimatePresence>
                {selectedTask && (
                    <motion.div
                        key={selectedTask.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-md"
                        onClick={() => setSelectedTask(null)}
                    >
                        <motion.div
                            initial={{ y: 24, scale: 0.97, opacity: 0 }}
                            animate={{ y: 0, scale: 1, opacity: 1 }}
                            exit={{ y: 24, scale: 0.97, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-gray-800 text-slate-100 shadow-2xl shadow-slate-950/70"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5">
                                            <CalendarDays className="mr-1 h-3 w-3" />
                                            {new Date(
                                                selectedTask.scheduled_at,
                                            ).toLocaleString('es-AR', {
                                                weekday: 'short',
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                        <span className="text-[11px] text-slate-500">
                                            Estado: {BRIEF_STATUS[selectedTask.status]}
                                        </span>
                                    </div>
                                    <h2 className="pt-6 text-lg font-semibold leading-tight">
                                        {selectedTask.title}
                                    </h2>
                                    {selectedTask.description && (
                                        <p className="text-xs text-slate-400">
                                            {selectedTask.description}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setSelectedTask(null)}
                                    className="rounded-full bg-slate-900 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                                >
                                    Cerrar
                                </button>
                            </div>

                            <TaskChecklistSection
                                taskId={selectedTask.id}
                                notes={selectedTask.notes ?? null}
                                editable={true}
                                variant="owner"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
