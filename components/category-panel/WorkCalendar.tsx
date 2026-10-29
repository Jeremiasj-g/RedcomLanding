'use client';
import {useEffect,useMemo,useState} from 'react';
import {DayPicker} from 'react-day-picker';
import {es} from 'date-fns/locale';
import {supabase} from '@/lib/supabaseClient';
import {notify,errorMessage} from '@/lib/notifications';
const fmt=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
export function useWorkCalendar(month:string){
 const [excluded,setExcluded]=useState<string[]>([]);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;setLoading(true);
  void supabase.from('category_nonworking_days').select('day').gte('day',month+'-01').lt('day',fmt(new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),1))).then(({data,error})=>{
   if(!live)return;if(error)notify.error(errorMessage(error,'Error al cargar días no laborables.'));else setExcluded((data??[]).map(x=>x.day));setLoading(false);
  });return()=>{live=false};
 },[month]);
 const counts=useMemo(()=>{
  const [year,m]=month.split('-').map(Number),now=new Date(),end=new Date(year,m,0).getDate();
  const past=now.getFullYear()>year||(now.getFullYear()===year&&now.getMonth()+1>m);
  const future=now.getFullYear()<year||(now.getFullYear()===year&&now.getMonth()+1<m);
  let total=0,elapsed=0;
  for(let d=1;d<=end;d++){const dt=new Date(year,m-1,d);if(dt.getDay()===0||excluded.includes(fmt(dt)))continue;total++;if(past||(!future&&d<=now.getDate()))elapsed++;}
  return {total,elapsed};
 },[month,excluded]);
 const toggle=async(day:Date)=>{
  const key=fmt(day),exists=excluded.includes(key);
  const {error}=exists?await supabase.from('category_nonworking_days').delete().eq('day',key):await supabase.from('category_nonworking_days').upsert({day:key});
  if(error)notify.error(errorMessage(error,'No se pudo actualizar el calendario.'));
  else setExcluded(v=>exists?v.filter(x=>x!==key):[...v,key]);
 };
 return {counts,excluded,loading,toggle};
}
export default function WorkCalendar({month,excluded,onToggle}:{month:string;excluded:string[];onToggle:(d:Date)=>void}){
 const [year,m]=month.split('-').map(Number);
 return <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
  <h3 className="text-sm font-semibold text-slate-900">Días no laborables</h3>
  <p className="mt-1 text-xs text-slate-500">Seleccioná feriados o cierres. Los domingos ya están excluidos.</p>
  <DayPicker mode="multiple" month={new Date(year,m-1,1)} selected={excluded.map(x=>new Date(Number(x.slice(0,4)),Number(x.slice(5,7))-1,Number(x.slice(8,10))))} onDayClick={d=>{if(d.getDay()!==0&&d.getMonth()===m-1&&d.getFullYear()===year)onToggle(d)}} locale={es} weekStartsOn={1} hideNavigation disabled={[{dayOfWeek:[0]}]} className="mt-3 text-sm"/>
 </div>;
}
