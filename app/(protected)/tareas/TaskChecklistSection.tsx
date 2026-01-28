'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, StickyNote, Trash2, CheckCircle2 } from 'lucide-react';
import { fetchTaskItems, createTaskItem, toggleTaskItem, deleteTaskItem } from '@/lib/tasks';

type TaskItem = {
  id: number;
  task_id: number;
  content: string;
  is_done: boolean;
  created_at: string;
};

type Variant = 'owner' | 'supervisor';

const TEXTS: Record<
  Variant,
  { title: string; subtitle: string; tip: string }
> = {
  owner: {
    title: 'Items • acciones realizadas',
    subtitle: 'Registrá pasos concretos: pruebas, correcciones, llamadas, etc.',
    tip: 'Tip: este checklist te sirve como historial de qué hiciste para cumplir la tarea.',
  },
  supervisor: {
    title: 'Items • acciones realizadas',
    subtitle: 'Checklist creado por el supervisor. Solo lectura.',
    tip: 'Tip: este detalle te ayuda a ver qué acciones concretas hizo el supervisor para cumplir la tarea.',
  },
};

type Props = {
  taskId: number;
  notes: string | null;
  /** si false → sólo lectura (modo supervisores) */
  editable: boolean;
  /** para cambiar textos según contexto */
  variant: Variant;
  /** callback para avisar cuando el checklist queda 100% completo (o deja de estarlo) */
  onAllDoneChange?: (allDone: boolean, stats: { done: number; total: number }) => void;
};

export default function TaskChecklistSection({
  taskId,
  notes,
  editable,
  variant,
  onAllDoneChange,
}: Props) {
  const [items, setItems] = useState<TaskItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [loadingItems, setLoadingItems] = useState(true);
  const [savingItem, setSavingItem] = useState(false);

  // Mantener el flujo “escribir → Enter → escribir → Enter” sin tocar el mouse.
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { title, subtitle, tip } = TEXTS[variant];
  const lastAllDoneRef = useRef<boolean | null>(null);

  const doneCount = items.filter((i) => i.is_done).length;
  const totalCount = items.length;
  const allDone = totalCount > 0 && doneCount === totalCount;

  useEffect(() => {
    if (!onAllDoneChange) return;
    // evitamos spamear el callback: solo cuando cambia el estado allDone
    if (lastAllDoneRef.current === allDone) return;
    lastAllDoneRef.current = allDone;
    onAllDoneChange(allDone, { done: doneCount, total: totalCount });
  }, [allDone, doneCount, totalCount, onAllDoneChange]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoadingItems(true);
        const data = await fetchTaskItems(taskId);
        if (!cancelled) setItems(data);
      } catch (err) {
        console.error('Error fetching task items', err);
      } finally {
        if (!cancelled) setLoadingItems(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const handleAddItem = async () => {
    if (!editable || !newItem.trim()) return;
    try {
      setSavingItem(true);
      const created = await createTaskItem(taskId, newItem.trim());
      setItems((prev) => [...prev, created]);
      setNewItem('');

      // Volver a enfocar el input para seguir cargando ítems.
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch (err) {
      console.error('Error creating item', err);
    } finally {
      setSavingItem(false);
    }
  };

  const handleToggleItem = async (item: TaskItem) => {
    if (!editable) return;
    try {
      const updated = await toggleTaskItem(item.id, !item.is_done);
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? updated : it)),
      );
    } catch (err) {
      console.error('Error toggling item', err);
    }
  };

  const handleDeleteItem = async (item: TaskItem) => {
    if (!editable) return;
    if (!confirm('¿Eliminar este ítem?')) return;
    try {
      await deleteTaskItem(item.id);
      setItems((prev) => prev.filter((it) => it.id !== item.id));
    } catch (err) {
      console.error('Error deleting item', err);
    }
  };

  return (
    <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
      {/* notas breves si existen */}
      {notes && notes.trim().length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-200">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-slate-400">
            <StickyNote className="h-3 w-3" />
            {variant === 'owner' ? 'Nota breve guardada' : 'Nota breve'}
          </div>
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed">
            {notes}
          </p>
        </div>
      )}

      {/* checklist / items */}
      <section className="rounded-xl border border-slate-800">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-slate-100">{title}</h3>
            <p className="text-[11px] text-slate-400">{subtitle}</p>
          </div>
        </div>

        {/* input nuevo item (solo si se puede editar) */}
        {editable && (
          <div className="mb-3 flex gap-2">
            <input
              ref={inputRef}
              className="flex-1 rounded-lg border border-slate-700/70 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="Ej: Revisé línea de obj. fiambres 214 y FRS..."
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                // Enter agrega; Shift+Enter no aplica porque el input es una línea
                e.preventDefault();
                if (!savingItem) handleAddItem();
              }}
            />
            <button
              onClick={handleAddItem}
              disabled={savingItem || !newItem.trim()}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700/60"
            >
              {savingItem ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        )}

        {/* lista items */}
        {loadingItems ? (
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Cargando items...
          </div>
        ) : items.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            {editable
              ? 'Todavía no registraste ninguna acción para esta tarea.'
              : 'No hay ítems registrados para esta tarea.'}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-2 rounded-lg border border-slate-800/70 bg-slate-950/70 px-2 py-1.5"
              >
                <button
                  disabled={!editable}
                  onClick={
                    editable ? () => handleToggleItem(item) : undefined
                  }
                  className={`mt-[2px] flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] ${
                    item.is_done
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                      : 'border-slate-600 bg-slate-900 text-slate-400'
                  } ${!editable ? 'cursor-default opacity-80' : ''}`}
                >
                  {item.is_done && <CheckCircle2 className="h-3 w-3" />}
                </button>
                <div className="flex-1 text-[11px] leading-snug text-slate-200">
                  <p
                    className={
                      item.is_done ? 'font-bold text-slate-500' : ''
                    }
                  >
                    {item.content}
                  </p>
                  <span className="mt-0.5 block text-[10px] text-slate-500">
                    {new Date(item.created_at).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {editable && (
                  <button
                    onClick={() => handleDeleteItem(item)}
                    className="mt-[2px] rounded bg-slate-900/80 p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="text-[11px] text-slate-500">{tip}</div>
    </div>
  );
}
