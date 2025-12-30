'use client';

import { supabase } from '@/lib/supabaseClient';

export type AnnouncementType = 'news' | 'weekly' | 'birthday' | 'important_alert';
export type Severity = 'info' | 'warning' | 'critical';

export type Announcement = {
    id: string;
    type: AnnouncementType;
    title: string;
    content: string;
    severity: Severity;
    require_ack: boolean;
    audience: any;
    pinned: boolean;
    starts_at: string;
    ends_at: string | null;
    is_active: boolean;
    is_published: boolean;
    archived_at: string | null;
    created_at: string;
};

export type AnnouncementMetric = {
    id: string;
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
};

export async function rrhhFetchAnnouncementsMetrics() {
    const { data, error } = await supabase
        .from('v_announcement_metrics')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as AnnouncementMetric[];
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
    const { error } = await supabase
        .from('announcements')
        .update({ archived_at: null })
        .eq('id', id);

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
