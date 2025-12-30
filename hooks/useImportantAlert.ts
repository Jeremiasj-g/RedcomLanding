'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type ImportantAlert = {
  id: string;
  title: string;
  content: string;
  severity: 'info' | 'warning' | 'critical';
  require_ack: boolean;
  starts_at: string;
  ends_at: string | null;
};

export function useImportantAlert(userId?: string) {
  const [alert, setAlert] = useState<ImportantAlert | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      if (!userId) {
        setAlert(null);
        setLoading(false);
        return;
      }

      // 1) traer la alerta activa aplicable (RLS ya filtra por audience)
      const { data: a, error: aErr } = await supabase
        .from('announcements')
        .select('id,title,content,severity,require_ack,starts_at,ends_at')
        .eq('type', 'important_alert')
        .eq('is_active', true)
        .eq('is_published', true)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (aErr || !a) {
        setAlert(null);
        setLoading(false);
        return;
      }

      // 2) si requiere ack, chequeamos si ya fue acknowledged
      if (a.require_ack) {
        const { data: r } = await supabase
          .from('announcement_reads')
          .select('acknowledged_at')
          .eq('announcement_id', a.id)
          .eq('user_id', userId)
          .maybeSingle();

        if (r?.acknowledged_at) {
          setAlert(null);
          setLoading(false);
          return;
        }
      }

      // 3) marcar seen_at (no bloquea)
      await supabase.from('announcement_reads').upsert(
        {
          announcement_id: a.id,
          user_id: userId,
          seen_at: new Date().toISOString(),
        },
        { onConflict: 'announcement_id,user_id' }
      );

      setAlert(a as ImportantAlert);
      setLoading(false);
    } catch (e) {
      console.error('[useImportantAlert]', e);
      setAlert(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const acknowledge = async () => {
    if (!alert || !userId) return;
    await supabase.from('announcement_reads').upsert(
      {
        announcement_id: alert.id,
        user_id: userId,
        acknowledged_at: new Date().toISOString(),
      },
      { onConflict: 'announcement_id,user_id' }
    );
    setAlert(null);
  };

  return { alert, loading, refetch: load, acknowledge };
}
