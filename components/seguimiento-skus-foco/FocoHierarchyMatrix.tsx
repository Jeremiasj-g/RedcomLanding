'use client';

import {useMemo,useState} from 'react';
import {ChevronDown,ChevronRight,Search,UsersRound,Building2,UserRound,ChartNoAxesCombined} from 'lucide-react';
import {findLineObjective,type ObjectiveValues} from '@/lib/skuFocoObjectives';

type Row=Record<string,unknown>;
type Focus={linea:string;articulos:string[]};
type Person={id:number;name:string;branch:string;role:string;superior:string};
type Item={vol:number;clients:Set<string>;objectiveVol:number|null;objectiveCov:number|null};
type Sales=Record<string,Record<string,Item>>;
const format=new Intl.NumberFormat('es-AR',{maximumFractionDigits:1});
const norm=(v:unknown)=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim().replace(/\s+/g,' ');
const txt=(v:unknown)=>String(v??'').trim();
const branchNumber=(v:unknown)=>{const t=norm(v);return /^\d+$/.test(t)?String(Number(t)):t.includes('CENTRAL')?'1':t.includes('RESISTENCIA')?'2':t.includes('POSADAS')?'3':t.includes('OBERA')?'4':'';};
const pKey=(p:Person)=>p.branch+':'+p.id;
const progress=(a:number,b:number|null)=>b===null||b<=0?null:(a/b)*100;
const fmt=(n:number|null)=>n===null?'—':format.format(n);
const pct=(n:number|null)=>n===null?'—':format.format(n)+'%';
const style=(n:number|null)=>n===null?'bg-slate-100 text-slate-400':n>=100?'bg-emerald-50 text-emerald-700':n>=75?'bg-blue-50 text-blue-700':n>=50?'bg-amber-50 text-amber-700':'bg-rose-50 text-rose-700';
const newItem=():Item=>({vol:0,clients:new Set(),objectiveVol:null,objectiveCov:null});
type TreeNode={id:string;kind:'manager'|'supervisor'|'seller';name:string;children:TreeNode[];sellerKey?:string};

export default function FocoHierarchyMatrix({lineRows,articleRows,peopleRows,focus,volumeGoals,coverageGoals}:{
 lineRows:Row[];articleRows:Row[];peopleRows:Row[];focus:Focus[];
 volumeGoals:ObjectiveValues;coverageGoals:ObjectiveValues;
}){
 const [query,setQuery]=useState('');
 const [branch,setBranch]=useState('all');
 const [selectedLine,setSelectedLine]=useState('all');
 const [expanded,setExpanded]=useState<string[]>([]);
 const [level,setLevel]=useState<'managers'|'supervisors'|'all'>('supervisors');

 const data=useMemo(()=>{
  const people:Person[]=peopleRows.map(r=>({
   id:Number(r['Código']),name:txt(r['Descripción']),
   branch:branchNumber(r['Sucursal']),role:norm(r['Cargo']),superior:norm(r['Superior'])
  })).filter(p=>Number.isFinite(p.id)&&p.id>0&&p.branch&&p.name);
  const personsByBranch=new Map<string,Person[]>();
  for(const p of people)personsByBranch.set(p.branch,[...(personsByBranch.get(p.branch)??[]),p]);
  const sales:Sales={};
  const labels:Record<string,string>={};
  const getSeller=(r:Row)=>{
   const id=Number(r['Vendedor']),branch=branchNumber(r['Sucursal']);
   if(!Number.isFinite(id)||id<=0||!branch)return null;
   const key=branch+':'+id;
   labels[key]=txt(r['Descripción Vendedor'])||labels[key]||'ID '+id;
   return key;
  };
  for(const r of lineRows){
   const seller=getSeller(r);if(!seller)continue;
   const description=norm(r['Descripción.2']||r['Lineas objetivos']);
   const code=norm(r['Código']);
   const cfg=focus.find(f=>description.includes(norm(f.linea))||code===norm(f.linea)||norm(f.linea).includes(code));
   if(!cfg)continue;
   const v=Number(r['Cantidades CON Cargo'])||0,customer=txt(r['Cod. Cliente']);
   const line=sales[seller]??={};
   const item=line[cfg.linea]??=newItem();
   item.vol+=v;if(customer&&v>0)item.clients.add(customer);
  }
  // The article report keeps focus SKU contributions available; line totals
  // always come from the line workbook to prevent double counting.
  const salesSellerKeys=Object.keys(sales);
  const usedKeys=new Set<string>();
  const roots:TreeNode[]=[];
  for(const [b,branchPeople] of personsByBranch){
   const managers=branchPeople.filter(p=>p.role==='GERENTE');
   const supervisors=branchPeople.filter(p=>p.role==='SUPERVISOR');
   const sellers=branchPeople.filter(p=>p.role==='VENDEDOR');
   const rootGroups=new Map<string,TreeNode>();
   const supervisorNodes=new Map<string,TreeNode>();
   for(const m of managers){
    const node:TreeNode={id:'m:'+b+':'+m.id,kind:'manager',name:m.name,children:[]};
    roots.push(node);rootGroups.set(norm(m.name),node);
   }
   const noManager:TreeNode={id:'m:'+b+':other',kind:'manager',name:'Sin gerente asignado · '+(b==='1'?'Casa Central':b==='2'?'Resistencia':b==='3'?'Posadas':'Oberá'),children:[]};
   for(const s of supervisors){
    const node:TreeNode={id:'s:'+b+':'+s.id,kind:'supervisor',name:s.name,children:[]};
    supervisorNodes.set(norm(s.name),node);
    (rootGroups.get(s.superior)||noManager).children.push(node);
   }
   const noSupervisor:TreeNode={id:'s:'+b+':other',kind:'supervisor',name:'Sin supervisor asignado',children:[]};
   for(const s of sellers){
    const key=pKey(s);
    const node:TreeNode={id:'v:'+key,kind:'seller',name:labels[key]||s.name,sellerKey:key,children:[]};
    (supervisorNodes.get(s.superior)||noSupervisor).children.push(node);
    usedKeys.add(key);
   }
   if(noSupervisor.children.length)noManager.children.push(noSupervisor);
   if(noManager.children.length)roots.push(noManager);
  }
  for(const key of salesSellerKeys){
   if(usedKeys.has(key))continue;
   const b=key.split(':')[0];let orphan=roots.find(n=>n.id==='m:'+b+':orphan');
   if(!orphan){orphan={id:'m:'+b+':orphan',kind:'manager',name:'Sin asignación en DetallePersonal · Sucursal '+b,children:[]};roots.push(orphan);}
   orphan.children.push({id:'v:'+key,kind:'seller',sellerKey:key,name:labels[key]||'ID '+key.split(':')[1],children:[]});
  }
  const aggregate=(node:TreeNode,line:string):Item=>{
   if(node.kind==='seller'){
    const value=sales[node.sellerKey!]?.[line];
    const oV=findLineObjective(volumeGoals,node.sellerKey!,line);
    const oC=findLineObjective(coverageGoals,node.sellerKey!,line);
    return {vol:value?.vol??0,clients:new Set(value?.clients??[]),objectiveVol:oV,objectiveCov:oC};
   }
   const value=newItem();let hasV=false,hasC=false;
   for(const ch of node.children){
    const item=aggregate(ch,line);
    value.vol+=item.vol;
    for(const cl of item.clients)value.clients.add(ch.id+'|'+cl);
    if(item.objectiveVol!==null){value.objectiveVol=(value.objectiveVol??0)+item.objectiveVol;hasV=true;}
    if(item.objectiveCov!==null){value.objectiveCov=(value.objectiveCov??0)+item.objectiveCov;hasC=true;}
   }
   if(!hasV)value.objectiveVol=null;
   if(!hasC)value.objectiveCov=null;
   return value;
  };
  const branchLabels:Record<string,string>={'1':'Casa Central','2':'Resistencia','3':'Posadas','4':'Oberá'};
  const isMatch=(node:TreeNode,q:string):boolean=>norm(node.name).includes(q)||node.id.includes(q)||node.children.some(ch=>isMatch(ch,q));
  return {roots,sales,aggregate,branchLabels,isMatch};
 },[lineRows,articleRows,peopleRows,focus,volumeGoals,coverageGoals]);

 const roots=data.roots.filter(root=>{
  if(branch!=='all'&&root.id.split(':')[1]!==branch)return false;
  return !query||data.isMatch(root,norm(query));
 });
 const lines=selectedLine==='all'?focus:focus.filter(f=>f.linea===selectedLine);
 const isOpen=(n:TreeNode)=>level==='all'||(level==='supervisors'&&n.kind==='manager')||expanded.includes(n.id);
 const toggle=(id:string)=>setExpanded(x=>x.includes(id)?x.filter(y=>y!==id):[...x,id]);
 const labels={'manager':'Jefe de ventas','supervisor':'Supervisor','seller':'Vendedor'};
 const sellers=(n:TreeNode):number=>n.kind==='seller'?1:n.children.reduce((total,ch)=>total+sellers(ch),0);
 const render=(n:TreeNode,line:string,depth=0):React.ReactNode=>{
  const metric=data.aggregate(n,line);
  const vo=progress(metric.vol,metric.objectiveVol),co=progress(metric.clients.size,metric.objectiveCov);
  const open=isOpen(n);
  return <div key={line+n.id}>
   <div className={'grid min-w-[1140px] grid-cols-[minmax(270px,2.5fr)_repeat(4,minmax(75px,1fr))_repeat(4,minmax(75px,1fr))] items-center border-b border-slate-100 text-[12px] '+(n.kind==='manager'?'bg-[#e9edf3] font-semibold text-slate-900':n.kind==='supervisor'?'bg-slate-50 font-medium text-slate-800':'bg-white text-slate-600 hover:bg-slate-50')}>
    <div className="flex min-w-0 items-center gap-1.5 px-3 py-3" style={{paddingLeft:14+depth*19}}>
     {n.kind==='seller'?<UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400"/>:<button title={open?'Contraer':'Expandir'} onClick={()=>toggle(n.id)} className="grid h-6 w-6 shrink-0 place-items-center rounded-md hover:bg-slate-200">{open?<ChevronDown className="h-4 w-4"/>:<ChevronRight className="h-4 w-4"/>}</button>}
     <span className="truncate">{n.name}</span>
     {n.kind!=='seller'&&<span className="ml-auto shrink-0 text-[10px] font-normal text-slate-400">{sellers(n)} vend.</span>}
    </div>
    <div className="px-2 text-right tabular-nums">{fmt(metric.objectiveVol)}</div>
    <div className="px-2 text-right font-semibold tabular-nums">{fmt(metric.vol)}</div>
    <div className="px-2 text-right tabular-nums">{metric.objectiveVol===null?'—':fmt(Math.max(0,metric.objectiveVol-metric.vol))}</div>
    <div className="px-2 text-center"><span className={'inline-flex min-w-[57px] justify-center rounded-lg px-2 py-1.5 text-xs font-semibold tabular-nums '+style(vo)}>{pct(vo)}</span></div>
    <div className="border-l border-slate-200 px-2 text-right tabular-nums">{fmt(metric.objectiveCov)}</div>
    <div className="px-2 text-right font-semibold tabular-nums">{metric.clients.size}</div>
    <div className="px-2 text-right tabular-nums">{metric.objectiveCov===null?'—':fmt(Math.max(0,metric.objectiveCov-metric.clients.size))}</div>
    <div className="px-2 text-center"><span className={'inline-flex min-w-[57px] justify-center rounded-lg px-2 py-1.5 text-xs font-semibold tabular-nums '+style(co)}>{pct(co)}</span></div>
   </div>
   {open&&n.children.map(ch=>render(ch,line,depth+1))}
  </div>;
 };
 const summary=lines.map(line=>{
  const items=roots.map(n=>data.aggregate(n,line.linea));
  const volume=items.reduce((s,x)=>s+x.vol,0),clients=items.reduce((s,x)=>s+x.clients.size,0);
  const volGoals=items.map(x=>x.objectiveVol).filter((v):v is number=>v!==null);
  const covGoals=items.map(x=>x.objectiveCov).filter((v):v is number=>v!==null);
  return {line:line.linea,volume,clients,volGoal:volGoals.length?volGoals.reduce((a,b)=>a+b,0):null,covGoal:covGoals.length?covGoals.reduce((a,b)=>a+b,0):null};
 });
 const cards=summary.reduce((a,x)=>({volume:a.volume+x.volume,clients:a.clients+x.clients,volGoal:a.volGoal+(x.volGoal??0),covGoal:a.covGoal+(x.covGoal??0),volumeHas:a.volumeHas||x.volGoal!==null,coverageHas:a.coverageHas||x.covGoal!==null}),{volume:0,clients:0,volGoal:0,covGoal:0,volumeHas:false,coverageHas:false});
 return <div className="space-y-5">
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   {[
    {label:'Volumen vendido',value:fmt(cards.volume),detail:'Unidades acumuladas'},
    {label:'Cumplimiento volumen',value:pct(cards.volumeHas?progress(cards.volume,cards.volGoal):null),detail:cards.volumeHas?'Objetivo '+fmt(cards.volGoal):'Sin objetivo'},
    {label:'Cobertura acumulada',value:fmt(cards.clients),detail:'Compradores por vendedor y línea'},
    {label:'Cumplimiento cobertura',value:pct(cards.coverageHas?progress(cards.clients,cards.covGoal):null),detail:cards.coverageHas?'Objetivo '+fmt(cards.covGoal):'Sin objetivo'},
   ].map(card=><div key={card.label} className="rounded-[19px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
    <div className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">{card.label}</div>
    <div className="mt-2 text-[28px] font-semibold tracking-tight text-slate-950">{card.value}</div>
    <div className="mt-1 text-[11px] text-slate-400">{card.detail}</div>
   </div>)}
  </div>
  <div className="flex flex-wrap items-end gap-3 rounded-[20px] border border-slate-200 bg-white p-4">
   <label className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar jefe, supervisor, vendedor o ID" className="h-10 w-full rounded-xl border border-slate-200 bg-[#fafbfc] pl-9 pr-3 text-xs outline-none focus:border-blue-300"/></label>
   <select aria-label="Sucursal" value={branch} onChange={e=>setBranch(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"><option value="all">Todas las sucursales</option>{Object.entries(data.branchLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
   <select aria-label="Línea" value={selectedLine} onChange={e=>setSelectedLine(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"><option value="all">Todas las líneas</option>{focus.map(f=><option key={f.linea} value={f.linea}>{f.linea}</option>)}</select>
   <div className="flex rounded-xl bg-slate-100 p-1">{([{id:'managers',label:'Jefes'},{id:'supervisors',label:'Supervisores'},{id:'all',label:'Todo'}] as const).map(item=><button key={item.id} onClick={()=>setLevel(item.id)} className={'rounded-lg px-3 py-2 text-[11px] font-semibold '+(level===item.id?'bg-white text-slate-950 shadow-sm':'text-slate-500')}>{item.label}</button>)}</div>
  </div>
  {!peopleRows.length?<div className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-800">Importá DetallePersonal para consultar la jerarquía comercial. Los reportes de ventas se conservan.</div>:null}
  {summary.map(line=><section key={line.line} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
   <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1c2535] px-5 py-4 text-white">
    <div><div className="text-[10px] uppercase tracking-[.1em] text-white/45">Matriz jerárquica · Línea comercial</div><h3 className="mt-1 text-[16px] font-semibold">{line.line}</h3></div>
    <div className="flex flex-wrap gap-4 text-[11px]"><span>Volumen <strong className="text-base">{fmt(line.volume)}</strong></span><span>Avance <strong className="text-base">{pct(progress(line.volume,line.volGoal))}</strong></span><span>Cobertura <strong className="text-base">{fmt(line.clients)}</strong></span></div>
   </div>
   <div className="overflow-x-auto">
    <div className="min-w-[1140px]">
     <div className="grid grid-cols-[minmax(270px,2.5fr)_repeat(4,minmax(75px,1fr))_repeat(4,minmax(75px,1fr))] border-b border-slate-200 bg-[#f3f5f8] text-[10px] font-semibold uppercase tracking-[.07em] text-slate-500">
      <div className="px-4 py-3">Personal comercial</div>
      <div className="col-span-4 py-3 text-center text-blue-800">Volumen</div>
      <div className="col-span-4 border-l border-slate-200 py-3 text-center text-emerald-800">Cobertura</div>
     </div>
     <div className="grid grid-cols-[minmax(270px,2.5fr)_repeat(4,minmax(75px,1fr))_repeat(4,minmax(75px,1fr))] border-b border-slate-200 bg-slate-50 py-2 text-center text-[10px] font-semibold uppercase text-slate-400">
      <div className="text-left px-4">Gerencia → Supervisión → Venta</div>
      {['Objetivo','Avance','Resta','%','Objetivo','Avance','Resta','%'].map((v,i)=><div key={i}>{v}</div>)}
     </div>
     {roots.length?roots.map(root=>render(root,line.line)):<div className="p-8 text-center text-sm text-slate-400">Sin equipos para los filtros actuales.</div>}
    </div>
   </div>
  </section>)}
  <p className="px-1 text-[11px] leading-5 text-slate-400">Los totales se agregan desde vendedores hacia supervisores y gerentes. La cobertura se suma por vendedor y línea; un cliente atendido por dos vendedores cuenta en ambos. Un guion significa que no hay un objetivo válido asignado, no un objetivo cero.</p>
 </div>;
}
