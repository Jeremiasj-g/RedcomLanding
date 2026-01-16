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

export type TargetUserRow = {
  foco_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  branch_name: string | null;
};

export async function getFocoTargetUsers(focoId: string): Promise<TargetUserRow[]> {
  const { data, error } = await supabase
    .from('foco_target_users') // 👈 view recomendada
    .select('*')
    .eq('foco_id', focoId);

  if (error) throw error;
  return (data || []) as TargetUserRow[];
}

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

/**
 * ✅ CREATE (focos + foco_targets)
 * Devuelve focoId
 */
export async function createFoco(input: {
  title: string;
  content: string;
  severity: FocoSeverity;
  type: FocoType;
  targetBranchIds: number[];
}) {
  const { title, content, severity, type, targetBranchIds } = input;

  const { data: foco, error: focoErr } = await supabase
    .from('focos')
    .insert({
      title: title.trim(),
      content: content, // ya viene html
      severity,
      type,
    })
    .select('id')
    .single();

  if (focoErr) throw focoErr;
  if (!foco?.id) throw new Error('No se devolvió el id del foco.');

  const focoId = foco.id as string;

  const payloadTargets = (targetBranchIds ?? []).map((bid) => ({
    foco_id: focoId,
    branch_id: bid,
  }));

  if (payloadTargets.length) {
    const { error: targetsErr } = await supabase.from('foco_targets').insert(payloadTargets);
    if (targetsErr) throw targetsErr;
  }

  return focoId;
}

// -------------------------
// ✅ Assets (Storage + foco_assets)
// -------------------------
export const FOCOS_BUCKET = 'foco-assets'; // 👈 si tu bucket se llama distinto, cambialo acá

export type UploadFocoAssetItem = {
  file: File;
  label?: string | null;
  // kind: ajustalo si tu enum no tiene 'image'
  kind?: string; // default 'image'
};

function safeExt(file: File) {
  const name = file.name || '';
  const dot = name.lastIndexOf('.');
  if (dot === -1) return '';
  return name.slice(dot).toLowerCase();
}

/**
 * Sube N archivos a Storage y registra filas en foco_assets.
 * OJO: asume bucket existente.
 */
export async function uploadFocoAssets(input: {
  focoId: string;
  createdBy: string;
  items: UploadFocoAssetItem[];
}) {
  const { focoId, createdBy, items } = input;

  if (!items?.length) return;

  for (const it of items) {
    const file = it.file;
    const ext = safeExt(file) || '.png';
    const objectName = `${crypto.randomUUID()}${ext}`;
    const storagePath = `focos/${focoId}/${objectName}`;

    const { error: upErr } = await supabase.storage.from(FOCOS_BUCKET).upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

    if (upErr) throw upErr;

    // Si el bucket es público, esto devuelve url directa.
    // Si es privado, igual devuelve algo pero te conviene luego signed urls para mostrar (lo vemos en el próximo paso).
    const { data: pub } = supabase.storage.from(FOCOS_BUCKET).getPublicUrl(storagePath);
    const url = pub?.publicUrl || storagePath;

    const kind = (it.kind ?? 'image') as any; // 👈 ajustá si tu enum no usa 'image'
    const label = (it.label ?? '').trim() || null;

    const { error: assetErr } = await supabase.from('foco_assets').insert({
      foco_id: focoId,
      kind,
      url,
      label,
      created_by: createdBy,
    });

    if (assetErr) throw assetErr;
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
    query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
  }

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
  const { error } = await supabase.from('focos').update({ is_active: true, archived_at: null }).eq('id', focoId);

  if (error) throw error;
}

export async function duplicateFoco(focoId: string) {
  const { data: base, error: baseErr } = await supabase
    .from('focos')
    .select('title,content,severity,type,start_at,end_at')
    .eq('id', focoId)
    .single();

  if (baseErr) throw baseErr;
  if (!base) throw new Error('No se encontró el foco a duplicar.');

  const { data: targets, error: tErr } = await supabase.from('foco_targets').select('branch_id').eq('foco_id', focoId);
  if (tErr) throw tErr;

  const branchIds = (targets ?? []).map((t: any) => t.branch_id).filter(Boolean);

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

  if (branchIds.length > 0) {
    const payload = branchIds.map((bid) => ({ foco_id: newId, branch_id: bid }));
    const { error: targetsInsErr } = await supabase.from('foco_targets').insert(payload);

    if (targetsInsErr) {
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
  const { error } = await supabase.from('focos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}
