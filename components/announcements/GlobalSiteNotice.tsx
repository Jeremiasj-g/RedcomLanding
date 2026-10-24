'use client';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { supabase } from '@/lib/supabaseClient';

type Notice = { id: number; title: string; body: string; enabled: boolean; interval_hours: number; updated_at: string };
const keyFor = (id:string,n:Notice) => `redcom:site-notice:${id}:${n.id}:${n.updated_at}`;

export default function GlobalSiteNotice() {
 const { me, loading } = useAuth();
 const [notice,setNotice] = useState<Notice|null>(null);
 const [open,setOpen] = useState(false);
 const load=useCallback(async()=>{
   const {data,error}=await supabase.from('site_announcements').select('*').eq('id',1).maybeSingle();
   if (!error) setNotice(data as Notice|null);
 },[]);
 useEffect(()=>{if(!loading && me?.id && me.is_active) void load(); else {setNotice(null);setOpen(false);}},[me?.id,me?.is_active,loading,load]);
 useEffect(()=>{
  if(!me?.id || !notice?.enabled){setOpen(false);return;}
  const check=()=>{
   try {const last=Number(localStorage.getItem(keyFor(me.id,notice))||0);if(Date.now()-last>=notice.interval_hours*3600000) setOpen(true);}
   catch {setOpen(true);}
  };
  check();
  const timer=window.setInterval(check,60_000);
  const onFocus=()=>{void load();check();};
  const onChange=()=>void load();
  window.addEventListener('focus',onFocus);
  window.addEventListener('redcom:notice-changed',onChange);
  return ()=>{clearInterval(timer);window.removeEventListener('focus',onFocus);window.removeEventListener('redcom:notice-changed',onChange);};
 },[me?.id,notice,load]);
 const dismiss=()=>{if(me?.id && notice){try{localStorage.setItem(keyFor(me.id,notice),String(Date.now()));}catch{}}setOpen(false);};
 if(!open||!notice||!me?.id||!me.is_active)return null;
 return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
  <section role="alertdialog" aria-modal="true" aria-labelledby="site-notice-title" aria-describedby="site-notice-body" className="w-full max-w-lg rounded-[28px] bg-[#f8f9fb] p-7 shadow-2xl">
    <div className="flex items-start justify-between gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><AlertTriangle size={25}/></div><button type="button" onClick={dismiss} aria-label="Cerrar aviso" className="rounded-xl p-2 text-slate-500 hover:bg-slate-200"><X size={20}/></button></div>
    <h2 id="site-notice-title" className="mt-5 text-2xl font-semibold text-slate-900">{notice.title}</h2>
    <p id="site-notice-body" className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-slate-600">{notice.body}</p>
    <button type="button" autoFocus onClick={dismiss} className="mt-7 w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">Entendido</button>
  </section>
 </div>;
}
