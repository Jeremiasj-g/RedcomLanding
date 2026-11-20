import type { CategoryScaleGate, CategoryScaleMetric } from '@/lib/categoryScale';
import type {MonthlyConsideration} from '@/lib/categoryMonthlyConsiderations';

export type SellerCategoryInput = {
 dailyBilling:number|null; efficiency:number|null; effectiveness:number|null;
 pop:number|null; exhibition:number|null; volume:number|null; coverage:number|null; routeHours:number|null;
};

export const CATEGORY_PASS_SCORE=75;
export const DEFAULT_ROUTE_MINUTES=5*60+20;
export const DEFAULT_EFFECTIVENESS=90;
/** Tolerancia comercial en puntos porcentuales, sin modificar el dato real. */
export const CATEGORY_PERCENT_TOLERANCE=1;
export type CategoryLevel='JUNIOR'|'SEMI SENIOR'|'SENIOR';
export type CategoryAssessment={label:string;status:'qualified'|'pending'|'blocked';score:number|null;details:string;tiers:TierAssessment[];gates:GateAssessment[]};
export type TierAssessment={label:CategoryLevel;score:number;maximum:number;passed:boolean;missing:string[];lines:TierMetricAssessment[]};
export type TierMetricAssessment={id:number;name:string;unit:string;weight:number;actual:number|null;required:number|string|null;passed:boolean|null;projected:boolean;considered:boolean;rawPassed:boolean|null};
export type GateAssessment={label:string;actual:number|null;required:number;unit:string;passed:boolean|null;considered:boolean;rawPassed:boolean|null;kind:'route'|'effectiveness'};

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
/** Volumen y cobertura exigen el valor completo. El horario de ruta se verifica por separado. */
function hasPercentageTolerance(name:string,valueType?:string){
 const n=normalized(name);
 if(n.includes('volumen')||n.includes('cobertura')||n.includes('hora')||n.includes('ruta'))return false;
 return ['efectividad','eficiencia','pop','exhibic'].some(token=>n.includes(token)) || valueType==='percent';
}
function meetsRequirement(actual:number,required:number,tolerance=0){
 return actual+1e-9>=required-tolerance;
}
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
  // 5.20 hs significa cinco horas y veinte minutos, no cinco horas decimales.
  const hourMinute=/(\d{1,2})[.,](\d{2})(?:\s*(?:h|hs|hora|horas))?\b/i.exec(text);
  if(hourMinute){const minutes=Number(hourMinute[2]);return minutes<60?Number(hourMinute[1])+minutes/60:null;}
 }
 const raw=text.match(/\d+(?:\.\d+)?/);
 return raw?Number(raw[0]):null;
}
export function gateBreakdown(input:SellerCategoryInput,gates:CategoryScaleGate[],consideration?:MonthlyConsideration|null):GateAssessment[]{
 const defs=[
  {kind:'route' as const,label:'Horario de ruta',fallback:DEFAULT_ROUTE_MINUTES/60,actual:input.routeHours,unit:'h'},
  {kind:'effectiveness' as const,label:'Efectividad',fallback:DEFAULT_EFFECTIVENESS,actual:input.effectiveness,unit:'%'},
 ];
 return defs.map(def=>{
  const configured=gates.find(g=>{const n=normalized(g.label);return def.kind==='route'?n.includes('hora')||n.includes('ruta'):n.includes('efectividad')});
  const parsed=configured?parseRequirement(configured.valueText,def.kind):null;
  const required=parsed??def.fallback;
  const actual=def.actual!==null&&Number.isFinite(def.actual)?def.actual:null;
  const rawPassed=actual===null?null:meetsRequirement(actual,required,def.kind==='effectiveness'?CATEGORY_PERCENT_TOLERANCE:0);
  const considered=Boolean(consideration?.gate_exemptions?.[def.kind])&&rawPassed!==true;
  return {kind:def.kind,label:def.label,unit:def.unit,required,actual,rawPassed,considered,passed:considered?true:rawPassed};
 });
}
export function scoreByCategory(input:SellerCategoryInput,projectedCategory:string|null,metrics:CategoryScaleMetric[],consideration?:MonthlyConsideration|null):TierAssessment[]{
 const active=metrics.filter(m=>m.weightPercent>0);
 const projectedRank=categoryRank(projectedCategory);
 return tierKeys.map(tier=>{
  const lines=active.map(metric=>{
   const projected=projectedMetric(metric.metricName);
   const actual=projected?null:measure(metric.metricName,input);
   const required=projected?tier.label:metric[tier.key];
   const rawPassed=projected
    ?projectedRank===null?null:projectedRank>=tier.rank
    :actual===null||!Number.isFinite(actual)||typeof required!=='number'?null:meetsRequirement(actual,required,hasPercentageTolerance(metric.metricName,metric.valueType)?CATEGORY_PERCENT_TOLERANCE:0);
   const level=consideration?.metric_levels?.[String(metric.id)];
   const recognizedRank=level==='senior'?3:level==='semi'?2:level==='junior'?1:0;
   const considered=recognizedRank>=tier.rank&&rawPassed!==true;
   const passed=considered?true:rawPassed;
   return {id:metric.id,name:metric.metricName,unit:metric.valueType,weight:metric.weightPercent,actual,required,passed,rawPassed,considered,projected} satisfies TierMetricAssessment;
  });
  const score=lines.reduce((sum,line)=>sum+(line.passed===true?line.weight:0),0);
  const maximum=lines.reduce((sum,line)=>sum+line.weight,0);
  return {label:tier.label,score,maximum,passed:score+1e-9>=CATEGORY_PASS_SCORE,missing:lines.filter(line=>line.passed===null).map(line=>line.name),lines};
 });
}
export function assessSellerCategory(input:SellerCategoryInput,metrics:CategoryScaleMetric[],gates:CategoryScaleGate[],projectedCategory:string|null=null,consideration?:MonthlyConsideration|null):CategoryAssessment{
 const tiers=scoreByCategory(input,projectedCategory,metrics,consideration);
 const checks=gateBreakdown(input,gates,consideration);
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
  const tolerance=hasPercentageTolerance(m.metricName,m.valueType)?CATEGORY_PERCENT_TOLERANCE:0;
  const rank=available&&actual!==null?([m.seniorValue,m.semiSeniorValue,m.juniorValue].findIndex(v=>meetsRequirement(actual,Number(v),tolerance))):null;
  const normalizedRank=rank===null?null:rank===-1?0:3-rank;
  return {id:m.id,section:m.sectionName,name:m.metricName,unit:m.valueType,actual,
   thresholds:{senior:m.seniorValue,semiSenior:m.semiSeniorValue,junior:m.juniorValue,improvement:m.improvementValue},
   weight:m.weightPercent,rank:normalizedRank,points:normalizedRank===null?null:normalizedRank*m.weightPercent,
   maximumPoints:3*m.weightPercent,matchedCategory:normalizedRank===null?null:normalizedRank===3?'SENIOR':normalizedRank===2?'SEMI SENIOR':normalizedRank===1?'JUNIOR':'PLAN DE MEJORA',
   note:!available?'Faltan umbrales en el cuadro de escalas':actual===null?'KPI sin datos':''
  };
 });
}
