import { supabase } from '@/lib/supabaseClient';

export type ProjectTaskActionPlan = {
  id: number;
  task_id: number;
  branch_key: string;
  seller_id: string;
  viewer_auth_user_id: string | null;
  assigned_holder_name: string | null;
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

/** Las opciones provienen del padrón comercial actual, no del histórico. */
export type ActionPlanVendorCandidate={
 auth_user_id:string; person_code:number; person_name:string;
};
export async function fetchActionPlanVendorCandidates(taskId:number){
 const {data,error}=await supabase.rpc('action_plan_vendor_candidates',{p_task_id:taskId});
 if(error)throw error;
 return (data??[]) as ActionPlanVendorCandidate[];
}
export async function assignActionPlanVendor(taskId:number,authUserId:string|null){
 const {error}=await supabase.rpc('assign_action_plan_vendor',{
  p_task_id:taskId,p_vendor_auth_user_id:authUserId,
 });
 if(error)throw error;
}
