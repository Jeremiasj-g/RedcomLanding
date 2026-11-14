'use client';

export default function CategoryV2ContentSkeleton({variant='categories'}:{variant?:'categories'|'permissions'}){
 const pulse='animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none';
 return <div role="status" aria-label="Cargando Categorías V 2.0" className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
   {variant==='permissions'&&<div className="mb-8 h-[350px] rounded-2xl bg-slate-100 animate-pulse motion-reduce:animate-none"/>}
   <section className="mt-6 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-5"><div className={pulse+' h-6 w-64'}/><div className={pulse+' h-9 w-36'}/></div>
    <div className="flex gap-5 border-b border-slate-100 px-5 py-4">{[1,2].map(n=><div key={n} className={pulse+' h-12 w-36'}/>)}</div>
    <div className="border-b border-slate-100 px-5 py-4"><div className={pulse+' h-10 w-72 max-w-full'}/></div>
    <div className="space-y-2 px-5 py-4"><div className="flex gap-2">{Array.from({length:8},(_,i)=><div key={i} className={pulse+' h-8 flex-1'}/>)}</div>{Array.from({length:8},(_,i)=><div key={i} className="flex gap-2">{Array.from({length:8},(_,j)=><div key={j} className={pulse+' h-10 flex-1'}/>)}</div>)}</div>
   </section>
   <section className="mt-6 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
    <div className={pulse+' h-6 w-56'}/>
    <div className="mt-4 flex gap-2 border-b border-slate-100 pb-4">{[1,2,3].map(n=><div key={n} className={pulse+' h-9 w-24'}/>)}</div>
    <div className="mt-4 space-y-2">{Array.from({length:6},(_,i)=><div key={i} className={pulse+' h-11 w-full'}/>)}</div>
   </section>
 </div>;
}
