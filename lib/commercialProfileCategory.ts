import {supabase} from '@/lib/supabaseClient';
import {fromDbRow} from '@/lib/categoryPanel';
import type {CategoryPanelRow} from '@/lib/categoryPanelExcel';
import type {KpiProjection} from '@/lib/categoryKpiProjections';
import {assessSellerCategory,type SellerCategoryInput,type CategoryAssessment} from '@/lib/categoryReached';
import type {CategoryScaleMetric,CategoryScaleGate} from '@/lib/categoryScale';
import type {MonthlyConsideration} from '@/lib/categoryMonthlyConsiderations';
import {summarizeSigoReasons,type SigoReasonSummary} from '@/lib/categorySigoReasons';

type Daily={
 visit_date:string;branch:string;sales_force:string;seller_id:number|null;
 seller_name:string;first_visit:string|null;last_visit:string|null;
 corrected_start:string|null;corrected_end:string|null;reason:string|null;
};
export type CommercialProfileV2Snapshot={
 branch:string;code:number;scope:string;month:string;months:string[];
 row:Record<string,unknown>|null;projection:KpiProjection|null;
 daily:Daily[];metrics:CategoryScaleMetric[];gates:CategoryScaleGate[];
 excludedDays:string[];monthlyConsideration:MonthlyConsideration|null;
};
export type CommercialProfileCategory={
 month:string;scope:string;row:CategoryPanelRow|null;
 input:SellerCategoryInput;projection:KpiProjection|null;
 assessment:CategoryAssessment;elapsedDays:number;
 reasonSummary:SigoReasonSummary[];metrics:CategoryScaleMetric[];gates:CategoryScaleGate[];consideration:MonthlyConsideration|null;
};
export const previousCategoryMonth=(month:string)=>{
 const [year,m]=month.split('-').map(Number);
 const date=new Date(year,m-2,1);
 return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');
};
export async function fetchMyCommercialCategory(month:string):Promise<CommercialProfileV2Snapshot>{
 const {data,error}=await supabase.rpc('my_commercial_vendor_category_v2',{p_month:month});
 if(error)throw error;
 if(!data||typeof data!=='object'||!Array.isArray(data.months))
  throw new Error('No se recibieron datos de Categorías V2.');
 return data as CommercialProfileV2Snapshot;
}
function workdays(month:string,excludedDays:string[]){
 const [year,m]=month.split('-').map(Number);
 const now=new Date();
 const last=new Date(year,m,0).getDate();
 const past=year<now.getFullYear()||(year===now.getFullYear()&&m<now.getMonth()+1);
 const future=year>now.getFullYear()||(year===now.getFullYear()&&m>now.getMonth()+1);
 const exclude=new Set(excludedDays);
 let elapsed=0;
 for(let d=1;d<=last;d++){
  const dt=new Date(year,m-1,d);
  const key=year+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  if(dt.getDay()===0||exclude.has(key))continue;
  if(past||(!future&&d<=now.getDate()))elapsed++;
 }
 return elapsed;
}
function seconds(value:string){
 const [h,m,s]=value.split(':').map(Number);
 return h*3600+m*60+(s||0);
}
export function buildMyCommercialCategory(data:CommercialProfileV2Snapshot):CommercialProfileCategory{
 const row=data.row?fromDbRow(data.row as Parameters<typeof fromDbRow>[0]):null;
 const projected=data.projection;
 const days=workdays(data.month,data.excludedDays??[]);
 let sum=0,validDays=0;
 for(const day of data.daily??[]){
  if(day.seller_id!==data.code||day.reason)continue;
  const start=day.corrected_start??day.first_visit,end=day.corrected_end??day.last_visit;
  if(!start||!end)continue;
  const diff=seconds(end)-seconds(start);
  if(Number.isFinite(diff)&&diff>=0){sum+=diff;validDays++;}
 }
 const input:SellerCategoryInput={
  dailyBilling:row&&days>0?row.importeFinalFacturado/days:null,
  efficiency:row&&row.visitados>0?row.cntFac/row.visitados*100:null,
  effectiveness:row&&row.visitasPlaneadas>0?row.visitados/row.visitasPlaneadas*100:null,
  pop:projected?.pop_percentage??null,
  exhibition:projected?.exhibition_percentage??null,
  volume:projected?.volume_percentage??null,
  coverage:projected?.coverage_percentage??null,
  routeHours:validDays?sum/validDays/3600:null,
 };
 const force=data.scope==='corrientes_masivos'?'ESQUEMA 1':
  data.scope==='corrientes_refrigerados'?'ESQUEMA REGRIGERADOS':'all';
 return {
  month:data.month,scope:data.scope,row,input,projection:projected,
  assessment:assessSellerCategory(input,data.metrics??[],data.gates??[],projected?.projected_category??null,data.monthlyConsideration),
  elapsedDays:days,metrics:data.metrics??[],gates:data.gates??[],consideration:data.monthlyConsideration??null,
  reasonSummary:summarizeSigoReasons(data.daily??[],data.code,data.branch,force),
 };
}
