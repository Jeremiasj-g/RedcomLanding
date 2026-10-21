'use client';

import {useEffect,useMemo,useState} from 'react';
import {AnimatePresence,motion} from 'framer-motion';
import {ChevronDown,ChevronRight,FileSpreadsheet,Loader2,Save,Search,UsersRound} from 'lucide-react';
import {readFirstWorksheet} from '@/lib/categoryPanelExcel';
import {supabase} from '@/lib/supabaseClient';
import {errorMessage,notify} from '@/lib/notifications';

export type CommercialPerson={id:number;name:string;branch:string;role:string;superior:string;force:string};
type Node={key:string;person:CommercialPerson|null;name:string;kind:'branch'|'manager'|'supervisor'|'seller';children:Node[]};
const clean=(value:unknown)=>String(value??'').replace(/\s+/g,' ').trim();
const norm=(value:unknown)=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const branchKey=(value:string)=>norm(value);
const makeNode=(p:CommercialPerson,kind:Node['kind']):Node=>({key:p.branch+':'+p.role+':'+p.id,name:p.name,person:p,kind,children:[]});
function parsePersonnel(matrix:(string|number|boolean|null)[][]):CommercialPerson[]{
 const headers=matrix[0]?.map(norm)??[];
 const index=(label:string)=>headers.indexOf(norm(label));
 const required=['Código','Descripción','Sucursal','Cargo','Superior'];
 if(required.some(label=>index(label)<0))throw new Error('El Excel debe incluir Código, Descripción, Sucursal, Cargo y Superior.');
 const people:CommercialPerson[]=[];
 const found=new Set<string>();
 for(const row of matrix.slice(1)){
  const id=Number(row[index('Código')]),name=clean(row[index('Descripción')]),branch=clean(row[index('Sucursal')]);
  if(!Number.isInteger(id)||id<=0||!name||!branch)continue;
  const role=norm(row[index('Cargo')]);
  if(!['VENDEDOR','SUPERVISOR','GERENTE'].includes(role))continue;
  const key=branchKey(branch)+':'+id;
  if(found.has(key))throw new Error('Código duplicado en la misma sucursal: '+key);
  found.add(key);
  people.push({id,name,branch,role,superior:clean(row[index('Superior')]),force:clean(row[index('Fuerza de Venta')])});
 }
 if(!people.length)throw new Error('No hay personal comercial válido en el archivo.');
 return people;
}
function buildTree(people:CommercialPerson[]):Node[]{
 const branches=new Map<string,{name:string;persons:CommercialPerson[]}>();
 for(const person of people){
  const id=branchKey(person.branch);
  const entry=branches.get(id)??{name:person.branch,persons:[]};
  entry.persons.push(person);branches.set(id,entry);
 }
 return [...branches.entries()].sort(([a],[b])=>a.localeCompare(b,'es')).map(([branch,entry])=>{
  const root:Node={key:'branch:'+branch,name:entry.name,person:null,kind:'branch',children:[]};
  const managers=entry.persons.filter(p=>p.role==='GERENTE');
  const supervisors=entry.persons.filter(p=>p.role==='SUPERVISOR');
  const sellers=entry.persons.filter(p=>p.role==='VENDEDOR');
  const managerNodes=managers.map(p=>makeNode(p,'manager'));
  const supervisorNodes=supervisors.map(p=>makeNode(p,'supervisor'));
  const orphans:Node={key:root.key+':unassigned',name:'Sin superior identificado',person:null,kind:'manager',children:[]};
  for(const supervisor of supervisorNodes){
    const boss=managerNodes.find(m=>norm(m.name)===norm(supervisor.person?.superior));
    (boss??orphans).children.push(supervisor);
  }
  for(const seller of sellers){
    const supervisor=supervisorNodes.find(s=>norm(s.name)===norm(seller.superior));
    const node=makeNode(seller,'seller');
    if(supervisor)supervisor.children.push(node);
    else{
      const manager=managerNodes.find(m=>norm(m.name)===norm(seller.superior));
      (manager??orphans).children.push(node);
    }
  }
  root.children=[...managerNodes.filter(n=>n.children.length),...managerNodes.filter(n=>!n.children.length)];
  if(orphans.children.length)root.children.push(orphans);
  return root;
 });
}
const countSellers=(node:Node):number=>node.kind==='seller'?1:node.children.reduce((sum,child)=>sum+countSellers(child),0);

export default function CommercialPersonnel(){
 const [people,setPeople]=useState<CommercialPerson[]>([]);
 const [updatedAt,setUpdatedAt]=useState<string|null>(null);
 const [file,setFile]=useState<File|null>(null);
 const [preview,setPreview]=useState<CommercialPerson[]|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [query,setQuery]=useState('');
 const [branch,setBranch]=useState('all');
 const [collapsed,setCollapsed]=useState<string[]>([]);
 useEffect(()=>{
  let active=true;
  void(async()=>{
   try{
    const {data,error}=await supabase.from('category_commercial_personnel').select('people,updated_at').eq('id',1).maybeSingle();
    if(error)throw error;
    if(active){setPeople(Array.isArray(data?.people)?data.people as CommercialPerson[]:[]);setUpdatedAt(data?.updated_at??null);}
   }catch(e){if(active)notify.error(errorMessage(e,'No se pudo cargar el personal comercial.'));}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[]);
 const current=preview??people;
 const trees=useMemo(()=>buildTree(current),[current]);
 const shown=trees.filter(root=>branch==='all'||root.key==='branch:'+branchKey(branch));
 const filterNode=(node:Node):Node|null=>{
  const q=norm(query);
  if(!q)return node;
  if(norm(node.name+' '+(node.person?.id??'')+' '+(node.person?.superior??'')).includes(q))return node;
  const children=node.children.map(filterNode).filter((item):item is Node=>Boolean(item));
  return children.length?{...node,children}:null;
 };
 const visible=shown.map(filterNode).filter((item):item is Node=>Boolean(item));
 const upload=async(next:File|null)=>{
  setFile(next);setPreview(null);setCollapsed([]);
  if(!next)return;
  try{setBusy(true);setPreview(parsePersonnel(await readFirstWorksheet(next)));}
  catch(e){notify.error(errorMessage(e,'No se pudo leer DetallePersonal.'));}
  finally{setBusy(false);}
 };
 const save=async()=>{
  if(!preview||busy)return;
  try{
   setBusy(true);
   const {data,error}=await supabase.from('category_commercial_personnel').upsert({id:1,people:preview,updated_at:new Date().toISOString()},{onConflict:'id'}).select('updated_at').single();
   if(error)throw error;
   setPeople(preview);setUpdatedAt(data.updated_at);setPreview(null);setFile(null);
   notify.success('Personal comercial guardado y compartido.');
  }catch(e){notify.error(errorMessage(e,'No se pudo guardar el personal comercial.'));}
  finally{setBusy(false);}
 };
 const renderNode=(node:Node,depth=0):React.ReactNode=>{
  const open=!collapsed.includes(node.key)||Boolean(query);
  const expandable=node.children.length>0;
  const type=node.kind==='branch'?'Sucursal':node.kind==='manager'?'Gerencia':node.kind==='supervisor'?'Supervisión':'Vendedor';
  return <div key={node.key}>
   <motion.div layout transition={{duration:0.3,ease:'easeInOut'}} className={'flex items-center gap-3 border-b border-slate-100 py-3 pr-4 '+(node.kind==='branch'?'bg-[#edf1f7] font-semibold':node.kind==='manager'?'bg-slate-50 font-semibold':'bg-white')}
    style={{paddingLeft:16+depth*22}}>
    {expandable?<button type="button" onClick={()=>setCollapsed(old=>old.includes(node.key)?old.filter(x=>x!==node.key):[...old,node.key])} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-slate-200">
      <motion.span className="block" animate={{rotate:open?0:-90}} transition={{duration:0.3,ease:'easeInOut'}}><ChevronDown className="h-4 w-4"/></motion.span>
    </button>:<span className="w-7 shrink-0"/>}
    <div className="min-w-0 flex-1"><div className="truncate text-[13px] text-slate-900">{node.person?.id?String(node.person.id).padStart(2,'0')+' · ':''}{node.name}</div>
     {node.person?.superior&&<div className="text-[10px] font-normal text-slate-400">Superior: {node.person.superior}</div>}
    </div>
    <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-500 sm:inline">{type}</span>
    {expandable&&<span className="whitespace-nowrap text-[11px] font-normal text-slate-400">{countSellers(node)} vendedores</span>}
   </motion.div>
   <AnimatePresence initial={false}>
    {open&&expandable&&<motion.div key="children" initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.3,ease:[0.4,0,0.2,1]}} className="overflow-hidden">{node.children.map(child=>renderNode(child,depth+1))}</motion.div>}
   </AnimatePresence>
  </div>;
 };
 return <motion.section initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.3,ease:'easeOut'}} className="mt-6 overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,.035)]">
  <div className="flex flex-wrap items-start justify-between gap-5 border-b border-slate-200 p-6">
   <div><div className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-600">Estructura comercial</div>
    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Personal comercial</h2>
    <p className="mt-2 text-xs text-slate-500">Importá DetallePersonal.xlsx y consultá gerentes, supervisores y vendedores por sucursal.</p>
    <p className="mt-2 text-[11px] text-slate-400">{updatedAt?'Guardado: '+new Date(updatedAt).toLocaleString('es-AR'):'Sin importaciones guardadas'}</p>
   </div>
   <div className="flex flex-wrap items-center gap-2">
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><FileSpreadsheet className="h-4 w-4"/> {file?file.name:'Seleccionar Excel'}
     <input type="file" accept=".xlsx" className="sr-only" onChange={event=>void upload(event.target.files?.[0]??null)}/>
    </label>
    {preview&&<button type="button" disabled={busy} onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-semibold text-white disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Guardar personal</button>}
   </div>
  </div>
  <AnimatePresence initial={false}>{preview&&<motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.3}} className="overflow-hidden border-b border-blue-100 bg-blue-50 px-6 py-3 text-xs font-medium text-blue-700">Vista previa · {preview.length} personas · Guardá para reemplazar la información vigente.</motion.div>}</AnimatePresence>
  <div className="grid grid-cols-2 gap-0 border-b border-slate-200 sm:grid-cols-4">
   {[['Sucursales',new Set(current.map(p=>branchKey(p.branch))).size],['Gerentes',current.filter(p=>p.role==='GERENTE').length],['Supervisores',current.filter(p=>p.role==='SUPERVISOR').length],['Vendedores',current.filter(p=>p.role==='VENDEDOR').length]].map(([label,value])=>
     <div key={label} className="border-r border-slate-100 px-6 py-4"><div className="text-[10px] uppercase text-slate-400">{label}</div><div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div></div>)}
  </div>
  <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
   <div className="relative min-w-[230px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nombre, ID o superior..." className="h-10 w-full rounded-xl border border-slate-200 bg-[#fafbfc] pl-9 pr-3 text-xs outline-none"/></div>
   <select aria-label="Sucursal" value={branch} onChange={e=>setBranch(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs">{[<option key="all" value="all">Todas las sucursales</option>,...[...new Set(current.map(p=>p.branch))].map(v=><option key={v} value={v}>{v}</option>)]}</select>
   <button type="button" onClick={()=>setCollapsed([])} className="h-10 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-700">Expandir todo</button>
   <button type="button" onClick={()=>setCollapsed(trees.flatMap(b=>[b.key,...b.children.flatMap(m=>[m.key,...m.children.map(s=>s.key)])]))} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold">Contraer todo</button>
  </div>
  {loading?<div className="p-12 text-center text-sm text-slate-400">Cargando personal comercial...</div>:visible.length?<div>{visible.map(node=>renderNode(node))}</div>:<div className="p-12 text-center text-sm text-slate-400"><UsersRound className="mx-auto mb-3 h-7 w-7"/> {current.length?'No hay coincidencias.':'Importá DetallePersonal para visualizar la jerarquía.'}</div>}
 </motion.section>;
}
