'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type ImportantAlert = {
  id: string;
  title: string;
  content: string;
  severity: 'info' | 'warning' | 'critical';
  require_ack: boolean;
  pinned: boolean;
  created_at: string;
};

export function useImportantAlertsQueue() {
  const [queue, setQueue] = useState<ImportantAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_pending_important_alerts');
    if (error) {
      console.error('[get_pending_important_alerts]', error);
      setQueue([]);
      setLoading(false);
      return;
    }
    setQueue((data ?? []) as ImportantAlert[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    return () => clearTimer();
  }, [load]);

  const current = useMemo(() => queue[0] ?? null, [queue]);

  const upsertRead = async (
    announcementId: string,
    patch: Record<string, any>
  ) => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;

    const base = {
      announcement_id: announcementId,
      user_id: userId,
      seen_at: new Date().toISOString(),
      ...patch,
    };

    const { error } = await supabase
      .from('announcement_reads')
      .upsert(base, { onConflict: 'announcement_id,user_id' });

    if (error) console.error('[announcement_reads upsert]', error);
  };

  // ✅ Entendido: ACK + dismiss (no vuelve)
  const acknowledge = async (id: string) => {
    await upsertRead(id, {
      acknowledged_at: new Date().toISOString(),
      dismissed_at: new Date().toISOString(),
      snoozed_until: null,
    });

    setQueue((prev) => prev.filter((x) => x.id !== id));
  };

  // ✅ Recordar en X minutos (default 3)
  const snooze = async (id: string, minutes = 3) => {
    const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    await upsertRead(id, {
      snoozed_until: until,
      dismissed_at: null,
    });

    // lo saco ahora, pero volverá cuando pase el tiempo
    setQueue((prev) => prev.filter((x) => x.id !== id));

    // recarga justo después del snooze
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      load();
    }, minutes * 60 * 1000 + 350);
  };

  // ✅ No mostrar más (dismissed_at)
  const dismissForever = async (id: string) => {
    await upsertRead(id, {
      dismissed_at: new Date().toISOString(),
      snoozed_until: null,
    });

    setQueue((prev) => prev.filter((x) => x.id !== id));
  };

  return {
    queue,
    current,
    loading,
    reload: load,
    acknowledge,
    snooze,
    dismissForever,
  };
}
