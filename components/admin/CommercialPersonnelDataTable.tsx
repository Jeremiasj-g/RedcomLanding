'use client';
import {useEffect,useMemo,useState} from 'react';
import {ColumnFilterPopup} from '@/components/category-panel/CategoryColumnFilters';
import {ChevronDown,ChevronLeft,ChevronRight,Filter,Search,KeyRound,Shuffle} from 'lucide-react';
import {sellerFromWorksheet,sellerKey,type SellerIdentity} from '@/lib/commercialPersonnelPasswords';
import type {PersonnelTableSnapshot} from '@/lib/commercialPersonnelMaster';

const PAGE_SIZE=25;
const STORAGE_KEY='redcom:commercial-personnel-table-view';
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
export default function CommercialPersonnelDataTable({snapshot,loading,linkedAccountKeys,onSellerAction}:{
 snapshot:PersonnelTableSnapshot|null;loading:boolean;
 linkedAccountKeys?:Set<string>;
 onSellerAction?:(seller:SellerIdentity,action:'manual'|'random')=>void;
}){
 const [search,setSearch]=useState('');
 const [sort,setSort]=useState<{key:string;direction:'asc'|'desc'}|null>(null);
 const [filters,setFilters]=useState<Record<string,string[]>>({});
 const [active,setActive]=useState<string|null>(null);
 const [draft,setDraft]=useState<string[]|null>(null);
 const [filterSearch,setFilterSearch]=useState('');
 const [position,setPosition]=useState({top:0,left:0});
 const [page,setPage]=useState(1);
 const [restored,setRestored]=useState(false);
 useEffect(()=>{
  try{
   const saved=JSON.parse(sessionStorage.getItem(STORAGE_KEY)??'null') as {
    search?:unknown;sort?:{key?:unknown;direction?:unknown};filters?:Record<string,unknown>;page?:unknown;
   }|null;
   if(saved){
    if(typeof saved.search==='string')setSearch(saved.search);
    if(saved.sort&&typeof saved.sort.key==='string'&&(saved.sort.direction==='asc'||saved.sort.direction==='desc'))
     setSort({key:saved.sort.key,direction:saved.sort.direction});
    if(saved.filters&&typeof saved.filters==='object'){
     const values=Object.entries(saved.filters).filter(([key,v])=>key.startsWith('c')&&Array.isArray(v)&&v.every(x=>typeof x==='string')) as Array<[string,string[]]>;
     setFilters(Object.fromEntries(values));
    }
    if(typeof saved.page==='number'&&Number.isSafeInteger(saved.page)&&saved.page>0)setPage(saved.page);
   }
  }catch{/* Restaurar el valor por defecto si la preferencia quedó dañada. */}
  setRestored(true);
 },[]);
 useEffect(()=>{
  if(!restored)return;
  try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify({search,sort,filters,page}));}catch{/* Las preferencias no son indispensables. */}
 },[restored,search,sort,filters,page]);
 const grouped=useMemo(()=>groups.map(group=>({...group,cols:(snapshot?.columns??[]).filter(col=>category(col.label)===group.key)})).filter(group=>group.cols.length>0),[snapshot]);
 const filteredOptions=useMemo(()=>{
  if(!snapshot||!active)return [];
  const matching=snapshot.rows.filter(row=>Object.entries(filters).every(([key,values])=>key===active||values.includes(row[key]??'')));
  return [...new Set(matching.map(row=>row[active]??''))].sort((a,b)=>a.localeCompare(b,'es-AR',{numeric:true,sensitivity:'base'}));
 },[snapshot,active,filters]);
 const selected=draft??(active&&filters[active]!==undefined?filteredOptions.filter(value=>filters[active].includes(value)):filteredOptions);
 const activeColumn=snapshot?.columns.find(col=>col.key===active);
 const closeFilter=()=>{setActive(null);setDraft(null);setFilterSearch('');};
 const openFilter=(key:string,button:HTMLButtonElement)=>{
  if(active===key){closeFilter();return;}
  const rect=button.getBoundingClientRect();
  setPosition({top:Math.max(8,Math.min(rect.bottom+6,window.innerHeight-420)),left:Math.max(8,Math.min(rect.left,window.innerWidth-318))});
  setActive(key);setDraft(null);setFilterSearch('');
 };
 const applyFilter=()=>{
  if(!active)return;
  setFilters(current=>{
   const next={...current};
   if(selected.length===filteredOptions.length)delete next[active];
   else next[active]=selected;
   return next;
  });
  setPage(1);closeFilter();
 };
 const filterCount=Object.keys(filters).length;
 const results=useMemo(()=>{
  if(!snapshot)return [];
  const query=normalize(search.trim());
  const rows=snapshot.rows.filter(row=>
   (!query||snapshot.columns.some(col=>normalize(row[col.key]??'').includes(query)))&&
   Object.entries(filters).every(([key,values])=>values.includes(row[key]??''))
  );
  if(sort)rows.sort((a,b)=>(a[sort.key]??'').localeCompare(b[sort.key]??'','es-AR',{numeric:true,sensitivity:'base'})*(sort.direction==='asc'?1:-1));
  return rows;
 },[snapshot,search,sort,filters]);
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
  {filterCount>0&&<div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600">
   <span className="inline-flex items-center gap-2"><Filter className="h-3.5 w-3.5"/>{filterCount} filtros activos · {results.length} resultados</span>
   <button type="button" onClick={()=>{setFilters({});setPage(1);closeFilter();}} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs transition-colors duration-200 hover:bg-slate-100">Limpiar filtros</button>
  </div>}
  <div className="hidden flex-wrap gap-1 border-b border-slate-100 bg-slate-50 px-3 py-3 max-md:flex">
   {(snapshot?.columns??[]).map(col=><button key={col.key} type="button" onClick={e=>openFilter(col.key,e.currentTarget)} aria-label={'Filtrar '+col.label} className={'inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs '+(filters[col.key]!==undefined?'border-slate-400 bg-slate-200':'border-slate-200 bg-white')}>
    <span>{col.label}</span><ChevronDown className="h-3 w-3"/>
   </button>)}
  </div>
  <div className="max-h-[min(65vh,770px)] min-h-[320px] w-full overflow-y-auto overflow-x-hidden overscroll-contain">
   <table className="w-full table-fixed border-collapse text-left text-xs max-md:block">
    <colgroup>{grouped.map(group=><col key={group.key} style={{width:onSellerAction?(group.key==='code'?'7%':group.key==='identity'?'20%':group.key==='branch'?'18%':group.key==='hierarchy'?'19%':'20%'):(group.key==='code'?'8%':group.key==='identity'?'23%':group.key==='branch'?'20%':group.key==='hierarchy'?'24%':'25%')}}/>)}
     {onSellerAction&&<col style={{width:'16%'}}/>}</colgroup>
    <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 shadow-[0_1px_0_#e2e8f0] max-md:hidden">
     <tr>{grouped.map(group=><th key={group.key} scope="col" className="min-w-0 border-r border-slate-200 px-2 py-2.5 align-top font-medium last:border-r-0">
      <div className="mb-1.5 text-[11px] font-medium">{group.title}</div>
      <div className="flex flex-wrap gap-1">{group.cols.map(col=><button key={col.key} type="button" onClick={e=>openFilter(col.key,e.currentTarget)} aria-label={'Filtrar '+col.label} aria-haspopup="dialog" aria-expanded={active===col.key} className={'inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-normal transition-colors duration-200 '+(filters[col.key]!==undefined?'border-slate-500 bg-slate-200 text-slate-950':'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
       <span className="min-w-0 break-words text-left">{col.label}</span><ChevronDown className="h-3 w-3 shrink-0"/>
      </button>)}</div>
     </th>)}{onSellerAction&&<th scope="col" className="px-2 py-2.5 text-[11px] font-medium">Acciones</th>}</tr>
    </thead>
    <tbody className="max-md:block">
     {loading?Array.from({length:10},(_,index)=><tr key={index} className="border-b border-slate-100">{groups.map(group=><td key={group.key} className="px-3 py-3"><div className="h-4 w-full animate-pulse rounded bg-slate-100 motion-reduce:animate-none"/></td>)}{onSellerAction&&<td className="px-2 py-3"><div className="h-8 w-full animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none"/></td>}</tr>):
     visible.map((row,index)=><tr key={currentPage+'-'+index} className="border-b border-slate-100 align-top transition-colors duration-200 hover:bg-slate-50 max-md:my-3 max-md:block max-md:rounded-xl max-md:border max-md:border-slate-200 max-md:p-2">
      {grouped.map(group=><td key={group.key} className="min-w-0 border-r border-slate-100 px-2.5 py-3 text-slate-700 last:border-r-0 max-md:block max-md:border-0 max-md:px-3 max-md:py-2">
       <div className="mb-1 hidden text-xs font-medium text-slate-900 max-md:block">{group.title}</div><div className="space-y-1.5">{group.cols.map((col,i)=><div key={col.key} className="min-w-0 break-words">
        {group.cols.length>1&&<span className="mr-1 text-[10px] text-slate-500">{col.label}:</span>}
        <span className={i===0&&group.key==='identity'?'font-medium text-slate-900':'tabular-nums'}>{row[col.key]||'—'}</span>
       </div>)}</div>
      </td>)}
       {onSellerAction&&(()=>{
         const seller=snapshot?sellerFromWorksheet(snapshot.columns,row):null;
         if(seller?.role!=='VENDEDOR')return <td className="px-2 py-3 text-center text-slate-400">—</td>;
         const linked=linkedAccountKeys?.has(sellerKey(seller))??false;
         return <td className="border-l border-slate-100 px-2 py-2 align-top max-md:block max-md:border-0">
          <div className="flex flex-wrap items-center gap-1">
           <button type="button" title="Establecer contraseña manual" aria-label={'Contraseña manual para '+seller.name} onClick={()=>onSellerAction(seller,'manual')} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 transition-colors duration-200 hover:bg-slate-100"><KeyRound className="h-3.5 w-3.5"/></button>
           <button type="button" title="Generar contraseña aleatoria" aria-label={'Contraseña aleatoria para '+seller.name} onClick={()=>onSellerAction(seller,'random')} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 transition-colors duration-200 hover:bg-slate-100"><Shuffle className="h-3.5 w-3.5"/></button>
          </div>
          <span className="mt-1 block text-[10px] text-slate-500">{linked?'Acceso configurado':'Clave pendiente'}</span>
         </td>;
        })()}
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
  {activeColumn&&<ColumnFilterPopup label={activeColumn.label} position={position} options={filteredOptions} selected={selected} search={filterSearch} onSearch={setFilterSearch} onSelected={setDraft} onSort={direction=>{setSort({key:activeColumn.key,direction});setPage(1);closeFilter();}} onApply={applyFilter} onClose={closeFilter}/>}
 </section>;
}
