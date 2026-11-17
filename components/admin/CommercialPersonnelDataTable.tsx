'use client';
import {useMemo,useState} from 'react';
import {ArrowDown,ArrowUp,ArrowUpDown,ChevronLeft,ChevronRight,Search} from 'lucide-react';
import type {PersonnelTableSnapshot} from '@/lib/commercialPersonnelMaster';

const PAGE_SIZE=25;
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-AR');
const compare=(a:string,b:string)=>{
 const an=Number(a.replace(/\./g,'').replace(',','.')),bn=Number(b.replace(/\./g,'').replace(',','.'));
 if(a.trim()&&b.trim()&&Number.isFinite(an)&&Number.isFinite(bn))return an-bn;
 return a.localeCompare(b,'es-AR',{numeric:true,sensitivity:'base'});
};
export default function CommercialPersonnelDataTable({snapshot,loading}:{snapshot:PersonnelTableSnapshot|null;loading:boolean}){
 const [search,setSearch]=useState('');
 const [sort,setSort]=useState<{key:string;direction:'asc'|'desc'}|null>(null);
 const [page,setPage]=useState(1);
 const results=useMemo(()=>{
  if(!snapshot)return [];
  const query=normalize(search.trim());
  const rows=snapshot.rows.filter(row=>!query||snapshot.columns.some(col=>normalize(row[col.key]??'').includes(query)));
  if(sort)rows.sort((a,b)=>compare(a[sort.key]??'',b[sort.key]??'')*(sort.direction==='asc'?1:-1));
  return rows;
 },[snapshot,search,sort]);
 const totalPages=Math.max(1,Math.ceil(results.length/PAGE_SIZE));
 const currentPage=Math.min(page,totalPages);
 const visible=results.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
 const toggleSort=(key:string)=>{
  setSort(prev=>prev?.key===key&&prev.direction==='asc'?{key,direction:'desc'}:prev?.key===key?null:{key,direction:'asc'});
  setPage(1);
 };
 const rangeStart=results.length?(currentPage-1)*PAGE_SIZE+1:0;
 const rangeEnd=Math.min(currentPage*PAGE_SIZE,results.length);
 return <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
   <div className="min-w-0">
    <h2 className="text-sm font-semibold text-slate-900">Detalle de personal</h2>
    <p className="text-xs text-slate-500">{loading?'Consultando archivo publicado…':snapshot?snapshot.rows.length+' registros · '+snapshot.columns.length+' columnas del Excel original':'No hay archivo disponible'}</p>
   </div>
   <div className="relative w-full max-w-sm">
    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
    <input aria-label="Buscar en todas las columnas de personal" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Buscar personal, código, sucursal…" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition-[border-color,box-shadow] duration-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"/>
   </div>
  </div>
  <div className="max-h-[min(65vh,770px)] min-h-[320px] w-full overflow-auto overscroll-contain">
   <table className="w-max min-w-full border-collapse text-left text-xs">
    <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 shadow-[0_1px_0_#e2e8f0]">
     <tr>{(snapshot?.columns??[]).map(col=><th key={col.key} scope="col" aria-sort={sort?.key===col.key?(sort.direction==='asc'?'ascending':'descending'):'none'} className="whitespace-nowrap border-r border-slate-200 px-3 py-2.5 font-medium last:border-r-0">
      <button type="button" onClick={()=>toggleSort(col.key)} className="inline-flex w-full items-center justify-between gap-3 rounded-md text-left transition-colors duration-200 hover:text-slate-950" aria-label={'Ordenar por '+col.label}>
       <span>{col.label}</span>
       {sort?.key===col.key?(sort.direction==='asc'?<ArrowUp className="h-3 w-3 shrink-0"/>:<ArrowDown className="h-3 w-3 shrink-0"/>):<ArrowUpDown className="h-3 w-3 shrink-0 text-slate-400"/>}
      </button>
     </th>)}</tr>
    </thead>
    <tbody>
     {loading?Array.from({length:10},(_,index)=><tr key={index} className="border-b border-slate-100">{Array.from({length:Math.max(7,snapshot?.columns.length??0)},(_,cell)=><td key={cell} className="px-3 py-3"><div className="h-4 w-24 animate-pulse rounded bg-slate-100 motion-reduce:animate-none"/></td>)}</tr>):
     visible.map((row,index)=><tr key={currentPage+'-'+index} className="border-b border-slate-100 transition-colors duration-200 hover:bg-slate-50">
      {snapshot?.columns.map(col=><td key={col.key} className="max-w-[290px] whitespace-nowrap border-r border-slate-100 px-3 py-2.5 tabular-nums text-slate-700 last:border-r-0" title={row[col.key]??''}>
       {row[col.key]||'—'}
      </td>)}
     </tr>)}
    </tbody>
   </table>
   {!loading&&!results.length&&<div className="py-16 text-center text-sm text-slate-500">{snapshot?.rows.length?'No hay registros que coincidan con la búsqueda.':'Todavía no hay datos para mostrar.'}</div>}
  </div>
  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
   <span className="tabular-nums">{loading?'Cargando…':rangeStart+' a '+rangeEnd+' de '+results.length+' registros'}</span>
   <div className="flex items-center gap-2">
    <span className="mr-2 tabular-nums">Página {currentPage} de {totalPages}</span>
    <button type="button" aria-label="Página anterior" disabled={loading||currentPage===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="h-4 w-4"/></button>
    <button type="button" aria-label="Página siguiente" disabled={loading||currentPage===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="h-4 w-4"/></button>
   </div>
  </div>
 </section>;
}
