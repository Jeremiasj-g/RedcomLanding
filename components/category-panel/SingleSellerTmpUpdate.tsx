'use client';
import {useState} from 'react';
import {FileSpreadsheet, Loader2, RefreshCw, Upload, X} from 'lucide-react';
import {parseTmpSellerTotals, type CategoryPanelRow} from '@/lib/categoryPanelExcel';
import {supabase} from '@/lib/supabaseClient';
import {errorMessage,notify} from '@/lib/notifications';

type TmpSeller=Awaited<ReturnType<typeof parseTmpSellerTotals>>[number];
const money=new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'});
const num=new Intl.NumberFormat('es-AR');

export default function SingleSellerTmpUpdate({
 savedRows,onUpdated
}:{savedRows:CategoryPanelRow[];onUpdated:(row:CategoryPanelRow)=>void}){
 const [file,setFile]=useState<File|null>(null);
 const [list,setList]=useState<TmpSeller[]>([]);
 const [chosen,setChosen]=useState('');
 const [reading,setReading]=useState(false);
 const [saving,setSaving]=useState(false);
 const selected=list.find(s=>s.branchKey+':'+s.sellerId===chosen);
 const existing=selected?savedRows.find(r=>r.branchKey===selected.branchKey&&r.sellerId===selected.sellerId):undefined;
 const clear=()=>{setFile(null);setList([]);setChosen('');};
 async function inspect(){
  if(!file)return;
  try{
   setReading(true);
   const results=await parseTmpSellerTotals(file);
   setList(results);
   const available=results.filter(s=>savedRows.some(r=>r.branchKey===s.branchKey&&r.sellerId===s.sellerId));
   setChosen(available.length===1?available[0].branchKey+':'+available[0].sellerId:'');
   notify.success(results.length===1?'Vendedor detectado. Revisá los importes.':`TMP leído: ${results.length} vendedores. Seleccioná únicamente el que querés actualizar.`);
  }catch(e){setList([]);setChosen('');notify.error(errorMessage(e,'No se pudo interpretar el TMP.'));}
  finally{setReading(false);}
 }
 async function confirm(){
  if(!selected||!existing||saving)return;
  if(!window.confirm(`¿Actualizar la facturación solo de ${selected.sellerName} (ID ${selected.sellerId})? Los demás vendedores no se modificarán.`))return;
  try{
   setSaving(true);
   const {error}=await supabase.rpc('admin_update_category_seller_tmp',{
    p_branch_key:selected.branchKey,p_seller_id:selected.sellerId,
    p_amount:Math.round(selected.amount*100)/100,p_invoice_count:selected.invoices
   });
   if(error)throw error;
   onUpdated({...existing,importeFinalFacturado:Math.round(selected.amount*100)/100,
     cntFac:selected.invoices,partialUpdatedAt:new Date().toISOString(),partialUpdateSource:'tmp'});
   clear();
   notify.success('Facturación actualizada solo para el vendedor seleccionado.');
  }catch(e){notify.error(errorMessage(e,'No se pudo actualizar la facturación.'));}
  finally{setSaving(false);}
 }
 return <section className="h-full rounded-[20px] bg-white p-5 shadow-[0_6px_22px_rgba(15,23,42,.05)]">
   <div className="flex flex-col justify-between gap-3">
    <div>
     
     <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">Actualizar facturación de un vendedor</h2>
     <p className="mt-1 text-xs leading-5 text-slate-500">Suma todos sus períodos y actualiza solo Importe Final Facturado y Cnt.Fac., sin tocar visitas ni otros vendedores.</p>
    </div>
    <div className="flex flex-wrap items-center gap-2">
     <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50">
      <Upload className="h-4 w-4"/>{file?file.name:'Seleccionar TMP'}
      <input type="file" className="hidden" accept=".xlsx" onChange={e=>{setFile(e.target.files?.[0]??null);setList([]);setChosen('');e.target.value='';}}/>
     </label>
     {file&&<button type="button" onClick={()=>void inspect()} disabled={reading||saving}
       className="inline-flex h-10 items-center gap-2 rounded-xl bg-sky-600 px-4 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
       {reading?<Loader2 className="h-4 w-4 animate-spin"/>:<FileSpreadsheet className="h-4 w-4"/>}Previsualizar
     </button>}
     {file&&<button type="button" title="Limpiar" onClick={clear} disabled={saving||reading} className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-slate-100"><X className="h-4 w-4"/></button>}
    </div>
   </div>
   {list.length>0&&<div className="mt-5 border-t border-slate-200 pt-4">
    {list.length>1&&<p className="mb-2 text-xs font-medium text-amber-700">El archivo contiene {num.format(list.length)} vendedores. Seleccioná uno: solamente ese será actualizado.</p>}
    <select value={chosen} onChange={e=>setChosen(e.target.value)}
      className="h-11 w-full max-w-[630px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-blue-400">
      <option value="">Seleccionar vendedor por sucursal e ID</option>
      {list.map(s=><option key={s.branchKey+':'+s.sellerId} value={s.branchKey+':'+s.sellerId}>
       {s.branchLabel} · ID {s.sellerId} · {s.sellerName} · {s.periods} período(s)
      </option>)}
    </select>
    {selected&&<div className="mt-4">
     <div className="mb-3 text-sm font-semibold text-slate-900">{selected.sellerName}
      <span className="ml-2 font-normal text-slate-500">· ID {selected.sellerId} · {selected.branchLabel} · {selected.periods} fila(s) acumuladas</span>
     </div>
     {existing?<><div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[580px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
       <tr><th className="px-4 py-3">Dato</th><th className="px-4 py-3">Guardado</th><th className="px-4 py-3">Nuevo (suma de períodos)</th></tr></thead>
       <tbody>
        <tr className="border-t border-slate-100"><td className="px-4 py-3">Importe Final Facturado</td><td className="px-4 py-3 text-slate-500">{money.format(existing.importeFinalFacturado)}</td><td className="px-4 py-3 font-semibold">{money.format(selected.amount)}</td></tr>
        <tr className="border-t border-slate-100"><td className="px-4 py-3">Cnt.Fac.</td><td className="px-4 py-3 text-slate-500">{num.format(existing.cntFac)}</td><td className="px-4 py-3 font-semibold">{num.format(selected.invoices)}</td></tr>
       </tbody></table>
     </div>
     <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <p className="text-[11px] text-slate-500">Las visitas de este vendedor y los demás registros permanecerán sin cambios.</p>
      <button type="button" onClick={()=>void confirm()} disabled={saving}
       className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
       {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<RefreshCw className="h-4 w-4"/>}Confirmar actualización
      </button>
     </div></>:<p className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">Este vendedor no está en los KPIs guardados; no se puede modificar con una importación parcial.</p>}
    </div>}
   </div>}
 </section>;
}
