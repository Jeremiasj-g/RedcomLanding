'use client';
import {useCallback,useEffect,useState} from 'react';
import {AlertTriangle,X} from 'lucide-react';
import {supabase} from '@/lib/supabaseClient';
import {useMe} from '@/hooks/useMe';
type Notice={id:number;title:string;message:string;is_active:boolean;repeat_hours:number;revision:number};
export default function WorkspaceNoticeModal(){
 const {me}=useMe();
 const [notice,setNotice]=useState<Notice|null>(null);
 const [visible,setVisible]=useState(false);
 const check=useCallback(async()=>{
  if(!me?.id||!me.is_active)return;
  const {data,error}=await supabase.from('workspace_notices').select('id,title,message,is_active,repeat_hours,revision').eq('id',1).maybeSingle();
  if(error||!data||!data.is_active){setVisible(false);return;}
  const current=data as Notice;
  setNotice(current);
  const key='redcom-workspace-notice-'+me.id+'-'+current.id+'-'+current.revision;
  const last=Number(window.localStorage.getItem(key)||0);
  setVisible(!last||Date.now()-last>=current.repeat_hours*3600000);
 },[me?.id,me?.is_active]);
 useEffect(()=>{
  if(!me?.id||!me.is_active)return;
  void check();
  const interval=window.setInterval(()=>void check(),60_000);
  const onVisible=()=>{if(document.visibilityState==='visible')void check();};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{window.clearInterval(interval);document.removeEventListener('visibilitychange',onVisible);};
 },[check,me?.id,me?.is_active]);
 const dismiss=()=>{
  if(notice&&me?.id){
   window.localStorage.setItem('redcom-workspace-notice-'+me.id+'-'+notice.id+'-'+notice.revision,String(Date.now()));
  }
  setVisible(false);
 };
 if(!visible||!notice||!me?.id)return null;
 return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
  <div role="dialog" aria-modal="true" aria-labelledby="workspace-notice-title" aria-describedby="workspace-notice-description" className="w-full max-w-lg rounded-[24px] border border-slate-100 bg-white p-6 shadow-[0_28px_90px_rgba(15,23,42,.25)] sm:p-8">
   <div className="flex items-start justify-between gap-3">
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><AlertTriangle className="h-6 w-6"/></div>
    <button type="button" onClick={dismiss} aria-label="Cerrar aviso" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"><X className="h-5 w-5"/></button>
   </div>
   <div className="mt-5 text-[10px] font-bold uppercase tracking-[.15em] text-amber-600">Comunicado importante</div>
   <h2 id="workspace-notice-title" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{notice.title}</h2>
   <p id="workspace-notice-description" className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">{notice.message}</p>
   <div className="mt-7 flex justify-end"><button type="button" onClick={dismiss} className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">Entendido</button></div>
  </div>
 </div>;
}
