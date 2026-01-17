'use client';

import { useEffect, useState } from 'react';
import { fetchTaskItems } from '@/lib/tasks';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  taskId: number;
  size?: number; // tamaño del puntito en px (default 6)
};

type ChecklistInfo = {
  total: number;
  done: number;
};

export default function TaskChecklistIndicator({ taskId, size = 6 }: Props) {
  const [info, setInfo] = useState<ChecklistInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // función reutilizable para cargar el estado del checklist
  const loadChecklistInfo = async () => {
    try {
      setLoading(true);
      const items = await fetchTaskItems(taskId);

      const total = items.length;
      const done = items.filter((i) => i.is_done).length;

      setInfo({ total, done });
    } catch (err) {
      console.error('Error loading checklist items for task', err);
    } finally {
      setLoading(false);
    }
  };

  // 1) carga inicial
  useEffect(() => {
    loadChecklistInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // 2) suscripción realtime a cambios en task_items de esta tarea
  useEffect(() => {
    const channel = supabase
      .channel(`task-items-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_items',
          filter: `task_id=eq.${taskId}`,
        },
        async () => {
          // cuando cambie algo del checklist de esta tarea, recargamos info
          await loadChecklistInfo();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  if (loading || !info) return null;

  const { total, done } = info;

  // si no hay checklist, no mostramos nada
  if (total === 0) return null;

  const pending = total - done;
  const isAllDone = pending === 0;

  // 🟢 verde = checklist completo
  // 🟠 naranja = faltan ítems
  const colorClass = isAllDone
    ? 'bg-emerald-400 ring-emerald-500/40'
    : 'bg-orange-400 ring-orange-500/40';

  const title = isAllDone
    ? `Checklist completado (${total} ítems)`
    : `${pending} pendiente(s) · ${done} completado(s)`;

  return (
    <span
      className={`rounded-full ${colorClass}`}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
      }}
      title={title}
    />
  );
}
