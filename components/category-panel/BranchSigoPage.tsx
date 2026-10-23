'use client';
import {useMe} from '@/hooks/useMe';
import CategorySigoHistory from '@/components/category-panel/CategorySigoHistory';
import Link from 'next/link';

type Props={branchKey:string;branch:string;force:string;title:string};
export default function BranchSigoPage({branchKey,branch,force,title}:Props){
 const {me,loading}=useMe();
 if(loading)return <div className="grid min-h-[50vh] place-items-center text-sm text-slate-500">Cargando permisos...</div>;
 const permitted=me?.is_active&&(me.role==='admin'||(['supervisor','jdv'].includes(me.role)&&me.branches.includes(branchKey)));
 if(!permitted)return <div className="mx-auto max-w-2xl px-6 py-20 text-center"><h1 className="text-xl font-semibold">Acceso restringido</h1><p className="mt-3 text-sm text-slate-500">Esta sección está disponible para supervisores y jefes de venta asignados a la sucursal.</p></div>;
 return <main className="min-h-screen bg-[#f4f5f7] px-4 py-6 lg:px-6">
  <div className="mb-5"><Link href="/" className="text-xs font-medium text-blue-600 hover:underline">← Inicio</Link><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Horarios SIGO · {title}</h1><p className="mt-2 text-sm text-slate-500">Detalle diario, promedios mensuales y análisis por ID. Las correcciones se comparten con Panel de Categorías.</p></div>
  <CategorySigoHistory branchScope={{branch,force}}/>
 </main>;
}
