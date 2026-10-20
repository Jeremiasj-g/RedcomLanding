'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Script from 'next/script';
import { ArrowRight, BarChart3, CheckCircle2, FileSpreadsheet, Layers3, Loader2, Plus, RefreshCw, Save, Search, Target, Trash2, Upload, Users, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useMe } from '@/hooks/useMe';
import { notify, errorMessage } from '@/lib/notifications';

type ExcelRow = Record<string, unknown>;
type FocusLine = { linea: string; articulos: string[] };
type FormLine = { key: number; linea: string; articulos: string };
type Objectives = Record<string, { objVol: number; objCov: number }>;
type Shared = {
  lineas: ExcelRow[]; articulos: ExcelRow[]; focus_config: FocusLine[];
  objectives: Objectives; file_lineas_name: string | null;
  file_articulos_name: string | null; updated_at: string;
};
type Metric = { vol: number; cov: Set<string>; objVol: number; objCov: number };
type LineMetric = Metric & { realName: string; articulos: Record<string, Metric> };
type Vendor = { lineas: Record<string, LineMetric> };
type Dashboard = Record<string, Vendor>;
declare global { interface Window { XLSX?: { read: (value: Uint8Array, config: {type: 'array'}) => { Sheets: Record<string, unknown>; SheetNames: string[] }; utils: { sheet_to_json: (sheet: unknown) => ExcelRow[] } } } }

const emptyShared: Shared = {lineas:[],articulos:[],focus_config:[],objectives:{},file_lineas_name:null,file_articulos_name:null,updated_at:''};
const int = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const newMetric = (): Metric => ({vol:0,cov:new Set<string>(),objVol:0,objCov:0});
const keyObj = (vendor:string,line:string,art?:string) => JSON.stringify([vendor,line,art??null]);
const text = (x:unknown) => String(x ?? '').trim();

function buildDashboard(state: Shared) {
  const globalData: Dashboard = {};
  const descArt: Record<string,string> = {};
  const vendors = new Set<string>();
  const lineDescriptions: Record<string,string> = {};

  // Misma selección por código/nombre y mismos cálculos del HTML suministrado.
  for (const row of state.lineas) {
    const vendor = text(row['Descripción Vendedor']) || 'Sin Vendedor';
    const desc = text(row['Descripción.2'] || row['Lineas objetivos']);
    const code = text(row['Código']);
    const cfg = state.focus_config.find(f=>desc.toUpperCase().includes(f.linea) || code===f.linea || f.linea.includes(code));
    if (!cfg) continue;
    lineDescriptions[cfg.linea] = desc;
    const vol = parseFloat(text(row['Cantidades CON Cargo'])) || 0;
    const cliente = row['Cod. Cliente'];
    vendors.add(vendor);
    globalData[vendor] ??= {lineas:{}};
    const line = globalData[vendor].lineas[cfg.linea] ??= {...newMetric(),realName:desc,articulos:{}};
    line.vol += vol;
    if (cliente && vol > 0) line.cov.add(String(cliente));
  }
  for (const row of state.articulos) {
    const vendor = text(row['Descripción Vendedor']) || 'Sin Vendedor';
    const cod = text(row['Código']);
    const desc = text(row['Descripción.2'] || row['Artículos']) || 'Desconocido';
    const cfg = state.focus_config.find(f=>f.articulos.includes(cod));
    if (!cfg) continue;
    globalData[vendor] ??= {lineas:{}};
    const line = globalData[vendor].lineas[cfg.linea] ??= {...newMetric(),realName:cfg.linea,articulos:{}};
    descArt[cod] = desc;
    const item = line.articulos[cod] ??= newMetric();
    const vol = parseFloat(text(row['Cantidades CON Cargo'])) || 0;
    const cliente = row['Cod. Cliente'];
    item.vol += vol;
    if (cliente && vol > 0) item.cov.add(String(cliente));
    vendors.add(vendor);
  }
  return { globalData, descArt, vendors:[...vendors].filter(v=>v!=='Sin Vendedor'&&v!=='NaN').sort() };
}

function MetricCells({data, vendor, line, article, goals, onChange, canEdit}:{
  data: Metric; vendor:string; line:string; article?:string;
  goals:Objectives; onChange:(key:string,field:'objVol'|'objCov',value:number)=>void;canEdit:boolean;
}) {
  const id = keyObj(vendor,line,article);
  const saved = goals[id] || {objVol:0,objCov:0};
  const remainingVol = Math.max(0,saved.objVol-data.vol);
  const remainingCov = Math.max(0,saved.objCov-data.cov.size);
  return <>
    <td className="border-l border-slate-100 px-2 py-2 text-center"><input aria-label="Objetivo volumen" type="number" min={0} step="any" disabled={!canEdit} value={saved.objVol} onChange={e=>onChange(id,'objVol',Number(e.target.value)||0)} className="w-[76px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs text-slate-800 outline-none focus:border-blue-400 disabled:bg-slate-50"/></td>
    <td className="px-3 py-3 text-center font-semibold text-blue-700">{int.format(data.vol)}</td>
    <td className="px-3 py-3 text-center text-rose-500">{int.format(remainingVol)}</td>
    <td className="border-l border-slate-100 px-2 py-2 text-center"><input aria-label="Objetivo cobertura" type="number" min={0} step="any" disabled={!canEdit} value={saved.objCov} onChange={e=>onChange(id,'objCov',Number(e.target.value)||0)} className="w-[76px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs text-slate-800 outline-none focus:border-blue-400 disabled:bg-slate-50"/></td>
    <td className="px-3 py-3 text-center font-semibold text-emerald-700">{data.cov.size}</td>
    <td className="px-3 py-3 text-center text-rose-500">{int.format(remainingCov)}</td>
  </>;
}

export default function SeguimientoSkusFoco() {
  const {me} = useMe();
  const admin = me?.role === 'admin';
  const [tab,setTab] = useState<'foco'|'datos'|'dashboard'>('foco');
  const [state,setState] = useState<Shared>(emptyShared);
  const [forms,setForms] = useState<FormLine[]>([{key:1,linea:'',articulos:''}]);
  const [counter,setCounter] = useState(2);
  const [vendorFilter,setVendorFilter] = useState('all');
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [xlsxReady,setXlsxReady] = useState(false);
  const [lineFile,setLineFile] = useState<File|null>(null);
  const [articleFile,setArticleFile] = useState<File|null>(null);
  const [objectivesDirty,setObjectivesDirty] = useState(false);

  const load = useCallback(async()=>{
    const {data,error}=await supabase.from('sku_foco_shared_state').select('*').eq('id',1).single();
    if(error) throw error;
    const value = {...emptyShared,...data} as Shared;
    setState(value);
    setForms(value.focus_config.length?value.focus_config.map((f,i)=>({key:i+1,linea:f.linea,articulos:f.articulos.join(', ')})):[{key:1,linea:'',articulos:''}]);
    setCounter(value.focus_config.length+1 || 2);
    if(value.lineas.length && value.articulos.length && value.focus_config.length)setTab('dashboard');
  },[]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{try{await load();}catch(e){if(!cancelled)notify.error(errorMessage(e,'No se pudo recuperar el seguimiento guardado.'));}finally{if(!cancelled)setLoading(false);}})();
    return ()=>{cancelled=true;};
  },[load]);

  const parsedFocus = useMemo(()=>forms.filter(f=>f.linea.trim()).map(f=>({
    linea:f.linea.trim().toUpperCase(),articulos:f.articulos.split(',').map(a=>a.trim()).filter(Boolean),
  })),[forms]);
  const {globalData,descArt,vendors}=useMemo(()=>buildDashboard(state),[state]);
  const visibleVendors = vendorFilter==='all'?vendors:[vendorFilter];
  const configured=Boolean(state.lineas.length && state.articulos.length && state.focus_config.length);

  async function readFile(file:File): Promise<ExcelRow[]> {
    if(!window.XLSX)throw new Error('El lector de Excel todavía se está cargando. Intentá nuevamente.');
    const wb = window.XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array'});
    return window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  }
  async function saveSnapshot() {
    if(!admin)return;
    if(!parsedFocus.length){notify.error('Definí al menos una línea de foco.');setTab('foco');return;}
    if(!lineFile&&!state.lineas.length){notify.error('Falta el reporte por línea.');return;}
    if(!articleFile&&!state.articulos.length){notify.error('Falta el reporte por artículo.');return;}
    try{
      setBusy(true);
      const [rowsLines,rowsArts]=await Promise.all([lineFile?readFile(lineFile):Promise.resolve(state.lineas),articleFile?readFile(articleFile):Promise.resolve(state.articulos)]);
      const next={...state,lineas:rowsLines,articulos:rowsArts,focus_config:parsedFocus,
        file_lineas_name:lineFile?.name??state.file_lineas_name,
        file_articulos_name:articleFile?.name??state.file_articulos_name,
        updated_at:new Date().toISOString()};
      const {error}=await supabase.from('sku_foco_shared_state').update({...next,updated_by:me?.id}).eq('id',1);
      if(error)throw error;
      setState(next);setLineFile(null);setArticleFile(null);setVendorFilter('all');setTab('dashboard');
      notify.success('Reportes y configuración guardados para todos los usuarios.');
    }catch(e){notify.error(errorMessage(e,'No se pudieron procesar o guardar los reportes.'));}
    finally{setBusy(false);}
  }
  function editGoal(id:string,field:'objVol'|'objCov',value:number){
    setState(prev=>({...prev,objectives:{...prev.objectives,[id]:{objVol:prev.objectives[id]?.objVol??0,objCov:prev.objectives[id]?.objCov??0,[field]:value}}}));
    setObjectivesDirty(true);
  }
  async function saveGoals(){
    if(!admin)return;
    try{
      setBusy(true);
      const {error}=await supabase.from('sku_foco_shared_state').update({objectives:state.objectives}).eq('id',1);
      if(error)throw error;
      setObjectivesDirty(false);notify.success('Objetivos guardados para todos los usuarios.');
    }catch(e){notify.error(errorMessage(e,'No se pudieron guardar los objetivos.'));}
    finally{setBusy(false);}
  }

  return <main className="min-h-screen bg-[#F4F5F7] px-4 pb-14 pt-8 sm:px-6 lg:px-8">
    <Script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" strategy="afterInteractive" onLoad={()=>setXlsxReady(true)}/>
    <div className="mx-auto max-w-[1480px]">
      <header className="mb-7 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-600"><Target className="h-4 w-4"/> Seguimiento comercial</div>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-[#17181B]">Seguimiento SKUs FOCO</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Configurá líneas y artículos de foco, importá los reportes y seguí los avances de volumen y cobertura.</p>
        </div>
        <div className="text-xs text-slate-400">{state.updated_at?<>Última actualización: {new Date(state.updated_at).toLocaleString('es-AR')}</>:'Sin información congelada'}</div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3" aria-label="Secciones SKUs FOCO">
        {([{id:'foco',label:'1. Definir Foco',icon:Target},{id:'datos',label:'2. Cargar Datos',icon:FileSpreadsheet},{id:'dashboard',label:'3. Dashboard',icon:BarChart3}] as const).map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={'flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold transition '+(tab===t.id?'bg-[#17181b] text-white':'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}><t.icon className="h-4 w-4"/>{t.label}</button>)}
      </nav>
      {loading?<div className="grid min-h-[380px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400"/></div>:(
        <>
          {tab==='foco'&&<section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-semibold text-slate-950">Configurar líneas y artículos de foco</h2>
            <p className="mt-1 text-sm text-slate-500">Agregá las líneas de objetivo y los códigos de los artículos específicos que querés analizar. Solo estos aparecerán en el resultado.</p>
            <div className="mt-6 space-y-3">{forms.map(f=><div key={f.key} className="grid gap-3 rounded-2xl border border-slate-200 bg-[#fafbfc] p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
              <label className="text-xs font-semibold text-slate-600">Nombre o código de línea<input disabled={!admin} value={f.linea} onChange={e=>setForms(old=>old.map(item=>item.key===f.key?{...item,linea:e.target.value}:item))} placeholder="Ej.: 04 WINNERS o 1126" className="mt-2 block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-400 disabled:bg-slate-50"/></label>
              <label className="text-xs font-semibold text-slate-600">Códigos de artículos FOCO (separados por coma)<input disabled={!admin} value={f.articulos} onChange={e=>setForms(old=>old.map(item=>item.key===f.key?{...item,articulos:e.target.value}:item))} placeholder="Ej.: 670218, 671376, 128" className="mt-2 block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-400 disabled:bg-slate-50"/></label>
              {admin&&<button title="Eliminar línea" onClick={()=>setForms(old=>old.filter(item=>item.key!==f.key))} className="self-end rounded-xl p-3 text-rose-500 hover:bg-rose-50"><X className="h-4 w-4"/></button>}
            </div>)}</div>
            <div className="mt-5 flex flex-wrap justify-between gap-3">
              {admin?<button onClick={()=>{setForms(old=>[...old,{key:counter,linea:'',articulos:''}]);setCounter(x=>x+1);}} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-50 px-4 text-xs font-semibold text-blue-700"><Plus className="h-4 w-4"/> Agregar línea de foco</button>:<span className="text-xs text-slate-400">La configuración es administrada centralmente.</span>}
              <button onClick={()=>setTab('datos')} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-5 text-xs font-semibold text-white">Siguiente paso <ArrowRight className="h-4 w-4"/></button>
            </div>
          </section>}

          {tab==='datos'&&<section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-semibold text-slate-950">Importar reportes Excel</h2>
            <p className="mt-1 text-sm text-slate-500">Los datos guardados son compartidos: al ingresar, los demás usuarios ven el mismo reporte sin volver a importar.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {([{id:'lineas',title:'Ventas x Línea (acumulado)',file:lineFile,set:setLineFile,name:state.file_lineas_name,rows:state.lineas.length},
                {id:'articulos',title:'Ventas x Artículo (detalle foco)',file:articleFile,set:setArticleFile,name:state.file_articulos_name,rows:state.articulos.length}] as const).map(item=>
                <div key={item.id} className="rounded-2xl border border-dashed border-slate-300 bg-[#fafbfc] p-5">
                  <FileSpreadsheet className="h-7 w-7 text-emerald-600"/>
                  <h3 className="mt-3 text-sm font-semibold text-slate-800">{item.title}</h3>
                  <p className="mt-2 text-xs text-slate-500">{item.name?`Guardado: ${item.name} · ${int.format(item.rows)} filas`:'Aún sin datos guardados'}</p>
                  {item.file&&<p className="mt-2 text-xs font-semibold text-blue-700">Nuevo archivo: {item.file.name}</p>}
                  {admin&&<input aria-label={item.title} type="file" accept=".xlsx,.xls" disabled={!xlsxReady} onChange={e=>item.set(e.target.files?.[0]??null)} className="mt-4 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-semibold file:text-emerald-700 disabled:opacity-50"/>}
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-between border-t border-slate-100 pt-5">
              <button onClick={()=>setTab('foco')} className="h-10 px-3 text-xs font-semibold text-slate-500">Volver</button>
              {admin?<button disabled={busy||!xlsxReady} onClick={()=>void saveSnapshot()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Guardar y generar reporte</button>:<button onClick={()=>setTab('dashboard')} className="rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white">Ver dashboard</button>}
            </div>
          </section>}

          {tab==='dashboard'&&<section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <label className="flex items-center gap-3 text-xs font-semibold text-slate-700"><Users className="h-4 w-4 text-blue-600"/> Vendedor
                <select value={vendorFilter} onChange={e=>setVendorFilter(e.target.value)} className="h-10 min-w-[230px] max-w-[340px] rounded-xl border border-slate-200 bg-[#fafbfc] px-3 text-xs text-slate-800"><option value="all">Todos los vendedores</option>{vendors.map(v=><option key={v} value={v}>{v}</option>)}</select>
              </label>
              <div className="flex items-center gap-2">
                {admin&&objectivesDirty&&<button disabled={busy} onClick={()=>void saveGoals()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white"><Save className="h-4 w-4"/> Guardar objetivos</button>}
                <button onClick={()=>setTab('datos')} className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-blue-600 hover:bg-blue-50"><RefreshCw className="h-4 w-4"/> Recargar datos</button>
              </div>
            </div>
            {!configured?<div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">Todavía no hay un reporte compartido. Un administrador debe configurar el foco e importar ambos Excel.</div>:
            <div className="space-y-5">{visibleVendors.map(vendor=>{
              const lines=globalData[vendor]?.lineas??{};
              const existing=state.focus_config.filter(cfg=>lines[cfg.linea]);
              if(!existing.length)return null;
              return <article key={vendor} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 bg-[#1b263e] px-5 py-4 text-white"><Users className="h-4 w-4"/><h2 className="text-base font-semibold">{vendor}</h2></div>
                <div className="overflow-x-auto"><table className="w-full min-w-[950px] border-collapse text-left text-xs">
                  <thead><tr className="bg-slate-100 text-slate-700"><th className="w-[40%] border-b border-slate-200 px-4 py-3">Concepto (línea / artículo)</th><th colSpan={3} className="border-b border-l border-slate-200 px-4 py-3 text-center text-blue-900">VOLUMEN</th><th colSpan={3} className="border-b border-l border-slate-200 px-4 py-3 text-center text-emerald-900">COBERTURA</th></tr><tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><th className="px-4 py-2"></th><th className="border-l px-3 py-2 text-center">Obj.</th><th className="px-3 py-2 text-center">Avance</th><th className="px-3 py-2 text-center">Resta</th><th className="border-l px-3 py-2 text-center">Obj.</th><th className="px-3 py-2 text-center">Avance</th><th className="px-3 py-2 text-center">Resta</th></tr></thead>
                  <tbody>{existing.map(cfg=>{
                    const line=lines[cfg.linea];
                    return <FragmentLine key={cfg.linea} cfg={cfg} line={line} vendor={vendor} descArt={descArt} goals={state.objectives} canEdit={admin} onChange={editGoal}/>;
                  })}</tbody>
                </table></div>
              </article>;
            })}</div>}
          </section>}
        </>
      )}
    </div>
  </main>;
}

function FragmentLine({cfg,line,vendor,descArt,goals,canEdit,onChange}:{
  cfg:FocusLine;line:LineMetric;vendor:string;descArt:Record<string,string>;
  goals:Objectives;canEdit:boolean;onChange:(id:string,field:'objVol'|'objCov',value:number)=>void;
}) {
 return <>
   <tr className="border-b border-blue-100 bg-blue-50 font-semibold text-blue-900"><td className="px-4 py-3"><Layers3 className="mr-2 inline h-4 w-4 text-blue-500"/>{line.realName||cfg.linea}</td><MetricCells data={line} vendor={vendor} line={cfg.linea} goals={goals} canEdit={canEdit} onChange={onChange}/></tr>
   {cfg.articulos.map(cod=>{const art=line.articulos[cod];if(!art||art.vol<=0)return null;return <tr key={cod} className="border-b border-slate-100 text-slate-700 hover:bg-slate-50"><td className="px-4 py-3 pl-9"><span className="mr-2 text-[10px] font-semibold text-slate-400">({cod})</span>{descArt[cod]||'Cod: '+cod}</td><MetricCells data={art} vendor={vendor} line={cfg.linea} article={cod} goals={goals} canEdit={canEdit} onChange={onChange}/></tr>;})}
 </>;
}
