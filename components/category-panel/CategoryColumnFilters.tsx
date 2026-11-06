'use client';

import {useMemo,useState,type ReactNode} from 'react';
import {ChevronDown,Filter,Search} from 'lucide-react';

export type FilterColumn<T>={key:string;label:string;value:(row:T)=>string};
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();

/** Menú compartido con los filtros por columna de Horarios SIGO. */
export function ColumnFilterPopup({label,position,options,selected,search,onSearch,onSelected,onSort,onApply,onClose}:{
 label:string;position:{top:number;left:number};options:string[];selected:string[];search:string;onSearch:(value:string)=>void;
 onSelected:(values:string[])=>void;onSort:(order:'asc'|'desc')=>void;onApply:()=>void;onClose:()=>void;
}){
 const visible=options.filter(v=>normalize(v).includes(normalize(search)));
 return <>
  <button type="button" aria-label="Cerrar menú de filtro" onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-transparent"/>
  <div role="dialog" aria-label={'Filtrar '+label} className="fixed z-50 w-[310px] overflow-hidden rounded-xl border border-slate-200 bg-white text-xs shadow-[0_18px_45px_rgba(15,23,42,.2)]" style={position}>
   <div className="border-b border-slate-100 p-2">
    <button type="button" onClick={()=>onSort('asc')} className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-100">Ordenar A a Z / Menor a mayor</button>
    <button type="button" onClick={()=>onSort('desc')} className="w-full rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-100">Ordenar Z a A / Mayor a menor</button>
   </div>
   <div className="px-3 pt-3">
    <div className="mb-2 font-semibold text-slate-800">Filtrar por valores</div>
    <div className="flex items-center justify-between text-[11px]">
     <button type="button" onClick={()=>onSelected(options)} className="text-blue-600 hover:underline">Seleccionar todo</button>
     <button type="button" onClick={()=>onSelected([])} className="text-blue-600 hover:underline">Borrar</button>
     <span className="text-slate-400">Mostrando {visible.length}</span>
    </div>
    <div className="relative mt-3"><Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={event=>onSearch(event.target.value)} placeholder="Buscar..." className="h-9 w-full rounded-lg border border-slate-200 px-3 pr-9 text-xs outline-none focus:border-blue-400"/></div>
    <div className="my-3 max-h-48 overflow-y-auto">
     {visible.map(value=><label key={value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-slate-700 hover:bg-slate-50"><input type="checkbox" className="accent-emerald-600" checked={selected.includes(value)} onChange={()=>onSelected(selected.includes(value)?selected.filter(v=>v!==value):[...selected,value])}/><span className="truncate">{value}</span></label>)}
     {!visible.length&&<p className="px-2 py-3 text-slate-400">Sin coincidencias</p>}
    </div>
   </div>
   <div className="flex justify-end gap-2 border-t border-slate-100 px-3 py-3">
    <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
    <button type="button" onClick={onApply} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800">Aceptar</button>
   </div>
  </div>
 </>;
}

/** Tabla con filtros independientes por columna. Mantiene los registros originales intactos. */
export function FilterableCategoryTable<T>({rows,columns,renderRow,emptyMessage='No hay resultados para los filtros seleccionados.'}:{
 rows:T[];columns:FilterColumn<T>[];renderRow:(row:T)=>ReactNode;emptyMessage?:string;
}){
 const [filters,setFilters]=useState<Record<string,string[]>>({});
 const [active,setActive]=useState<string|null>(null);
 const [draft,setDraft]=useState<string[]|null>(null);
 const [search,setSearch]=useState('');
 const [position,setPosition]=useState({top:0,left:0});
 const [sort,setSort]=useState<{key:string;order:'asc'|'desc'}|null>(null);
 const matches=(row:T,column:FilterColumn<T>)=>!filters[column.key]?.length||filters[column.key].includes(column.value(row));
 const shown=useMemo(()=>{
  const result=rows.filter(row=>columns.every(col=>matches(row,col)));
  if(sort){
   const column=columns.find(col=>col.key===sort.key);
   if(column)result.sort((a,b)=>column.value(a).localeCompare(column.value(b),'es',{numeric:true,sensitivity:'base'})*(sort.order==='asc'?1:-1));
  }
  return result;
 // columns are defined by the caller for each table, filtering is recomputed whenever parent data changes.
 },[rows,columns,filters,sort]);
 const selectedCol=columns.find(col=>col.key===active);
 const options=useMemo(()=>selectedCol?[...new Set(rows.filter(row=>columns.every(col=>col.key===selectedCol.key||matches(row,col))).map(row=>selectedCol.value(row)))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true})):[],[rows,columns,filters,selectedCol]);
 const selected=draft??(selectedCol&&filters[selectedCol.key]?.length?options.filter(v=>filters[selectedCol.key].includes(v)):options);
 const close=()=>{setActive(null);setDraft(null);setSearch('');};
 const apply=()=>{if(!active)return;setFilters(old=>({...old,[active]:selected.length===options.length?[]:selected}));close();};
 const open=(key:string,button:HTMLButtonElement)=>{
  if(active===key){close();return;}
  const rect=button.getBoundingClientRect();
  setPosition({top:Math.max(8,Math.min(rect.bottom+6,window.innerHeight-420)),left:Math.max(8,Math.min(rect.left,window.innerWidth-318))});
  setActive(key);setDraft(null);setSearch('');
 };
 const hasFilters=Object.values(filters).some(list=>list.length>0);
 return <>
  {hasFilters&&<div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-700"><span><Filter className="mr-1 inline h-3.5 w-3.5"/>Filtros activos · {shown.length} registros</span><button type="button" onClick={()=>{setFilters({});close();}} className="rounded-lg px-2 py-1 font-medium hover:bg-blue-100">Limpiar todos</button></div>}
  <table className="w-full table-fixed text-left text-[10px] leading-4 xl:text-[11px] max-lg:block">
   <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 max-lg:hidden"><tr>{columns.map(col=><th key={col.key} className="break-words px-1 py-2 font-medium"><button type="button" onClick={e=>open(col.key,e.currentTarget)} className={`flex w-full items-center justify-between gap-1 rounded-md px-0.5 py-1 text-left transition-colors duration-200 hover:bg-slate-200 ${filters[col.key]?.length?'text-blue-600':''}`}><span className="min-w-0 break-words">{col.label}</span><ChevronDown className="h-3 w-3 shrink-0"/></button></th>)}</tr></thead>
   <tbody className="max-lg:block">{shown.map((row,i)=><ReactFragment key={i}>{renderRow(row)}</ReactFragment>)}</tbody>
  </table>
  {!shown.length&&<p className="px-5 py-8 text-center text-sm text-slate-500">{emptyMessage}</p>}
  {selectedCol&&<ColumnFilterPopup label={selectedCol.label} position={position} options={options} selected={selected} search={search} onSearch={setSearch} onSelected={setDraft} onSort={order=>{setSort({key:selectedCol.key,order});apply();}} onApply={apply} onClose={close}/>}
 </>;
}
function ReactFragment({children}:{children:ReactNode}){return <>{children}</>;}
