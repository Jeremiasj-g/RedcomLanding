'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Save } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { notify } from '@/lib/notifications';
type Resource = {id:number;title:string;branch_key:string;section_key:string;allowed_roles:string[]|null;permission_key:string|null};
type Role = {code:string;name:string};
export default function ResourceRolePermissions() {
 const [resources,setResources]=useState<Resource[]>([]);
 const [roles,setRoles]=useState<Role[]>([]);
 const [selected,setSelected]=useState<number|null>(null);
 const [draft,setDraft]=useState<string[]|null>(null);
 const [query,setQuery]=useState('');
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);
  const [a,b]=await Promise.all([
   supabase.from('branch_resources').select('id,title,branch_key,section_key,allowed_roles,permission_key').eq('is_active',true).order('branch_key').order('title'),
   supabase.from('user_types').select('code,name').eq('is_active',true).order('sort_order'),
  ]);
  if(a.error||b.error) notify.error(a.error?.message||b.error?.message||'No se pudieron cargar los permisos.');
  else {setResources((a.data||[]) as Resource[]);setRoles((b.data||[]) as Role[]);
    setSelected(v=>(a.data||[]).some(x=>x.id===v)?v:((a.data||[])[0]?.id??null));}
  setLoading(false);
 },[]);
 useEffect(()=>{void load()},[load]);
 const resource=resources.find(r=>r.id===selected);
 useEffect(()=>{setDraft(resource?.allowed_roles??null)},[resource?.id,resource?.allowed_roles]);
 const visible=useMemo(()=>resources.filter(r=>[r.title,r.branch_key,r.section_key].join(' ').toLowerCase().includes(query.toLowerCase())),[query,resources]);
 const dirty=resource?JSON.stringify([...(draft||[])].sort())!==JSON.stringify([...(resource.allowed_roles||[])].sort())||((draft===null)!==(resource.allowed_roles===null)):false;
 const save=async()=>{if(!resource||!dirty)return;setSaving(true);
 const {error}=await supabase.from('branch_resources').update({allowed_roles:draft,permission_key:null}).eq('id',resource.id);
 setSaving(false);
 if(error)notify.error(error.message);
 else {setResources(v=>v.map(r=>r.id===resource.id?{...r,allowed_roles:draft,permission_key:null}:r));notify.success('Acceso a la herramienta actualizado.');}
 };
 return <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
  <section className="rounded-3xl bg-white p-5 shadow-[0_8px_35px_rgba(15,23,42,0.08)]">
   <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold text-slate-900">Herramientas</h2><button onClick={()=>void load()} title="Actualizar" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><RefreshCw size={17}/></button></div>
   <div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16}/><input aria-label="Buscar herramienta" placeholder="Buscar herramienta" value={query} onChange={e=>setQuery(e.target.value)} className="w-full rounded-xl bg-slate-100 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"/></div>
   <div className="mt-3 max-h-[530px] space-y-1 overflow-auto">{loading?<p className="p-3 text-sm text-slate-500">Cargando…</p>:visible.map(r=><button key={r.id} type="button" onClick={()=>setSelected(r.id)} className={`block w-full rounded-xl px-3 py-3 text-left transition ${selected===r.id?'bg-slate-900 text-white':'hover:bg-slate-100 text-slate-800'}`}><span className="block truncate text-sm font-medium">{r.title}</span><span className={`mt-1 block text-xs ${selected===r.id?'text-slate-300':'text-slate-500'}`}>{r.branch_key.replaceAll('_',' · ')}</span></button>)}</div>
  </section>
  <section className="rounded-3xl bg-white p-6 shadow-[0_8px_35px_rgba(15,23,42,0.08)]">
   {!resource?<p className="text-sm text-slate-500">Seleccioná una herramienta.</p>:<>
   <h2 className="text-xl font-semibold text-slate-900">{resource.title}</h2><p className="mt-1 text-sm text-slate-500">Elegí los roles que pueden verla.</p>
   <label className="mt-6 flex items-center gap-3 border-b border-slate-100 pb-4 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-slate-900" checked={draft===null&&!resource.permission_key} onChange={e=>setDraft(e.target.checked?null:[])} /> Todos los roles</label>
   <div className="mt-4 grid gap-4 sm:grid-cols-2">{roles.map(role=><label key={role.code} className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 accent-slate-900" checked={draft!==null?draft.includes(role.code):!resource.permission_key} onChange={e=>setDraft(v=>e.target.checked?[...new Set([...(v||[]),role.code])]:v===null?roles.map(x=>x.code).filter(x=>x!==role.code):v.filter(x=>x!==role.code))}/>{role.name}</label>)}</div>
   {resource.permission_key&&draft===null&&<p className="mt-5 text-xs text-slate-500">Actualmente hereda el permiso general «{resource.permission_key}». Guardar una selección de roles reemplaza ese permiso para esta herramienta.</p>}
   <div className="mt-8 flex justify-end"><button disabled={!dirty||saving} onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm disabled:opacity-40"><Save size={16}/>{saving?'Guardando…':'Guardar cambios'}</button></div>
   </>}
  </section>
 </div>;
}
