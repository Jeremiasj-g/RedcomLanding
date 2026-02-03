'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Loader2,
  StickyNote,
  Trash2,
  CheckCircle2,
  Pencil,
  GripVertical,
  X,
  Check,
} from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { supabase } from '@/lib/supabaseClient';
import { fetchTaskItems, createTaskItem, toggleTaskItem, deleteTaskItem } from '@/lib/tasks';

type TaskItem = {
  id: number;
  task_id: number;
  content: string;
  is_done: boolean;
  created_at: string;
};

// Agrupación SIN tocar DB: se guarda como prefijo dentro de `content`.
// Formato: "§§<grupo>§§ <texto>". En UI se oculta el prefijo.
const GROUP_PREFIX_RE = /^§§([^§]{1,40})§§\s*/;

function parseGroupedContent(raw: string) {
  const m = raw.match(GROUP_PREFIX_RE);
  if (!m) return { group: '', text: raw };
  const group = (m[1] ?? '').trim();
  const text = raw.replace(GROUP_PREFIX_RE, '').trimStart();
  return { group, text };
}

function encodeGroupedContent(group: string, text: string) {
  const g = (group ?? '').trim();
  if (!g) return text;
  return `§§${g}§§ ${text}`;
}

async function updateTaskItemContent(itemId: number, nextContent: string) {
  const { data, error } = await supabase
    .from('task_items')
    .update({ content: nextContent })
    .eq('id', itemId)
    .select('*')
    .single();
  if (error) throw error;
  return data as TaskItem;
}

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

function DraggableItem({
  itemId,
  disabled,
  children,
}: {
  itemId: number;
  disabled: boolean;
  children: (args: {
    setNodeRef: (node: HTMLElement | null) => void;
    transformStyle: CSSProperties;
    attributes: any;
    listeners: any;
    isDragging: boolean;
  }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `item:${itemId}`,
    disabled,
  });

  const style: CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {};

  return <>{children({ setNodeRef, transformStyle: style, attributes, listeners, isDragging })}</>;
}

function GroupDropZone({
  groupKey,
  disabled,
  children,
  className = '',
}: {
  groupKey: string;
  disabled: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group:${groupKey}`,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'ring-1 ring-sky-500/60' : ''}`}
    >
      {children}
    </div>
  );
}

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

  // Agrupación (client-side / sin DB): se guarda como prefijo en `content`.
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [newGroupDraft, setNewGroupDraft] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Edición inline de items
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const editInputRef = useRef<HTMLInputElement | null>(null);

  // Drag & Drop (mover items a grupos)
  const [activeDragId, setActiveDragId] = useState<number | null>(null);

  // Mantener el flujo “escribir → Enter → escribir → Enter” sin tocar el mouse.
  const inputRef = useRef<HTMLInputElement | null>(null);
  const groupWrapRef = useRef<HTMLDivElement | null>(null);

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

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      const g = parseGroupedContent(it.content).group;
      if (g) set.add(g);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const it of items) {
      const g = parseGroupedContent(it.content).group || '__ungrouped__';
      const arr = map.get(g) ?? [];
      arr.push(it);
      map.set(g, arr);
    }
    // orden por created_at asc para mantener consistencia
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return map;
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  // Cerrar menú de grupos al click afuera
  useEffect(() => {
    if (!groupMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = groupWrapRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setGroupMenuOpen(false);
      setCreatingGroup(false);
      setNewGroupDraft('');
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [groupMenuOpen]);

  const handleAddItem = async () => {
    if (!editable || !newItem.trim()) return;
    try {
      setSavingItem(true);
      const payload = encodeGroupedContent(selectedGroup, newItem.trim());
      const created = await createTaskItem(taskId, payload);
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

  const startEditItem = (item: TaskItem) => {
    const parsed = parseGroupedContent(item.content);
    setEditingId(item.id);
    setEditingValue(parsed.text);
    requestAnimationFrame(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    });
  };

  const cancelEditItem = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const saveEditItem = async (item: TaskItem) => {
    if (!editable) return;
    const nextText = editingValue.trim();
    if (!nextText) return;

    const { group } = parseGroupedContent(item.content);
    const nextContent = encodeGroupedContent(group, nextText);

    // optimistic
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, content: nextContent } : it)),
    );

    try {
      const updated = await updateTaskItemContent(item.id, nextContent);
      setItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
      cancelEditItem();
    } catch (err) {
      console.error('Error updating item', err);
      // rollback: recargar lista para asegurar consistencia
      try {
        const data = await fetchTaskItems(taskId);
        setItems(data);
      } catch {}
      cancelEditItem();
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!editable) return;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    if (!activeIdStr.startsWith('item:')) return;
    if (!overIdStr.startsWith('group:')) return;

    const itemId = Number(activeIdStr.replace('item:', ''));
    const groupKey = overIdStr.replace('group:', '');

    const targetGroup = groupKey === '__ungrouped__' ? '' : groupKey;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const parsed = parseGroupedContent(item.content);
    if (parsed.group === targetGroup) return;

    const nextContent = encodeGroupedContent(targetGroup, parsed.text);

    // optimistic
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, content: nextContent } : it)),
    );

    try {
      const updated = await updateTaskItemContent(itemId, nextContent);
      setItems((prev) => prev.map((it) => (it.id === itemId ? updated : it)));
    } catch (err) {
      console.error('Error moving item to group', err);
      // rollback recargando
      try {
        const data = await fetchTaskItems(taskId);
        setItems(data);
      } catch {}
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

        {/* input nuevo item + agrupación (solo si se puede editar) */}
        {editable && (
          <div className="mb-3 space-y-2">
            {/* selector de grupo */}
            <div ref={groupWrapRef} className="relative">
              <button
                type="button"
                onClick={() => setGroupMenuOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-700/70 bg-slate-950/50 px-3 py-2 text-left text-[11px] text-slate-200 hover:border-slate-600"
              >
                <span className="truncate">
                  {selectedGroup ? (
                    <>
                      Grupo: <span className="font-medium text-slate-100">{selectedGroup}</span>
                    </>
                  ) : (
                    <span className="text-slate-300">Sin grupo</span>
                  )}
                </span>
                <span className="ml-3 text-slate-400">▾</span>
              </button>

              <AnimatePresence initial={false}>
                {groupMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.985 }}
                    transition={{ duration: 0.16 }}
                    className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950/95 shadow-xl shadow-black/40"
                  >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGroup('');
                      setGroupMenuOpen(false);
                      setCreatingGroup(false);
                      setNewGroupDraft('');
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-[11px] hover:bg-slate-900 ${
                      !selectedGroup ? 'text-sky-200' : 'text-slate-200'
                    }`}
                  >
                    <span>Sin grupo</span>
                    {!selectedGroup && <span className="text-slate-500">✓</span>}
                  </button>

                  {groups.length > 0 && (
                    <div className="max-h-44 overflow-auto border-t border-slate-800 py-1">
                      {groups.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            setSelectedGroup(g);
                            setGroupMenuOpen(false);
                            setCreatingGroup(false);
                            setNewGroupDraft('');
                          }}
                          className={`flex w-full items-center justify-between px-3 py-2 text-[11px] hover:bg-slate-900 ${
                            selectedGroup === g ? 'text-sky-200' : 'text-slate-200'
                          }`}
                        >
                          <span className="truncate">{g}</span>
                          {selectedGroup === g && <span className="text-slate-500">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-slate-800 p-2">
                    {!creatingGroup ? (
                      <button
                        type="button"
                        onClick={() => setCreatingGroup(true)}
                        className="w-full rounded-lg bg-slate-900/70 px-3 py-2 text-[11px] text-slate-200 hover:bg-slate-900"
                      >
                        + Crear nuevo grupo
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          className="flex-1 rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          placeholder="Ej: Categorías"
                          value={newGroupDraft}
                          onChange={(e) => setNewGroupDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            const name = newGroupDraft.trim();
                            if (!name) return;
                            setSelectedGroup(name);
                            setGroupMenuOpen(false);
                            setCreatingGroup(false);
                            setNewGroupDraft('');
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const name = newGroupDraft.trim();
                            if (!name) return;
                            setSelectedGroup(name);
                            setGroupMenuOpen(false);
                            setCreatingGroup(false);
                            setNewGroupDraft('');
                          }}
                          className="rounded-lg bg-sky-500 px-3 py-2 text-[11px] font-medium text-sky-950 hover:bg-sky-400"
                        >
                          OK
                        </button>
                      </div>
                    )}
                  </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* input de item + botón */}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                className="flex-1 rounded-lg border border-slate-700/70 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder={
                  selectedGroup
                    ? `Ej: (${selectedGroup}) Revisé línea de obj. fiambres 214 y FRS...`
                    : 'Ej: Revisé línea de obj. fiambres 214 y FRS...'
                }
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
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
          <DndContext
            sensors={sensors}
            onDragStart={(e) => {
              const id = String(e.active.id);
              if (id.startsWith('item:')) setActiveDragId(Number(id.replace('item:', '')));
            }}
            onDragEnd={onDragEnd}
          >
            <div className="space-y-3">
            {/* Ungrouped primero */}
            {grouped.has('__ungrouped__') && (
              <GroupDropZone groupKey="__ungrouped__" disabled={!editable}>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-medium text-slate-200">Sin grupo</div>
                  <div className="text-[10px] text-slate-500">
                    {grouped.get('__ungrouped__')!.filter((i) => i.is_done).length}/
                    {grouped.get('__ungrouped__')!.length}
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {grouped.get('__ungrouped__')!.map((item) => {
                    const parsed = parseGroupedContent(item.content);
                    const isEditing = editingId === item.id;

                    return (
                      <DraggableItem itemId={item.id} disabled={!editable || isEditing || !!activeDragId}>
                        {({ setNodeRef, transformStyle, attributes, listeners, isDragging }) => (
                          <li
                            key={item.id}
                            ref={setNodeRef}
                            style={transformStyle}
                            className={`flex items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-950/70 px-2 py-1.5 z-10 ${
                              isDragging ? 'opacity-60' : ''
                            }`}
                          >
                            {editable ? (
                              <button
                                type="button"
                                {...attributes}
                                {...listeners}
                                className="mt-[2px] rounded p-1 text-slate-500 hover:bg-slate-900/80 hover:text-slate-200"
                                title="Arrastrar"
                              >
                                <GripVertical className="h-4 w-4" />
                              </button>
                            ) : (
                              <div className="mt-[2px] h-6 w-6" />
                            )}

                            <button
                              disabled={!editable}
                              onClick={editable ? () => handleToggleItem(item) : undefined}
                              className={`mt-[2px] flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] ${
                                item.is_done
                                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                                  : 'border-slate-600 bg-slate-900 text-slate-400'
                              } ${!editable ? 'cursor-default opacity-80' : ''}`}
                            >
                              {item.is_done && <CheckCircle2 className="h-3 w-3" />}
                            </button>

                            <div className="flex-1 text-[11px] leading-snug text-slate-200">
                              {!isEditing ? (
                                <p className={item.is_done ? 'font-bold text-slate-500' : ''}>{parsed.text}</p>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <input
                                    ref={editInputRef}
                                    className="w-full rounded-lg border border-slate-700/70 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') {
                                        e.preventDefault();
                                        cancelEditItem();
                                      }
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        saveEditItem(item);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => saveEditItem(item)}
                                    className="rounded bg-emerald-500/15 p-1 text-emerald-300 hover:bg-emerald-500/25"
                                    title="Guardar"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditItem}
                                    className="rounded bg-slate-900/70 p-1 text-slate-300 hover:bg-slate-900"
                                    title="Cancelar"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              )}

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
                              <div className="mt-[2px] flex items-center gap-1">
                                <button
                                  onClick={() => startEditItem(item)}
                                  className="rounded bg-slate-900/80 p-1 text-slate-500 hover:bg-slate-900 hover:text-slate-200"
                                  title="Editar"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item)}
                                  className="rounded bg-slate-900/80 p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </li>
                        )}
                      </DraggableItem>
                    );
                  })}
                </ul>
              </div>
              </GroupDropZone>
            )}

            {/* Grupos */}
            {groups.map((g) => {
              const arr = grouped.get(g) ?? [];
              if (arr.length === 0) return null;
              const done = arr.filter((i) => i.is_done).length;
              const total = arr.length;
              const isCollapsed = collapsedGroups[g] ?? false;

              return (
                <GroupDropZone groupKey={g} disabled={!editable}>
                <div key={g} className="rounded-xl border border-slate-800/70 bg-slate-950/40">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedGroups((prev) => ({ ...prev, [g]: !isCollapsed }))
                    }
                    className="flex w-full items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0 text-left">
                      <div className="truncate text-[12px] font-medium text-slate-100">{g}</div>
                      <div className="text-[10px] text-slate-500">Agrupación</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-[10px] text-slate-500">
                        {done}/{total}
                      </div>
                      <div className="text-slate-400">{isCollapsed ? '▸' : '▾'}</div>
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-1.5 overflow-hidden px-2 pb-2"
                      >
                      {arr.map((item) => {
                        const parsed = parseGroupedContent(item.content);
                        const isEditing = editingId === item.id;

                        return (
                          <DraggableItem itemId={item.id} disabled={!editable || isEditing || !!activeDragId}>
                            {({ setNodeRef, transformStyle, attributes, listeners, isDragging }) => (
                              <li
                                key={item.id}
                                ref={setNodeRef}
                                style={transformStyle}
                                className={`flex items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-950/70 px-2 py-1.5 z-10 ${
                                  isDragging ? 'opacity-60' : ''
                                }`}
                              >
                                {editable ? (
                                  <button
                                    type="button"
                                    {...attributes}
                                    {...listeners}
                                    className="mt-[2px] rounded p-1 text-slate-500 hover:bg-slate-900/80 hover:text-slate-200"
                                    title="Arrastrar"
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </button>
                                ) : (
                                  <div className="mt-[2px] h-6 w-6" />
                                )}

                                <button
                                  disabled={!editable}
                                  onClick={editable ? () => handleToggleItem(item) : undefined}
                                  className={`mt-[2px] flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] ${
                                    item.is_done
                                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                                      : 'border-slate-600 bg-slate-900 text-slate-400'
                                  } ${!editable ? 'cursor-default opacity-80' : ''}`}
                                >
                                  {item.is_done && <CheckCircle2 className="h-3 w-3" />}
                                </button>

                                <div className="flex-1 text-[11px] leading-snug text-slate-200">
                                  {!isEditing ? (
                                    <p className={item.is_done ? 'font-bold text-slate-500' : ''}>{parsed.text}</p>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <input
                                        ref={editInputRef}
                                        className="w-full rounded-lg border border-slate-700/70 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Escape') {
                                            e.preventDefault();
                                            cancelEditItem();
                                          }
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            saveEditItem(item);
                                          }
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => saveEditItem(item)}
                                        className="rounded bg-emerald-500/15 p-1 text-emerald-300 hover:bg-emerald-500/25"
                                        title="Guardar"
                                      >
                                        <Check className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEditItem}
                                        className="rounded bg-slate-900/70 p-1 text-slate-300 hover:bg-slate-900"
                                        title="Cancelar"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  )}

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
                                  <div className="mt-[2px] flex items-center gap-1">
                                    <button
                                      onClick={() => startEditItem(item)}
                                      className="rounded bg-slate-900/80 p-1 text-slate-500 hover:bg-slate-900 hover:text-slate-200"
                                      title="Editar"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(item)}
                                      className="rounded bg-slate-900/80 p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
                                      title="Eliminar"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </li>
                            )}
                          </DraggableItem>
                        );
                      })}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
                </GroupDropZone>
              );
            })}
            </div>
          </DndContext>
        )}
      </section>

      <div className="text-[11px] text-slate-500">{tip}</div>
    </div>
  );
}
