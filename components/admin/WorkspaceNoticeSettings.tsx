'use client';
import {useEffect,useState} from 'react';
import {AlertTriangle,Save} from 'lucide-react';
import {supabase} from '@/lib/supabaseClient';
import {notify,errorMessage} from '@/lib/notifications';
import {RedcomSelect} from '@/components/ui/redcom-select';
export default function WorkspaceNoticeSettings(){
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [title,setTitle]=useState('');
 const [message,setMessage]=useState('');
 const [active,setActive]=useState(false);
 const [hours,setHours]=useState('12');
 const load=async()=>{
  const {data,error}=await supabase.from('workspace_notices').select('title,message,is_active,repeat_hours').eq('id',1).single();
  if(error)notify.error(errorMessage(error,'No se pudo cargar la configuración.'));
  else {setTitle(data.title);setMessage(data.message);setActive(data.is_active);setHours(String(data.repeat_hours));}
  setLoading(false);
 };
 useEffect(()=>{void load();},[]);
 const save=async()=>{
  if(!title.trim()||!message.trim()){notify.error('Completá el título y el mensaje.');return;}
  setSaving(true);
  const {error}=await supabase.rpc('update_workspace_notice',{p_title:title.trim(),p_message:message.trim(),p_active:active,p_repeat_hours:Number(hours)});
  if(error)notify.error(errorMessage(error,'No se pudo guardar el aviso.'));
  else notify.success('Aviso global actualizado. La nueva versión se mostrará a los usuarios.');
  setSaving(false);
 };
 return <div className="mx-auto max-w-3xl rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
  <div className="flex items-center gap-3"><div className="rounded-xl bg-amber-50 p-3 text-amber-600"><AlertTriangle className="h-5 w-5"/></div><div><h1 className="text-xl font-semibold text-slate-950">Avisos globales</h1><p className="mt-1 text-sm text-slate-500">Configurá el comunicado que verán los usuarios en cualquier módulo.</p></div></div>
  {loading?<div className="py-12 text-sm text-slate-500">Cargando configuración...</div>:<div className="mt-8 space-y-5">
   <label className="flex items-center justify-between rounded-xl bg-slate-50 p-4"><span className="text-sm font-medium text-slate-800">Aviso habilitado</span><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} className="h-5 w-5 accent-slate-950"/></label>
   <label className="block"><span className="text-xs font-semibold text-slate-600">Título</span><input value={title} maxLength={120} onChange={e=>setTitle(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-400"/></label>
   <label className="block"><span className="text-xs font-semibold text-slate-600">Mensaje</span><textarea value={message} maxLength={2000} rows={6} onChange={e=>setMessage(e.target.value)} className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-blue-400"/></label>
   <div><span className="mb-2 block text-xs font-semibold text-slate-600">Frecuencia para cada usuario</span><RedcomSelect value={hours} onValueChange={setHours} options={[{value:'1',label:'Cada hora'},{value:'6',label:'Cada 6 horas'},{value:'12',label:'Cada 12 horas'},{value:'24',label:'Cada 24 horas'},{value:'48',label:'Cada 48 horas'},{value:'168',label:'Cada 7 días'}]} className="h-11 w-full max-w-xs rounded-xl"/></div>
   <p className="text-xs leading-5 text-slate-500">Cuando cambiás y guardás el aviso, se publica una versión nueva que aparecerá al usuario en su siguiente comprobación (habitualmente dentro de un minuto). Luego volverá según la frecuencia elegida. Desactivarlo deja de mostrarlo.</p>
   <div className="flex justify-end"><button onClick={()=>void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4"/>{saving?'Guardando...':'Guardar aviso'}</button></div>
  </div>}
 </div>;
}
