'use client';

import {useEffect,useMemo,useState} from 'react';
import {CalendarDays,ChevronDown,FileSpreadsheet,Filter,Loader2,Save,Search,Upload,X} from 'lucide-react';
import {readFirstWorksheet} from '@/lib/categoryPanelExcel';
import {supabase} from '@/lib/supabaseClient';
import {errorMessage,notify} from '@/lib/notifications';

type Daily={visit_date:string;seller_name:string;total_clients:number;visited_clients:number;unvisited_clients:number;first_visit:string|null;last_visit:string|null};
type Person={id:number;name:string;branch:string;role:string;superior:string};
const clean=(value:unknown)=>String(value??'').trim().replace(/\s+/g,' ');
const norm=(value:unknown)=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const displayDate=(date:string)=>{const [y,m,d]=date.split('-');return d+'/'+m+'/'+y;};
const normalizeDate=(value:unknown)=>{
 const s=clean(value);
 let match=/^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(s);
 if(match)return match[3]+'-'+match[2]+'-'+match[1];
 match=/^(\d{4})[-/](\d{2})[-/](\d{2})/.exec(s);
 if(match)return match[1]+'-'+match[2]+'-'+match[3];
 if(typeof value==='number'&&value>20000&&value<100000)return new Date(Date.UTC(1899,11,30)+Math.round(value)*86400000).toISOString().slice(0,10);
 return '';
};
const normalizeTime=(value:unknown)=>{
 if(typeof value==='number'&&value>0&&value<1){
  const seconds=Math.round(value*86400)%86400;
  return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
 }
 const s=clean(value);
 if(!s||s==='0'||s==='00:00:00')return null;
 const match=/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
 if(!match||Number(match[1])>23||Number(match[2])>59||Number(match[3]??0)>59)return null;
 return [match[1].padStart(2,'0'),match[2],match[3]??'00'].join(':');
};
const workedHours=(start:string|null,end:string|null)=>{
 if(!start||!end)return '—';
 const seconds=(time:string)=>{const [h,m,s]=time.split(':').map(Number);return h*3600+m*60+s;};
 const duration=seconds(end)-seconds(start);
 if(!Number.isFinite(duration)||duration<0)return '—';
 return [Math.floor(duration/3600),Math.floor(duration%3600/60),duration%60].map(n=>String(n).padStart(2,'0')).join(':');
};
function parseReport(matrix:(string|number|boolean|null)[][]):Daily[]{
 const header=matrix.findIndex(row=>norm(row?.[7])==='SECTOR'&&norm(row?.[8])==='FECHA'&&norm(row?.[9])==='VISITADO');
 if(header<0)throw new Error('No se encontraron las columnas H: Sector, I: Fecha y J: Visitado.');
 const result=new Map<string,Daily>();
 for(const row of matrix.slice(header+1)){
  const name=clean(row?.[7]),date=normalizeDate(row?.[8]),status=norm(row?.[9]);
  if(!name||!date||!['SI','NO'].includes(status))continue;
  const key=date+'|'+norm(name);
  let item=result.get(key);
  if(!item){item={visit_date:date,seller_name:norm(name),total_clients:0,visited_clients:0,unvisited_clients:0,first_visit:null,last_visit:null};result.set(key,item);}
  item.total_clients++;
  if(status==='SI')item.visited_clients++;else item.unvisited_clients++;
  const time=normalizeTime(row?.[10]);
  if(time&&status==='SI'){
   if(!item.first_visit||time<item.first_visit)item.first_visit=time;
   if(!item.last_visit||time>item.last_visit)item.last_visit=time;
  }
 }
 if(!result.size)throw new Error('No hay filas válidas de visitas para importar.');
 return [...result.values()].sort((a,b)=>b.visit_date.localeCompare(a.visit_date)||a.seller_name.localeCompare(b.seller_name,'es'));
}

export default function CategorySigoHistory(){
 const [history,setHistory]=useState<Daily[]>([]);
 const [personnel,setPersonnel]=useState<Person[]>([]);
 const [preview,setPreview]=useState<Daily[]|null>(null);
 const [file,setFile]=useState<File|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [date,setDate]=useState('all');
 const [query,setQuery]=useState('');
 const [columnFilters,setColumnFilters]=useState<Record<string,string[]>>({});
 const [activeColumn,setActiveColumn]=useState<string|null>(null);
 const [filterSearch,setFilterSearch]=useState('');
 useEffect(()=>{let live=true;void(async()=>{try{
  const all:Daily[]=[];let offset=0;
  while(true){
   const {data,error}=await supabase.from('category_sigo_daily').select('visit_date,seller_name,total_clients,visited_clients,unvisited_clients,first_visit,last_visit').order('visit_date',{ascending:false}).order('seller_name',{ascending:true}).range(offset,offset+999);
   if(error)throw error;
   all.push(...(data??[]));if((data??[]).length<1000)break;offset+=1000;
  }
  if(live)setHistory(all);
 }catch(e){if(live)notify.error(errorMessage(e,'No se pudo cargar el histórico SIGO.'));}finally{if(live)setLoading(false);}})();return()=>{live=false;};},[]);
 useEffect(()=>{let active=true;void(async()=>{
  const {data,error}=await supabase.from('category_commercial_personnel').select('people').eq('id',1).maybeSingle();
  if(error){if(active)notify.error(errorMessage(error,'No se pudo cargar la jerarquía comercial.'));return;}
  if(active)setPersonnel(Array.isArray(data?.people)?data.people as Person[]:[]);
 })();return()=>{active=false;};},[]);
 const sellerDetails=useMemo(()=>{
  const map=new Map<string,{code:string;supervisor:string}>();
  for(const seller of personnel.filter(p=>norm(p.role)==='VENDEDOR')){
   const key=norm(seller.name);
   const supervisors=personnel.filter(p=>norm(p.role)==='SUPERVISOR'&&norm(p.branch)===norm(seller.branch)&&norm(p.name)===norm(seller.superior));
   const detail={code:String(seller.id),supervisor:supervisors.length===1?supervisors[0].name:'—'};
   // Repeated names across branches cannot safely be resolved without an ID in SIGO.
   map.set(key,map.has(key)?{code:'—',supervisor:'—'}:detail);
  }
  return map;
 },[personnel]);
 const upload=async(next:File|null)=>{
  setFile(next);setPreview(null);if(!next)return;
  try{setBusy(true);const parsed=parseReport(await readFirstWorksheet(next));setPreview(parsed);setDate('all');notify.success('Archivo procesado. Revisá los datos y guardalos para incorporar cada fecha.');}
  catch(e){notify.error(errorMessage(e,'No se pudo procesar el archivo SIGO.'));}finally{setBusy(false);}
 };
 const save=async()=>{
  if(!preview?.length||busy)return;
  try{setBusy(true);
   const dates=[...new Set(preview.map(p=>p.visit_date))];
   // Update only dates present in the uploaded report. Existing other days survive.
   const {error}=await supabase.rpc('replace_category_sigo_days',{p_rows:preview});
   if(error)throw error;
   const other=history.filter(item=>!dates.includes(item.visit_date));
   setHistory([...preview,...other].sort((a,b)=>a.visit_date.localeCompare(b.visit_date)||a.seller_name.localeCompare(b.seller_name,'es')));
   setPreview(null);setFile(null);notify.success('Histórico SIGO actualizado. Días anteriores conservados.');
  }catch(e){notify.error(errorMessage(e,'No se pudo guardar el histórico.'));}finally{setBusy(false);}
 };
 const dataset=preview??history;
 const days=[...new Set(dataset.map(item=>item.visit_date))].sort((a,b)=>a.localeCompare(b));
 const columns=[
  {key:'month',label:'Mes'},
  {key:'date',label:'Fecha'},
  {key:'supervisor',label:'Supervisor'},
  {key:'code',label:'Cod Vendedor'},
  {key:'seller',label:'Vendedor'},
  {key:'start',label:'Inicio'},
  {key:'end',label:'Fin'},
  {key:'hours',label:'Horario ruta'},
  {key:'missing',label:'PDVs Sin visitar'},
 ];
 const cellValue=(item:Daily,key:string):string=>{
  const detail=sellerDetails.get(norm(item.seller_name));
  switch(key){
   case 'month':return new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(item.visit_date+'T12:00:00Z'));
   case 'date':return displayDate(item.visit_date);
   case 'supervisor':return detail?.supervisor??'—';
   case 'code':return detail?.code??'—';
   case 'seller':return item.seller_name;
   case 'start':return item.first_visit??'—';
   case 'end':return item.last_visit??'—';
   case 'hours':return workedHours(item.first_visit,item.last_visit);
   case 'missing':return String(item.unvisited_clients);
   default:return '';
  }
 };
 const baseRows=dataset.filter(item=>(date==='all'||item.visit_date===date)&&(!query||norm(item.seller_name).includes(norm(query))));
 const matches=(item:Daily,key:string)=>!columnFilters[key]?.length||columnFilters[key].includes(cellValue(item,key));
 const shown=baseRows.filter(item=>columns.every(col=>matches(item,col.key))).sort((a,b)=>a.visit_date.localeCompare(b.visit_date)||a.seller_name.localeCompare(b.seller_name,'es'));
 const options=activeColumn?[...new Set(baseRows.filter(item=>columns.every(col=>col.key===activeColumn||matches(item,col.key))).map(item=>cellValue(item,activeColumn)))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true})):[];
 const visibleOptions=options.filter(value=>norm(value).includes(norm(filterSearch)));
 const checked=activeColumn?columnFilters[activeColumn]??[]:[];
 const toggleOption=(value:string)=>{
  if(!activeColumn)return;
  const next=checked.length?checked.filter(v=>options.includes(v)):options;
  const values=next.includes(value)?next.filter(v=>v!==value):[...next,value];
  setColumnFilters(old=>({...old,[activeColumn]:values.length===options.length?[]:values}));
 };
 const clearFilters=()=>{setColumnFilters({});setActiveColumn(null);setFilterSearch('');};

 const totals=shown.reduce((a,r)=>({assigned:a.assigned+r.total_clients,visited:a.visited+r.visited_clients,missing:a.missing+r.unvisited_clients}),{assigned:0,visited:0,missing:0});
 const datesInPreview=[...new Set(preview?.map(item=>item.visit_date)??[])];
 return <section className="mt-6 overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,.035)]">
  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-6">
   <div><div className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-600">Histórico diario · SIGO</div><h2 className="mt-1 text-2xl font-semibold tracking-tight">Horarios de vendedores</h2><p className="mt-1 text-xs text-slate-500">Cada archivo se procesa localmente: solo se guardan los resultados diarios, nunca el Excel.</p></div>
   <div className="flex items-center gap-2">
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700"><Upload className="h-4 w-4"/>{file?file.name:'Importar Excel SIGO'}<input type="file" accept=".xlsx" className="sr-only" onChange={e=>void upload(e.target.files?.[0]??null)}/></label>
    {preview&&<button disabled={busy} onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-semibold text-white disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Guardar días</button>}
   </div>
  </div>
  {preview&&<div className="border-b border-blue-100 bg-blue-50 px-6 py-3 text-xs text-blue-700"><strong>Vista previa sin guardar:</strong> {preview.length} registros de vendedor/día · {datesInPreview.map(displayDate).join(', ')}. Al guardar se actualizan solo estas fechas.</div>}
  <div className="grid grid-cols-2 border-b border-slate-200 md:grid-cols-4">{[['Días registrados',days.length],['Clientes asignados',totals.assigned],['Visitados',totals.visited],['Sin visitar',totals.missing]].map(([label,n])=><div key={label} className="border-r border-slate-100 px-6 py-4"><p className="text-[10px] uppercase text-slate-400">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{Number(n).toLocaleString('es-AR')}</p></div>)}</div>
  <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
   <div className="relative min-w-[230px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar vendedor..." className="h-10 w-full rounded-xl border border-slate-200 bg-[#fafbfc] pl-9 pr-3 text-xs outline-none"/></div>
   <div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"/><select aria-label="Fecha" value={date} onChange={e=>setDate(e.target.value)} className="h-10 min-w-[170px] rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs"><option value="all">Todas las fechas</option>{days.map(day=><option key={day} value={day}>{displayDate(day)}</option>)}</select></div>
  </div>
  {Object.values(columnFilters).some(values=>values.length>0)&&<div className="flex items-center justify-between border-b border-blue-100 bg-blue-50 px-5 py-2 text-[11px] font-medium text-blue-700"><span><Filter className="mr-1 inline h-3.5 w-3.5"/>Filtros activos · {shown.length} filas</span><button type="button" onClick={clearFilters} className="rounded-lg px-2 py-1 hover:bg-blue-100">Limpiar todos</button></div>}
  {activeColumn&&<div className="border-b border-slate-200 bg-[#fafbfc] px-5 py-4">
   <div className="mx-auto max-w-[680px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-800">Filtrar: {columns.find(col=>col.key===activeColumn)?.label}</span><button type="button" aria-label="Cerrar filtro" onClick={()=>{setActiveColumn(null);setFilterSearch('');}} className="rounded-lg p-1.5 hover:bg-slate-100"><X className="h-4 w-4"/></button></div>
    <div className="relative mt-3"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={filterSearch} onChange={e=>setFilterSearch(e.target.value)} placeholder="Buscar valores..." className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-blue-300"/></div>
    <div className="mt-3 flex gap-2"><button type="button" onClick={()=>setColumnFilters(old=>({...old,[activeColumn]:[]}))} className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-medium">Seleccionar todos</button><button type="button" onClick={()=>setColumnFilters(old=>({...old,[activeColumn]:['__NINGUN_VALOR__']}))} className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-medium">Deseleccionar todos</button></div>
    <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
     {visibleOptions.map(value=><label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={!checked.length||checked.includes(value)} onChange={()=>toggleOption(value)} className="accent-blue-600"/><span className="truncate">{value}</span></label>)}
     {!visibleOptions.length&&<div className="px-2 py-3 text-xs text-slate-400">Sin valores coincidentes</div>}
    </div>
    <div className="mt-3 flex justify-end"><button type="button" onClick={()=>{setActiveColumn(null);setFilterSearch('');}} className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-semibold text-white">Aplicar</button></div>
   </div>
  </div>}
  <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-xs">
   <thead className="bg-[#f5f7fa] text-[10px] uppercase tracking-wider text-slate-500"><tr>{columns.map(col=><th key={col.key} className="px-3 py-2 font-semibold"><button type="button" onClick={()=>{setActiveColumn(old=>old===col.key?null:col.key);setFilterSearch('');}} className={'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left hover:bg-slate-200 '+(columnFilters[col.key]?.length?'text-blue-600':'')}><span>{col.label}</span><ChevronDown className="h-3.5 w-3.5 shrink-0"/></button></th>)}</tr></thead>
   <tbody>{shown.map((item,i)=><tr key={item.visit_date+'|'+item.seller_name} className={'border-t border-slate-100 '+(i%2?'bg-slate-50/40':'bg-white')}>
    <td className="whitespace-nowrap px-5 py-3 font-medium capitalize text-slate-600">{new Intl.DateTimeFormat('es-AR',{month:'long',timeZone:'UTC'}).format(new Date(item.visit_date+'T12:00:00Z'))}</td>
    <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-600">{displayDate(item.visit_date)}</td>
    <td className="px-5 py-3 text-slate-700">{sellerDetails.get(norm(item.seller_name))?.supervisor??'—'}</td>
    <td className="px-5 py-3 font-medium tabular-nums">{sellerDetails.get(norm(item.seller_name))?.code??'—'}</td>
    <td className="px-5 py-3 font-semibold text-slate-900">{item.seller_name}</td>
    <td className="px-5 py-3 font-medium tabular-nums">{item.first_visit??'—'}</td>
    <td className="px-5 py-3 font-medium tabular-nums">{item.last_visit??'—'}</td>
    <td className="px-5 py-3 font-semibold tabular-nums text-blue-700">{workedHours(item.first_visit,item.last_visit)}</td>
    <td className="px-5 py-3"><span className={'rounded-lg px-2 py-1 font-semibold tabular-nums '+(item.unvisited_clients?'bg-amber-50 text-amber-700':'bg-emerald-50 text-emerald-700')}>{item.unvisited_clients}</span></td>
   </tr>)}</tbody>
  </table>{loading?<p className="p-12 text-center text-sm text-slate-400">Cargando histórico...</p>:!shown.length?<p className="p-12 text-center text-sm text-slate-400"><FileSpreadsheet className="mx-auto mb-2 h-6 w-6"/>No hay registros para mostrar.</p>:null}</div>
 </section>;
}
