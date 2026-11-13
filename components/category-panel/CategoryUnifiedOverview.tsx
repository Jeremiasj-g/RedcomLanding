'use client';
import {useEffect,useMemo,useState} from 'react';
import {supabase} from '@/lib/supabaseClient';
import {notify,errorMessage} from '@/lib/notifications';
import type {CategoryPanelRow} from '@/lib/categoryPanelExcel';
import type {KpiProjection} from '@/lib/categoryKpiProjections';
import WorkCalendar,{useWorkCalendar} from '@/components/category-panel/WorkCalendar';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {CalendarDays,Download,ChevronDown} from 'lucide-react';
import {exportSellerCategoryExcel} from '@/lib/exportSellerCategoryExcel';
import SellerDataCalculations from '@/components/category-panel/SellerDataCalculations';
import {FilterableCategoryTable,type FilterColumn} from '@/components/category-panel/CategoryColumnFilters';
import {fetchCategoryScaleConfig,type CategoryScaleMetric,type CategoryScaleGate} from '@/lib/categoryScale';
import {assessSellerCategory,gateBreakdown,scoreByCategory,CATEGORY_PASS_SCORE,type SellerCategoryInput} from '@/lib/categoryReached';
type Daily={visit_date:string;branch:string;sales_force:string;seller_id:number|null;seller_name:string;first_visit:string|null;last_visit:string|null;corrected_start:string|null;corrected_end:string|null;reason:string|null};
const branches=[
 {key:'corrientes_masivos',name:'Corrientes',branch:'CASA CENTRAL',force:'ESQUEMA 1'},
 {key:'corrientes_refrigerados',name:'Refrigerados',branch:'CASA CENTRAL',force:'ESQUEMA REGRIGERADOS'},
 {key:'chaco',name:'Chaco',branch:'SUCURSAL RESISTENCIA',force:'all'},
 {key:'misiones',name:'Misiones',branch:'SUCURSAL POSADAS',force:'all'},
 {key:'obera',name:'Oberá',branch:'SUCURSAL OBERA',force:'all'},
] as const;
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
export default function CategoryUnifiedOverview({rows,projections,month,onMonthChange,availableMonths,loadingMonth}:{rows:CategoryPanelRow[];projections:KpiProjection[];month:string;onMonthChange:(month:string)=>void;availableMonths:string[];loadingMonth:boolean}){
 const [daily,setDaily]=useState<Daily[]>([]);
 const [loading,setLoading]=useState(true);
 const [branchTab,setBranchTab]=useState<string>('corrientes_masivos');
 const [search,setSearch]=useState('');
 const [detail,setDetail]=useState<{name:string;branch:string;input:SellerCategoryInput;projectedCategory:string|null;row:CategoryPanelRow|null}|null>(null);
 const [scaleMetrics,setScaleMetrics]=useState<CategoryScaleMetric[]>([]);
 const [scaleGates,setScaleGates]=useState<CategoryScaleGate[]>([]);
 const [scaleLoaded,setScaleLoaded]=useState(false);
 useEffect(()=>{let active=true;void fetchCategoryScaleConfig().then(config=>{if(active){setScaleMetrics(config.metrics);setScaleGates(config.gates);setScaleLoaded(true);}}).catch(error=>notify.error(errorMessage(error,'No se pudieron cargar las escalas.')));return()=>{active=false;};},[]);
 const {counts,excluded,loading:calendarLoading,toggle}=useWorkCalendar(month);
 const [personnel,setPersonnel]=useState<Array<{id:number;name:string;branch:string;role:string;superior:string;force:string}>>([]);
 useEffect(()=>{void supabase.from('category_commercial_personnel').select('people').eq('id',1).maybeSingle().then(({data,error})=>{if(error)notify.error(errorMessage(error,'No se pudo cargar Personal comercial.'));else setPersonnel(Array.isArray(data?.people)?data.people:[]);});},[]);
 useEffect(()=>{
  if(!month){setLoading(false);setDaily([]);return;}
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
 const overviewColumns:FilterColumn<CategoryPanelRow>[]=useMemo(()=>[
  {key:'branch',label:'Sucursal',value:r=>r.branchLabel},{key:'sector',label:'Sector',value:r=>String(r.sector)},{key:'id',label:'ID',value:r=>String(r.sellerId)},
  {key:'seller',label:'Vendedor',value:r=>r.sellerName},{key:'visited',label:'Visitados',value:r=>String(r.visitados)},
  {key:'distance',label:'Venta distancia',value:r=>String(r.ventaDistancia)},{key:'pdv',label:'Venta PDV',value:r=>String(r.ventaPdv)},
  {key:'planned',label:'Visitas planeadas',value:r=>String(r.visitasPlaneadas)},
  {key:'billing',label:'Facturación',value:r=>money.format(r.importeFinalFacturado)},
  {key:'invoices',label:'Facturas',value:r=>String(r.cntFac)},
  {key:'daily',label:'Facturación diaria',value:r=>counts.elapsed>0?money.format(r.importeFinalFacturado/counts.elapsed):'—'},
  {key:'projected',label:'Categoría proyectada',value:r=>byProjection.get(r.branchKey+':'+r.sellerId)?.projected_category??'—'},
  {key:'pop',label:'POP',value:r=>String(byProjection.get(r.branchKey+':'+r.sellerId)?.pop_percentage??'—')},
  {key:'exhibition',label:'Exhibición',value:r=>String(byProjection.get(r.branchKey+':'+r.sellerId)?.exhibition_percentage??'—')},
  {key:'coverage',label:'Cobertura',value:r=>String(byProjection.get(r.branchKey+':'+r.sellerId)?.coverage_percentage??'—')},
  {key:'volume',label:'Volumen',value:r=>String(byProjection.get(r.branchKey+':'+r.sellerId)?.volume_percentage??'—')},
  {key:'hours',label:'Horario promedio',value:r=>{const avg=stats.get(r.branchKey+':'+r.sellerId);return loading?'Cargando…':avg?displayDuration(Math.round(avg.sum/avg.days)):'Sin datos';}},
  {key:'days',label:'Días válidos',value:r=>String(stats.get(r.branchKey+':'+r.sellerId)?.days??0)}
 ],[byProjection,stats,counts.elapsed,loading]);
 const branchRows=useMemo(()=>sellers.filter(p=>{const b=branches.find(item=>item.key===branchTab);return !!b&&p.branch===b.branch&&(b.force==='all'||p.force===b.force)}).sort((a,b)=>a.superior.localeCompare(b.superior,'es')||a.id-b.id),[sellers,branchTab]);
 const branchColumns:FilterColumn<(typeof sellers)[number]>[]=useMemo(()=>{
  const get=(p:(typeof sellers)[number])=>{const r=rows.find(row=>row.branchKey===branchTab&&row.sellerId===p.id);const extra=byProjection.get(branchTab+':'+p.id);const avg=stats.get(branchTab+':'+p.id);return {r,extra,avg};};
  return [
   {key:'supervisor',label:'Supervisor',value:p=>p.superior||'Sin supervisor'},
   {key:'seller',label:'N° vendedor · Vendedor',value:p=>p.id+' · '+p.name},
   {key:'hours',label:'Horario promedio',value:p=>{const {avg}=get(p);return loading?'Cargando…':avg?displayDuration(Math.round(avg.sum/avg.days)):'Sin datos';}},
   {key:'volume',label:'Obj. Volumen alcanzado',value:p=>String(get(p).extra?.volume_percentage??'—')},
   {key:'coverage',label:'Obj. Cobertura alcanzado',value:p=>String(get(p).extra?.coverage_percentage??'—')},
   {key:'effectiveness',label:'% Efectividad',value:p=>{const {r}=get(p);return r&&r.visitasPlaneadas>0?(r.visitados/r.visitasPlaneadas*100).toFixed(2)+'%':'—';}},
   {key:'efficiency',label:'% Eficiencia',value:p=>{const {r}=get(p);return r&&r.visitados>0?(r.cntFac/r.visitados*100).toFixed(2)+'%':'—';}},
   {key:'pop',label:'% POP',value:p=>String(get(p).extra?.pop_percentage??'—')},
   {key:'exhibition',label:'% Exhibición',value:p=>String(get(p).extra?.exhibition_percentage??'—')},
   {key:'projected',label:'Categoría proyectada',value:p=>get(p).extra?.projected_category??'—'},
   {key:'reached',label:'Categoría alcanzada',value:p=>{const {r,extra,avg}=get(p);return assessSellerCategory({dailyBilling:r&&counts.elapsed>0?r.importeFinalFacturado/counts.elapsed:null,efficiency:r&&r.visitados>0?r.cntFac/r.visitados*100:null,effectiveness:r&&r.visitasPlaneadas>0?r.visitados/r.visitasPlaneadas*100:null,pop:extra?.pop_percentage??null,exhibition:extra?.exhibition_percentage??null,volume:extra?.volume_percentage??null,coverage:extra?.coverage_percentage??null,routeHours:avg?avg.sum/avg.days/3600:null},scaleMetrics,scaleGates,extra?.projected_category??null).label;}},
   {key:'detail',label:'Desglose',value:()=>'Ver puntaje'}
  ];
 },[rows,branchTab,byProjection,stats,loading,counts.elapsed,scaleMetrics,scaleGates]);
 return <div className="mt-6 space-y-6">
  {month&&!availableMonths.includes(month)&&<p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">No hay KPIs unificados guardados para {month}. Los horarios SIGO se consultan por separado; seleccioná o importá el mes correspondiente.</p>}
  {loadingMonth&&<p className="text-xs text-slate-500">Cargando KPIs del mes…</p>}
  <section className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,.055)]">
   <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-5">
    <div><h2 className="text-xl font-semibold text-slate-900">Reportes unificados y horarios</h2><p className="mt-1 text-xs text-slate-500">Datos guardados de KPIs y promedio diario SIGO del mes seleccionado.</p></div>
    <label className="flex items-center gap-2 text-xs text-slate-600">Mes <input type="month" aria-label="Mes de horarios" value={month} onChange={e=>{if(/^\d{4}-\d{2}$/.test(e.target.value))onMonthChange(e.target.value)}} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"/></label>
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
   <div className="max-h-[650px] overflow-y-auto overflow-x-hidden">
    <FilterableCategoryTable rows={filtered} columns={overviewColumns} renderRow={row=>{
     const key=row.branchKey+':'+row.sellerId,proj=byProjection.get(key),avg=stats.get(key);
     return <tr key={key} className="border-t border-slate-100 text-slate-700 hover:bg-slate-50/70 max-lg:my-3 max-lg:grid max-lg:grid-cols-2 max-lg:rounded-xl max-lg:border max-lg:border-slate-200 max-lg:p-2">
      <td data-label="Sucursal" className=" px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{row.branchLabel}</td><td data-label="Sector" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{row.sector}</td><td data-label="ID" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{row.sellerId}</td>
      <td data-label="Vendedor" className=" px-1.5 py-2.5 font-medium min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{row.sellerName}</td>
      <td data-label="Visitados" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{fmt.format(row.visitados)}</td><td data-label="Venta distancia" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{fmt.format(row.ventaDistancia)}</td><td data-label="Venta PDV" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{fmt.format(row.ventaPdv)}</td><td data-label="Visitas planeadas" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{fmt.format(row.visitasPlaneadas)}</td>
      <td data-label="Facturación" className=" px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{money.format(row.importeFinalFacturado)}</td><td data-label="Facturas" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{fmt.format(row.cntFac)}</td>
      <td data-label="Facturación diaria" className=" px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{counts.elapsed>0?money.format(row.importeFinalFacturado/counts.elapsed):'—'}</td>
      <td data-label="Categoría proyectada" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{proj?.projected_category??'—'}</td><td data-label="POP" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{proj?.pop_percentage==null?'—':proj.pop_percentage+'%'}</td><td data-label="Exhibición" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{proj?.exhibition_percentage==null?'—':proj.exhibition_percentage+'%'}</td>
      <td data-label="Cobertura" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{proj?.coverage_percentage==null?'—':fmt.format(proj.coverage_percentage)}</td><td data-label="Volumen" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{proj?.volume_percentage==null?'—':fmt.format(proj.volume_percentage)}</td>
      <td data-label="Horario promedio" className="px-1.5 py-2.5 font-medium min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{loading?'Cargando…':avg?displayDuration(Math.round(avg.sum/avg.days)):'Sin datos'}</td><td data-label="Días válidos" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{loading?'—':avg?.days??0}</td>
     </tr>}} />

   </div>
   <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">El promedio considera días con inicio y fin válidos (corregidos cuando corresponda) y excluye días con motivo registrado. No se inventan horarios faltantes.</p>
  </section>
  <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,.055)]">
   <h2 className="text-lg font-semibold text-slate-900">Categorías por sucursal</h2>
   <div role="tablist" aria-label="Sucursales" className="mt-4 flex flex-wrap gap-2 border-b border-slate-100 pb-4">
    {branches.map(b=><button key={b.key} type="button" role="tab" aria-selected={branchTab===b.key} onClick={()=>setBranchTab(b.key)} className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${branchTab===b.key?'bg-emerald-600 text-white':'text-slate-600 hover:bg-slate-100'}`}>{b.name}</button>)}
   </div>
   <p className="mt-3 text-xs text-slate-500">Categoría alcanzada: exige 75 puntos por nivel y cumplimiento de horario de ruta y efectividad. Se asigna el nivel más alto aprobado; sin datos suficientes se indica Pendiente.</p>
   <div role="tabpanel" className="mt-4 overflow-x-hidden">
     <FilterableCategoryTable key={branchTab} rows={branchRows} columns={branchColumns} renderRow={p=>{
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
         const assessment=assessSellerCategory(input,scaleMetrics,scaleGates,extra?.projected_category??null);
         const percent=(n:number|null|undefined)=>n==null?'—':n.toLocaleString('es-AR',{maximumFractionDigits:2})+'%';
         const quantity=(n:number|null|undefined)=>n==null?'—':fmt.format(n);
         return <tr key={p.branch+':'+p.force+':'+p.id} className="border-b border-slate-100 text-slate-700 hover:bg-slate-50 max-lg:my-3 max-lg:grid max-lg:grid-cols-2 max-lg:rounded-xl max-lg:border max-lg:border-slate-200 max-lg:p-2">
          <td data-label="Supervisor" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{p.superior||'Sin supervisor'}</td><td data-label="Vendedor" className=" px-1.5 py-2.5 font-medium min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{p.id} · {p.name}</td>
          <td data-label="Horario promedio" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{loading?'Cargando…':avg?displayDuration(Math.round(avg.sum/avg.days)):'Sin datos'}</td>
          <td data-label="Volumen" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{quantity(extra?.volume_percentage)}</td><td data-label="Cobertura" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{quantity(extra?.coverage_percentage)}</td>
          <td data-label="Efectividad" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{effective==null?'—':percent(effective)}</td><td data-label="Eficiencia" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{efficient==null?'—':percent(efficient)}</td>
          <td data-label="POP" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{percent(extra?.pop_percentage)}</td><td data-label="Exhibición" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{percent(extra?.exhibition_percentage)}</td><td data-label="Categoría proyectada" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400">{extra?.projected_category??'—'}</td><td data-label="Categoría alcanzada" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400"><span title={scaleLoaded?assessment.details:'Cargando cuadro de escalas'} className={`inline-flex max-w-full break-words rounded-lg px-2.5 py-1 text-xs font-medium ${!scaleLoaded||assessment.status==='pending'?'bg-slate-100 text-slate-500':assessment.label==='SENIOR'?'bg-emerald-100 text-emerald-800':assessment.label==='SEMI SENIOR'?'bg-green-50 text-green-700':assessment.label==='JUNIOR'?'bg-amber-100 text-amber-800':'bg-rose-100 text-rose-700'}`}>{scaleLoaded?assessment.label:'Cargando…'}{scaleLoaded&&assessment.status==='pending'?' · sin verificar':''}</span></td><td data-label="Desglose" className="px-1.5 py-2.5 min-w-0 break-words [overflow-wrap:anywhere] max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:px-3 max-lg:py-3 max-lg:before:content-[attr(data-label)] max-lg:before:text-[10px] max-lg:before:font-medium max-lg:before:text-slate-400"><button type="button" disabled={!scaleLoaded} onClick={()=>setDetail({name:p.name,branch:branch.name,input,projectedCategory:extra?.projected_category??null,row:row??null})} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-50 disabled:opacity-40">Ver puntaje</button></td>
         </tr>;
       }} />
    </div>
  </section>
  {detail&&<SellerScoreDialog name={detail.name} branch={detail.branch} input={detail.input} projectedCategory={detail.projectedCategory} row={detail.row} elapsedDays={counts.elapsed} month={month} metrics={scaleMetrics} gates={scaleGates} onClose={()=>setDetail(null)}/>}
 </div>;
}


function SellerScoreDialog({name,branch,input,projectedCategory,row,elapsedDays,month,metrics,gates,onClose}:{name:string;branch:string;input:SellerCategoryInput;projectedCategory:string|null;row:CategoryPanelRow|null;elapsedDays:number;month:string;metrics:CategoryScaleMetric[];gates:CategoryScaleGate[];onClose:()=>void}){
 const [view,setView]=useState<'comparison'|'data'>('comparison');
 const [exportOpen,setExportOpen]=useState(false);
 const [exportComparison,setExportComparison]=useState(true);
 const [exportCalculations,setExportCalculations]=useState(true);
 const assessment=assessSellerCategory(input,metrics,gates,projectedCategory);
 const tiers=scoreByCategory(input,projectedCategory,metrics);
 const checks=gateBreakdown(input,gates);
 const fmtNumber=(value:number|null)=>value===null?'—':value.toLocaleString('es-AR',{maximumFractionDigits:2});
 const fmtTime=(value:number|null)=>value===null?'—':displayDuration(Math.round(value*3600));
 const fmtValue=(value:number|null,unit:string)=>value===null?'Sin datos':unit==='currency'?money.format(value):fmtNumber(value)+(unit==='percent'?'%':'');
 const badgeClass=assessment.status==='pending'?'bg-slate-100 text-slate-600':assessment.label==='SENIOR'?'bg-emerald-700 text-white':assessment.label==='SEMI SENIOR'?'bg-emerald-500 text-white':assessment.label==='JUNIOR'?'bg-amber-100 text-amber-800':'bg-rose-100 text-rose-700';
 const colors:{[key:string]:string}={'SENIOR':'bg-emerald-700 text-white','SEMI SENIOR':'bg-emerald-500 text-white','JUNIOR':'bg-amber-400 text-slate-950'};
 return <div role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}} className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm">
  <section role="dialog" aria-modal="true" aria-labelledby="seller-score-title" className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[26px] bg-white shadow-[0_24px_70px_rgba(15,23,42,.18)]">
   <header className="shrink-0 border-b border-slate-100 px-5 py-5 sm:px-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
     <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-3"><h2 id="seller-score-title" className="text-xl font-semibold tracking-tight text-slate-950">Análisis de {name}</h2><span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>{assessment.label}</span></div>
      <p className="mt-1 text-sm text-slate-500">{branch} · Cuadro de escalas · mínimo {CATEGORY_PASS_SCORE}/100 por categoría</p>
     </div>
     <div className="flex shrink-0 items-center gap-2">
      <Popover open={exportOpen} onOpenChange={setExportOpen}>
       <PopoverTrigger asChild>
        <button type="button" className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-emerald-700" aria-label="Opciones de exportación a Excel">
         <Download className="h-4 w-4"/>Exportar Excel<ChevronDown className="h-4 w-4"/>
        </button>
       </PopoverTrigger>
       <PopoverContent align="end" sideOffset={8} className="z-[220] w-[280px] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,.14)]">
        <p className="text-sm font-semibold text-slate-900">Contenido a exportar</p>
        <div className="mt-3 space-y-1">
         <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-200 hover:bg-slate-50">
          <input type="checkbox" checked={exportComparison} onChange={e=>setExportComparison(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-emerald-600"/>
          <span className="text-sm font-medium text-slate-700">Comparación</span>
         </label>
         <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-200 hover:bg-slate-50">
          <input type="checkbox" checked={exportCalculations} onChange={e=>setExportCalculations(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-emerald-600"/>
          <span className="text-sm font-medium text-slate-700">Datos + cálculos</span>
         </label>
        </div>
        <button type="button" disabled={!exportComparison&&!exportCalculations} onClick={()=>{
         try{
          exportSellerCategoryExcel({name,branch,month,projectedCategory,row,elapsedDays,input,assessment,comparison:exportComparison,calculations:exportCalculations});
          setExportOpen(false);
         }catch(error){notify.error(errorMessage(error,'No se pudo generar el Excel.'));}
        }} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-4 w-4"/>Descargar Excel</button>
       </PopoverContent>
      </Popover>
      <button type="button" onClick={onClose} aria-label="Cerrar detalle" className="h-10 rounded-xl bg-slate-100 px-4 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-200">Cerrar</button>
     </div>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
     {checks.map(check=><div key={check.kind} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3">
      <div><p className="text-xs text-slate-500">{check.label} requerido</p><p className="mt-1 text-sm font-medium text-slate-900">{check.kind==='route'?fmtTime(check.required):fmtNumber(check.required)+'%'}</p></div>
      <div className="text-right"><p className="text-xs text-slate-500">Alcanzado</p><p className={`mt-1 text-sm font-semibold ${check.passed===true?'text-emerald-700':check.passed===false?'text-rose-600':'text-slate-500'}`}>{check.kind==='route'?fmtTime(check.actual):check.actual===null?'Sin datos':fmtNumber(check.actual)+'%'} {check.passed===true?'✓':check.passed===false?'✕':'· Sin evaluar'}</p></div>
     </div>)}
    </div>
    {assessment.status!=='qualified'&&<p className="mt-3 text-xs leading-5 text-slate-500">{assessment.details}. Los puntos se muestran igualmente para que puedas analizar cada nivel.</p>}
   </header>
   <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7">
    <div className="mb-5 flex justify-center"><div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1">
     <button type="button" onClick={()=>setView('comparison')} className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${view==='comparison'?'bg-white text-slate-950 shadow-sm':'text-slate-500'}`}>Comparación</button>
     <button type="button" onClick={()=>setView('data')} className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${view==='data'?'bg-white text-slate-950 shadow-sm':'text-slate-500'}`}>Datos + cálculos</button>
    </div></div>
    {view==='comparison'?<div className="grid gap-4 lg:grid-cols-3">
     {tiers.map(tier=><div key={tier.label} className={`overflow-hidden rounded-[20px] border bg-white shadow-[0_5px_24px_rgba(15,23,42,.04)] ${assessment.label===tier.label?'border-emerald-300':'border-slate-200'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-4">
       <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${colors[tier.label]}`}>{tier.label}</span>
       <div className="text-right"><p className="text-xs font-semibold tabular-nums text-slate-900">{fmtNumber(tier.score)} / {fmtNumber(tier.maximum)} pts</p><p className={`mt-1 text-[11px] ${tier.passed?'text-emerald-700':'text-slate-500'}`}>{tier.passed?'Supera los 75 puntos':'No alcanza 75 puntos'}</p></div>
      </div>
      <div className="px-4 py-3">
       <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all duration-200 ${tier.passed?'bg-emerald-500':'bg-slate-400'}`} style={{width:`${Math.max(0,Math.min(100,tier.score))}%`}}/></div>
       <div className="divide-y divide-slate-100">
        {tier.lines.map(item=><div key={item.id} className="py-3">
         <div className="flex items-start justify-between gap-3"><span className="text-sm font-medium text-slate-900">{item.projected?'Categoría proyectada':item.name}</span><span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${item.passed?'bg-blue-50 text-blue-700':item.passed===false?'bg-slate-100 text-slate-500':'bg-amber-50 text-amber-700'}`}>{item.passed===null?'—':item.passed?'+'+fmtNumber(item.weight):'0'}</span></div>
         <p className="mt-1 text-xs text-slate-500">Requerido: {item.projected?item.required:item.required===null?'Sin configurar':fmtValue(item.required as number,item.unit)}</p>
         <p className={`mt-0.5 text-xs ${item.passed===true?'text-emerald-700':item.passed===false?'text-rose-600':'text-slate-500'}`}>Alcanzado: {item.projected?projectedCategory??'Sin cargar':fmtValue(item.actual,item.unit)}</p>
        </div>)}
       </div>
      </div>
     </div>)}
    </div>:<SellerDataCalculations row={row} elapsedDays={elapsedDays} projectedCategory={projectedCategory} month={month}/>}
   </div>
  </section>
 </div>;
}
