'use client';

import {useEffect,useMemo,useState} from 'react';
import {CalendarDays,ChevronDown,FileSpreadsheet,Filter,Loader2,Save,Search,Upload,X} from 'lucide-react';
import {readFirstWorksheet} from '@/lib/categoryPanelExcel';
import {supabase} from '@/lib/supabaseClient';
import {errorMessage,notify} from '@/lib/notifications';

type Daily={visit_date:string;seller_name:string;branch:string;sales_force:string;total_clients:number;visited_clients:number;unvisited_clients:number;first_visit:string|null;last_visit:string|null};
type Person={id:number;name:string;branch:string;role:string;superior:string;force?:string};
const TEAM_CARDS=[
 {id:'masivos',name:'Masivos',branch:'CASA CENTRAL',force:'ESQUEMA 1',category:'Masivos',description:'Distribución de productos de consumo masivo para toda la región',tone:'from-[#07567d] via-[#0879b4] to-[#039add]'},
 {id:'refrigerados',name:'Refrigerados',branch:'CASA CENTRAL',force:'ESQUEMA REGRIGERADOS',category:'Refrigerados',description:'Cadena de frío garantizada para productos perecederos',tone:'from-[#07567d] via-[#0879b4] to-[#039add]'},
 {id:'chaco',name:'Chaco',branch:'SUCURSAL RESISTENCIA',force:'all',category:'Regional',description:'Distribución especializada en la provincia del Chaco',tone:'from-[#a21524] via-[#c20d3e] to-[#eb5574]'},
 {id:'misiones',name:'Misiones',branch:'SUCURSAL POSADAS',force:'all',category:'Regional',description:'Red de distribución en todo Misiones',tone:'from-[#086342] via-[#11904c] to-[#78ce42]'},
 {id:'obera',name:'Oberá',branch:'SUCURSAL OBERA',force:'all',category:'Local',description:'Servicios especializados para Oberá',tone:'from-[#6f168f] via-[#9215b1] to-[#de46ae]'}
] as const;
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
const durationSeconds=(start:string|null,end:string|null):number|null=>{
 if(!start||!end)return null;
 const seconds=(time:string)=>{const [h,m,s]=time.split(':').map(Number);return h*3600+m*60+s;};
 const duration=seconds(end)-seconds(start);
 return Number.isFinite(duration)&&duration>=0?duration:null;
};
const formatDuration=(duration:number)=>[Math.floor(duration/3600),Math.floor(duration%3600/60),duration%60].map(n=>String(n).padStart(2,'0')).join(':');
const workedHours=(start:string|null,end:string|null)=>{
 if(!start||!end)return '—';
 const seconds=(time:string)=>{const [h,m,s]=time.split(':').map(Number);return h*3600+m*60+s;};
 const duration=seconds(end)-seconds(start);
 if(!Number.isFinite(duration)||duration<0)return '—';
 return [Math.floor(duration/3600),Math.floor(duration%3600/60),duration%60].map(n=>String(n).padStart(2,'0')).join(':');
};
class PersonnelMismatchError extends Error {
 names:string[];
 constructor(names:string[]){super('Hay vendedores sin coincidencia única en Personal comercial.');this.name='PersonnelMismatchError';this.names=names;}
}
function parseReport(matrix:(string|number|boolean|null)[][],personnel:Person[]):Daily[]{
 const byName=new Map<string,Person[]>();
 for(const p of personnel.filter(p=>norm(p.role)==='VENDEDOR')){
  const key=norm(p.name);byName.set(key,[...(byName.get(key)??[]),p]);
 }
 const header=matrix.findIndex(row=>norm(row?.[7])==='SECTOR'&&norm(row?.[8])==='FECHA'&&norm(row?.[9])==='VISITADO');
 if(header<0)throw new Error('No se encontraron las columnas H: Sector, I: Fecha y J: Visitado.');
 const result=new Map<string,Daily>();
 const unknown=new Set<string>();
 for(const row of matrix.slice(header+1)){
  const name=clean(row?.[7]),date=normalizeDate(row?.[8]),status=norm(row?.[9]);
  if(!name||!date||!['SI','NO'].includes(status))continue;
  const matches=byName.get(norm(name))??[];
  const teams=[...new Map(matches.filter(person=>person.branch&&person.force).map(person=>[person.branch+'|'+person.force,person])).values()];
  if(teams.length!==1){unknown.add(name);continue;}
  const person=teams[0];
  const key=date+'|'+norm(person.branch)+'|'+norm(person.force)+'|'+norm(name);
  let item=result.get(key);
  if(!item){item={visit_date:date,seller_name:norm(name),branch:person.branch,sales_force:person.force!,total_clients:0,visited_clients:0,unvisited_clients:0,first_visit:null,last_visit:null};result.set(key,item);}
  item.total_clients++;
  if(status==='SI')item.visited_clients++;else item.unvisited_clients++;
  const time=normalizeTime(row?.[10]);
  if(time&&status==='SI'){
   if(!item.first_visit||time<item.first_visit)item.first_visit=time;
   if(!item.last_visit||time>item.last_visit)item.last_visit=time;
  }
 }
 if(unknown.size)throw new PersonnelMismatchError([...unknown].sort((a,b)=>a.localeCompare(b,'es')));
 if(!result.size)throw new Error('No hay filas válidas de visitas para importar.');
 return [...result.values()].sort((a,b)=>b.visit_date.localeCompare(a.visit_date)||a.seller_name.localeCompare(b.seller_name,'es'));
}

export default function CategorySigoHistory(){
 const [history,setHistory]=useState<Daily[]>([]);
 const [personnel,setPersonnel]=useState<Person[]>([]);
 const [selectedBranch,setSelectedBranch]=useState<string>('CASA CENTRAL');
 const [selectedForce,setSelectedForce]=useState<string>('ESQUEMA 1');
 const [preview,setPreview]=useState<Daily[]|null>(null);
 const [file,setFile]=useState<File|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [missingNames,setMissingNames]=useState<string[]>([]);
 const [duplicateScopes,setDuplicateScopes]=useState<{visit_date:string;branch:string;sales_force:string}[]>([]);
 const [confirmReplace,setConfirmReplace]=useState(false);
 const [date,setDate]=useState('all');
 const [averageMonth,setAverageMonth]=useState('');
 const [view,setView]=useState<'daily'|'averages'>('daily');
 const [query,setQuery]=useState('');
 const [columnFilters,setColumnFilters]=useState<Record<string,string[]>>({});
 const [activeColumn,setActiveColumn]=useState<string|null>(null);
 const [filterSearch,setFilterSearch]=useState('');
 const [draftSelection,setDraftSelection]=useState<string[]|null>(null);
 const [filterPosition,setFilterPosition]=useState({top:0,left:0});
 const [sortColumn,setSortColumn]=useState<string|null>(null);
 const [sortDirection,setSortDirection]=useState<'asc'|'desc'>('asc');
 useEffect(()=>{let live=true;void(async()=>{try{
  const all:Daily[]=[];let offset=0;
  while(true){
   const {data,error}=await supabase.from('category_sigo_daily').select('visit_date,seller_name,branch,sales_force,total_clients,visited_clients,unvisited_clients,first_visit,last_visit').order('visit_date',{ascending:false}).order('seller_name',{ascending:true}).range(offset,offset+999);
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
  for(const seller of personnel.filter(p=>norm(p.role)==='VENDEDOR'&&norm(p.branch)===norm(selectedBranch)&&(selectedForce==='all'||p.force===selectedForce))){
   const key=norm(seller.name);
   const supervisors=personnel.filter(p=>norm(p.role)==='SUPERVISOR'&&norm(p.branch)===norm(seller.branch)&&norm(p.name)===norm(seller.superior));
   const detail={code:String(seller.id),supervisor:supervisors.length===1?supervisors[0].name:'—'};
   // Repeated names across branches cannot safely be resolved without an ID in SIGO.
   map.set(key,map.has(key)?{code:'—',supervisor:'—'}:detail);
  }
  return map;
 },[personnel,selectedBranch,selectedForce]);
 const upload=async(next:File|null)=>{
  setFile(next);setPreview(null);setMissingNames([]);setDuplicateScopes([]);setConfirmReplace(false);
  if(!next)return;
  try{
   setBusy(true);
   if(!personnel.length)throw new PersonnelMismatchError(['No se cargó el detalle de Personal comercial']);
   const parsed=parseReport(await readFirstWorksheet(next),personnel);
   setPreview(parsed);setDate('all');
   if(new Set(parsed.map(p=>p.branch)).size===1)setSelectedBranch(parsed[0].branch);
   setSelectedForce('all');
   const scopes=[...new Map(parsed.map(p=>[p.visit_date+'|'+p.branch+'|'+p.sales_force,{visit_date:p.visit_date,branch:p.branch,sales_force:p.sales_force}])).values()];
   const {data:existing,error}=await supabase.from('category_sigo_daily')
    .select('visit_date,branch,sales_force')
    .in('visit_date',[...new Set(scopes.map(s=>s.visit_date))]);
   if(error)throw error;
   const existingKeys=new Set((existing??[]).map(p=>p.visit_date+'|'+p.branch+'|'+p.sales_force));
   const duplicated=scopes.filter(scope=>existingKeys.has(scope.visit_date+'|'+scope.branch+'|'+scope.sales_force));
   setDuplicateScopes(duplicated);
   if(duplicated.length)notify.error('La fecha y equipo ya tienen datos guardados. Confirmá el reemplazo antes de continuar.');
   else notify.success('Archivo procesado. Revisá la vista previa y guardá los resultados.');
  }catch(e){
   setPreview(null);
   if(e instanceof PersonnelMismatchError){setMissingNames(e.names);}
   else notify.error(errorMessage(e,'No se pudo procesar el archivo SIGO.'));
  }finally{setBusy(false);}
 };
 const save=async(confirmed=false)=>{
  if(!preview?.length||busy)return;
  try{
   setBusy(true);
   // Always recheck in Supabase before writing, including when imported from another session.
   const scopes=[...new Map(preview.map(p=>[p.visit_date+'|'+p.branch+'|'+p.sales_force,{visit_date:p.visit_date,branch:p.branch,sales_force:p.sales_force}])).values()];
   const {data:existing,error:checkError}=await supabase.from('category_sigo_daily')
    .select('visit_date,branch,sales_force')
    .in('visit_date',[...new Set(scopes.map(s=>s.visit_date))]);
   if(checkError)throw checkError;
   const existingKeys=new Set((existing??[]).map(p=>p.visit_date+'|'+p.branch+'|'+p.sales_force));
   const duplicates=scopes.filter(scope=>existingKeys.has(scope.visit_date+'|'+scope.branch+'|'+scope.sales_force));
   if(duplicates.length&&!confirmed){
    setDuplicateScopes(duplicates);
    setConfirmReplace(true);
    return;
   }
   const {error}=await supabase.rpc('replace_category_sigo_days',{p_rows:preview,p_confirm_replace:confirmed});
   if(error)throw error;
   const replaced=new Set(scopes.map(scope=>scope.visit_date+'|'+scope.branch+'|'+scope.sales_force));
   const other=history.filter(item=>!replaced.has(item.visit_date+'|'+item.branch+'|'+item.sales_force));
   setHistory([...preview,...other].sort((a,b)=>a.visit_date.localeCompare(b.visit_date)||a.seller_name.localeCompare(b.seller_name,'es')));
   setPreview(null);setFile(null);setDuplicateScopes([]);setConfirmReplace(false);
   notify.success('Histórico SIGO guardado. Los demás días y equipos se conservaron.');
  }catch(e){notify.error(errorMessage(e,'No se pudo guardar el histórico.'));}
  finally{setBusy(false);}
 };
 const dataset=preview??history;
 const branchData=dataset.filter(item=>item.branch===selectedBranch);
 const forces=[...new Set(personnel.filter(person=>norm(person.branch)===norm(selectedBranch)&&person.force).map(person=>person.force!))].sort((a,b)=>a.localeCompare(b,'es'));
 const scopedData=branchData.filter(item=>selectedForce==='all'||item.sales_force===selectedForce);
 const days=[...new Set(scopedData.map(item=>item.visit_date))].sort((a,b)=>a.localeCompare(b));
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
  {key:'correctStart',label:'Corregir inicio'},
  {key:'correctEnd',label:'Corregir fin'},
  {key:'reason',label:'Motivo'},
  {key:'comments',label:'Comentarios'},
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
   case 'correctStart':case 'correctEnd':case 'reason':case 'comments':return '—';
   default:return '';
  }
 };
 const baseRows=scopedData.filter(item=>(date==='all'||item.visit_date===date)&&(!query||norm(item.seller_name).includes(norm(query))));
 const matches=(item:Daily,key:string)=>!columnFilters[key]?.length||columnFilters[key].includes(cellValue(item,key));
 const shown=baseRows.filter(item=>columns.every(col=>matches(item,col.key))).sort((a,b)=>{
  if(sortColumn){
   const left=sortColumn==='date'?a.visit_date:cellValue(a,sortColumn);
   const right=sortColumn==='date'?b.visit_date:cellValue(b,sortColumn);
   const comp=sortColumn==='missing'||sortColumn==='code'?Number(left)-Number(right):left.localeCompare(right,'es',{numeric:true});
   if(comp)return sortDirection==='asc'?comp:-comp;
  }
  return a.visit_date.localeCompare(b.visit_date)||a.seller_name.localeCompare(b.seller_name,'es');
 });
 const options=activeColumn?[...new Set(baseRows.filter(item=>columns.every(col=>col.key===activeColumn||matches(item,col.key))).map(item=>cellValue(item,activeColumn)))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true})):[];
 const visibleOptions=options.filter(value=>norm(value).includes(norm(filterSearch)));
 const selectedDraft=draftSelection===null?options:draftSelection;
 const openFilter=(key:string,button:HTMLButtonElement)=>{
  if(activeColumn===key){setActiveColumn(null);return;}
  const rect=button.getBoundingClientRect();
  const panelWidth=310;
  setFilterPosition({
   top:Math.max(8,Math.min(rect.bottom+6,window.innerHeight-420)),
   left:Math.max(8,Math.min(rect.left,window.innerWidth-panelWidth-8)),
  });
  setActiveColumn(key);setFilterSearch('');
  const values=[...new Set(baseRows.filter(row=>columns.every(col=>col.key===key||matches(row,col.key))).map(row=>cellValue(row,key)))];
  const applied=columnFilters[key]??[];
  setDraftSelection(applied.length?values.filter(value=>applied.includes(value)):values);
 };
 const closeFilter=()=>{setActiveColumn(null);setFilterSearch('');setDraftSelection(null);};
 const applyFilter=()=>{
  if(!activeColumn)return;
  const chosen=draftSelection??options;
  setColumnFilters(old=>({...old,[activeColumn]:chosen.length===options.length?[]:chosen}));
  closeFilter();
 };
 const setSort=(direction:'asc'|'desc')=>{
  if(!activeColumn)return;
  setSortColumn(activeColumn);setSortDirection(direction);applyFilter();
 };
 const clearFilters=()=>{setColumnFilters({});closeFilter();};

 const totals=shown.reduce((a,r)=>({assigned:a.assigned+r.total_clients,visited:a.visited+r.visited_clients,missing:a.missing+r.unvisited_clients}),{assigned:0,visited:0,missing:0});
 const months=useMemo(()=>[...new Set(scopedData.map(item=>item.visit_date.slice(0,7)))].sort((a,b)=>b.localeCompare(a)),[scopedData]);
 const effectiveMonth=months.includes(averageMonth)?averageMonth:months[0]??'';
 const monthlyAverages=useMemo(()=>{
  const groups=new Map<string,{seller:string;seconds:number;days:number}>();
  for(const item of scopedData){
   if(item.visit_date.slice(0,7)!==effectiveMonth)continue;
   const duration=durationSeconds(item.first_visit,item.last_visit);
   const key=norm(item.seller_name);
   const current=groups.get(key)??{seller:item.seller_name,seconds:0,days:0};
   if(duration!==null){current.seconds+=duration;current.days++;}
   groups.set(key,current);
  }
  return [...groups.values()].sort((a,b)=>a.seller.localeCompare(b.seller,'es'));
 },[scopedData,effectiveMonth]);
 const monthLabel=(month:string)=>new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));
 const datesInPreview=[...new Set(preview?.map(item=>item.visit_date)??[])];
 return <div className="mt-6">
  <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
   {TEAM_CARDS.map(team=>{
    const active=selectedBranch===team.branch&&selectedForce===team.force;
    const total=history.filter(item=>item.branch===team.branch&&(team.force==='all'||item.sales_force===team.force)).length;
    const compactColor:Record<string,string>={
     masivos:'border-sky-300 bg-sky-50 text-sky-800',
     refrigerados:'border-blue-300 bg-blue-50 text-blue-800',
     chaco:'border-rose-300 bg-rose-50 text-rose-800',
     misiones:'border-green-300 bg-green-50 text-green-800',
     obera:'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800',
    };
    return <button key={team.id} type="button" aria-pressed={active}
     onClick={()=>{setSelectedBranch(team.branch);setSelectedForce(team.force);setDate('all');setAverageMonth('');setColumnFilters({});setActiveColumn(null);setSortColumn(null);}}
     className={'flex min-h-[88px] flex-col justify-center gap-1 rounded-2xl border px-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md '+compactColor[team.id]+(active?' ring-2 ring-offset-2 ring-current shadow-sm':'')}>
      <span className="text-sm font-semibold">{team.name}</span>
      <span className="text-[11px] opacity-70">{total} registros históricos</span>
     </button>;
   })}
  </div>
  {missingNames.length>0&&<div role="dialog" aria-modal="true" aria-labelledby="sigo-missing-title" className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
   <div className="w-full max-w-lg rounded-[24px] bg-white p-6 shadow-2xl">
    <div className="text-[10px] font-bold uppercase tracking-[.12em] text-amber-600">Importación bloqueada</div>
    <h3 id="sigo-missing-title" className="mt-2 text-xl font-semibold text-slate-950">Actualizá Personal comercial</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600">Los siguientes nombres no tienen una coincidencia única de sucursal y fuerza de venta en el detalle de personal. Actualizá ese archivo en la pestaña <strong>Personal comercial</strong> y volvé a importar SIGO. No se guardó ningún dato.</p>
    <div className="mt-4 max-h-48 overflow-y-auto rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{missingNames.map(name=><div key={name} className="border-b border-amber-100 py-1.5 last:border-0">{name}</div>)}</div>
    <div className="mt-5 flex justify-end"><button type="button" onClick={()=>setMissingNames([])} className="rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-semibold text-white">Entendido</button></div>
   </div>
  </div>}
  {confirmReplace&&<div role="dialog" aria-modal="true" aria-labelledby="sigo-duplicate-title" className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
   <div className="w-full max-w-lg rounded-[24px] bg-white p-6 shadow-2xl">
    <div className="text-[10px] font-bold uppercase tracking-[.12em] text-amber-600">Datos ya importados</div>
    <h3 id="sigo-duplicate-title" className="mt-2 text-xl font-semibold text-slate-950">¿Reemplazar los horarios existentes?</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600">Estos días y equipos ya tienen información guardada. Si continuás, <strong>se reemplazarán todos sus registros</strong> por los resultados del Excel actual. Los demás días y equipos no se modificarán.</p>
    <div className="mt-4 max-h-48 overflow-y-auto rounded-xl bg-amber-50 p-3 text-xs text-amber-950">{duplicateScopes.map(scope=><div key={scope.visit_date+'|'+scope.branch+'|'+scope.sales_force} className="border-b border-amber-100 py-2 last:border-0">{displayDate(scope.visit_date)} · {scope.branch} · {scope.sales_force}</div>)}</div>
    <div className="mt-5 flex justify-end gap-2">
     <button type="button" disabled={busy} onClick={()=>setConfirmReplace(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700">Cancelar</button>
     <button type="button" disabled={busy} onClick={()=>void save(true)} className="rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{busy?'Guardando...':'Sí, reemplazar datos'}</button>
    </div>
   </div>
  </div>}
  <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,.035)]">
  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-6">
   <div><div className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-600">Histórico diario · SIGO</div><h2 className="mt-1 text-2xl font-semibold tracking-tight">Horarios de vendedores</h2><p className="mt-1 text-xs text-slate-500">Cada archivo se procesa localmente: solo se guardan los resultados diarios, nunca el Excel.</p></div>
   <div className="flex items-center gap-2">
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700"><Upload className="h-4 w-4"/>{file?file.name:'Importar Excel SIGO'}<input type="file" accept=".xlsx" className="sr-only" onChange={e=>void upload(e.target.files?.[0]??null)}/></label>
    {preview&&<button disabled={busy} onClick={()=>void save(false)} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-semibold text-white disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Guardar días</button>}
   </div>
  </div>
  {preview&&<div className="border-b border-blue-100 bg-blue-50 px-6 py-3 text-xs text-blue-700"><strong>Vista previa sin guardar:</strong> {preview.length} registros de vendedor/día · {datesInPreview.map(displayDate).join(', ')}. Al guardar se actualizan solo estas fechas.</div>}
  <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-[#fafbfc] px-5 py-3" role="tablist" aria-label="Vistas de Horarios SIGO">
   <button type="button" role="tab" aria-selected={view==='daily'} onClick={()=>{setView('daily');setActiveColumn(null);}} className={'rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors duration-300 '+(view==='daily'?'bg-slate-950 text-white shadow-sm':'bg-white text-slate-600 hover:bg-slate-100')}>Detalle diario</button>
   <button type="button" role="tab" aria-selected={view==='averages'} onClick={()=>{setView('averages');setActiveColumn(null);}} className={'rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors duration-300 '+(view==='averages'?'bg-slate-950 text-white shadow-sm':'bg-white text-slate-600 hover:bg-slate-100')}>Promedios mensuales</button>
  </div>
  {view==='daily'&&<>
  <div className="grid grid-cols-2 border-b border-slate-200 md:grid-cols-4">{[['Días registrados',days.length],['Clientes asignados',totals.assigned],['Visitados',totals.visited],['Sin visitar',totals.missing]].map(([label,n])=><div key={label} className="border-r border-slate-100 px-6 py-4"><p className="text-[10px] uppercase text-slate-400">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{Number(n).toLocaleString('es-AR')}</p></div>)}</div>
  <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
   <select aria-label="Fuerza de venta" value={selectedForce} onChange={e=>{setSelectedForce(e.target.value);setDate('all');setAverageMonth('');setColumnFilters({});}} className="h-10 min-w-[205px] rounded-xl border border-slate-200 bg-white px-3 text-xs">
    <option value="all">Todas las fuerzas de venta</option>{forces.map(force=><option key={force} value={force}>{force}</option>)}
   </select>
   <div className="relative min-w-[230px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar vendedor..." className="h-10 w-full rounded-xl border border-slate-200 bg-[#fafbfc] pl-9 pr-3 text-xs outline-none"/></div>
   <div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"/><select aria-label="Fecha" value={date} onChange={e=>setDate(e.target.value)} className="h-10 min-w-[170px] rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs"><option value="all">Todas las fechas</option>{days.map(day=><option key={day} value={day}>{displayDate(day)}</option>)}</select></div>
  </div>
  {Object.values(columnFilters).some(values=>values.length>0)&&<div className="flex items-center justify-between border-b border-blue-100 bg-blue-50 px-5 py-2 text-[11px] font-medium text-blue-700"><span><Filter className="mr-1 inline h-3.5 w-3.5"/>Filtros activos · {shown.length} filas</span><button type="button" onClick={clearFilters} className="rounded-lg px-2 py-1 hover:bg-blue-100">Limpiar todos</button></div>}
  {activeColumn&&<>
   <button type="button" aria-label="Cerrar menú de filtro" onClick={closeFilter} className="fixed inset-0 z-40 cursor-default bg-transparent"/>
   <div role="dialog" aria-label={'Filtrar '+columns.find(col=>col.key===activeColumn)?.label} className="fixed z-50 w-[310px] overflow-hidden rounded-xl border border-slate-200 bg-white text-xs shadow-[0_18px_45px_rgba(15,23,42,.2)]" style={{top:filterPosition.top,left:filterPosition.left}}>
    <div className="border-b border-slate-100 p-2">
     <button type="button" onClick={()=>setSort('asc')} className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-100">Ordenar A a Z / Menor a mayor</button>
     <button type="button" onClick={()=>setSort('desc')} className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-100">Ordenar Z a A / Mayor a menor</button>
    </div>
    <div className="px-3 pt-3">
     <div className="mb-2 font-semibold text-slate-800">Filtrar por valores</div>
     <div className="flex items-center justify-between text-[11px]">
      <button type="button" onClick={()=>setDraftSelection(options)} className="text-blue-600 hover:underline">Seleccionar todo</button>
      <button type="button" onClick={()=>setDraftSelection([])} className="text-blue-600 hover:underline">Borrar</button>
      <span className="text-slate-400">Mostrando {visibleOptions.length}</span>
     </div>
     <div className="relative mt-3"><Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400"/><input value={filterSearch} onChange={e=>setFilterSearch(e.target.value)} placeholder="Buscar..." className="h-9 w-full rounded-lg border border-slate-200 px-3 pr-9 text-xs outline-none focus:border-blue-400"/></div>
     <div className="my-3 max-h-48 overflow-y-auto">
      {visibleOptions.map(value=><label key={value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-slate-700 hover:bg-slate-50"><input type="checkbox" className="accent-emerald-600" checked={selectedDraft.includes(value)} onChange={()=>setDraftSelection(old=>{const current=old??options;return current.includes(value)?current.filter(v=>v!==value):[...current,value];})}/><span className="truncate">{value}</span></label>)}
      {!visibleOptions.length&&<p className="px-2 py-3 text-slate-400">Sin coincidencias</p>}
     </div>
    </div>
    <div className="flex justify-end gap-2 border-t border-slate-100 px-3 py-3">
     <button type="button" onClick={closeFilter} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
     <button type="button" onClick={applyFilter} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800">Aceptar</button>
    </div>
   </div>
  </>}
  <div className="overflow-x-auto"><table className="w-full min-w-[1690px] text-left text-xs">
   <thead className="bg-[#f5f7fa] text-[10px] uppercase tracking-wider text-slate-500"><tr>{columns.map(col=><th key={col.key} className={"px-3 py-2 font-semibold "+(col.key==='correctStart'?'border-l-[3px] border-l-slate-400 ':'')}><button type="button" onClick={event=>openFilter(col.key,event.currentTarget)} className={'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left hover:bg-slate-200 '+(columnFilters[col.key]?.length?'text-blue-600':'')}><span>{col.label}</span><ChevronDown className="h-3.5 w-3.5 shrink-0"/></button></th>)}</tr></thead>
   <tbody>{shown.map((item,i)=><tr key={item.visit_date+'|'+item.seller_name} className={(i>0&&item.visit_date!==shown[i-1].visit_date?'border-t-[3px] border-t-slate-400 ':'border-t border-t-slate-100 ')+(i%2?'bg-slate-50/40':'bg-white')}>
    <td className="whitespace-nowrap px-5 py-3 font-medium capitalize text-slate-600">{new Intl.DateTimeFormat('es-AR',{month:'long',timeZone:'UTC'}).format(new Date(item.visit_date+'T12:00:00Z'))}</td>
    <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-600">{displayDate(item.visit_date)}</td>
    <td className="px-5 py-3 text-slate-700">{sellerDetails.get(norm(item.seller_name))?.supervisor??'—'}</td>
    <td className="px-5 py-3 font-medium tabular-nums">{sellerDetails.get(norm(item.seller_name))?.code??'—'}</td>
    <td className="px-5 py-3 font-semibold text-slate-900">{item.seller_name}</td>
    <td className="px-5 py-3 font-medium tabular-nums">{item.first_visit??'—'}</td>
    <td className="px-5 py-3 font-medium tabular-nums">{item.last_visit??'—'}</td>
    <td className="px-5 py-3 font-semibold tabular-nums text-blue-700">{workedHours(item.first_visit,item.last_visit)}</td>
    <td className="px-5 py-3"><span className={'rounded-lg px-2 py-1 font-semibold tabular-nums '+(item.unvisited_clients?'bg-amber-50 text-amber-700':'bg-emerald-50 text-emerald-700')}>{item.unvisited_clients}</span></td>
    <td className="border-l-[3px] border-l-slate-400 px-5 py-3 text-slate-400">—</td>
    <td className="px-5 py-3 text-slate-400">—</td>
    <td className="px-5 py-3 text-slate-400">—</td>
    <td className="px-5 py-3 text-slate-400">—</td>
   </tr>)}</tbody>
  </table>{loading?<p className="p-12 text-center text-sm text-slate-400">Cargando histórico...</p>:!shown.length?<p className="p-12 text-center text-sm text-slate-400"><FileSpreadsheet className="mx-auto mb-2 h-6 w-6"/>No hay registros para mostrar.</p>:null}</div>
  </>}
  {view==='averages'&&<div className="bg-white">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 px-6 py-6">
     <div>
      <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-600">Resumen mensual</div>
      <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Promedio de horarios por vendedor</h3>
      <p className="mt-1 text-[11px] text-slate-500">Promedio de Horario ruta en los días con inicio y fin registrados. Los días sin horario válido no se incluyen.</p>
     </div>
     <label className="text-[11px] font-semibold text-slate-600">Mes
      <select aria-label="Mes de promedios" value={effectiveMonth} onChange={event=>setAverageMonth(event.target.value)} disabled={!months.length} className="mt-1.5 block h-10 min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-normal capitalize text-slate-800 outline-none focus:border-blue-400 disabled:opacity-50">
       {months.length?months.map(month=><option key={month} value={month}>{monthLabel(month)}</option>):<option value="">Sin meses cargados</option>}
      </select>
     </label>
    </div>
    <div className="overflow-x-auto">
     <table className="w-full min-w-[500px] text-left text-xs">
      <thead className="bg-[#f5f7fa] text-[10px] font-semibold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Cod vendedor</th><th className="px-5 py-3">Vendedor</th><th className="px-5 py-3">Hora promedio</th></tr></thead>
      <tbody>{monthlyAverages.map((item,index)=><tr key={norm(item.seller)} className={'border-t border-slate-100 '+(index%2?'bg-slate-50/40':'bg-white')}>
       <td className="px-5 py-3 font-medium tabular-nums text-slate-600">{sellerDetails.get(norm(item.seller))?.code??'—'}</td>
       <td className="px-5 py-3 font-semibold text-slate-900">{item.seller}</td>
       <td className="px-5 py-3 font-semibold tabular-nums text-blue-700">{item.days?formatDuration(Math.round(item.seconds/item.days)):'—'}</td>
      </tr>)}</tbody>
     </table>
     {!monthlyAverages.length&&<p className="px-6 py-12 text-center text-xs text-slate-400">No hay vendedores registrados en el mes seleccionado.</p>}
    </div>
  </div>}
 </section></div>;
}
