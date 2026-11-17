'use client';
import {useMemo,useState} from 'react';
import {ChevronLeft,ChevronRight,Search} from 'lucide-react';
import type {PersonnelTableSnapshot} from '@/lib/commercialPersonnelMaster';

const PAGE_SIZE=25;
const canonical=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
type GroupKey='code'|'identity'|'branch'|'hierarchy'|'other';
const category=(label:string):GroupKey=>{
 const v=canonical(label);
 if(v==='CODIGO'||v==='COD')return 'code';
 if(['DESCRIPCION','NOMBRE','USUARIO','TIPO'].includes(v))return 'identity';
 if(['SUCURSAL','FUERZA DE VENTA','FUERZA VENTA'].includes(v))return 'branch';
 if(['CARGO','SUPERIOR'].includes(v))return 'hierarchy';
 return 'other';
};
const groups:{key:GroupKey;title:string}[]=[{key:'code',title:'Código'},{key:'identity',title:'Personal'},{key:'branch',title:'Sucursal'},{key:'hierarchy',title:'Jerarquía'},{key:'other',title:'Información adicional'}];
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-AR');
export default function CommercialPersonnelDataTable({snapshot,loading}:{snapshot:PersonnelTableSnapshot|null;loading:boolean}){
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(1);
 const grouped=useMemo(()=>groups.map(group=>({...group,cols:(snapshot?.columns??[]).filter(col=>category(col.label)===group.key)})).filter(group=>group.cols.length>0),[snapshot]);
 const results=useMemo(()=>{
  if(!snapshot)return [];
  const query=normalize(search.trim());
  const rows=snapshot.rows.filter(row=>!query||snapshot.columns.some(col=>normalize(row[col.key]??'').includes(query)));
  return rows;
 },[snapshot,search]);
 const totalPages=Math.max(1,Math.ceil(results.length/PAGE_SIZE));
 const currentPage=Math.min(page,totalPages);
 const visible=results.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
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
  <div className="max-h-[min(65vh,770px)] min-h-[320px] w-full overflow-y-auto overflow-x-hidden overscroll-contain">
   <table className="w-full table-fixed border-collapse text-left text-xs">
    <colgroup>{grouped.map(group=><col key={group.key} style={{width:group.key==='code'?'8%':group.key==='identity'?'23%':group.key==='branch'?'20%':group.key==='hierarchy'?'24%':'25%'}}/>)}</colgroup>
    <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 shadow-[0_1px_0_#e2e8f0]">
     <tr>{grouped.map(group=><th key={group.key} scope="col" className="border-r border-slate-200 px-2.5 py-2.5 font-medium last:border-r-0">{group.title}</th>)}</tr>
    </thead>
    <tbody>
     {loading?Array.from({length:10},(_,index)=><tr key={index} className="border-b border-slate-100">{groups.map(group=><td key={group.key} className="px-3 py-3"><div className="h-4 w-full animate-pulse rounded bg-slate-100 motion-reduce:animate-none"/></td>)}</tr>):
     visible.map((row,index)=><tr key={currentPage+'-'+index} className="border-b border-slate-100 align-top transition-colors duration-200 hover:bg-slate-50">
      {grouped.map(group=><td key={group.key} className="min-w-0 border-r border-slate-100 px-2.5 py-3 text-slate-700 last:border-r-0">
       <div className="space-y-1.5">{group.cols.map((col,i)=><div key={col.key} className="min-w-0 break-words">
        {group.cols.length>1&&<span className="mr-1 text-[10px] text-slate-500">{col.label}:</span>}
        <span className={i===0&&group.key==='identity'?'font-medium text-slate-900':'tabular-nums'}>{row[col.key]||'—'}</span>
       </div>)}</div>
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
