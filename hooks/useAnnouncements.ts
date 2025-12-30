import { supabase } from '@/lib/supabaseClient';

export async function fetchAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createAnnouncement(payload: {
  type: string;
  title: string;
  content: string;
  audience?: any;
  severity?: string;
  pinned?: boolean;
  require_ack?: boolean;
}) {
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      ...payload,
      is_published: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}