import type {CategoryPanelRow} from '@/lib/categoryPanelExcel';
import type {KpiProjection} from '@/lib/categoryKpiProjections';
import type {CategoryScaleGate,CategoryScaleMetric} from '@/lib/categoryScale';
import {assessSellerCategory,type SellerCategoryInput} from '@/lib/categoryReached';
import type {MonthlyConsideration} from '@/lib/categoryMonthlyConsiderations';

export type CategoryV2ClosurePerson={id:number;name:string;branch:string;role:string;superior:string;force:string};
export type CategoryV2ClosureDaily={
 seller_id:number|null;branch:string;sales_force:string;reason:string|null;
 first_visit:string|null;last_visit:string|null;corrected_start:string|null;corrected_end:string|null;
};
export type CategoryV2ClosureResult={
 seller_id:number;seller_name:string;supervisor:string;category:string;
 status:'qualified'|'pending'|'blocked';score:number|null;details:string;input:SellerCategoryInput;
 consideration:{metric_levels:MonthlyConsideration['metric_levels'];gate_exemptions:MonthlyConsideration['gate_exemptions'];reason:string;revision:number;updated_by:string}|null;
};
export type CategoryV2ClosureSource={
 rows:CategoryPanelRow[];projections:KpiProjection[];personnel:CategoryV2ClosurePerson[];
 daily:CategoryV2ClosureDaily[];metrics:CategoryScaleMetric[];gates:CategoryScaleGate[];considerations?:MonthlyConsideration[];
};
const timeSeconds=(value:string|null)=>{
 if(!value)return null;
 const parts=value.split(':').map(Number);
 if(parts.length<2||parts.some(x=>!Number.isFinite(x)))return null;
 return parts[0]*3600+parts[1]*60+(parts[2]||0);
};
export function getCategoryV2ClosureResults(
 source:CategoryV2ClosureSource,branchKey:string,branch:string,force:string,elapsedDays:number
):CategoryV2ClosureResult[]{
 if(elapsedDays<1)throw new Error('No hay días laborales transcurridos para confirmar el mes.');
 if(!source.metrics.length)throw new Error('No hay escalas activas para confirmar el cierre.');
 const sellers=source.personnel.filter(p=>p.role==='VENDEDOR'&&p.branch===branch&&(force==='all'||p.force===force));
 if(!sellers.length)throw new Error('No hay vendedores para confirmar el cierre.');
 const rows=new Map(source.rows.filter(r=>r.branchKey===branchKey).map(r=>[r.sellerId,r]));
 const projections=new Map(source.projections.filter(p=>p.branch_key===branchKey).map(p=>[p.seller_id,p]));
 const hours=new Map<number,{seconds:number;days:number}>();
 for(const record of source.daily){
  if(record.seller_id===null||record.reason||record.branch!==branch||(force!=='all'&&record.sales_force!==force))continue;
  const start=timeSeconds(record.corrected_start??record.first_visit);
  const end=timeSeconds(record.corrected_end??record.last_visit);
  if(start===null||end===null||end<start)continue;
  const current=hours.get(record.seller_id)??{seconds:0,days:0};
  current.seconds+=end-start;current.days++;
  hours.set(record.seller_id,current);
 }
 return sellers.map(person=>{
  const row=rows.get(person.id),projection=projections.get(person.id),hour=hours.get(person.id);
  const input:SellerCategoryInput={
   dailyBilling:row?row.importeFinalFacturado/elapsedDays:null,
   efficiency:row&&row.visitados>0?row.cntFac/row.visitados*100:null,
   effectiveness:row&&row.visitasPlaneadas>0?row.visitados/row.visitasPlaneadas*100:null,
   pop:projection?.pop_percentage??null,exhibition:projection?.exhibition_percentage??null,
   volume:projection?.volume_percentage??null,coverage:projection?.coverage_percentage??null,
   routeHours:hour&&hour.days>0?hour.seconds/hour.days/3600:null
  };
  const consideration=source.considerations?.find(c=>c.branch_key===branchKey&&c.seller_id===person.id);
  const assessment=assessSellerCategory(input,source.metrics,source.gates,projection?.projected_category??null,consideration);
  return {seller_id:person.id,seller_name:person.name,supervisor:person.superior,
   category:assessment.status==='pending'?'PLAN DE MEJORA':assessment.label,status:assessment.status,score:assessment.score,details:assessment.details,input,
   consideration:consideration?{metric_levels:consideration.metric_levels,gate_exemptions:consideration.gate_exemptions,
    reason:consideration.reason,revision:consideration.revision,updated_by:consideration.updated_by}:null};
 });
}
export function countCategoryV2ElapsedDays(month:string,excludedDays:string[],now=new Date()):number{
 const [year,m]=month.split('-').map(Number);
 if(!Number.isInteger(year)||!Number.isInteger(m)||m<1||m>12)return 0;
 const lastDay=new Date(year,m,0).getDate();
 const past=year<now.getFullYear()||(year===now.getFullYear()&&m<now.getMonth()+1);
 const future=year>now.getFullYear()||(year===now.getFullYear()&&m>now.getMonth()+1);
 const excluded=new Set(excludedDays);
 let elapsed=0;
 for(let d=1;d<=lastDay;d++){
  const day=new Date(year,m-1,d);
  const date=month+'-'+String(d).padStart(2,'0');
  if(day.getDay()===0||excluded.has(date))continue;
  if(past||(!future&&d<=now.getDate()))elapsed++;
 }
 return elapsed;
}
