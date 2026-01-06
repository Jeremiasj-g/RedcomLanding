'use client';

import { supabase } from '@/lib/supabaseClient';
import type { FocoRow } from './focos.types';

export async function getFocosForMe(opts?: { onlyActive?: boolean }) {
  let q = supabase
    .from('focos')
    .select(
      `
      id,
      title,
      content,
      severity,
      type,
      is_active,
      created_at,
      updated_at,
      start_at,
      end_at,
      foco_targets (
        branch_id,
        branches ( name )
      )
    `
    )
    .order('start_at', { ascending: false });

  if (opts?.onlyActive) q = q.eq('is_active', true);

  const { data, error } = await q;
  if (error) throw error;

  // Normalizamos "targets" al formato que usa tu UI (branch_id + branch_name)
  const normalized =
    (data ?? []).map((f: any) => ({
      ...f,
      targets: (f.foco_targets ?? []).map((t: any) => ({
        branch_id: t.branch_id,
        branch_name: t.branches?.name ?? '—',
      })),
    })) ?? [];

  return normalized as any; // si querés, lo tipamos bien con tu FocoRow
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
