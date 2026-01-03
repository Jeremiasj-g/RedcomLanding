'use client';

import { supabase } from '@/lib/supabaseClient';

export type AnnouncementType = 'news' | 'weekly' | 'birthday' | 'important_alert';
export type Severity = 'info' | 'warning' | 'critical';

export type Audience =
  | {
      all?: boolean;
      roles?: string[];
      branches?: string[];
    }
  | null;

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
  id: string; // view puede devolver announcement_id o id
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

  // ✅ para el modal “Audiencia”
  audience?: Audience;

  // si tu view lo trae
  announcement_id?: string;
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

function getRealAnnouncementId(r: any) {
  return String(r?.announcement_id ?? r?.id ?? '').trim();
}

/** ✅ Métricas + merge de audience (para UI de RRHH) */
export async function rrhhFetchAnnouncementsMetrics() {
  const { data: metrics, error } = await supabase
    .from('v_announcement_metrics')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = ((metrics ?? []) as any[]) as AnnouncementMetric[];
  if (rows.length === 0) return [];

  // ids reales del announcement
  const ids = uniq(rows.map(getRealAnnouncementId).filter(Boolean));

  if (ids.length === 0) return rows;

  // traemos audience desde announcements (solo lo necesario)
  const { data: audRows, error: audErr } = await supabase
    .from('announcements')
    .select('id,audience')
    .in('id', ids);

  if (audErr) throw audErr;

  const audMap = new Map<string, Audience>();
  (audRows ?? []).forEach((r: any) => {
    audMap.set(String(r.id), (r.audience ?? null) as Audience);
  });

  // merge
  return rows.map((r: any) => {
    const realId = getRealAnnouncementId(r);
    return {
      ...r,
      audience: audMap.get(realId) ?? null,
      // mantenemos id tal cual la view, pero realId queda para el que lo necesite
      // (si en tu UI querés SIEMPRE el id real, podés reemplazar id: realId)
    } as AnnouncementMetric;
  });
}

/** ✅ NUEVO: trae el anuncio completo para edición (content, audience, etc.) */
export async function rrhhFetchAnnouncementById(id: string) {
  const { data, error } = await supabase.from('announcements').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Announcement;
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
