'use client';

import {useCategoryColors} from '@/components/providers/CategoryColorsProvider';
import {categoryStyle} from '@/lib/categoryColors';
import type {CategoryScaleGate,CategoryScaleMetric} from '@/lib/categoryScale';

type Tier={key:'seniorValue'|'semiSeniorValue'|'juniorValue'|'improvementValue';label:string;color:string};
const TIERS:Tier[]=[
 {key:'seniorValue',label:'SENIOR',color:'bg-emerald-700'},
 {key:'semiSeniorValue',label:'SEMI SENIOR',color:'bg-emerald-400'},
 {key:'juniorValue',label:'JUNIOR',color:'bg-yellow-400'},
 {key:'improvementValue',label:'PLAN DE MEJORA',color:'bg-red-500'},
];
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const matchMetric=(metrics:CategoryScaleMetric[],fragment:string)=>
 metrics.find(m=>normalize(m.metricName).includes(fragment));
const format=new Intl.NumberFormat('es-AR',{maximumFractionDigits:2});
const threshold=(metric:CategoryScaleMetric|undefined,key:Tier['key'])=>{
 if(!metric||key==='improvementValue')return '—';
 if(normalize(metric.metricName).includes('facturac'))return TIERS.find(t=>t.key===key)?.label??'—';
 const value=metric[key];
 if(value===null||!Number.isFinite(value))return '—';
 if(metric.valueType==='percent')return format.format(value)+'%';
 if(metric.valueType==='currency')return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(value);
 return format.format(value);
};

export default function CategoryScaleHero({metrics,gates,loading,error}:{
 metrics:CategoryScaleMetric[];gates:CategoryScaleGate[];loading:boolean;error?:string;
}){
 const {colors:categoryColors}=useCategoryColors();
 const columns=[
  {label:'Eficiencia',metric:matchMetric(metrics,'eficiencia')},
  {label:'Cobertura',metric:matchMetric(metrics,'cobertura')},
  {label:'Volumen',metric:matchMetric(metrics,'volumen')},
  {label:'% POP',metric:matchMetric(metrics,'pop')},
  {label:'% Exhibición',metric:matchMetric(metrics,'exhibic')},
 ];
 const billing=matchMetric(metrics,'facturac');
 const route=gates.find(g=>{const n=normalize(g.label);return n.includes('hora')||n.includes('ruta');});
 const effective=gates.find(g=>normalize(g.label).includes('efectividad'));
 const maxPoints=metrics.filter(m=>m.weightPercent>0).reduce((sum,m)=>sum+m.weightPercent,0);
 return <div className="relative mb-36 sm:mb-32">
  <div className="relative h-[350px] w-full bg-cover bg-bottom shadow-2xl" style={{backgroundImage:"url('/categorias.webp')"}} aria-hidden="true"/>
  <div className="absolute bottom-0 left-1/2 z-10 w-[min(1020px,calc(100%-24px))] -translate-x-1/2 translate-y-1/2 rounded-xl bg-white px-2 py-4 shadow-2xl">
   {loading?<div className="overflow-hidden px-1" role="status" aria-label="Cargando Cuadro de escalas">
    <div className="grid grid-cols-10 gap-3 bg-gray-50 px-3 py-2">{Array.from({length:10},(_,i)=><div key={i} className="h-4 rounded bg-slate-200 animate-pulse motion-reduce:animate-none"/>)}</div>
    {Array.from({length:4},(_,row)=><div key={row} className={'grid grid-cols-10 gap-3 px-3 py-2 '+(row%2?'bg-gray-50':'bg-white')}>{Array.from({length:10},(_,col)=><div key={col} className={'h-6 rounded animate-pulse motion-reduce:animate-none '+(col===0?'bg-slate-200':'bg-slate-100')}/>)}</div>)}
   </div>:
   error?<p role="alert" className="px-4 py-8 text-center text-sm text-rose-600">{error}</p>:
   metrics.length===0?<p className="px-4 py-8 text-center text-sm text-slate-500">No hay escalas configuradas.</p>:
   <div className="overflow-x-auto">
    <table className="w-full min-w-[1000px] text-left text-xs">
     <thead className="sticky top-0 z-10 bg-gray-50 uppercase text-gray-700">
      <tr>
       {['Categoría','Facturación','Horario','Efectividad','Eficiencia','Cobertura','Volumen','% POP','% Exhibición','Puntaje'].map(label=>
        <th key={label} className="px-3 py-2 font-semibold">{label}</th>
       )}
      </tr>
     </thead>
     <tbody className="text-gray-700">
      {TIERS.map((tier,index)=><tr key={tier.key} className={index%2===0?'bg-white':'bg-gray-50'}>
       <td className="px-3 py-2 font-semibold"><span style={categoryStyle(categoryColors,tier.label)} className="inline-flex items-center whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold">{tier.label}</span></td>
       <td className="px-3 py-2">{threshold(billing,tier.key)}</td>
       <td className="px-3 py-2" title={route?'Requisito: '+route.valueText:'Sin requisito configurado'}>{tier.key!=='improvementValue'&&route?route.valueText:'—'}</td>
       <td className="px-3 py-2" title={effective?'Requisito: '+effective.valueText:'Sin requisito configurado'}>{tier.key!=='improvementValue'&&effective?effective.valueText:'—'}</td>
       {columns.map(column=><td key={column.label} className="px-3 py-2">{threshold(column.metric,tier.key)}</td>)}
       <td className="px-3 py-2 font-semibold">{tier.key==='improvementValue'||!maxPoints?'—':format.format(maxPoints)}</td>
      </tr>)}
     </tbody>
    </table>
   </div>}
  </div>
 </div>;
}
