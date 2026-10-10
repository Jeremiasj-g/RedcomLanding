import { supabase } from '@/lib/supabaseClient';

export type BranchResourceIcon =
  | 'pie-chart'
  | 'user-plus'
  | 'calendar-clock'
  | 'users'
  | 'layers'
  | 'receipt'
  | 'target'
  | 'spreadsheet';

export type BranchResourceAccent =
  | 'blue'
  | 'green'
  | 'violet'
  | 'amber'
  | 'red'
  | 'slate'
  | 'cyan';

export type BranchResource = {
  id: number;
  branch_key: string;
  section_key: string;
  title: string;
  description: string | null;
  category: string | null;
  group_name: string | null;
  link: string;
  icon: BranchResourceIcon;
  accent: BranchResourceAccent;
  action_label: string;
  permission_key: string | null;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BranchResourceInput = {
  title: string;
  description?: string | null;
  category?: string | null;
  group_name?: string | null;
  link: string;
  icon: BranchResourceIcon;
  accent: BranchResourceAccent;
  action_label?: string;
  permission_key?: string | null;
};

export async function fetchBranchResources(
  branchKey: string,
  sectionKey = 'main',
): Promise<BranchResource[]> {
  const { data, error } = await supabase
    .from('branch_resources')
    .select('*')
    .eq('branch_key', branchKey)
    .eq('section_key', sectionKey)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;
  return (data ?? []) as BranchResource[];
}

export async function createBranchResource(params: {
  branchKey: string;
  sectionKey?: string;
  input: BranchResourceInput;
  currentUserId: string;
  sortOrder: number;
}): Promise<BranchResource> {
  const { branchKey, sectionKey = 'main', input, currentUserId, sortOrder } = params;

  const { data, error } = await supabase
    .from('branch_resources')
    .insert({
      branch_key: branchKey,
      section_key: sectionKey,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category?.trim() || null,
      group_name: input.group_name?.trim() || null,
      link: input.link.trim(),
      icon: input.icon,
      accent: input.accent,
      action_label: input.action_label?.trim() || 'Abrir herramienta',
      permission_key: input.permission_key || null,
      sort_order: sortOrder,
      created_by: currentUserId,
      updated_by: currentUserId,
      is_active: true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as BranchResource;
}

export async function updateBranchResource(
  id: number,
  input: BranchResourceInput,
): Promise<BranchResource> {
  const { data, error } = await supabase
    .from('branch_resources')
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category?.trim() || null,
      group_name: input.group_name?.trim() || null,
      link: input.link.trim(),
      icon: input.icon,
      accent: input.accent,
      action_label: input.action_label?.trim() || 'Abrir herramienta',
      permission_key: input.permission_key || null,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as BranchResource;
}

export async function deleteBranchResource(id: number): Promise<void> {
  const { error } = await supabase
    .from('branch_resources')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
