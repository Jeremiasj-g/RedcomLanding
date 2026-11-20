import {supabase} from '@/lib/supabaseClient';
export type MonthlyLevel='junior'|'semi'|'senior';
export type MonthlyConsideration={
 branch_key:string;month:string;seller_id:number;
 metric_levels:Record<string,MonthlyLevel>;
 gate_exemptions:Partial<Record<'route'|'effectiveness',boolean>>;
 reason:string;revision:number;updated_at:string;updated_by:string;
};
export const hasMonthlyRecognition=(item:MonthlyConsideration|null|undefined)=>
 Boolean(item&&(Object.keys(item.metric_levels??{}).length>0||
 Object.values(item.gate_exemptions??{}).some(Boolean)));
export async function fetchMonthlyConsiderations(month:string,branchKey?:string):Promise<MonthlyConsideration[]>{
 let query=supabase.from('category_v2_monthly_considerations')
 .select('branch_key,month,seller_id,metric_levels,gate_exemptions,reason,revision,updated_at,updated_by').eq('month',month);
 if(branchKey)query=query.eq('branch_key',branchKey);
 const {data,error}=await query;
 if(error)throw error;
 return (data??[]) as MonthlyConsideration[];
}
export async function saveMonthlyConsideration(input:{
 branchKey:string;month:string;sellerId:number;metricLevels:Record<string,MonthlyLevel>;
 gateExemptions:Partial<Record<'route'|'effectiveness',boolean>>;
 reason:string;expectedRevision:number;
}):Promise<MonthlyConsideration>{
 const {data,error}=await supabase.rpc('admin_save_category_v2_monthly_consideration',{
  p_branch_key:input.branchKey,p_month:input.month,p_seller_id:input.sellerId,
  p_metric_levels:input.metricLevels,p_gate_exemptions:input.gateExemptions,
  p_reason:input.reason,p_expected_revision:input.expectedRevision
 });
 if(error)throw error;
 return data as MonthlyConsideration;
}
