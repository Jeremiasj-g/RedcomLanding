'use client';

import {useEffect,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';

const MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function CategoryMonthPicker({
 value,onChange,disabled=false,label='Mes',className='',
}:{value:string;onChange:(value:string)=>void;disabled?:boolean;label?:string;className?:string}){
 const [open,setOpen]=useState(false);
 const [year,setYear]=useState(()=>Number(value.slice(0,4))||new Date().getFullYear());
 useEffect(()=>{if(open)setYear(Number(value.slice(0,4))||new Date().getFullYear());},[open,value]);
 const month=Number(value.slice(5,7));
 const title=month>=1&&month<=12?MONTHS[month-1]+' de '+value.slice(0,4):'Seleccionar mes';
 return <Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
   <button type="button" disabled={disabled} aria-label={label} aria-haspopup="dialog"
    className={'inline-flex h-10 min-w-[170px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,.04)] transition-colors duration-200 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 motion-reduce:transition-none '+className}>
    <span>{title}</span><CalendarDays className="h-4 w-4 shrink-0 text-slate-500"/>
   </button>
  </PopoverTrigger>
  <PopoverContent align="end" sideOffset={8} className="z-[220] w-[288px] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,.14)]">
   <div className="mb-3 flex items-center justify-between">
    <button type="button" aria-label="Año anterior" onClick={()=>setYear(y=>y-1)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 transition-colors duration-200 hover:bg-slate-100"><ChevronLeft className="h-4 w-4"/></button>
    <span className="text-sm font-semibold tabular-nums text-slate-900">{year}</span>
    <button type="button" aria-label="Año siguiente" onClick={()=>setYear(y=>y+1)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 transition-colors duration-200 hover:bg-slate-100"><ChevronRight className="h-4 w-4"/></button>
   </div>
   <div className="grid grid-cols-3 gap-1">
    {MONTHS.map((monthName,index)=>{
     const next=year+'-'+String(index+1).padStart(2,'0');
     const active=value===next;
     return <button type="button" key={monthName} aria-pressed={active} onClick={()=>{onChange(next);setOpen(false);}}
      className={'rounded-lg px-2 py-2.5 text-xs font-medium transition-colors duration-200 motion-reduce:transition-none '+(active?'bg-slate-950 text-white':'text-slate-700 hover:bg-slate-100')}>{monthName.slice(0,3)}</button>;
    })}
   </div>
  </PopoverContent>
 </Popover>;
}
