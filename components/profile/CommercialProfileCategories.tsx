'use client';

import {useEffect,useMemo,useState} from 'react';
import {BarChart3,ChevronRight,Layers3} from 'lucide-react';
import {RedcomSearchableSelect} from '@/components/ui/redcom-select';
import {SellerScoreDialog,SellerTierComparison} from '@/components/category-panel/CategoryUnifiedOverview';
import {errorMessage} from '@/lib/notifications';
import {hasMonthlyRecognition} from '@/lib/categoryMonthlyConsiderations';
import {
 buildMyCommercialCategory,
 type CommercialProfileV2Snapshot,
} from '@/lib/commercialProfileCategory';

const currentMonth=()=>{
 const now=new Date();
 return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
};
const monthLabel=(month:string)=>new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric'})
 .format(new Date(Number(month.slice(0,4)),Number(month.slice(5,7))-1,1));
export default function CommercialProfileCategories({sellerName,fetchCategory}:{sellerName:string;fetchCategory:(month:string)=>Promise<CommercialProfileV2Snapshot>}){
 const [month,setMonth]=useState(currentMonth);
 const [availableMonths,setAvailableMonths]=useState<string[]>([]);
 const [current,setCurrent]=useState<CommercialProfileV2Snapshot|null>(null);
 const [busy,setBusy]=useState(true);
 const [message,setMessage]=useState('');
 const [detailsOpen,setDetailsOpen]=useState(false);
 const category=useMemo(()=>current?buildMyCommercialCategory(current):null,[current]);

 useEffect(()=>{
  let live=true;
  setBusy(true);setMessage('');
  void (async()=>{
   const main=await fetchCategory(month);
   if(!live)return;
   setAvailableMonths(main.months.filter(m=>m>='2026-10').sort((a,b)=>b.localeCompare(a)));
   setCurrent(main);
  })().catch(error=>{
   if(live){setMessage(errorMessage(error,'No se pudo consultar Categorías V2.'));setCurrent(null);}
  }).finally(()=>{if(live)setBusy(false);});
  return()=>{live=false;};
 },[month,fetchCategory]);

 const branch=category?.scope==='corrientes_refrigerados'?'Refrigerados':
  category?.scope==='corrientes_masivos'?'Corrientes':
  category?.scope==='chaco'?'Chaco':category?.scope==='misiones'?'Misiones':
  category?.scope==='obera'?'Oberá':'Sucursal';
 const selectedName=category?.row?.sellerName??sellerName;
 return <section className="space-y-5">
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <h2 className="text-xl font-medium tracking-tight text-slate-950">Mi categoría</h2>
    <p className="mt-1 text-xs text-slate-500">Categorías V 2.0 · histórico del código comercial, independientemente del titular</p>
   </div>
   <div className="w-full sm:w-56">
    <label className="mb-1.5 block text-xs text-slate-600">Mes de consulta</label>
    <RedcomSearchableSelect
     accent="neutral" aria-label="Mes de Categorías V2" value={month}
     onValueChange={setMonth} disabled={!availableMonths.length}
     placeholder="Seleccionar mes" searchPlaceholder="Buscar mes"
     options={availableMonths.map(m=>({value:m,label:monthLabel(m)}))}
    />
   </div>
  </header>
  {message&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</div>}
  {hasMonthlyRecognition(category?.consideration)&&<div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><p className="font-medium">Consideración mensual aplicada</p><p className="mt-1 text-xs">{category?.consideration?.reason}</p><p className="mt-1 text-xs text-amber-700">Los KPI originales se mantienen sin modificaciones.</p></div>}
  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
     <h3 className="flex items-center gap-2 text-sm font-medium text-slate-900"><Layers3 className="h-4 w-4"/>Comparación de categorías</h3>
     <p className="mt-1 text-xs text-slate-500">{category?.row?'Código '+current?.code+' · '+branch+' · '+selectedName:'Solo se muestran indicadores disponibles para este código y mes'}</p>
    </div>
    <button type="button" disabled={!category?.row||busy} onClick={()=>setDetailsOpen(true)}
     className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-40">
     <BarChart3 className="h-4 w-4"/>Ver datos y cálculos<ChevronRight className="h-4 w-4"/>
    </button>
   </div>
   {busy?<div className="mt-5 grid gap-3 lg:grid-cols-3">{[0,1,2].map(i=><div key={i} className="h-72 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none"/>)}</div>:
    category?.row?<div className="mt-5">
     <SellerTierComparison input={category.input} projectedCategory={category.projection?.projected_category??null} metrics={category.metrics} gates={category.gates} consideration={category.consideration} percentTolerance={category.percentTolerance}/>
    </div>:<div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
     No hay indicadores de Categorías V2 para este código durante {monthLabel(month)}.
    </div>}
  </div>
  {category?.row&&detailsOpen&&<SellerScoreDialog
   name={selectedName} branch={branch} input={category.input}
   projectedCategory={category.projection?.projected_category??null} consideration={category.consideration}
   reasonSummary={category.reasonSummary} row={category.row}
   elapsedDays={category.elapsedDays} month={month}
   metrics={category.metrics} gates={category.gates} percentTolerance={category.percentTolerance}
   onClose={()=>setDetailsOpen(false)}
  />}
 </section>;
}
