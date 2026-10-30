import type {CategoryScaleGate,CategoryScaleMetric} from '@/lib/categoryScale';
export type SellerCategoryInput={dailyBilling:number|null;efficiency:number|null;effectiveness:number|null;pop:number|null;exhibition:number|null;volume:number|null;coverage:number|null;routeHours:number|null};
export type CategoryAssessment={label:string;status:'preliminary'|'pending'|'blocked';score:number|null;details:string};
const tiers=[{label:'SENIOR',value:'seniorValue',rank:3},{label:'SEMI SENIOR',value:'semiSeniorValue',rank:2},{label:'JUNIOR',value:'juniorValue',rank:1},{label:'PLAN DE MEJORA',value:'improvementValue',rank:0}] as const;
const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function measure(name:string,x:SellerCategoryInput):number|null{
 const n=normalized(name);
 if(n.includes('facturac'))return x.dailyBilling;
 if(n.includes('eficiencia'))return x.efficiency;
 if(n.includes('exhibic'))return x.exhibition;
 if(n.includes('pop'))return x.pop;
 if(n.includes('volumen'))return x.volume;
 if(n.includes('cobertura'))return x.coverage;
 return null;
}
function threshold(v:number,metric:CategoryScaleMetric){
 const rank=tiers.find(t=>{const limit=metric[t.value];return limit!==null&&v>=limit;});
 return rank?.rank??0;
}
export function assessSellerCategory(x:SellerCategoryInput,metrics:CategoryScaleMetric[],gates:CategoryScaleGate[]):CategoryAssessment{
 const active=metrics.filter(m=>m.weightPercent>0);
 if(!active.length)return {label:'Sin escala',status:'pending',score:null,details:'No hay indicadores ponderados'};
 const incomplete=active.filter(m=>tiers.slice(0,3).some(t=>m[t.value]===null));
 const eligible=active.filter(m=>!incomplete.includes(m));
 let sum=0,weight=0;const missing:string[]=[];
 for(const m of eligible){const v=measure(m.metricName,x);if(v===null||!Number.isFinite(v)){missing.push(m.metricName);continue;}sum+=threshold(v,m)*m.weightPercent;weight+=m.weightPercent;}
 if(!weight)return {label:'Sin datos',status:'pending',score:null,details:'Faltan indicadores para calcular la categoría'};
 const score=sum/weight;
 const label=score>=2.5?'SENIOR':score>=1.5?'SEMI SENIOR':score>=.5?'JUNIOR':'PLAN DE MEJORA';
 const gateFailures:string[]=[];const gateMissing:string[]=[];
 for(const gate of gates){
  const name=normalized(gate.label),value=name.includes('hora')?x.routeHours:name.includes('efectividad')?x.effectiveness:null;
  const target=Number(gate.valueText.replace(',','.').match(/\d+(?:\.\d+)?/)?.[0]);
  if(value===null||!Number.isFinite(target)){gateMissing.push(gate.label);continue;}
  if(value<target)gateFailures.push(gate.label);
 }
 const issues=[...incomplete.map(m=>'Sin umbral: '+m.metricName),...missing.map(m=>'Sin dato: '+m),...gateMissing.map(m=>'Condición sin verificar: '+m)];
 // Las puertas de apertura se consideran obligatorias; no se presenta la categoria como definitiva.
 if(gateFailures.length)return {label:'PLAN DE MEJORA',status:'blocked',score,details:'No cumple: '+gateFailures.join(', ')};
 return {label,status:'preliminary',score,details:issues.length?issues.join(' · '):'Clasificación preliminar ponderada; pendiente de validar la regla final de agregación'};
}

export type MetricScoreDetail={
 id:number;section:string;name:string;unit:string;actual:number|null;
 thresholds:{senior:number|null;semiSenior:number|null;junior:number|null;improvement:number|null};
 weight:number;rank:number|null;points:number|null;maximumPoints:number;
 matchedCategory:string|null;note:string;
};
export function scoreBreakdown(input:SellerCategoryInput,metrics:CategoryScaleMetric[]):MetricScoreDetail[]{
 return metrics.filter(m=>m.weightPercent>0).map(m=>{
  const actual=measure(m.metricName,input);
  const complete=tiers.slice(0,3).every(t=>m[t.value]!==null);
  const rank=actual!==null&&Number.isFinite(actual)&&complete?threshold(actual,m):null;
  return {id:m.id,section:m.sectionName,name:m.metricName,unit:m.valueType,
   actual,thresholds:{senior:m.seniorValue,semiSenior:m.semiSeniorValue,junior:m.juniorValue,improvement:m.improvementValue},
   weight:m.weightPercent,rank,points:rank===null?null:rank*m.weightPercent,
   maximumPoints:3*m.weightPercent,matchedCategory:rank===null?null:tiers.find(t=>t.rank===rank)?.label??null,
   note:!complete?'Faltan umbrales en el cuadro de escalas':actual===null?'KPI sin datos':''
  };
 });
}
export function gateBreakdown(input:SellerCategoryInput,gates:CategoryScaleGate[]){
 return gates.map(g=>{
  const label=normalized(g.label);
  const actual=label.includes('hora')?input.routeHours:label.includes('efectividad')?input.effectiveness:null;
  const required=Number(g.valueText.replace(',','.').match(/\\d+(?:\\.\\d+)?/)?.[0]);
  return {label:g.label,actual,required:Number.isFinite(required)?required:null,
   unit:label.includes('hora')?'h':label.includes('efectividad')?'%':'',
   passed:actual===null||!Number.isFinite(required)?null:actual>=required};
 });
}
