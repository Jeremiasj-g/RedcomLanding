'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {BarChart3,ChevronRight,History,Layers3} from 'lucide-react';
import {RedcomSearchableSelect} from '@/components/ui/redcom-select';
import {SellerScoreDialog,SellerTierComparison} from '@/components/category-panel/CategoryUnifiedOverview';
import {errorMessage} from '@/lib/notifications';
import {
 buildMyCommercialCategory,fetchMyCommercialCategory,previousCategoryMonth,
 type CommercialProfileV2Snapshot,
} from '@/lib/commercialProfileCategory';

const currentMonth=()=>{
 const now=new Date();
 return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
};
const monthLabel=(month:string)=>new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric'})
 .format(new Date(Number(month.slice(0,4)),Number(month.slice(5,7))-1,1));
const colors:Record<string,string>={
 'SENIOR':'bg-emerald-100 text-emerald-800',
 'SEMI SENIOR':'bg-emerald-50 text-emerald-700',
 'JUNIOR':'bg-amber-50 text-amber-800',
 'PLAN DE MEJORA':'bg-rose-50 text-rose-700',
};

function CategoryStatus({label}:{label:string}){
 return <span className={'inline-flex max-w-full items-center rounded-lg px-3 py-1.5 text-sm font-medium '+(colors[label]??'bg-slate-100 text-slate-700')}>{label}</span>;
}
function CategoryPreview({title,month,category,loading}:{title:string;month:string;category:string|null;loading:boolean}){
 return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white px-5 py-5">
  <div className="flex items-center gap-2 text-xs text-slate-500"><History className="h-4 w-4"/>{title}</div>
  {loading?<div className="mt-4 h-8 w-36 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none"/>:
   <div className="mt-4"><CategoryStatus label={category??'Sin datos'}/></div>}
  <p className="mt-3 text-xs capitalize text-slate-500">{monthLabel(month)}</p>
 </section>;
}

export default function CommercialProfileCategories({sellerName}:{sellerName:string}){
 const [month,setMonth]=useState(currentMonth);
 const [availableMonths,setAvailableMonths]=useState<string[]>([]);
 const [current,setCurrent]=useState<CommercialProfileV2Snapshot|null>(null);
 const [previous,setPrevious]=useState<CommercialProfileV2Snapshot|null>(null);
 const [busy,setBusy]=useState(true);
 const [message,setMessage]=useState('');
 const [detailsOpen,setDetailsOpen]=useState(false);
 const cache=useRef(new Map<string,CommercialProfileV2Snapshot>());
 const priorMonth=previousCategoryMonth(month);
 const category=useMemo(()=>current?buildMyCommercialCategory(current):null,[current]);
 const previousCategory=useMemo(()=>previous?buildMyCommercialCategory(previous):null,[previous]);

 useEffect(()=>{
  let live=true;
  setBusy(true);setMessage('');
  const fetchCached=async(value:string)=>{
   const existing=cache.current.get(value);
   if(existing)return existing;
   const result=await fetchMyCommercialCategory(value);
   cache.current.set(value,result);
   return result;
  };
  void (async()=>{
   const main=await fetchCached(month);
   if(!live)return;
   setAvailableMonths(main.months.filter(m=>m>='2026-10').sort((a,b)=>b.localeCompare(a)));
   setCurrent(main);
   if(priorMonth<'2026-10'){setPrevious(null);return;}
   const before=await fetchCached(priorMonth);
   if(live)setPrevious(before);
  })().catch(error=>{
   if(live){setMessage(errorMessage(error,'No se pudo consultar Categorías V2.'));setCurrent(null);setPrevious(null);}
  }).finally(()=>{if(live)setBusy(false);});
  return()=>{live=false;};
 },[month,priorMonth]);

 const categoryLabel=category&&category.row?category.assessment.label:null;
 const previousLabel=previousCategory&&previousCategory.row?previousCategory.assessment.label:null;
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
  <div className="grid gap-3 sm:grid-cols-2">
   <CategoryPreview title="Categoría del mes" month={month} category={categoryLabel} loading={busy}/>
   <CategoryPreview title="Mes anterior" month={priorMonth} category={previousLabel} loading={busy}/>
  </div>
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
     <SellerTierComparison input={category.input} projectedCategory={category.projection?.projected_category??null} metrics={category.metrics} gates={category.gates}/>
    </div>:<div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
     No hay indicadores de Categorías V2 para este código durante {monthLabel(month)}.
    </div>}
  </div>
  {category?.row&&detailsOpen&&<SellerScoreDialog
   name={selectedName} branch={branch} input={category.input}
   projectedCategory={category.projection?.projected_category??null}
   reasonSummary={category.reasonSummary} row={category.row}
   elapsedDays={category.elapsedDays} month={month}
   metrics={category.metrics} gates={category.gates}
   onClose={()=>setDetailsOpen(false)}
  />}
 </section>;
}
