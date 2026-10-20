'use client';

import {useMemo,useState} from 'react';
import {ChevronDown,ChevronRight,Search,UserRound,Download,FileSpreadsheet} from 'lucide-react';
import {findLineObjective,type ObjectiveValues} from '@/lib/skuFocoObjectives';

type Row=Record<string,unknown>;
type Focus={linea:string;articulos:string[]};
type Person={id:number;name:string;branch:string;role:string;superior:string};
type Item={vol:number;clients:Set<string>;objectiveVol:number|null;objectiveCov:number|null};
type Sales=Record<string,Record<string,Item>>;
const skuKey=(line:string,sku:string)=>line+'::sku::'+sku;
type ExcelAPI={utils:{aoa_to_sheet:(v:(string|number|null)[][])=>unknown;book_new:()=>unknown;book_append_sheet:(b:unknown,s:unknown,n:string)=>void};writeFile:(b:unknown,n:string)=>void};
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
 const [selectedSkus,setSelectedSkus]=useState<string[]>([]);
 const [skuMenu,setSkuMenu]=useState(false);
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
  const lineDescriptions:Record<string,string>={};
  const skuDescriptions:Record<string,string>={};
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
   if(description) lineDescriptions[cfg.linea]=txt(r['Descripción.2']||r['Lineas objetivos']);
   const v=Number(r['Cantidades CON Cargo'])||0,customer=txt(r['Cod. Cliente']);
   const line=sales[seller]??={};
   const item=line[cfg.linea]??=newItem();
   item.vol+=v;if(customer&&v>0)item.clients.add(customer);
  }
  // SKU rows come exclusively from article sales; line totals stay unchanged.
  for(const r of articleRows){
   const seller=getSeller(r);if(!seller)continue;
   const code=txt(r['Código']);
   const cfg=focus.find(f=>f.articulos.some(v=>norm(v)===norm(code)));
   if(!cfg)continue;
   const desc=txt(r['Descripción.2']||r['Artículos']);
   if(desc)skuDescriptions[skuKey(cfg.linea,code)]=desc;
   const value=Number(r['Cantidades CON Cargo'])||0;
   const item=(sales[seller]??={})[skuKey(cfg.linea,code)]??=newItem();
   item.vol+=value;
   const customer=txt(r['Cod. Cliente']);
   if(customer&&value>0)item.clients.add(customer);
  }
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
    const isSku=line.includes('::sku::');
    const oV=isSku?null:findLineObjective(volumeGoals,node.sellerKey!,lineDescriptions[line]??'',line);
    const oC=isSku?null:findLineObjective(coverageGoals,node.sellerKey!,lineDescriptions[line]??'',line);
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
  return {roots,sales,aggregate,branchLabels,isMatch,skuDescriptions};
 },[lineRows,articleRows,peopleRows,focus,volumeGoals,coverageGoals]);

 const roots=data.roots.filter(root=>{
  if(branch!=='all'&&root.id.split(':')[1]!==branch)return false;
  return !query||data.isMatch(root,norm(query));
 });
 const lines=selectedLine==='all'?focus:focus.filter(f=>f.linea===selectedLine);
 const availableSkus=[...new Set(lines.flatMap(f=>f.articulos))];
 const selectedCodes=(f:Focus)=>f.articulos.filter(code=>!selectedSkus.length||selectedSkus.includes(code));
 const filteredKeys=(f:Focus)=>selectedSkus.length?selectedCodes(f).map(code=>skuKey(f.linea,code)):[f.linea];
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
  const items=roots.flatMap(n=>filteredKeys(line).map(key=>data.aggregate(n,key)));
  const volume=items.reduce((s,x)=>s+x.vol,0),clients=items.reduce((s,x)=>s+x.clients.size,0);
  const volGoals=items.map(x=>x.objectiveVol).filter((v):v is number=>v!==null);
  const covGoals=items.map(x=>x.objectiveCov).filter((v):v is number=>v!==null);
  return {line:line.linea,volume,clients,volGoal:volGoals.length?volGoals.reduce((a,b)=>a+b,0):null,covGoal:covGoals.length?covGoals.reduce((a,b)=>a+b,0):null};
 });
 const exportMatrix=async(complete:boolean)=>{
  type CellValue=string|number|null;
  type ExcelCell={value:CellValue;style:Record<string,unknown>;numFmt:string;alignment:Record<string,unknown>;font:Record<string,unknown>;fill:Record<string,unknown>};
  type ExcelRow={getCell:(index:number)=>ExcelCell;height:number;values:CellValue[]};
  type ExcelSheet={
    mergeCells:(range:string)=>void;
    getCell:(address:string)=>ExcelCell;
    getRow:(index:number)=>ExcelRow;
    getColumn:(index:number)=>{width:number};
    addRow:(values:CellValue[])=>ExcelRow;
    views:unknown[];
    autoFilter:unknown;
    pageSetup:unknown;
  };
  type ExcelBook={
    creator:string;
    created:Date;
    addWorksheet:(name:string,options:Record<string,unknown>)=>ExcelSheet;
    xlsx:{writeBuffer:()=>Promise<ArrayBuffer>};
  };
  type ExcelJSConstructor=new()=>ExcelBook;
  const getExcelJS=async():Promise<ExcelJSConstructor>=>{
    const w=window as Window & {ExcelJS?:ExcelJSConstructor};
    if(w.ExcelJS)return w.ExcelJS;
    await new Promise<void>((resolve,reject)=>{
      const existing=document.querySelector('script[data-redcom-exceljs]');
      if(existing){existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(new Error('Error al cargar ExcelJS')),{once:true});return;}
      const script=document.createElement('script');
      script.dataset.redcomExceljs='true';
      script.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
      script.async=true;
      script.onload=()=>resolve();
      script.onerror=()=>reject(new Error('No se pudo cargar el generador de Excel'));
      document.head.appendChild(script);
    });
    if(!w.ExcelJS)throw new Error('El generador ExcelJS no está disponible');
    return w.ExcelJS;
  };
  try{
    const ExcelJS=await getExcelJS();
    const workbook=new ExcelJS();
    workbook.creator='REDCOM · Seguimiento SKUs FOCO';
    workbook.created=new Date();
    const sheet=workbook.addWorksheet('Matriz FOCO',{properties:{defaultRowHeight:19}});
    const navy='192439',blue='2459E8',green='116B52',light='EFF3F8',muted='69788F',white='FFFFFF';
    const solid=(color:string)=>({type:'pattern',pattern:'solid',fgColor:{argb:'FF'+color}});
    const font=(color:string,bold=false,size=10)=>({name:'Aptos',color:{argb:'FF'+color},bold,size});
    const colWidths=[22,22,16,19,33,15,17,17,17,16,17,17,17,16];
    colWidths.forEach((width,i)=>{sheet.getColumn(i+1).width=width;});
    sheet.mergeCells('A1:N2');
    const brand=sheet.getCell('A1');
    brand.value='REDCOM   /   SEGUIMIENTO SKUs FOCO';
    brand.fill=solid(navy);brand.font=font(white,true,18);
    brand.alignment={vertical:'middle',horizontal:'left',indent:1};
    sheet.getRow(1).height=24;sheet.getRow(2).height=20;
    sheet.mergeCells('A3:N3');
    const meta=sheet.getCell('A3');
    meta.value=(complete?'REPORTE COMPLETO':'VISTA FILTRADA')+'   ·   '+new Date().toLocaleString('es-AR');
    meta.fill=solid('E6EDF6');meta.font=font('40516A',true,10);meta.alignment={vertical:'middle',indent:2};
    sheet.getRow(3).height=26;
    sheet.mergeCells('A4:N4');
    const filters=sheet.getCell('A4');
    filters.value=complete?'Sucursales, líneas, SKUs y equipos: todos':
      'Sucursal: '+(branch==='all'?'Todas':data.branchLabels[branch]??branch)+
      '   |   Línea: '+(selectedLine==='all'?'Todas':selectedLine)+
      '   |   SKU: '+(selectedSkus.length?selectedSkus.join(', '):'Todos')+
      '   |   Personal: '+(query||'Todos');
    filters.fill=solid('F5F7FA');filters.font=font(muted,false,9);
    filters.alignment={vertical:'middle',indent:2};sheet.getRow(4).height=24;
    sheet.mergeCells('A6:F6');sheet.mergeCells('G6:J6');sheet.mergeCells('K6:N6');
    for(const [cell,title,color] of [['A6','ESTRUCTURA COMERCIAL',navy],['G6','VOLUMEN',blue],['K6','COBERTURA',green]]){
      const target=sheet.getCell(cell);target.value=title;
      target.fill=solid(color);target.font=font(white,true,10);
      target.alignment={vertical:'middle',horizontal:'center'};
    }
    sheet.getRow(6).height=27;
    const columns=['Línea','Código SKU','Nivel','Sucursal','Responsable','ID vendedor',
      'Objetivo','Avance','Resta','% cumplimiento','Objetivo','Avance','Resta','% cumplimiento'];
    const header=sheet.getRow(7);header.values=columns;header.height=29;
    for(let i=1;i<=14;i++){
      const cell=header.getCell(i);
      cell.fill=solid(i>=11?'D9F2E9':i>=7?'DFEAFE':'E7EBF0');
      cell.font=font(i>=11?green:i>=7?'194ABF':navy,true,10);
      cell.alignment={horizontal:i<=6?'left':'center',vertical:'middle',wrapText:true};
    }
    const exportRoots=complete?data.roots:roots;
    const exportLines=complete?focus:lines;
    let alternating=0;
    const append=(node:TreeNode,line:string,sku:string|null,depth:number)=>{
      const m=data.aggregate(node,sku?skuKey(line,sku):line);
      const parts=node.sellerKey?.split(':');
      const isBoss=node.kind==='manager',isSupervisor=node.kind==='supervisor';
      const percentVolume=progress(m.vol,m.objectiveVol);
      const percentCoverage=progress(m.clients.size,m.objectiveCov);
      const row=sheet.addRow([line,sku??'',isBoss?'Jefe de ventas':isSupervisor?'Supervisor':'Vendedor',
        data.branchLabels[node.id.split(':')[1]]??'',node.name,parts?Number(parts[1]):null,
        m.objectiveVol,m.vol,m.objectiveVol===null?null:Math.max(0,m.objectiveVol-m.vol),
        percentVolume===null?null:percentVolume/100,
        m.objectiveCov,m.clients.size,m.objectiveCov===null?null:Math.max(0,m.objectiveCov-m.clients.size),
        percentCoverage===null?null:percentCoverage/100]);
      row.height=isBoss?26:isSupervisor?23:21;
      const bg=isBoss?'E3EAF3':isSupervisor?'F0F4F9':alternating++%2===0?white:'FAFBFD';
      for(let i=1;i<=14;i++){
        const cell=row.getCell(i);
        cell.fill=solid(bg);
        cell.font=font(isBoss?navy:isSupervisor?'344761':'45546A',isBoss||isSupervisor,isBoss?11:10);
        cell.alignment={vertical:'middle',horizontal:i>6?'right':'left'};
        if(i>=7&&i!==10&&i!==14)cell.numFmt='#,##0.##;[Red](#,##0.##);–';
        if(i===10||i===14){
          cell.numFmt='0.0%';
          const value=i===10?percentVolume:percentCoverage;
          if(value!==null){
            const tone=value>=100?'DCF6E8':value>=75?'E5EDFF':value>=50?'FFF0C7':'FDE4E4';
            cell.fill=solid(tone);cell.font=font(value>=100?'116B52':value>=75?'194ABF':value>=50?'966500':'B74343',true,10);
          }
        }
      }
      row.getCell(5).alignment={indent:Math.min(depth,3)+1,vertical:'middle'};
      node.children.forEach(child=>append(child,line,sku,depth+1));
    };
    for(const focusLine of exportLines){
      const codes=complete?focusLine.articulos:selectedCodes(focusLine);
      if(complete||!selectedSkus.length)exportRoots.forEach(root=>append(root,focusLine.linea,null,0));
      codes.forEach(code=>exportRoots.forEach(root=>append(root,focusLine.linea,code,0)));
    }
    sheet.views=[{state:'frozen',xSplit:6,ySplit:7}];
    sheet.autoFilter={from:'A7',to:'N7'};
    sheet.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};
    const content=await workbook.xlsx.writeBuffer();
    const blob=new Blob([content],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download='REDCOM_SKUs_FOCO_'+(complete?'Completo':'Filtrado')+'.xlsx';
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }catch(error){
    window.alert(error instanceof Error?error.message:'No se pudo generar el Excel');
  }
 };
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
   <select aria-label="Línea" value={selectedLine} onChange={e=>{setSelectedLine(e.target.value);setSelectedSkus([]);setSkuMenu(false);}} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"><option value="all">Todas las líneas</option>{focus.map(f=><option key={f.linea} value={f.linea}>{f.linea}</option>)}</select>
   <div className="relative">
    <button type="button" onClick={()=>setSkuMenu(v=>!v)} className="flex h-10 min-w-[160px] items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
      SKUs: {selectedSkus.length?selectedSkus.length+' elegidos':'Todos'} <ChevronDown className="h-4 w-4"/>
    </button>
    {skuMenu&&<div className="absolute right-0 top-12 z-30 max-h-[300px] w-[300px] overflow-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
      <button type="button" onClick={()=>setSelectedSkus([])} className="mb-2 w-full rounded-lg bg-slate-100 px-3 py-2 text-left text-xs font-semibold">Todos los SKUs</button>
      {availableSkus.map(code=><label key={code} className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-slate-50">
        <input type="checkbox" checked={selectedSkus.includes(code)} onChange={e=>setSelectedSkus(old=>e.target.checked?[...old,code]:old.filter(s=>s!==code))}/>
        {code} · {lines.find(f=>f.articulos.includes(code))?.linea}
      </label>)}
      <button type="button" onClick={()=>setSkuMenu(false)} className="mt-2 w-full rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white">Aplicar</button>
    </div>}
   </div>
   <div className="flex rounded-xl bg-slate-100 p-1">{([{id:'managers',label:'Jefes'},{id:'supervisors',label:'Supervisores'},{id:'all',label:'Todo'}] as const).map(item=><button key={item.id} onClick={()=>setLevel(item.id)} className={'rounded-lg px-3 py-2 text-[11px] font-semibold '+(level===item.id?'bg-white text-slate-950 shadow-sm':'text-slate-500')}>{item.label}</button>)}</div>
  </div>
  <div className="flex flex-wrap justify-end gap-2">
   <button onClick={()=>exportMatrix(false)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700"><Download className="h-4 w-4"/>Exportar filtrado</button>
   <button onClick={()=>exportMatrix(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white"><FileSpreadsheet className="h-4 w-4"/>Exportar completo</button>
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
     {roots.length?<div>
       {(!selectedSkus.length)&&<div className="border-b bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">Total de línea · {line.line}</div>}
       {(!selectedSkus.length)&&roots.map(root=>render(root,line.line))}
       {selectedCodes(focus.find(f=>f.linea===line.line)!).map(code=><div key={code}>
         <div className="border-b bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700">SKU {code} · {data.skuDescriptions[skuKey(line.line,code)]??'Artículo'}</div>
         {roots.map(root=>render(root,skuKey(line.line,code)))}
       </div>)}
      </div>:<div className="p-8 text-center text-sm text-slate-400">Sin equipos para los filtros actuales.</div>}
    </div>
   </div>
  </section>)}
  <p className="px-1 text-[11px] leading-5 text-slate-400">Los totales se agregan desde vendedores hacia supervisores y gerentes. La cobertura se suma por vendedor y línea; un cliente atendido por dos vendedores cuenta en ambos. Un guion significa que no hay un objetivo válido asignado, no un objetivo cero.</p>
 </div>;
}
