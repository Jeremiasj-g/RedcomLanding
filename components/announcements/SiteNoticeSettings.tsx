'use client';
import { useEffect,useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/app/auth/AuthProvider';
import { Megaphone, Save } from 'lucide-react';
type Notice={id:number;title:string;body:string;enabled:boolean;interval_hours:number;updated_at:string};
export default function SiteNoticeSettings(){
 const {me}=useAuth();
 const [form,setForm]=useState<Notice|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 useEffect(()=>{if(me?.role!=='admin')return; void (async()=>{const {data,error}=await supabase.from('site_announcements').select('*').eq('id',1).maybeSingle();if(error)setMessage('No se pudo cargar la configuración: '+error.message);else setForm(data as Notice|null)})();},[me?.role]);
 if(me?.role!=='admin')return null;
 const save=async()=>{if(!form||busy)return;setBusy(true);setMessage('');
  const {error}=await supabase.from('site_announcements').update({title:form.title.trim(),body:form.body.trim(),enabled:form.enabled,interval_hours:form.interval_hours,updated_at:new Date().toISOString()}).eq('id',1);
  setBusy(false);
  if(error)setMessage('Error al guardar: '+error.message);
  else {setMessage('Aviso actualizado correctamente.');window.dispatchEvent(new Event('redcom:notice-changed')); }
 };
 return <section className="mb-7 rounded-[24px] border border-slate-200 bg-[#f8f9fb] p-6">
  <div className="flex items-center gap-3"><Megaphone className="h-6 w-6 text-amber-600"/><div><h2 className="text-xl font-semibold text-slate-900">Aviso general</h2><p className="text-sm text-slate-500">Se mostrará en cualquier sección a todos los usuarios activos.</p></div></div>
  {form?<div className="mt-5 space-y-4">
   <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.enabled} onChange={e=>setForm({...form,enabled:e.target.checked})} className="h-4 w-4"/>Aviso habilitado</label>
   <label className="block text-sm font-medium text-slate-700">Título<input value={form.title} maxLength={140} onChange={e=>setForm({...form,title:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900"/></label>
   <label className="block text-sm font-medium text-slate-700">Mensaje<textarea value={form.body} rows={4} onChange={e=>setForm({...form,body:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900"/></label>
   <label className="block text-sm font-medium text-slate-700">Repetir cada (horas)<input type="number" min={1} max={168} value={form.interval_hours} onChange={e=>setForm({...form,interval_hours:Math.min(168,Math.max(1,Number(e.target.value)||1))})} className="mt-1 block w-28 rounded-xl border border-slate-300 bg-white p-3 text-slate-900"/></label>
   <p className="text-xs text-slate-500">Cada usuario ve la primera aparición al ingresar. Después de pulsar Entendido, el mismo aviso reaparece una vez transcurrido el intervalo configurado. Editar el aviso reinicia ese intervalo.</p>
   <button type="button" disabled={busy||!form.title.trim()||!form.body.trim()} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Save size={16}/>{busy?'Guardando...':'Guardar aviso'}</button>
  </div>:<p className="mt-4 text-sm text-slate-500">Cargando aviso…</p>}
  {message&&<p role="status" className="mt-3 text-sm text-slate-600">{message}</p>}
 </section>;
}
