'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Script from 'next/script';
import { ArrowRight, BarChart3, CheckCircle2, FileSpreadsheet, Layers3, Loader2, Plus, RefreshCw, Save, Search, Target, Trash2, Upload, Users, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useMe } from '@/hooks/useMe';
import { notify, errorMessage } from '@/lib/notifications';
import { findLineObjective, parseObjectiveMatrix, type ObjectiveValues } from '@/lib/skuFocoObjectives';

type ExcelRow = Record<string, unknown>;
type FocusLine = { linea: string; articulos: string[] };
type FormLine = { key: number; linea: string; articulos: string };
type Objectives = Record<string, { objVol: number; objCov: number }>;
type Shared = {
  lineas: ExcelRow[]; articulos: ExcelRow[]; focus_config: FocusLine[];
  objectives: Objectives; file_lineas_name: string | null;
  file_articulos_name: string | null; updated_at: string;
  lineas_storage_path?: string | null; articulos_storage_path?: string | null;
  objetivo_volumen_storage_path?: string | null; objetivo_cobertura_storage_path?: string | null;
  objetivo_volumen_file_name?: string | null; objetivo_cobertura_file_name?: string | null;
};
type Metric = { vol: number; cov: Set<string>; objVol: number; objCov: number };
type LineMetric = Metric & { realName: string; articulos: Record<string, Metric> };
type Vendor = { lineas: Record<string, LineMetric> };
type Dashboard = Record<string, Vendor>;
declare global { interface Window { XLSX?: { read: (value: Uint8Array, config: {type: 'array'}) => { Sheets: Record<string, unknown>; SheetNames: string[] }; utils: { sheet_to_json: (sheet: unknown) => ExcelRow[] } } } }

const emptyShared: Shared = {lineas:[],articulos:[],focus_config:[],objectives:{},file_lineas_name:null,file_articulos_name:null,updated_at:'',lineas_storage_path:null,articulos_storage_path:null,
 objetivo_volumen_storage_path:null,objetivo_cobertura_storage_path:null,
 objetivo_volumen_file_name:null,objetivo_cobertura_file_name:null};
const int = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const newMetric = (): Metric => ({vol:0,cov:new Set<string>(),objVol:0,objCov:0});
const keyObj = (vendor:string,line:string,art?:string) => JSON.stringify([vendor,line,art??null]);
const text = (x:unknown) => String(x ?? '').trim();

function buildDashboard(state: Shared) {
  const globalData: Dashboard = {};
  const descArt: Record<string,string> = {};
  const vendors = new Set<string>();
  const lineDescriptions: Record<string,string> = {};
  const vendorLabels: Record<string,string> = {};
  const vendorKeyFromRow = (row:ExcelRow):string | null => {
    const raw = text(row['Vendedor']);
    const id = Number(raw);
    if (!raw || !Number.isFinite(id) || id <= 0) return null;
    const branch = text(row['Sucursal']).match(/^\s*(\d+)/)?.[1];
    return branch ? `${Number(branch)}:${id}` : null;
  };

  // Misma selección por código/nombre y mismos cálculos del HTML suministrado.
  for (const row of state.lineas) {
    const vendor = vendorKeyFromRow(row);
    if (!vendor) continue;
    vendorLabels[vendor] = text(row['Descripción Vendedor']) || `Vendedor ${vendor.split(':')[1]}`;
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
    const vendor = vendorKeyFromRow(row);
    if (!vendor) continue;
    vendorLabels[vendor] = text(row['Descripción Vendedor']) || `Vendedor ${vendor.split(':')[1]}`;
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
  return { globalData, descArt, vendorLabels,
    vendors:[...vendors].sort((a,b)=>vendorLabels[a].localeCompare(vendorLabels[b],'es')) };
}

function MetricCells({data, goalVol, goalCov}:{
  data: Metric; goalVol: number | null; goalCov: number | null;
}) {
  const remainingVol = goalVol === null ? null : Math.max(0,goalVol-data.vol);
  const remainingCov = goalCov === null ? null : Math.max(0,goalCov-data.cov.size);
  const show = (value:number|null)=>value===null?'—':int.format(value);
  return <>
    <td className="border-l border-slate-100 px-3 py-3 text-center font-semibold text-slate-700">{show(goalVol)}</td>
    <td className="px-3 py-3 text-center font-semibold text-blue-700">{int.format(data.vol)}</td>
    <td className="px-3 py-3 text-center text-rose-500">{show(remainingVol)}</td>
    <td className="border-l border-slate-100 px-3 py-3 text-center font-semibold text-slate-700">{show(goalCov)}</td>
    <td className="px-3 py-3 text-center font-semibold text-emerald-700">{data.cov.size}</td>
    <td className="px-3 py-3 text-center text-rose-500">{show(remainingCov)}</td>
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
  const [objectiveVolumeFile,setObjectiveVolumeFile] = useState<File|null>(null);
  const [objectiveCoverageFile,setObjectiveCoverageFile] = useState<File|null>(null);
  const [volumeObjectives,setVolumeObjectives] = useState<ObjectiveValues>({});
  const [coverageObjectives,setCoverageObjectives] = useState<ObjectiveValues>({});
  const [storedPaths,setStoredPaths] = useState<{
    lineas:string|null;articulos:string|null;volume:string|null;coverage:string|null;
  }>({lineas:null,articulos:null,volume:null,coverage:null});

  const load = useCallback(async()=>{
    const {data,error}=await supabase.from('sku_foco_shared_state').select('*').eq('id',1).single();
    if(error) throw error;
    const value = {...emptyShared,...data} as Shared;
    setState(value);
    setStoredPaths({
      lineas:value.lineas_storage_path??null,articulos:value.articulos_storage_path??null,
      volume:value.objetivo_volumen_storage_path??null,
      coverage:value.objetivo_cobertura_storage_path??null,
    });
    setForms(value.focus_config.length?value.focus_config.map((f,i)=>({key:i+1,linea:f.linea,articulos:f.articulos.join(', ')})):[{key:1,linea:'',articulos:''}]);
    setCounter(value.focus_config.length+1 || 2);
    if((value.lineas.length || value.lineas_storage_path) && (value.articulos.length || value.articulos_storage_path) && value.focus_config.length)setTab('dashboard');
  },[]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{try{await load();}catch(e){if(!cancelled)notify.error(errorMessage(e,'No se pudo recuperar el seguimiento guardado.'));}finally{if(!cancelled)setLoading(false);}})();
    return ()=>{cancelled=true;};
  },[load]);

  // Al entrar, los archivos congelados se descargan una sola vez desde Storage.
  // La tabla SQL solo almacena metadatos, no miles de filas JSON.
  useEffect(()=>{
    if(!xlsxReady || (!storedPaths.lineas && !storedPaths.articulos && !storedPaths.volume && !storedPaths.coverage))return;
    let cancelled=false;
    (async()=>{
      try{
        setLoading(true);
        const download=async(path:string):Promise<ExcelRow[]>=>{
          const {data,error}=await supabase.storage.from('sku-foco-reports').download(path);
          if(error)throw error;
          const wb=window.XLSX!.read(new Uint8Array(await data.arrayBuffer()),{type:'array'});
          return window.XLSX!.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        };
        const [lineas,articulos,volumes,coverages]=await Promise.all([
          storedPaths.lineas?download(storedPaths.lineas):Promise.resolve(null),
          storedPaths.articulos?download(storedPaths.articulos):Promise.resolve(null),
          storedPaths.volume?download(storedPaths.volume):Promise.resolve(null),
          storedPaths.coverage?download(storedPaths.coverage):Promise.resolve(null),
        ]);
        if(cancelled)return;
        setState(prev=>({...prev,lineas:lineas??prev.lineas,articulos:articulos??prev.articulos}));
        setVolumeObjectives(volumes ? parseObjectiveMatrix(volumes) : {});
        setCoverageObjectives(coverages ? parseObjectiveMatrix(coverages) : {});
      }catch(e){if(!cancelled)notify.error(errorMessage(e,'No se pudieron recuperar los reportes compartidos.'));}
      finally{if(!cancelled)setLoading(false);}
    })();
    return ()=>{cancelled=true;};
  },[xlsxReady,storedPaths.lineas,storedPaths.articulos,storedPaths.volume,storedPaths.coverage]);

  const parsedFocus = useMemo(()=>forms.filter(f=>f.linea.trim()).map(f=>({
    linea:f.linea.trim().toUpperCase(),articulos:f.articulos.split(',').map(a=>a.trim()).filter(Boolean),
  })),[forms]);
  const {globalData,descArt,vendors,vendorLabels}=useMemo(()=>buildDashboard(state),[state]);
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
    if(!lineFile&&!storedPaths.lineas&&!state.lineas.length){notify.error('Falta el reporte por línea.');return;}
    if(!articleFile&&!storedPaths.articulos&&!state.articulos.length){notify.error('Falta el reporte por artículo.');return;}
    if(!objectiveVolumeFile&&!storedPaths.volume){notify.error('Falta Objetivo-volumen.xlsx.');return;}
    if(!objectiveCoverageFile&&!storedPaths.coverage){notify.error('Falta Objetivo-cobertura.xlsx.');return;}
    const newUploads:string[]=[];
    try{
      setBusy(true);
      const [rowsLines,rowsArts,rowsVolume,rowsCoverage]=await Promise.all([
        lineFile?readFile(lineFile):Promise.resolve(state.lineas),
        articleFile?readFile(articleFile):Promise.resolve(state.articulos),
        objectiveVolumeFile?readFile(objectiveVolumeFile):Promise.resolve(null),
        objectiveCoverageFile?readFile(objectiveCoverageFile):Promise.resolve(null),
      ]);
      const newVolume=rowsVolume ? parseObjectiveMatrix(rowsVolume) : volumeObjectives;
      const newCoverage=rowsCoverage ? parseObjectiveMatrix(rowsCoverage) : coverageObjectives;
      const upload=async(file:File,kind:string)=>{
        const path=`live/${kind}-${Date.now()}-${Math.random().toString(36).slice(2,10)}.xlsx`;
        const {error}=await supabase.storage.from('sku-foco-reports').upload(path,file,{
          contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert:false,
        });
        if(error)throw error;
        newUploads.push(path);
        return path;
      };
      const lineasPath=lineFile?await upload(lineFile,'lineas'):storedPaths.lineas;
      const articulosPath=articleFile?await upload(articleFile,'articulos'):storedPaths.articulos;
      const volumePath=objectiveVolumeFile?await upload(objectiveVolumeFile,'objetivo-volumen'):storedPaths.volume;
      const coveragePath=objectiveCoverageFile?await upload(objectiveCoverageFile,'objetivo-cobertura'):storedPaths.coverage;
      // Sin enviar todas las filas en un único JSON: evita timeout y Failed to fetch.
      const timestamp=new Date().toISOString();
      const {error}=await supabase.from('sku_foco_shared_state').update({
        lineas:[],articulos:[],
        lineas_storage_path:lineasPath,articulos_storage_path:articulosPath,
        objetivo_volumen_storage_path:volumePath,objetivo_cobertura_storage_path:coveragePath,
        objetivo_volumen_file_name:objectiveVolumeFile?.name??state.objetivo_volumen_file_name,
        objetivo_cobertura_file_name:objectiveCoverageFile?.name??state.objetivo_cobertura_file_name,
        focus_config:parsedFocus,
        file_lineas_name:lineFile?.name??state.file_lineas_name,
        file_articulos_name:articleFile?.name??state.file_articulos_name,
        updated_at:timestamp,updated_by:me?.id,
      }).eq('id',1);
      if(error)throw error;
      setState(prev=>({...prev,lineas:rowsLines,articulos:rowsArts,focus_config:parsedFocus,
        file_lineas_name:lineFile?.name??prev.file_lineas_name,
        file_articulos_name:articleFile?.name??prev.file_articulos_name,
        lineas_storage_path:lineasPath,articulos_storage_path:articulosPath,
        objetivo_volumen_storage_path:volumePath,objetivo_cobertura_storage_path:coveragePath,
        objetivo_volumen_file_name:objectiveVolumeFile?.name??prev.objetivo_volumen_file_name,
        objetivo_cobertura_file_name:objectiveCoverageFile?.name??prev.objetivo_cobertura_file_name,
        updated_at:timestamp}));
      setVolumeObjectives(newVolume);setCoverageObjectives(newCoverage);
      setStoredPaths({lineas:lineasPath??null,articulos:articulosPath??null,
        volume:volumePath??null,coverage:coveragePath??null});
      setLineFile(null);setArticleFile(null);setObjectiveVolumeFile(null);setObjectiveCoverageFile(null);setVendorFilter('all');setTab('dashboard');
      notify.success('Reportes congelados en Storage y disponibles para los demás usuarios.');
    }catch(e){
      if(newUploads.length)void supabase.storage.from('sku-foco-reports').remove(newUploads);
      notify.error(errorMessage(e,'No se pudieron procesar o guardar los reportes.'));
    }finally{setBusy(false);}
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
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {([
                {title:'Objetivo de volumen',name:state.objetivo_volumen_file_name,
                  path:storedPaths.volume,file:objectiveVolumeFile,set:setObjectiveVolumeFile},
                {title:'Objetivo de cobertura',name:state.objetivo_cobertura_file_name,
                  path:storedPaths.coverage,file:objectiveCoverageFile,set:setObjectiveCoverageFile},
              ] as const).map(item=><div key={item.title}
                className="rounded-2xl border border-dashed border-slate-300 bg-[#fafbfc] p-5">
                <FileSpreadsheet className="h-7 w-7 text-blue-600"/>
                <h3 className="mt-3 text-sm font-semibold text-slate-800">{item.title}</h3>
                <p className="mt-2 text-xs text-slate-500">{item.path
                  ? 'Guardado: '+(item.name??'Planilla de objetivos')
                  : 'Aún sin datos guardados'}</p>
                {item.file&&<p className="mt-2 text-xs font-semibold text-blue-700">
                  Nuevo archivo: {item.file.name}</p>}
                {admin&&<input aria-label={item.title} type="file" accept=".xlsx,.xls"
                  disabled={!xlsxReady} onChange={e=>item.set(e.target.files?.[0]??null)}
                  className="mt-4 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700 disabled:opacity-50"/>}
              </div>)}
            </div>
            <p className="mt-3 text-xs text-slate-500">Los objetivos se cruzan por ID de vendedor y línea comercial. Las planillas corresponden a Casa Central.</p>
            <div className="mt-6 flex justify-between border-t border-slate-100 pt-5">
              <button onClick={()=>setTab('foco')} className="h-10 px-3 text-xs font-semibold text-slate-500">Volver</button>
              {admin?<button disabled={busy||!xlsxReady} onClick={()=>void saveSnapshot()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Guardar y generar reporte</button>:<button onClick={()=>setTab('dashboard')} className="rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white">Ver dashboard</button>}
            </div>
          </section>}

          {tab==='dashboard'&&<section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <label className="flex items-center gap-3 text-xs font-semibold text-slate-700"><Users className="h-4 w-4 text-blue-600"/> Vendedor
                <select value={vendorFilter} onChange={e=>setVendorFilter(e.target.value)} className="h-10 min-w-[230px] max-w-[340px] rounded-xl border border-slate-200 bg-[#fafbfc] px-3 text-xs text-slate-800"><option value="all">Todos los vendedores</option>{vendors.map(v=><option key={v} value={v}>{vendorLabels[v]} · ID {v.split(':')[1]}</option>)}</select>
              </label>
              <div className="flex items-center gap-2">

                <button onClick={()=>setTab('datos')} className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-blue-600 hover:bg-blue-50"><RefreshCw className="h-4 w-4"/> Recargar datos</button>
              </div>
            </div>
            {!configured?<div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">Todavía no hay un reporte compartido. Un administrador debe configurar el foco e importar ambos Excel.</div>:
            <div className="space-y-5">{visibleVendors.map(vendor=>{
              const lines=globalData[vendor]?.lineas??{};
              const existing=state.focus_config.filter(cfg=>lines[cfg.linea]);
              if(!existing.length)return null;
              return <article key={vendor} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 bg-[#1b263e] px-5 py-4 text-white"><Users className="h-4 w-4"/><h2 className="text-base font-semibold">{vendorLabels[vendor]} <span className="ml-2 text-xs font-normal text-white/50">ID {vendor.split(':')[1]}</span></h2></div>
                <div className="overflow-x-auto"><table className="w-full min-w-[950px] border-collapse text-left text-xs">
                  <thead><tr className="bg-slate-100 text-slate-700"><th className="w-[40%] border-b border-slate-200 px-4 py-3">Concepto (línea / artículo)</th><th colSpan={3} className="border-b border-l border-slate-200 px-4 py-3 text-center text-blue-900">VOLUMEN</th><th colSpan={3} className="border-b border-l border-slate-200 px-4 py-3 text-center text-emerald-900">COBERTURA</th></tr><tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><th className="px-4 py-2"></th><th className="border-l px-3 py-2 text-center">Obj.</th><th className="px-3 py-2 text-center">Avance</th><th className="px-3 py-2 text-center">Resta</th><th className="border-l px-3 py-2 text-center">Obj.</th><th className="px-3 py-2 text-center">Avance</th><th className="px-3 py-2 text-center">Resta</th></tr></thead>
                  <tbody>{existing.map(cfg=>{
                    const line=lines[cfg.linea];
                    return <FragmentLine key={cfg.linea} cfg={cfg} line={line} vendor={vendor} descArt={descArt} volumeGoals={volumeObjectives} coverageGoals={coverageObjectives}/>;
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

function FragmentLine({cfg,line,vendor,descArt,volumeGoals,coverageGoals}:{
  cfg:FocusLine;line:LineMetric;vendor:string;descArt:Record<string,string>;
  volumeGoals:ObjectiveValues;coverageGoals:ObjectiveValues;
}) {
  const volGoal=findLineObjective(volumeGoals,vendor,line.realName,cfg.linea);
  const covGoal=findLineObjective(coverageGoals,vendor,line.realName,cfg.linea);
  return <>
    <tr className="border-b border-blue-100 bg-blue-50 font-semibold text-blue-900">
      <td className="px-4 py-3"><Layers3 className="mr-2 inline h-4 w-4 text-blue-500"/>{line.realName||cfg.linea}</td>
      <MetricCells data={line} goalVol={volGoal} goalCov={covGoal}/>
    </tr>
    {cfg.articulos.map(cod=>{
      const art=line.articulos[cod];
      if(!art||art.vol<=0)return null;
      return <tr key={cod} className="border-b border-slate-100 text-slate-700 hover:bg-slate-50">
        <td className="px-4 py-3 pl-9"><span className="mr-2 text-[10px] font-semibold text-slate-400">({cod})</span>{descArt[cod]||'Cod: '+cod}</td>
        <MetricCells data={art} goalVol={null} goalCov={null}/>
      </tr>;
    })}
  </>;
}
