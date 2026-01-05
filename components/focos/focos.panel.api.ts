'use client';

import { supabase } from '@/lib/supabaseClient';

export type FocoSeverity = 'info' | 'warning' | 'critical';
export type FocoType = 'foco' | 'critico' | 'promo' | 'capacitacion';

export type PanelFocoRow = {
  id: string;
  title: string;
  content: string;
  severity: FocoSeverity;
  type: FocoType;

  start_at: string;
  end_at: string | null;

  is_active: boolean;
  archived_at: string | null;

  created_by: string;
  created_at: string;
  updated_at: string;

  targets: { branch_id: number; branch_name: string }[];
  target_branches_count: number;

  target_users_count: number;
  completed_count: number;
  completion_rate: number; // 0..100
};

export type CompletionUserRow = {
  foco_id: string;
  user_id: string;
  branch_id: number | null;
  completed_at: string;
  email: string | null;
  full_name: string | null;
  branch_name: string | null;
};

export async function updateFoco(input: {
  focoId: string;
  title: string;
  content: string;
  severity: FocoSeverity;
  type: FocoType;
  targetBranchIds: number[];
}) {
  const { focoId, targetBranchIds, ...patch } = input;

  // 1) update focos
  const { error: upErr } = await supabase
    .from('focos')
    .update({
      title: patch.title.trim(),
      content: patch.content.trim(),
      severity: patch.severity,
      type: patch.type,
    })
    .eq('id', focoId);

  if (upErr) throw upErr;

  // 2) targets: estrategia simple -> borrar y reinsertar
  const { error: delErr } = await supabase.from('foco_targets').delete().eq('foco_id', focoId);
  if (delErr) throw delErr;

  const payload = (targetBranchIds ?? []).map((bid) => ({ foco_id: focoId, branch_id: bid }));
  if (payload.length) {
    const { error: insErr } = await supabase.from('foco_targets').insert(payload);
    if (insErr) throw insErr;
  }
}

export async function getFocoPanelList(opts?: {
  onlyActive?: boolean;
  q?: string;
  severity?: FocoSeverity | 'all';
  type?: FocoType | 'all';
}) {
  const onlyActive = opts?.onlyActive ?? true;
  const q = (opts?.q ?? '').trim();
  const severity = opts?.severity ?? 'all';
  const type = opts?.type ?? 'all';

  let query = supabase.from('focos_with_stats').select('*');

  if (onlyActive) query = query.eq('is_active', true);
  if (severity !== 'all') query = query.eq('severity', severity);
  if (type !== 'all') query = query.eq('type', type);

  if (q) {
    // iLike en título/contenido
    query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
  }

  // orden: activos arriba y más nuevos
  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as PanelFocoRow[];
}

export async function getFocoCompletionsUsers(focoId: string) {
  const { data, error } = await supabase
    .from('foco_completion_users')
    .select('*')
    .eq('foco_id', focoId)
    .order('completed_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as CompletionUserRow[];
}

export async function closeFoco(focoId: string) {
  const { error } = await supabase
    .from('focos')
    .update({ is_active: false, archived_at: new Date().toISOString() })
    .eq('id', focoId);

  if (error) throw error;
}

export async function reopenFoco(focoId: string) {
  const { error } = await supabase
    .from('focos')
    .update({ is_active: true, archived_at: null })
    .eq('id', focoId);

  if (error) throw error;
}

export async function duplicateFoco(focoId: string) {
  // 1) Traer foco base
  const { data: base, error: baseErr } = await supabase
    .from('focos')
    .select('title,content,severity,type,start_at,end_at')
    .eq('id', focoId)
    .single();

  if (baseErr) throw baseErr;
  if (!base) throw new Error('No se encontró el foco a duplicar.');

  // 2) Traer targets
  const { data: targets, error: tErr } = await supabase
    .from('foco_targets')
    .select('branch_id')
    .eq('foco_id', focoId);

  if (tErr) throw tErr;

  const branchIds = (targets ?? []).map((t: any) => t.branch_id).filter(Boolean);

  // 3) Insert foco nuevo
  const nowIso = new Date().toISOString();
  const newTitle =
    (base.title?.toUpperCase().includes('COPIA') ? base.title : `COPIA - ${base.title}`) ?? 'COPIA - FOCO';

  const { data: inserted, error: insErr } = await supabase
    .from('focos')
    .insert({
      title: newTitle,
      content: base.content,
      severity: base.severity,
      type: base.type,
      start_at: nowIso,
      end_at: base.end_at,
      is_active: true,
      archived_at: null,
    })
    .select('id')
    .single();

  if (insErr) throw insErr;
  if (!inserted?.id) throw new Error('No se pudo duplicar (sin id).');

  const newId = inserted.id as string;

  // 4) Insert targets del nuevo foco
  if (branchIds.length > 0) {
    const payload = branchIds.map((bid) => ({ foco_id: newId, branch_id: bid }));
    const { error: targetsInsErr } = await supabase.from('foco_targets').insert(payload);

    if (targetsInsErr) {
      // rollback best-effort
      await supabase.from('focos').delete().eq('id', newId);
      throw targetsInsErr;
    }
  }

  return newId;
}

export async function deleteFoco(focoId: string) {
  const { error } = await supabase.from('focos').delete().eq('id', focoId);
  if (error) throw error;
}

export async function deleteFocos(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from('focos').delete().in('id', ids);
  if (error) throw error;
}

export async function deleteAllFocos() {
  // OJO: esto borra TODO (focos + cascades por FK)
  const { error } = await supabase.from('focos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}
