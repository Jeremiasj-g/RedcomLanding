'use client';
import {useEffect,useMemo,useState} from 'react';
import {supabase} from '@/lib/supabaseClient';
import {notify,errorMessage} from '@/lib/notifications';
import type {CategoryPanelRow} from '@/lib/categoryPanelExcel';
import type {KpiProjection} from '@/lib/categoryKpiProjections';
import WorkCalendar,{useWorkCalendar} from '@/components/category-panel/WorkCalendar';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {CalendarDays} from 'lucide-react';
import {fetchCategoryScaleConfig,type CategoryScaleMetric,type CategoryScaleGate} from '@/lib/categoryScale';
import {assessSellerCategory,scoreBreakdown,gateBreakdown,type SellerCategoryInput} from '@/lib/categoryReached';
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
 const [detail,setDetail]=useState<{name:string;branch:string;input:SellerCategoryInput;projectedCategory:string|null}|null>(null);
 const [scaleMetrics,setScaleMetrics]=useState<CategoryScaleMetric[]>([]);
 const [scaleGates,setScaleGates]=useState<CategoryScaleGate[]>([]);
 const [scaleLoaded,setScaleLoaded]=useState(false);
 useEffect(()=>{let active=true;void fetchCategoryScaleConfig().then(config=>{if(active){setScaleMetrics(config.metrics);setScaleGates(config.gates);setScaleLoaded(true);}}).catch(error=>notify.error(errorMessage(error,'No se pudieron cargar las escalas.')));return()=>{active=false;};},[]);
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
     <Popover>
      <PopoverTrigger asChild><button type="button" className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50"><CalendarDays className="h-4 w-4"/>Configurar calendario</button></PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="z-[80] w-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-[0_18px_55px_rgba(15,23,42,.13)]"><WorkCalendar month={month} excluded={excluded} onToggle={d=>void toggle(d)}/></PopoverContent>
    </Popover>
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
      <td className="px-3 py-3">{proj?.coverage_percentage==null?'—':fmt.format(proj.coverage_percentage)}</td><td className="px-3 py-3">{proj?.volume_percentage==null?'—':fmt.format(proj.volume_percentage)}</td>
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
   <p className="mt-3 text-xs text-slate-500">Categoría alcanzada: estimación ponderada a partir de las escalas configuradas. No es una categoría oficial mientras falten umbrales o se valide la regla final de clasificación.</p>
   <div role="tabpanel" className="mt-4 overflow-x-auto">
     <table className="w-full min-w-[1260px] text-left text-xs">
       <thead className="border-b border-slate-100 bg-slate-50 text-slate-600"><tr>{['Supervisor','N° vendedor · Vendedor','Horario promedio','Obj. Volumen alcanzado','Obj. Cobertura alcanzado','% Efectividad','% Eficiencia','% POP','% Exhibición','Categoría proyectada','Categoría alcanzada','Desglose'].map(h=><th key={h} className="whitespace-nowrap px-3 py-3 font-medium">{h}</th>)}</tr></thead>
       <tbody>{sellers.filter(p=>{
         const branch=branches.find(b=>b.key===branchTab);
         return branch&&p.branch===branch.branch&&(branch.force==='all'||p.force===branch.force);
       }).sort((a,b)=>a.superior.localeCompare(b.superior,'es')||a.id-b.id).map(p=>{
         const branch=branches.find(b=>b.key===branchTab)!;
         const row=rows.find(r=>r.branchKey===branchTab&&r.sellerId===p.id);
         const extra=byProjection.get(branchTab+':'+p.id),avg=stats.get(branchTab+':'+p.id);
         const effective=row&&row.visitasPlaneadas>0?row.visitados/row.visitasPlaneadas*100:null;
         const efficient=row&&row.visitados>0?row.cntFac/row.visitados*100:null;
         const input:SellerCategoryInput={
           dailyBilling:row&&counts.elapsed>0?row.importeFinalFacturado/counts.elapsed:null,
           efficiency:efficient,effectiveness:effective,
           pop:extra?.pop_percentage??null,exhibition:extra?.exhibition_percentage??null,
           volume:extra?.volume_percentage??null,coverage:extra?.coverage_percentage??null,
           routeHours:avg?avg.sum/avg.days/3600:null
         };
         const assessment=assessSellerCategory(input,scaleMetrics,scaleGates);
         const percent=(n:number|null|undefined)=>n==null?'—':n.toLocaleString('es-AR',{maximumFractionDigits:2})+'%';
         const quantity=(n:number|null|undefined)=>n==null?'—':fmt.format(n);
         return <tr key={p.branch+':'+p.force+':'+p.id} className="border-b border-slate-100 text-slate-700 hover:bg-slate-50">
          <td className="px-3 py-3">{p.superior||'Sin supervisor'}</td><td className="whitespace-nowrap px-3 py-3 font-medium">{p.id} · {p.name}</td>
          <td className="px-3 py-3">{loading?'Cargando…':avg?displayDuration(Math.round(avg.sum/avg.days)):'Sin datos'}</td>
          <td className="px-3 py-3">{quantity(extra?.volume_percentage)}</td><td className="px-3 py-3">{quantity(extra?.coverage_percentage)}</td>
          <td className="px-3 py-3">{effective==null?'—':percent(effective)}</td><td className="px-3 py-3">{efficient==null?'—':percent(efficient)}</td>
          <td className="px-3 py-3">{percent(extra?.pop_percentage)}</td><td className="px-3 py-3">{percent(extra?.exhibition_percentage)}</td><td className="px-3 py-3">{extra?.projected_category??'—'}</td><td className="px-3 py-3"><span title={scaleLoaded?assessment.details:'Cargando cuadro de escalas'} className={`inline-flex whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium ${!scaleLoaded||assessment.status==='pending'?'bg-slate-100 text-slate-500':assessment.label==='SENIOR'?'bg-emerald-100 text-emerald-800':assessment.label==='SEMI SENIOR'?'bg-green-50 text-green-700':assessment.label==='JUNIOR'?'bg-amber-100 text-amber-800':'bg-rose-100 text-rose-700'}`}>{scaleLoaded?assessment.label:'Cargando…'}{scaleLoaded&&assessment.status==='preliminary'?' · preliminar':''}</span></td><td className="px-3 py-3"><button type="button" disabled={!scaleLoaded} onClick={()=>setDetail({name:p.name,branch:branch.name,input,projectedCategory:extra?.projected_category??null})} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-50 disabled:opacity-40">Ver puntaje</button></td>
         </tr>;
       })}</tbody>
     </table>
    </div>
  </section>
  {detail&&<SellerScoreDialog name={detail.name} branch={detail.branch} input={detail.input} projectedCategory={detail.projectedCategory} metrics={scaleMetrics} gates={scaleGates} onClose={()=>setDetail(null)}/>}
 </div>;
}


function SellerScoreDialog({name,branch,input,projectedCategory,metrics,gates,onClose}:{name:string;branch:string;input:SellerCategoryInput;projectedCategory:string|null;metrics:CategoryScaleMetric[];gates:CategoryScaleGate[];onClose:()=>void}){
 const items=scoreBreakdown(input,metrics);
 const rules=gateBreakdown(input,gates);
 const points=items.reduce((n,m)=>n+(m.points??0),0);
 const max=items.reduce((n,m)=>n+(m.points===null?0:m.maximumPoints),0);
 const score=max?points/max*3:null;
 const categoryRank=(value:string|null)=>{
  const normalized=(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  return normalized==='SENIOR'?3:normalized==='SEMI SENIOR'?2:normalized==='JUNIOR'?1:normalized==='PLAN DE MEJORA'?0:null;
 };
 const buckets=[{rank:0,label:'Plan de mejora',style:'bg-rose-100 text-rose-800',bar:'bg-rose-500'},
 {rank:1,label:'Junior',style:'bg-amber-100 text-amber-800',bar:'bg-amber-500'},
 {rank:2,label:'Semi Senior',style:'bg-emerald-100 text-emerald-800',bar:'bg-emerald-400'},
 {rank:3,label:'Senior',style:'bg-emerald-100 text-emerald-900',bar:'bg-emerald-700'}];
 const scores=items.map(item=>({
  ...item,
  earnedRank:item.name.toLocaleLowerCase('es').includes('facturac')?categoryRank(projectedCategory):item.rank,
 }));
 const totalWeight=items.reduce((sum,item)=>sum+item.weight,0);
 const allocatedWeight=scores.reduce((sum,item)=>sum+(item.earnedRank===null?0:item.weight),0);
 const shares=buckets.map(bucket=>({...bucket,weight:scores.reduce((sum,item)=>sum+(item.earnedRank===bucket.rank?item.weight:0),0)}));
 const tiers=[
 {label:'Senior',key:'senior' as const,rank:3,style:'bg-emerald-700 text-white'},
 {label:'Semi Senior',key:'semiSenior' as const,rank:2,style:'bg-emerald-500 text-white'},
 {label:'Junior',key:'junior' as const,rank:1,style:'bg-amber-400 text-slate-900'}
 ];
 const comparison=tiers.map(tier=>({
  ...tier,
  lines:scores.map(item=>{
   const projected=item.name.toLowerCase().includes('facturac');
   const required=projected?tier.label.toUpperCase():item.thresholds[tier.key];
   const actualRank=projected?categoryRank(projectedCategory):item.rank;
   const known=projected?actualRank!==null:item.actual!==null&&required!==null;
   const pass=known?(projected?(actualRank as number)>=tier.rank:(item.actual as number)>=(required as number)):null;
   return {...item,projected,required,pass};
  })
 }));
 const [detailView,setDetailView]=useState<'comparison'|'data'>('comparison');
 const fmtScore=(n:number|null)=>n===null?'—':n.toLocaleString('es-AR',{maximumFractionDigits:2});
 const show=(n:number|null,unit:string)=>n===null?'—':(unit==='currency'?new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(n):fmtScore(n)+(unit==='percent'?'%':''));
 return <div role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}} className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm">
 <section role="dialog" aria-modal="true" aria-labelledby="seller-score-title" className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[26px] bg-white p-5 shadow-2xl sm:p-7">
  <div className="flex items-start justify-between gap-4">
   <div><h2 id="seller-score-title" className="text-xl font-semibold text-slate-900">Detalle de puntaje · {name}</h2><p className="mt-1 text-sm text-slate-500">{branch} · comparación con el Cuadro de escalas</p></div>
   <button type="button" onClick={onClose} aria-label="Cerrar detalle" className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">Cerrar</button>
  </div>
  <div className="mt-6 flex justify-center"><div className="inline-flex rounded-xl bg-slate-100 p-1">
   <button type="button" onClick={()=>setDetailView('comparison')} className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${detailView==='comparison'?'bg-white text-slate-900 shadow-sm':'text-slate-500'}`}>Comparación</button>
   <button type="button" onClick={()=>setDetailView('data')} className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${detailView==='data'?'bg-white text-slate-900 shadow-sm':'text-slate-500'}`}>Datos + cálculos</button>
  </div></div>
  {detailView==='comparison'?<div className="mt-5 grid gap-4 lg:grid-cols-3">
   {comparison.map(tier=>{
    const total=tier.lines.reduce((n,item)=>n+(item.pass?item.weight:0),0);
    const maximum=tier.lines.reduce((n,item)=>n+item.weight,0);
    return <div key={tier.label} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_5px_24px_rgba(15,23,42,.04)]">
     <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-4"><span className={`rounded-md px-2 py-1 text-xs font-semibold ${tier.style}`}>{tier.label}</span><span className="text-xs text-slate-500">Puntos <strong className="font-semibold text-slate-900">{fmtScore(total)}/{fmtScore(maximum)}</strong></span></div>
     <div className="divide-y divide-slate-100 px-4">
      {tier.lines.map(item=><div key={item.id} className="py-3">
       <div className="flex items-start justify-between gap-3"><span className="text-sm font-medium text-slate-900">{item.projected?'Categoría proyectada':item.name}</span><span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${item.pass===true?'bg-blue-50 text-blue-700':item.pass===false?'bg-slate-100 text-slate-500':'bg-amber-50 text-amber-700'}`}>{item.pass===null?'—':item.pass?'+'+fmtScore(item.weight):'0'}</span></div>
       <p className="mt-1 text-xs text-slate-500">Requerido: {item.projected?tier.label.toUpperCase():show(item.required as number|null,item.unit)}</p>
       <p className={`mt-0.5 text-xs ${item.pass===true?'text-emerald-700':item.pass===false?'text-rose-600':'text-slate-500'}`}>Alcanzado: {item.projected?projectedCategory??'Sin cargar':show(item.actual,item.unit)}</p>
      </div>)}
     </div>
    </div>;
   })}
  </div>:<div className="mt-5 space-y-4">
   <div className="grid grid-cols-2 gap-4 border-y border-slate-100 py-4 sm:grid-cols-3">
    <div><p className="text-xs text-slate-500">Puntaje ponderado provisional</p><p className="text-xl font-semibold">{fmtScore(score)} / 3</p></div>
    <div><p className="text-xs text-slate-500">Puntos evaluables</p><p className="text-xl font-semibold">{fmtScore(points)} / {fmtScore(max)}</p></div>
    <div><p className="text-xs text-slate-500">Indicadores pendientes</p><p className="text-xl font-semibold">{items.filter(x=>x.points===null).length}</p></div>
   </div>
   <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-50"><tr>{['Indicador','KPI real','Junior','Semi Senior','Senior','Peso'].map(label=><th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{items.map(item=><tr key={item.id} className="border-b border-slate-100">
    <td className="px-3 py-3">{item.name}</td><td className="px-3 py-3">{item.name.toLowerCase().includes('facturac')?projectedCategory??'—':show(item.actual,item.unit)}</td>
    <td className="px-3 py-3">{item.thresholds.junior===null?'—':show(item.thresholds.junior,item.unit)}</td><td className="px-3 py-3">{item.thresholds.semiSenior===null?'—':show(item.thresholds.semiSenior,item.unit)}</td><td className="px-3 py-3">{item.thresholds.senior===null?'—':show(item.thresholds.senior,item.unit)}</td><td className="px-3 py-3">{fmtScore(item.weight)}%</td>
   </tr>)}</tbody></table></div>
  </div>}
  <h3 className="mt-7 text-sm font-semibold text-slate-900">Condiciones de acceso a categoría</h3>
  <div className="mt-3 divide-y divide-slate-100">{rules.map(rule=><div key={rule.label} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span>{rule.label}</span><span className="text-slate-500">Real: {fmtScore(rule.actual)} {rule.unit} · mínimo: {fmtScore(rule.required)} {rule.unit}</span><span className={rule.passed===null?'text-slate-500':rule.passed?'text-emerald-600':'text-rose-600'}>{rule.passed===null?'Sin evaluar':rule.passed?'Cumple':'No cumple'}</span></div>)}</div>
 </section></div>;
}
