'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabaseClient';
import {useAuth} from '@/app/auth/AuthProvider';
import {Check,Loader2,RefreshCw,Save} from 'lucide-react';

type Notice={id:number;title:string;body:string;enabled:boolean;interval_hours:number;updated_at:string};

export default function SiteNoticeSettings(){
 const {me}=useAuth();
 const [form,setForm]=useState<Notice|null>(null);
 const [saved,setSaved]=useState<Notice|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');

 const load=async()=>{
  setLoading(true);setError('');setMessage('');
  const {data,error:fetchError}=await supabase.from('site_announcements').select('id,title,body,enabled,interval_hours,updated_at').eq('id',1).maybeSingle();
  setLoading(false);
  if(fetchError){setError('No se pudo cargar la configuración: '+fetchError.message);return;}
  if(!data){setError('No se encontró el aviso general configurado.');return;}
  setForm(data as Notice);setSaved(data as Notice);
 };
 useEffect(()=>{if(me?.role==='admin')void load();},[me?.role]);
 if(me?.role!=='admin')return null;

 const dirty=Boolean(form&&saved&&(
  form.enabled!==saved.enabled||form.title!==saved.title||
  form.body!==saved.body||form.interval_hours!==saved.interval_hours
 ));
 const save=async()=>{
  if(!form||busy)return;
  setBusy(true);setError('');setMessage('');
  const {data,error:saveError}=await supabase.from('site_announcements')
   .update({title:form.title.trim(),body:form.body.trim(),enabled:form.enabled,
    interval_hours:form.interval_hours,updated_at:new Date().toISOString()})
   .eq('id',1).select('id,title,body,enabled,interval_hours,updated_at').single();
  setBusy(false);
  if(saveError||!data){setError('No se pudo guardar el aviso: '+(saveError?.message??'No se confirmó la actualización.'));return;}
  setForm(data as Notice);setSaved(data as Notice);
  setMessage(data.enabled?'Aviso habilitado y guardado.':'Aviso deshabilitado y guardado. Ya no se mostrará a los usuarios.');
  window.dispatchEvent(new Event('redcom:notice-changed'));
 };

 return <section className="rounded-[24px] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_8px_30px_rgba(15,23,42,.045)] sm:px-7">
  <div className="flex flex-wrap items-start justify-between gap-4">
   <div>
    <h2 className="text-xl font-semibold tracking-tight text-slate-950">Aviso general</h2>
    <p className="mt-1 text-sm font-normal text-slate-500">Configurá el mensaje que aparece en toda la aplicación.</p>
   </div>
   {form&&<span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${form.enabled?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-600'}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${form.enabled?'bg-emerald-500':'bg-slate-400'}`}/>
    {form.enabled?'Activo':'Desactivado'}
   </span>}
  </div>
  {loading?<div className="flex items-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={16} className="animate-spin"/>Cargando configuración…</div>:
  form?<div className="mt-6 space-y-5">
   <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
    <div>
     <p className="text-sm font-medium text-slate-900">Mostrar aviso</p>
     <p className="mt-1 text-xs text-slate-500">Al desactivarlo, deja de mostrarse en todas las sesiones.</p>
    </div>
    <button type="button" role="switch" aria-checked={form.enabled} aria-label="Mostrar aviso" onClick={()=>setForm({...form,enabled:!form.enabled})}
     className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${form.enabled?'bg-emerald-600':'bg-slate-200'}`}>
     <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.enabled?'translate-x-5':'translate-x-0'}`}/>
    </button>
   </div>
   <div className="grid gap-5 lg:grid-cols-[1fr_190px]">
    <label className="block text-sm font-medium text-slate-700">Título
     <input type="text" value={form.title} maxLength={140} onChange={event=>setForm({...form,title:event.target.value})}
      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal text-slate-900 outline-none transition-colors duration-200 focus:border-slate-400"/>
    </label>
    <label className="block text-sm font-medium text-slate-700">Repetir cada (horas)
     <input type="number" min={1} max={168} value={form.interval_hours} onChange={event=>setForm({...form,interval_hours:Math.min(168,Math.max(1,Number(event.target.value)||1))})}
      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal text-slate-900 outline-none transition-colors duration-200 focus:border-slate-400"/>
    </label>
   </div>
   <label className="block text-sm font-medium text-slate-700">Mensaje
    <textarea value={form.body} rows={4} onChange={event=>setForm({...form,body:event.target.value})}
     className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal leading-6 text-slate-900 outline-none transition-colors duration-200 focus:border-slate-400"/>
   </label>
   <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
    <span className="text-xs text-slate-500">{dirty?'Tenés cambios sin guardar.':'Los cambios se sincronizan automáticamente con la aplicación después de guardarlos.'}</span>
    <div className="flex items-center gap-2">
     <button type="button" disabled={busy} onClick={()=>void load()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15}/>Actualizar</button>
     <button type="button" disabled={busy||!dirty||!form.title.trim()||!form.body.trim()} onClick={()=>void save()}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
      {busy?<Loader2 size={15} className="animate-spin"/>:<Save size={15}/>}
      {busy?'Guardando…':'Guardar cambios'}
     </button>
    </div>
   </div>
  </div>:null}
  {message&&<p role="status" className="mt-4 flex items-center gap-2 text-sm text-emerald-700"><Check size={16}/>{message}</p>}
  {error&&<p role="alert" className="mt-4 text-sm text-rose-600">{error}</p>}
 </section>;
}
