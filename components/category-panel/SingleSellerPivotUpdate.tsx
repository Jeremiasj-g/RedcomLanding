'use client';

import { useState } from 'react';
import { FileSpreadsheet, Loader2, RefreshCw, Upload, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { parseSingleSellerPivot, type CategoryPanelRow } from '@/lib/categoryPanelExcel';
import { errorMessage, notify } from '@/lib/notifications';

type PivotSingle = Awaited<ReturnType<typeof parseSingleSellerPivot>>;
const number = new Intl.NumberFormat('es-AR');

export default function SingleSellerPivotUpdate({ savedRows, onUpdated }: {
  savedRows: CategoryPanelRow[];
  onUpdated: (row: CategoryPanelRow) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<PivotSingle | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const current = parsed ? savedRows.find(row=>row.branchKey===parsed.branchKey && row.sellerId===parsed.sellerId) : undefined;
  async function preview() {
    if(!file) return;
    try{
      setLoading(true);
      const result=await parseSingleSellerPivot(file);
      setParsed(result);
      if(!savedRows.some(row=>row.branchKey===result.branchKey && row.sellerId===result.sellerId)){
        notify.error('Este vendedor no está en los KPIs guardados. No se puede actualizar.');
      }
    }catch(error){setParsed(null);notify.error(errorMessage(error,'No se pudo interpretar el PivotGrid individual.'));}
    finally{setLoading(false);}
  }
  async function update() {
    if(!parsed||!current||saving)return;
    if(!window.confirm(`¿Actualizar únicamente a ${parsed.sellerName} (ID ${parsed.sellerId})? Los demás vendedores y los datos TMP permanecerán iguales.`))return;
    try{
      setSaving(true);
      const {error}=await supabase.rpc('admin_update_category_seller_pivot',{
        p_branch_key:parsed.branchKey,p_seller_id:parsed.sellerId,
        p_sector:parsed.sector,p_seller_name:parsed.sellerName,
        p_visitados:parsed.visitados,p_venta_distancia:parsed.ventaDistancia,
        p_venta_pdv:parsed.ventaPdv,p_visitas_planeadas:parsed.visitasPlaneadas,
      });
      if(error)throw error;
      onUpdated({...current,...parsed});
      setFile(null);setParsed(null);
      notify.success('Vendedor actualizado. Se conservaron los demás registros y los datos de facturación.');
    }catch(error){notify.error(errorMessage(error,'No se pudo actualizar al vendedor.'));}
    finally{setSaving(false);}
  }
  const comparisons = current && parsed ? [
    ['Visitados',current.visitados,parsed.visitados],
    ['Venta a distancia',current.ventaDistancia,parsed.ventaDistancia],
    ['Venta PDV',current.ventaPdv,parsed.ventaPdv],
    ['Visitas planeadas',current.visitasPlaneadas,parsed.visitasPlaneadas],
  ] as const : [];
  return <section className="mt-4 rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,.035)] sm:p-6">
    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-600">Actualización parcial</div>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">Actualizar un vendedor</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Subí un PivotGrid individual. Solo cambiarán sus datos de visitas y ventas PDV/distancia; facturación y Cnt.Fac. se conservan.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <Upload className="h-4 w-4"/> {file?file.name:'Seleccionar PivotGrid'}
          <input type="file" className="hidden" accept=".xlsx" onChange={e=>{setFile(e.target.files?.[0]??null);setParsed(null);e.target.value='';}}/>
        </label>
        {file&&<button type="button" disabled={loading||saving} onClick={()=>void preview()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white disabled:opacity-50">
          {loading?<Loader2 className="h-4 w-4 animate-spin"/>:<FileSpreadsheet className="h-4 w-4"/>}Previsualizar
        </button>}
        {(file||parsed)&&<button title="Limpiar" type="button" disabled={loading||saving} onClick={()=>{setFile(null);setParsed(null);}} className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-slate-100"><X className="h-4 w-4"/></button>}
      </div>
    </div>
    {parsed&&<div className="mt-5 border-t border-slate-200 pt-4">
      <div className="text-sm font-semibold text-slate-900">{parsed.sellerName} <span className="font-normal text-slate-500">· {parsed.branchLabel} · ID {parsed.sellerId} · Sector {parsed.sector}</span></div>
      {current ? <>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[540px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Dato</th><th className="px-4 py-3">Guardado</th><th className="px-4 py-3">Archivo nuevo</th></tr></thead>
            <tbody>{comparisons.map(([label,oldVal,newVal])=><tr key={label} className="border-t border-slate-100"><td className="px-4 py-3 font-medium text-slate-700">{label}</td><td className="px-4 py-3 text-slate-500">{number.format(oldVal)}</td><td className="px-4 py-3 font-semibold text-slate-900">{number.format(newVal)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-[11px] text-slate-500">Se conservarán el Importe Final Facturado y Cnt.Fac. de este vendedor, y todos los demás registros.</p>
          <button type="button" disabled={saving} onClick={()=>void update()} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<RefreshCw className="h-4 w-4"/>}Confirmar actualización
          </button>
        </div>
      </> : <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">El vendedor no existe en los datos guardados. Primero debe importarse en el reporte general.</p>}
    </div>}
  </section>;
}
