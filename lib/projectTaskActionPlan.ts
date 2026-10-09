import { supabase } from '@/lib/supabaseClient';

export type ProjectTaskActionPlan = {
  id: number;
  task_id: number;
  branch_key: string;
  seller_id: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchProjectTaskActionPlan(
  taskId: number,
): Promise<ProjectTaskActionPlan | null> {
  const { data, error } = await supabase
    .from('project_task_action_plans')
    .select('*')
    .eq('task_id', taskId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as ProjectTaskActionPlan | null;
}

export async function upsertProjectTaskActionPlan(params: {
  taskId: number;
  branchKey: string;
  sellerId: string;
  userId: string | null;
}): Promise<ProjectTaskActionPlan> {
  const { taskId, branchKey, sellerId, userId } = params;

  const { data, error } = await supabase
    .from('project_task_action_plans')
    .upsert(
      {
        task_id: taskId,
        branch_key: branchKey,
        seller_id: sellerId,
        created_by: userId,
        updated_by: userId,
      },
      { onConflict: 'task_id' },
    )
    .select('*')
    .single();

  if (error) throw error;
  return data as ProjectTaskActionPlan;
}

export async function clearProjectTaskActionPlan(taskId: number) {
  const { error } = await supabase
    .from('project_task_action_plans')
    .delete()
    .eq('task_id', taskId);

  if (error) throw error;
}
