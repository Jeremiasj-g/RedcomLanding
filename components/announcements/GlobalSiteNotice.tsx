'use client';
import {useCallback,useEffect,useState} from 'react';
import {AlertTriangle,X} from 'lucide-react';
import {useAuth} from '@/app/auth/AuthProvider';
import {supabase} from '@/lib/supabaseClient';

type Notice={id:number;title:string;body:string;enabled:boolean;interval_hours:number;updated_at:string};
const keyFor=(id:string,n:Notice)=>`redcom:site-notice:${id}:${n.id}:${n.updated_at}`;
const shouldDisplay=(userId:string,n:Notice)=>{
 if(!n.enabled)return false;
 try{
  const last=Number(localStorage.getItem(keyFor(userId,n))||0);
  return !Number.isFinite(last)||Date.now()-last>=Math.max(1,n.interval_hours)*3600000;
 }catch{return true;}
};

export default function GlobalSiteNotice(){
 const {me,loading}=useAuth();
 const [notice,setNotice]=useState<Notice|null>(null);
 const [open,setOpen]=useState(false);

 // El servidor es la única fuente de verdad. Nunca conservar un aviso abierto
 // cuando se confirma que el administrador lo deshabilitó.
 const load=useCallback(async()=>{
  if(!me?.id||!me.is_active){setNotice(null);setOpen(false);return;}
  const {data,error}=await supabase.from('site_announcements')
   .select('id,title,body,enabled,interval_hours,updated_at').eq('id',1).maybeSingle();
  if(error){
   // Ante una lectura fallida no mostrar un aviso posiblemente desactualizado.
   setOpen(false);
   return;
  }
  const next=data as Notice|null;
  setNotice(next);
  setOpen(Boolean(next?.enabled&&shouldDisplay(me.id,next)));
 },[me?.id,me?.is_active]);

 useEffect(()=>{
  if(loading||!me?.id||!me.is_active){setNotice(null);setOpen(false);return;}
  void load();
  const timer=window.setInterval(()=>void load(),30_000);
  const refresh=()=>void load();
  const onVisibility=()=>{if(document.visibilityState==='visible')void load();};
  window.addEventListener('focus',refresh);
  window.addEventListener('redcom:notice-changed',refresh);
  document.addEventListener('visibilitychange',onVisibility);
  return()=>{
   window.clearInterval(timer);
   window.removeEventListener('focus',refresh);
   window.removeEventListener('redcom:notice-changed',refresh);
   document.removeEventListener('visibilitychange',onVisibility);
  };
 },[loading,me?.id,me?.is_active,load]);

 const dismiss=()=>{
  if(me?.id&&notice){
   try{localStorage.setItem(keyFor(me.id,notice),String(Date.now()));}catch{}
  }
  setOpen(false);
 };

 if(!open||!notice?.enabled||!me?.id||!me.is_active)return null;
 return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="presentation">
  <section role="alertdialog" aria-modal="true" aria-labelledby="site-notice-title" aria-describedby="site-notice-body" className="w-full max-w-lg rounded-[26px] border border-slate-200/70 bg-white p-6 shadow-[0_28px_90px_rgba(15,23,42,.22)] sm:p-7">
   <div className="flex items-start justify-between">
    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><AlertTriangle size={21} strokeWidth={1.8}/></span>
    <button type="button" onClick={dismiss} aria-label="Cerrar aviso" className="rounded-xl p-2 text-slate-500 transition-colors duration-200 hover:bg-slate-100"><X size={18}/></button>
   </div>
   <h2 id="site-notice-title" className="mt-5 text-xl font-semibold tracking-tight text-slate-950">{notice.title}</h2>
   <p id="site-notice-body" className="mt-3 whitespace-pre-wrap text-sm font-normal leading-6 text-slate-600">{notice.body}</p>
   <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
    <button type="button" autoFocus onClick={dismiss} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-slate-800">Entendido</button>
   </div>
  </section>
 </div>;
}
