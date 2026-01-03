'use client';

import { supabase } from '@/lib/supabaseClient';

export type AnnouncementType = 'news' | 'weekly' | 'birthday' | 'important_alert';
export type Severity = 'info' | 'warning' | 'critical';

export type Audience = {
  all?: boolean;
  roles?: string[];
  branches?: string[];
} | null;

export type Announcement = {
  id: string;
  type: AnnouncementType;
  title: string;
  content: string;
  severity: Severity;
  require_ack: boolean;
  audience: Audience;
  pinned: boolean;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  is_published: boolean;
  archived_at: string | null;
  created_at: string;
};

export type AnnouncementMetric = {
  id: string; // puede ser el id del announcement (ideal)
  type: AnnouncementType;
  title: string;
  created_at: string;
  is_active: boolean;
  is_published: boolean;
  require_ack: boolean;
  severity: Severity;
  pinned: boolean;
  starts_at: string;
  ends_at: string | null;
  archived_at: string | null;
  seen_count: number;
  ack_count: number;

  // ✅ para el modal de audiencia
  audience?: Audience;

  // si tu view lo trae, lo respetamos (no molesta)
  announcement_id?: string;
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

export async function rrhhFetchAnnouncementsMetrics() {
  // 1) métricas como siempre (no tocamos nada)
  const { data: metrics, error } = await supabase
    .from('v_announcement_metrics')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = ((metrics ?? []) as any[]) as AnnouncementMetric[];
  if (rows.length === 0) return [];

  // 2) detectar el id real del announcement (algunas views usan announcement_id)
  const ids = uniq(
    rows
      .map((r: any) => String(r.announcement_id ?? r.id ?? '').trim())
      .filter(Boolean)
  );

  if (ids.length === 0) {
    // no hay ids para buscar audience -> devolvemos métricas sin audience
    return rows;
  }

  // 3) traemos audience desde announcements
  const { data: audRows, error: audErr } = await supabase
    .from('announcements')
    .select('id,audience')
    .in('id', ids);

  if (audErr) throw audErr;

  const audMap = new Map<string, Audience>();
  (audRows ?? []).forEach((r: any) => {
    audMap.set(String(r.id), (r.audience ?? null) as Audience);
  });

  // 4) merge al shape que tu UI espera
  const merged = rows.map((r: any) => {
    const realId = String(r.announcement_id ?? r.id);
    return {
      ...r,
      // para UI: siempre en root
      audience: audMap.get(realId) ?? null,
      // aseguramos que id siga siendo el id del announcement si tu view usa announcement_id
      id: String(r.id ?? realId),
    } as AnnouncementMetric;
  });

  return merged;
}

export async function rrhhUpdateAnnouncement(id: string, patch: Partial<Announcement>) {
  const { error } = await supabase.from('announcements').update(patch).eq('id', id);
  if (error) throw error;
}

export async function rrhhArchiveAnnouncement(id: string) {
  const { error } = await supabase
    .from('announcements')
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq('id', id);

  if (error) throw error;
}

export async function rrhhRestoreAnnouncement(id: string) {
  const { error } = await supabase.from('announcements').update({ archived_at: null }).eq('id', id);
  if (error) throw error;
}

export async function rrhhDeleteAnnouncement(id: string) {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}

export async function rrhhFetchReads(announcementId: string) {
  const { data, error } = await supabase
    .from('v_reads_with_user')
    .select('user_id,full_name,email,seen_at,acknowledged_at,dismissed_at,created_at')
    .eq('announcement_id', announcementId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
