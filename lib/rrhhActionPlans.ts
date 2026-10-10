import { supabase } from '@/lib/supabaseClient';

export type RRHHActionPlanAssignee = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

export type RRHHActionPlanChecklistItem = {
  id?: string;
  text?: string;
  done?: boolean;
};

export type RRHHActionPlanRow = {
  action_plan_id: number;
  task_id: number;
  project_id: number | null;
  project_name: string;
  project_status: string;
  project_start_date: string | null;
  project_due_date: string | null;
  task_title: string;
  task_summary: string | null;
  task_description: string | null;
  task_status: string;
  task_priority: string;
  task_due_date: string | null;
  task_is_locked: boolean;
  branch_key: string;
  seller_id: string;
  seller_name: string;
  seller_category: string | null;
  seller_efficiency: string | null;
  seller_effectiveness: string | null;
  seller_billing: string | null;
  seller_snapshot_year: number | null;
  seller_snapshot_month: number | null;
  assignees: RRHHActionPlanAssignee[];
  checklist_total: number;
  checklist_done: number;
  checklist_items: RRHHActionPlanChecklistItem[];
  action_plan_created_at: string;
  action_plan_updated_at: string;
};

export async function fetchRRHHActionPlans(): Promise<RRHHActionPlanRow[]> {
  const { data, error } = await supabase.rpc('rrhh_list_action_plans');

  if (error) throw error;

  return ((data ?? []) as RRHHActionPlanRow[]).map((row) => ({
    ...row,
    assignees: Array.isArray(row.assignees) ? row.assignees : [],
    checklist_items: Array.isArray(row.checklist_items)
      ? row.checklist_items
      : [],
  }));
}
