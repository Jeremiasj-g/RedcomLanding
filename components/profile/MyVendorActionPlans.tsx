'use client';

import {useMemo} from 'react';
import {CalendarDays,CheckCircle2,ClipboardList,LockKeyhole,UsersRound,FolderKanban} from 'lucide-react';
import {decodeTodoLabel} from '@/lib/projectActionPlanGroups';
import type {MyVendorActionPlan} from '@/lib/myVendorActionPlans';

const statusLabels:Record<string,string>={
 not_started:'Sin empezar',in_progress:'En progreso',done:'Finalizado',cancelled:'Cancelado',
};
const statusTones:Record<string,string>={
 not_started:'bg-slate-100 text-slate-700',in_progress:'bg-sky-50 text-sky-700',
 done:'bg-emerald-50 text-emerald-700',cancelled:'bg-rose-50 text-rose-700',
};
const priorityLabels:Record<string,string>={low:'Baja',medium:'Media',high:'Alta'};
const projectStatusLabels:Record<string,string>={active:'Activo',closed:'Cerrado',completed:'Completado',archived:'Archivado'};
const branchLabels:Record<string,string>={
 corrientes_masivos:'Corrientes · Masivos',corrientes_refrigerados:'Corrientes · Refrigerados',
 chaco_masivos:'Chaco',misiones_masivos:'Misiones',obera_masivos:'Oberá',
};
const pct=(p:MyVendorActionPlan)=>p.checklist_total>0?
 Math.min(100,Math.max(0,Math.round(p.checklist_done/p.checklist_total*100))):0;
const dateText=(date:string|null)=>date?
 new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')):'Sin fecha límite';

function PlanOverview({plan}:{plan:MyVendorActionPlan}){
 const progress=pct(plan);
 const groups=new Map<string,Array<{id?:string;text?:string;done?:boolean;label:string}>>();
 for(const todo of plan.checklist_items){
   const decoded=decodeTodoLabel(todo.text);
   const name=decoded.group||'Sin grupo';
   const list=groups.get(name)??[];
   list.push({...todo,label:decoded.label});
   groups.set(name,list);
 }
 const grouped=Array.from(groups.entries());
 return <article className="rounded-2xl border border-slate-200 bg-white px-4 py-5 sm:px-6">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div className="min-w-0">
    <p className="flex items-center gap-1.5 text-xs text-slate-500"><FolderKanban className="h-3.5 w-3.5"/>{plan.project_name}</p>
    <h3 className="mt-1 text-base font-medium text-slate-950">{plan.task_title}</h3>
    {plan.task_summary&&<p className="mt-1 text-sm text-slate-600">{plan.task_summary}</p>}
   </div>
   <span className={'rounded-lg px-2.5 py-1 text-xs font-medium '+(statusTones[plan.task_status]??statusTones.not_started)}>
    {statusLabels[plan.task_status]??plan.task_status}
   </span>
  </div>
  <div className="mt-4 grid gap-3 border-y border-slate-100 py-4 text-xs sm:grid-cols-2">
    <div><span className="text-slate-500">Proyecto</span><p className="mt-1 font-medium text-slate-800">{projectStatusLabels[plan.project_status]??plan.project_status}</p></div>
    <div><span className="text-slate-500">Prioridad</span><p className="mt-1 font-medium text-slate-800">{priorityLabels[plan.task_priority]??plan.task_priority}</p></div>
    <div><span className="text-slate-500">Sucursal</span><p className="mt-1 font-medium text-slate-800">{branchLabels[plan.branch_key]??plan.branch_key}</p></div>
    <div><span className="text-slate-500">Código comercial</span><p className="mt-1 font-medium tabular-nums text-slate-800">{plan.seller_id}</p></div>
   </div>
  <div className="mt-5 flex items-end justify-between gap-3">
   <div>
    <p className="text-xs text-slate-500">Avance de acciones</p>
    <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{plan.checklist_total?progress+'%':'Sin acciones'}</p>
   </div>
   <span className="text-xs tabular-nums text-slate-500">
    {plan.checklist_done} de {plan.checklist_total} completadas
   </span>
  </div>
  <div role="progressbar" aria-label={'Avance de '+plan.task_title}
   aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
   className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
   <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-200 motion-reduce:transition-none" style={{width:progress+'%'}}/>
  </div>
  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
   <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5"/>Vence: {dateText(plan.task_due_date??plan.project_due_date)}</span>
   <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5"/>Solo lectura</span>
  </div>
  {(plan.project_description||plan.assignees.length>0)&&<div className="mt-5 border-t border-slate-100 pt-4">
   <h4 className="text-sm font-medium text-slate-900">Detalles del proyecto</h4>

   {plan.project_description&&<p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{plan.project_description}</p>}
   {plan.assignees.length>0&&<div className="mt-4">
    <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700"><UsersRound className="h-3.5 w-3.5"/>Responsables</p>
    <div className="mt-2 flex flex-wrap gap-2">{plan.assignees.map((person,index)=><span key={index} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{person.name}</span>)}</div>
   </div>}
  </div>}
  {plan.task_description&&<div className="mt-5 border-t border-slate-100 pt-4">
    <p className="text-xs font-medium text-slate-900">Descripción general</p>
    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{plan.task_description}</p>
   </div>}
  <div className="mt-5 border-t border-slate-100 pt-4">
   <h4 className="text-sm font-medium text-slate-900">Acciones del plan</h4>
   {grouped.length?<div className="mt-4 space-y-5">
    {grouped.map(([name,items])=>{
      const completed=items.filter(item=>item.done).length;
      const groupProgress=Math.round(completed/items.length*100);
      const priority=plan.todo_groups.find(group=>group.name===name)?.priority;
      return <section key={name} aria-label={'Grupo '+name} className="min-w-0">
       <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h5 className="text-xs font-medium text-slate-800">{name}</h5>
        <span className="text-xs tabular-nums text-slate-500">{completed}/{items.length} · {groupProgress}%{priority?' · '+(priorityLabels[priority]??priority):''}</span>
       </div>
       <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-[width] duration-200 motion-reduce:transition-none" style={{width:groupProgress+'%'}}/></div>
       <ul className="mt-2 divide-y divide-slate-100">
       {items.map((item,index)=><li key={item.id??index} className="flex min-w-0 items-start gap-2.5 py-3 text-sm">
        <CheckCircle2 className={'mt-0.5 h-4 w-4 shrink-0 '+(item.done?'text-emerald-600':'text-slate-300')}/>
        <span className={'min-w-0 flex-1 break-words '+(item.done?'text-slate-500':'text-slate-800')}>{item.label||'Acción sin descripción'}</span>
        <span className="shrink-0 text-xs text-slate-500">{item.done?'Cumplida':'Pendiente'}</span>
       </li>)}
       </ul>
      </section>;
    })}
   </div>:<p className="mt-3 text-sm text-slate-500">Este plan todavía no tiene acciones registradas.</p>}
  </div>
 </article>;
}

export default function MyVendorActionPlans({plans,loading,error,onReload}:{plans:MyVendorActionPlan[];loading:boolean;error:string;onReload:()=>void}){
 const total=useMemo(()=>plans.reduce((n,p)=>n+p.checklist_total,0),[plans]);
 const done=useMemo(()=>plans.reduce((n,p)=>n+p.checklist_done,0),[plans]);
 return <section className="space-y-5">
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <h2 className="text-xl font-medium tracking-tight text-slate-950">Mi plan de acción</h2>
    <p className="mt-1 text-sm text-slate-500">Seguimiento de los planes asignados a tu cuenta comercial</p>
   </div>
   <button type="button" onClick={onReload} disabled={loading}
    className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-50">
    Actualizar
   </button>
  </header>
  {error?<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>:
   loading?<div className="grid gap-4 md:grid-cols-2">{[0,1].map(i=><div key={i} className="h-72 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none"/>)}</div>:
   plans.length?<>
    <div className="grid grid-cols-3 gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white py-4 sm:py-5">
      <div className="min-w-0 border-r border-slate-100 px-2.5 text-center sm:px-5">
        <p className="text-[10px] leading-tight text-slate-500 sm:text-xs">Planes asignados</p>
        <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900 sm:text-2xl">{plans.length}</p>
      </div>
      <div className="min-w-0 border-r border-slate-100 px-2.5 text-center sm:px-5">
        <p className="text-[10px] leading-tight text-slate-500 sm:text-xs">Acciones completadas</p>
        <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900 sm:text-2xl">{done}/{total}</p>
      </div>
      <div className="min-w-0 px-2.5 text-center sm:px-5">
        <p className="text-[10px] leading-tight text-slate-500 sm:text-xs">Progreso general</p>
        <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900 sm:text-2xl">{total?Math.round(done/total*100)+'%':'—'}</p>
      </div>
    </div>
    <div className="grid items-start gap-4 lg:grid-cols-2">{plans.map(plan=><PlanOverview key={plan.action_plan_id} plan={plan}/>)}</div>
   </>:<div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
    <ClipboardList className="mx-auto h-7 w-7 text-slate-400"/>
    <h3 className="mt-3 text-sm font-medium text-slate-900">Todavía no tenés planes asignados</h3>
    <p className="mt-1 text-sm text-slate-500">Cuando tu supervisor vincule un Plan de acción a tu cuenta comercial, aparecerá acá.</p>
   </div>}
 </section>;
}
