'use client';
import {useEffect,useMemo,useState} from 'react';
import {supabase} from '@/lib/supabaseClient';
import {notify,errorMessage} from '@/lib/notifications';
import type {CategoryPanelRow} from '@/lib/categoryPanelExcel';
import type {KpiProjection} from '@/lib/categoryKpiProjections';
import WorkCalendar,{useWorkCalendar} from '@/components/category-panel/WorkCalendar';
type Daily={visit_date:string;branch:string;sales_force:string;seller_id:number|null;seller_name:string;first_visit:string|null;last_visit:string|null;corrected_start:string|null;corrected_end:string|null;reason:string|null};
const branches=[
 {key:'corrientes_masivos',name:'Corrientes',branch:'CASA CENTRAL',force:'ESQUEMA 1'},
 {key:'corrientes_refrigerados',name:'Refrigerados',branch:'CASA CENTRAL',force:'ESQUEMA REGRIGERADOS'},
 {key:'chaco',name:'Chaco',branch:'SUCURSAL RESISTENCIA',force:'all'},
 {key:'misiones',name:'Misiones',branch:'SUCURSAL POSADAS',force:'all'},
 {key:'obera',name:'Oberá',branch:'SUCURSAL OBERA',force:'all'},
] as const;
const currentMonth=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
const followingMonth=(v:string)=>{const [y,m]=v.split('-').map(Number),d=new Date(y,m,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
const fmt=new Intl.NumberFormat('es-AR');
const money=new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2});
const duration=(start:string|null,end:string|null)=>{
 if(!start||!end)return null;
 const seconds=(v:string)=>{const [h,m,s]=v.split(':').map(Number);return h*3600+m*60+(s||0)};
 const result=seconds(end)-seconds(start);
 return Number.isFinite(result)&&result>=0?result:null;
};
const displayDuration=(v:number)=>[Math.floor(v/3600),Math.floor(v%3600/60),Math.round(v%60)].map(x=>String(x).padStart(2,'0')).join(':');
export default function CategoryUnifiedOverview({rows,projections}:{rows:CategoryPanelRow[];projections:KpiProjection[]}){
 const [month,setMonth]=useState(currentMonth);
 const [daily,setDaily]=useState<Daily[]>([]);
 const [loading,setLoading]=useState(true);
 const [branchTab,setBranchTab]=useState<string>('corrientes_masivos');
 const [search,setSearch]=useState('');
 const {counts,excluded,loading:calendarLoading,toggle}=useWorkCalendar(month);
 const [personnel,setPersonnel]=useState<Array<{id:number;name:string;branch:string;role:string;superior:string;force:string}>>([]);
 useEffect(()=>{void supabase.from('category_commercial_personnel').select('people').eq('id',1).maybeSingle().then(({data,error})=>{if(error)notify.error(errorMessage(error,'No se pudo cargar Personal comercial.'));else setPersonnel(Array.isArray(data?.people)?data.people:[]);});},[]);
 useEffect(()=>{
  let active=true;setLoading(true);setDaily([]);
  (async()=>{
   const records:Daily[]=[];let offset=0;
   while(active){
    const {data,error}=await supabase.from('category_sigo_daily').select('visit_date,branch,sales_force,seller_id,seller_name,first_visit,last_visit,corrected_start,corrected_end,reason').gte('visit_date',month+'-01').lt('visit_date',followingMonth(month)+'-01').order('visit_date').range(offset,offset+999);
    if(error)throw error;
    records.push(...(data??[]) as Daily[]);
    if((data??[]).length<1000)break;offset+=1000;
   }
   if(active)setDaily(records);
  })().catch(e=>{if(active)notify.error(errorMessage(e,'No se pudieron cargar los horarios del mes.'));}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[month]);
 const stats=useMemo(()=>{
  const group=new Map<string,{sum:number;days:number}>();
  for(const day of daily){
   if(day.seller_id===null||day.reason)continue;
   const branch=branches.find(b=>b.branch===day.branch&&(b.force==='all'||b.force===day.sales_force));
   if(!branch)continue;
   const value=duration(day.corrected_start??day.first_visit,day.corrected_end??day.last_visit);
   if(value===null)continue;
   const key=branch.key+':'+day.seller_id;
   const prev=group.get(key)??{sum:0,days:0};prev.sum+=value;prev.days++;group.set(key,prev);
  }
  return group;
 },[daily]);
 const byProjection=useMemo(()=>new Map(projections.map(p=>[p.branch_key+':'+p.seller_id,p])),[projections]);
 const sellers=useMemo(()=>personnel.filter(p=>p.role?.toUpperCase()==='VENDEDOR'),[personnel]);
 const filtered=useMemo(()=>rows.filter(r=>(r.sellerName+' '+r.branchLabel+' '+r.sellerId).toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))),[rows,search]);
 return <div className="mt-6 space-y-6">
  <section className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,.055)]">
   <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-5">
    <div><h2 className="text-xl font-semibold text-slate-900">Reportes unificados y horarios</h2><p className="mt-1 text-xs text-slate-500">Datos guardados de KPIs y promedio diario SIGO del mes seleccionado.</p></div>
    <label className="flex items-center gap-2 text-xs text-slate-600">Mes <input type="month" aria-label="Mes de horarios" value={month} onChange={e=>{if(/^\d{4}-\d{2}$/.test(e.target.value))setMonth(e.target.value)}} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"/></label>
   </div>
   <div className="flex flex-wrap items-center gap-5 border-b border-slate-100 px-5 py-3">
     <div><div className="text-xs text-slate-500">Días laborales transcurridos</div><div className="text-2xl font-semibold">{calendarLoading?'—':counts.elapsed}</div></div>
     <div><div className="text-xs text-slate-500">Días laborales del mes</div><div className="text-2xl font-semibold">{calendarLoading?'—':counts.total}</div></div>
     <details className="ml-auto"><summary className="cursor-pointer text-sm font-medium text-blue-700">Configurar calendario</summary><div className="absolute z-30 mt-2 bg-white shadow-xl"><WorkCalendar month={month} excluded={excluded} onToggle={d=>void toggle(d)}/></div></details>
   </div>
   <div className="border-b border-slate-100 px-5 py-3"><input aria-label="Buscar vendedor" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar vendedor, ID o sucursal" className="h-10 w-full max-w-sm rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300"/></div>
   <div className="max-h-[650px] overflow-auto">
    <table className="w-full min-w-[1680px] text-left text-xs"><thead className="sticky top-0 z-10 bg-slate-50 text-slate-600"><tr>
     {['Sucursal','Sector','ID','Vendedor','Visitados','Venta distancia','Venta PDV','Visitas planeadas','Facturación','Facturas','Facturación diaria','Categoría proyectada','POP','Exhibición','Cobertura','Volumen','Horario promedio','Días válidos'].map(t=><th key={t} className="whitespace-nowrap px-3 py-3 font-medium">{t}</th>)}
    </tr></thead><tbody>{filtered.map(row=>{
     const key=row.branchKey+':'+row.sellerId,proj=byProjection.get(key),avg=stats.get(key);
     return <tr key={key} className="border-t border-slate-100 text-slate-700 hover:bg-slate-50/70">
      <td className="whitespace-nowrap px-3 py-3">{row.branchLabel}</td><td className="px-3 py-3">{row.sector}</td><td className="px-3 py-3">{row.sellerId}</td>
      <td className="whitespace-nowrap px-3 py-3 font-medium">{row.sellerName}</td>
      <td className="px-3 py-3">{fmt.format(row.visitados)}</td><td className="px-3 py-3">{fmt.format(row.ventaDistancia)}</td><td className="px-3 py-3">{fmt.format(row.ventaPdv)}</td><td className="px-3 py-3">{fmt.format(row.visitasPlaneadas)}</td>
      <td className="whitespace-nowrap px-3 py-3">{money.format(row.importeFinalFacturado)}</td><td className="px-3 py-3">{fmt.format(row.cntFac)}</td>
      <td className="whitespace-nowrap px-3 py-3">{counts.elapsed>0?money.format(row.importeFinalFacturado/counts.elapsed):'—'}</td>
      <td className="px-3 py-3">{proj?.projected_category??'—'}</td><td className="px-3 py-3">{proj?.pop_percentage==null?'—':proj.pop_percentage+'%'}</td><td className="px-3 py-3">{proj?.exhibition_percentage==null?'—':proj.exhibition_percentage+'%'}</td>
      <td className="px-3 py-3">{proj?.coverage_percentage==null?'—':proj.coverage_percentage+'%'}</td><td className="px-3 py-3">{proj?.volume_percentage==null?'—':proj.volume_percentage+'%'}</td>
      <td className="px-3 py-3 font-medium">{loading?'Cargando…':avg?displayDuration(Math.round(avg.sum/avg.days)):'Sin datos'}</td><td className="px-3 py-3">{loading?'—':avg?.days??0}</td>
     </tr>})}</tbody></table>
    {!filtered.length&&<p className="px-5 py-8 text-center text-sm text-slate-500">No hay vendedores para mostrar.</p>}
   </div>
   <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">El promedio considera días con inicio y fin válidos (corregidos cuando corresponda) y excluye días con motivo registrado. No se inventan horarios faltantes.</p>
  </section>
  <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,.055)]">
   <h2 className="text-lg font-semibold text-slate-900">Categorías por sucursal</h2>
   <div role="tablist" aria-label="Sucursales" className="mt-4 flex flex-wrap gap-2 border-b border-slate-100 pb-4">
    {branches.map(b=><button key={b.key} type="button" role="tab" aria-selected={branchTab===b.key} onClick={()=>setBranchTab(b.key)} className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${branchTab===b.key?'bg-emerald-600 text-white':'text-slate-600 hover:bg-slate-100'}`}>{b.name}</button>)}
   </div>
   <div role="tabpanel" className="mt-4 overflow-x-auto">
     <table className="w-full min-w-[1260px] text-left text-xs">
       <thead className="border-b border-slate-100 bg-slate-50 text-slate-600"><tr>{['Supervisor','N° vendedor · Vendedor','Horario promedio','Obj. Volumen alcanzado','Obj. Cobertura alcanzado','% Efectividad','% Eficiencia','% POP','% Exhibición','Categoría proyectada'].map(h=><th key={h} className="whitespace-nowrap px-3 py-3 font-medium">{h}</th>)}</tr></thead>
       <tbody>{sellers.filter(p=>{
         const branch=branches.find(b=>b.key===branchTab);
         return branch&&p.branch===branch.branch&&(branch.force==='all'||p.force===branch.force);
       }).sort((a,b)=>a.superior.localeCompare(b.superior,'es')||a.id-b.id).map(p=>{
         const branch=branches.find(b=>b.key===branchTab)!;
         const row=rows.find(r=>r.branchKey===branchTab&&r.sellerId===p.id);
         const extra=byProjection.get(branchTab+':'+p.id),avg=stats.get(branchTab+':'+p.id);
         const effective=row&&row.visitasPlaneadas>0?row.visitados/row.visitasPlaneadas*100:null;
         const efficient=row&&row.visitados>0?row.cntFac/row.visitados*100:null;
         const percent=(n:number|null|undefined)=>n==null?'—':n.toLocaleString('es-AR',{maximumFractionDigits:2})+'%';
         return <tr key={p.branch+':'+p.force+':'+p.id} className="border-b border-slate-100 text-slate-700 hover:bg-slate-50">
          <td className="px-3 py-3">{p.superior||'Sin supervisor'}</td><td className="whitespace-nowrap px-3 py-3 font-medium">{p.id} · {p.name}</td>
          <td className="px-3 py-3">{loading?'Cargando…':avg?displayDuration(Math.round(avg.sum/avg.days)):'Sin datos'}</td>
          <td className="px-3 py-3">{percent(extra?.volume_percentage)}</td><td className="px-3 py-3">{percent(extra?.coverage_percentage)}</td>
          <td className="px-3 py-3">{effective==null?'—':percent(effective)}</td><td className="px-3 py-3">{efficient==null?'—':percent(efficient)}</td>
          <td className="px-3 py-3">{percent(extra?.pop_percentage)}</td><td className="px-3 py-3">{percent(extra?.exhibition_percentage)}</td><td className="px-3 py-3">{extra?.projected_category??'—'}</td>
         </tr>;
       })}</tbody>
     </table>
    </div>
  </section>
 </div>;
}
