'use client';

import { supabase } from '@/lib/supabaseClient';
import type { FocoAsset, FocoRow } from '@/components/focos/focos.types';

/** Trae assets de muchos focos y los agrupa por foco_id */
async function getFocoAssetsByFocoIds(focoIds: string[]): Promise<Map<string, FocoAsset[]>> {
  const map = new Map<string, FocoAsset[]>();
  if (!focoIds.length) return map;

  const { data, error } = await supabase
    .from('foco_assets')
    .select('id,foco_id,kind,url,label,created_by,created_at')
    .in('foco_id', focoIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  for (const a of (data ?? []) as FocoAsset[]) {
    const arr = map.get(a.foco_id) ?? [];
    arr.push(a);
    map.set(a.foco_id, arr);
  }

  return map;
}

export async function getFocosForMe(opts?: { onlyActive?: boolean }): Promise<FocoRow[]> {
  const onlyActive = opts?.onlyActive ?? true;

  // ✅ 1) ACÁ PEGÁS TU QUERY QUE YA FUNCIONA (no la inventamos)
  // Ejemplo (REEMPLAZAR por tu versión real):
  let query = supabase.from('focos_with_stats').select('*'); // <-- cambia esto por tu fuente real
  if (onlyActive) query = query.eq('is_active', true);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  const base = (data ?? []) as any[];

  // ✅ 2) assets (extra, no rompe la query base)
  const focoIds = base.map((f) => f.id).filter(Boolean);
  const assetsMap = await getFocoAssetsByFocoIds(focoIds);

  // ✅ 3) merge tipado
  return base.map((f) => ({
    ...(f as any),
    assets: assetsMap.get(f.id) ?? [],
  })) as FocoRow[];
}

export async function getMyFocoCompletions(userId: string, focoIds: string[]) {
  if (!focoIds.length) return new Set<string>();

  const { data, error } = await supabase
    .from('foco_completions')
    .select('foco_id')
    .eq('user_id', userId)
    .in('foco_id', focoIds);

  if (error) throw error;

  return new Set((data ?? []).map((r: any) => r.foco_id as string));
}

export async function markFocoCompleted(params: { focoId: string; branchId?: number | null; userId: string }) {
  const { error } = await supabase.from('foco_completions').insert({
    foco_id: params.focoId,
    user_id: params.userId,
    branch_id: params.branchId ?? null,
  });
  if (error) throw error;
}

export async function unmarkFocoCompleted(params: { focoId: string }) {
  const { error } = await supabase.from('foco_completions').delete().eq('foco_id', params.focoId);
  if (error) throw error;
}

export async function getMyBranches(userId: string) {
  const { data, error } = await supabase
    .from('user_branches')
    .select('branch_id, branches:branches(id,name)')
    .eq('user_id', userId);

  if (error) throw error;

  return (data ?? [])
    .map((r: any) => r.branches)
    .filter(Boolean)
    .map((b: any) => ({ id: b.id as number, name: b.name as string }));
}
