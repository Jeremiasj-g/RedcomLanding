'use client';
import {CalendarDays,ChevronRight,ClipboardList} from 'lucide-react';
import type {useVendorProfileOverview} from './useVendorProfileOverview';

const tones:Record<string,string>={
 SENIOR:'bg-emerald-800 text-white',
 'SEMI SENIOR':'bg-emerald-200 text-emerald-950',
 JUNIOR:'bg-amber-200 text-amber-950',
 'PLAN DE MEJORA':'bg-rose-200 text-rose-950',
};
const monthLabel=(month:string)=>new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));
type Overview=ReturnType<typeof useVendorProfileOverview>;
export default function VendorProfileSummary({overview,tenure,hireLoading}:{overview:Overview;tenure:{label:string;date:string}|null;hireLoading:boolean}){
 const navigate=(section:'category'|'plan')=>(event:React.MouseEvent<HTMLAnchorElement>)=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();window.dispatchEvent(new CustomEvent('redcom:profile-navigate',{detail:section}));
 };
 return <div className="mt-5 space-y-4">
  <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
   <div className="flex items-center gap-2 text-sm text-slate-600"><CalendarDays className="h-4 w-4"/>Fecha de ingreso</div>
   {hireLoading?<div role="status" aria-label="Cargando fecha de ingreso" className="mt-3 h-9 w-40 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none"/>:
    tenure?<><p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-slate-950">{tenure.date}</p><p className="mt-1 text-sm text-slate-500">{tenure.label} en la empresa</p></>:<p className="mt-3 text-lg font-medium text-slate-700">Pendiente de registrar</p>}
  </section>
  <section aria-label="Mis categorías">
   <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-base font-medium text-slate-950">Mis categorías</h2><a href="/perfil?seccion=category" onClick={navigate('category')} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2">Ver detalles<ChevronRight className="h-4 w-4"/></a></div>
   <div className="grid grid-cols-2 gap-3">
    {[overview.currentMonth,overview.previousMonth].map((month,index)=>{
     const label=overview.categories[index];const error=overview.categoryErrors[index];
     return <div key={month} className={'min-w-0 rounded-2xl p-4 sm:rounded-3xl sm:p-6 '+(!overview.categoriesLoading&&!error&&label?tones[label]??'bg-white text-slate-900':'bg-white text-slate-700')}>
      <p className="text-xs font-medium opacity-90">{index===0?'Categoría actual':'Mes anterior'}</p>
      {overview.categoriesLoading?<div className="mt-4 h-8 w-full max-w-40 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none"/>:<p className="mt-3 break-words text-base font-semibold leading-tight sm:text-2xl">{error?'No disponible':label??'Sin datos'}</p>}
      <p className="mt-2 text-[11px] capitalize opacity-90 sm:text-xs">{monthLabel(month)}</p>
     </div>;
    })}
   </div>
  </section>
  <a href="/perfil?seccion=plan" onClick={navigate('plan')} className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-5 transition-colors duration-200 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-600 sm:p-6">
   <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700"><ClipboardList className="h-6 w-6"/></span>
   <div className="min-w-0 flex-1"><h2 className="text-sm font-medium text-slate-950">Planes de acción</h2>
    {overview.plansLoading?<div className="mt-2 h-6 w-36 max-w-full animate-pulse rounded bg-slate-100 motion-reduce:animate-none"/>:<p className="mt-1 text-lg font-semibold text-slate-900">{overview.plansError?'No disponible':overview.plans.length?overview.plans.length+' '+(overview.plans.length===1?'plan asignado':'planes asignados'):'Sin planes asignados'}</p>}
    <p className="mt-1 text-xs text-slate-500">Ver detalles en Mi plan</p>
   </div><ChevronRight className="h-5 w-5 shrink-0 text-slate-400"/>
  </a>
 </div>;
}
