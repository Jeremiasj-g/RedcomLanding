import type { CategoryScaleGate, CategoryScaleMetric } from '@/lib/categoryScale';

export type SellerCategoryInput = {
 dailyBilling:number|null; efficiency:number|null; effectiveness:number|null;
 pop:number|null; exhibition:number|null; volume:number|null; coverage:number|null; routeHours:number|null;
};

export const CATEGORY_PASS_SCORE=75;
export const DEFAULT_ROUTE_MINUTES=5*60+20;
export const DEFAULT_EFFECTIVENESS=89;
export type CategoryLevel='JUNIOR'|'SEMI SENIOR'|'SENIOR';
export type CategoryAssessment={label:string;status:'qualified'|'pending'|'blocked';score:number|null;details:string;tiers:TierAssessment[];gates:GateAssessment[]};
export type TierAssessment={label:CategoryLevel;score:number;maximum:number;passed:boolean;missing:string[];lines:TierMetricAssessment[]};
export type TierMetricAssessment={id:number;name:string;unit:string;weight:number;actual:number|null;required:number|string|null;passed:boolean|null;projected:boolean};
export type GateAssessment={label:string;actual:number|null;required:number;unit:string;passed:boolean|null;kind:'route'|'effectiveness'};

const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const tierKeys=[
 {label:'SENIOR' as const,key:'seniorValue' as const,rank:3},
 {label:'SEMI SENIOR' as const,key:'semiSeniorValue' as const,rank:2},
 {label:'JUNIOR' as const,key:'juniorValue' as const,rank:1},
];
export function categoryRank(value:string|null|undefined):number|null{
 const text=normalized(value??'').replace(/\s+/g,' ');
 return text==='senior'?3:text==='semi senior'||text==='semisenior'?2:text==='junior'?1:text==='plan de mejora'?0:null;
}
function projectedMetric(name:string){return normalized(name).includes('facturac');}
export function measure(name:string,x:SellerCategoryInput):number|null{
 const n=normalized(name);
 if(projectedMetric(name))return x.dailyBilling;
 if(n.includes('eficiencia'))return x.efficiency;
 if(n.includes('efectividad'))return x.effectiveness;
 if(n.includes('exhibic'))return x.exhibition;
 if(n.includes('pop'))return x.pop;
 if(n.includes('volumen'))return x.volume;
 if(n.includes('cobertura'))return x.coverage;
 return null;
}
function parseRequirement(value:string,kind:'route'|'effectiveness'):number|null{
 const text=value.replace(',','.');
 if(kind==='route'){
  const time=/(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(text);
  if(time)return Number(time[1])+Number(time[2])/60+Number(time[3]??0)/3600;
 }
 const raw=text.match(/\d+(?:\.\d+)?/);
 return raw?Number(raw[0]):null;
}
export function gateBreakdown(input:SellerCategoryInput,gates:CategoryScaleGate[]):GateAssessment[]{
 const defs=[
  {kind:'route' as const,label:'Horario de ruta',fallback:DEFAULT_ROUTE_MINUTES/60,actual:input.routeHours,unit:'h'},
  {kind:'effectiveness' as const,label:'Efectividad',fallback:DEFAULT_EFFECTIVENESS,actual:input.effectiveness,unit:'%'},
 ];
 return defs.map(def=>{
  const configured=gates.find(g=>{const n=normalized(g.label);return def.kind==='route'?n.includes('hora')||n.includes('ruta'):n.includes('efectividad')});
  const parsed=configured?parseRequirement(configured.valueText,def.kind):null;
  const required=parsed??def.fallback;
  const actual=def.actual!==null&&Number.isFinite(def.actual)?def.actual:null;
  return {kind:def.kind,label:def.label,unit:def.unit,required,actual,passed:actual===null?null:actual+1e-9>=required};
 });
}
export function scoreByCategory(input:SellerCategoryInput,projectedCategory:string|null,metrics:CategoryScaleMetric[]):TierAssessment[]{
 const active=metrics.filter(m=>m.weightPercent>0);
 const projectedRank=categoryRank(projectedCategory);
 return tierKeys.map(tier=>{
  const lines=active.map(metric=>{
   const projected=projectedMetric(metric.metricName);
   const actual=projected?null:measure(metric.metricName,input);
   const required=projected?tier.label:metric[tier.key];
   const passed=projected
    ?projectedRank===null?null:projectedRank>=tier.rank
    :actual===null||!Number.isFinite(actual)||typeof required!=='number'?null:actual+1e-9>=required;
   return {id:metric.id,name:metric.metricName,unit:metric.valueType,weight:metric.weightPercent,actual,required,passed,projected} satisfies TierMetricAssessment;
  });
  const score=lines.reduce((sum,line)=>sum+(line.passed===true?line.weight:0),0);
  const maximum=lines.reduce((sum,line)=>sum+line.weight,0);
  return {label:tier.label,score,maximum,passed:score+1e-9>=CATEGORY_PASS_SCORE,missing:lines.filter(line=>line.passed===null).map(line=>line.name),lines};
 });
}
export function assessSellerCategory(input:SellerCategoryInput,metrics:CategoryScaleMetric[],gates:CategoryScaleGate[],projectedCategory:string|null=null):CategoryAssessment{
 const tiers=scoreByCategory(input,projectedCategory,metrics);
 const checks=gateBreakdown(input,gates);
 if(!metrics.some(m=>m.weightPercent>0))
  return {label:'Sin escala',status:'pending',score:null,details:'No hay indicadores ponderados',tiers,gates:checks};
 const eligible=tiers.find(t=>t.passed);
 const missingChecks=checks.filter(check=>check.passed===null);
 const failedChecks=checks.filter(check=>check.passed===false);
 if(missingChecks.length)
  return {label:'Pendiente',status:'pending',score:eligible?.score??tiers[2]?.score??0,details:'Sin datos para verificar: '+missingChecks.map(c=>c.label).join(', '),tiers,gates:checks};
 if(failedChecks.length)
  return {label:'PLAN DE MEJORA',status:'blocked',score:eligible?.score??tiers[2]?.score??0,details:'No cumple la llave: '+failedChecks.map(c=>c.label).join(', '),tiers,gates:checks};
 if(!eligible)
  return {label:'PLAN DE MEJORA',status:'blocked',score:tiers[2]?.score??0,details:'Ningún nivel alcanza '+CATEGORY_PASS_SCORE+' puntos',tiers,gates:checks};
 return {label:eligible.label,status:'qualified',score:eligible.score,details:eligible.label+' cumple '+eligible.score+' puntos y ambas condiciones de acceso',tiers,gates:checks};
}
export type MetricScoreDetail={
 id:number;section:string;name:string;unit:string;actual:number|null;
 thresholds:{senior:number|null;semiSenior:number|null;junior:number|null;improvement:number|null};
 weight:number;rank:number|null;points:number|null;maximumPoints:number;matchedCategory:string|null;note:string;
};
export function scoreBreakdown(input:SellerCategoryInput,metrics:CategoryScaleMetric[]):MetricScoreDetail[]{
 return metrics.filter(m=>m.weightPercent>0).map(m=>{
  const actual=measure(m.metricName,input);
  const available=[m.seniorValue,m.semiSeniorValue,m.juniorValue].every(v=>v!==null);
  const rank=available&&actual!==null?([m.seniorValue,m.semiSeniorValue,m.juniorValue].findIndex(v=>actual>=Number(v))):null;
  const normalizedRank=rank===null?null:rank===-1?0:3-rank;
  return {id:m.id,section:m.sectionName,name:m.metricName,unit:m.valueType,actual,
   thresholds:{senior:m.seniorValue,semiSenior:m.semiSeniorValue,junior:m.juniorValue,improvement:m.improvementValue},
   weight:m.weightPercent,rank:normalizedRank,points:normalizedRank===null?null:normalizedRank*m.weightPercent,
   maximumPoints:3*m.weightPercent,matchedCategory:normalizedRank===null?null:normalizedRank===3?'SENIOR':normalizedRank===2?'SEMI SENIOR':normalizedRank===1?'JUNIOR':'PLAN DE MEJORA',
   note:!available?'Faltan umbrales en el cuadro de escalas':actual===null?'KPI sin datos':''
  };
 });
}
