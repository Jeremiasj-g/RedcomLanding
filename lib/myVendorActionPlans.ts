import {supabase} from '@/lib/supabaseClient';

export type MyVendorActionPlan={
 action_plan_id:number;task_id:number;project_name:string;
 task_title:string;task_summary:string|null;task_description:string|null;
 task_status:string;task_priority:string;task_due_date:string|null;
 project_due_date:string|null;branch_key:string;seller_id:string;
 assigned_holder_name:string;checklist_items:Array<{id?:string;text?:string;done?:boolean}>;
 checklist_total:number;checklist_done:number;updated_at:string;
};
export async function fetchMyVendorActionPlans():Promise<MyVendorActionPlan[]>{
 const {data,error}=await supabase.rpc('my_vendor_action_plans');
 if(error)throw error;
 if(!Array.isArray(data))throw new Error('No se pudo cargar el seguimiento.');
 return data.map((row:MyVendorActionPlan)=>({
  ...row,checklist_items:Array.isArray(row.checklist_items)?row.checklist_items:[],
 }));
}
