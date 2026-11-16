import { supabase } from '@/lib/supabaseClient';

export type ConsiderationRule = { mode: 'custom'; value: number } | { mode: 'exempt' };
export type MetricRules = Record<string, Partial<Record<'senior'|'semi'|'junior'|'improvement'|'weight', ConsiderationRule>>>;
export type GateRules = Record<string, ConsiderationRule>;
export type SellerConsideration = {
  branch_key: string;
  seller_id: number;
  seller_name_snapshot: string;
  reason: string;
  metric_rules: MetricRules;
  gate_rules: GateRules;
  updated_at: string;
};

export async function fetchSellerConsiderations(): Promise<SellerConsideration[]> {
  const { data, error } = await supabase.from('category_seller_considerations')
    .select('branch_key,seller_id,seller_name_snapshot,reason,metric_rules,gate_rules,updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SellerConsideration[];
}

export async function saveSellerConsideration(input: {
  branchKey: string; sellerId: number; reason: string;
  metricRules: MetricRules; gateRules: GateRules;
}): Promise<void> {
  const { error } = await supabase.rpc('admin_save_seller_consideration', {
    p_branch_key: input.branchKey,
    p_seller_id: input.sellerId,
    p_reason: input.reason,
    p_metric_rules: input.metricRules,
    p_gate_rules: input.gateRules,
  });
  if (error) throw error;
}

export async function deleteSellerConsideration(branchKey: string, sellerId: number) {
  const { error } = await supabase.from('category_seller_considerations')
    .delete().eq('branch_key', branchKey).eq('seller_id', sellerId);
  if (error) throw error;
}
