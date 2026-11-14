'use client';

export default function CategoryV2ContentSkeleton({variant='categories'}:{variant?:'categories'|'permissions'}){
 const pulse='animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none';
 return <div role="status" aria-label="Cargando Categorías V 2.0" className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
   {variant==='permissions'&&<div className="mb-8 h-[350px] rounded-2xl bg-slate-100 animate-pulse motion-reduce:animate-none"/>}
   {variant==='categories'&&<div className="mt-10">
    <div className={pulse+' h-11 w-[380px] max-w-full'}/>
    <div className="mt-5 flex flex-wrap gap-2">{Array.from({length:5},(_,i)=><div key={i} className={pulse+' h-10 w-24'}/>)}</div>
    <div className="mt-5 flex flex-wrap gap-2">{Array.from({length:4},(_,i)=><div key={i} className={pulse+' h-9 w-36'}/>)}</div>
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:4},(_,i)=><div key={i} className={pulse+' h-36 rounded-2xl'}/>)}</div>
    <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">{Array.from({length:6},(_,i)=><div key={i} className={pulse+' h-96 rounded-2xl'}/>)}</div>
   </div>}
 </div>;
}
