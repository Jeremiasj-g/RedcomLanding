'use client';

import Link from 'next/link';
import {useEffect,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {Clock3,Layers3} from 'lucide-react';
import {useMe} from '@/hooks/useMe';
import {useModulePermissions} from '@/components/permissions/ModulePermissionsProvider';
import {RequireAuth} from '@/components/RouteGuards';
import AccesoDenegadoPage from '@/app/acceso-denegado/page';
import {supabase} from '@/lib/supabaseClient';
import {errorMessage,notify} from '@/lib/notifications';
import {fromDbRow} from '@/lib/categoryPanel';
import type {CategoryPanelRow} from '@/lib/categoryPanelExcel';
import type {KpiProjection} from '@/lib/categoryKpiProjections';
import type {CategoryScaleMetric,CategoryScaleGate} from '@/lib/categoryScale';
import CategoryMonthPicker from '@/components/category-panel/CategoryMonthPicker';
import CategoryUnifiedOverview from '@/components/category-panel/CategoryUnifiedOverview';
import CategorySigoHistory from '@/components/category-panel/CategorySigoHistory';
import CategoryScaleHero from '@/components/category-panel/CategoryScaleHero';
import CategoryV2ContentSkeleton from '@/components/category-panel/CategoryV2ContentSkeleton';

type Scope={key:string;userBranch:string;branch:string;force:string;label:string;basePath:string};
type Daily={visit_date:string;branch:string;sales_force:string;seller_id:number|null;seller_name:string;first_visit:string|null;last_visit:string|null;corrected_start:string|null;corrected_end:string|null;reason:string|null};
type Person={id:number;name:string;branch:string;role:string;superior:string;force:string};
type Snapshot={months:string[];rows:Record<string,unknown>[];projections:KpiProjection[];daily:Daily[];personnel:Person[];metrics:CategoryScaleMetric[];gates:CategoryScaleGate[]};
const EMPTY:Snapshot={months:[],rows:[],projections:[],daily:[],personnel:[],metrics:[],gates:[]};
export default function BranchCategoryV2Page({scope,children}:{scope:Scope;children?:ReactNode}){
 const pathname=usePathname();
 const view=pathname.endsWith('/horarios-sigo')?'horarios-sigo':pathname.endsWith('/detalle-categorias')?'detalle-categorias':'categorias';
 const {me,loading:authLoading}=useMe();
 const {loading:permissionsLoading,canAccessModule}=useModulePermissions();
 const [month,setMonth]=useState(()=>{const date=new Date();return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');});
 const [visitedSigo,setVisitedSigo]=useState(false);
 const [visitedCategories,setVisitedCategories]=useState(false);
 const [hasScales,setHasScales]=useState(false);
 const [loadedMonth,setLoadedMonth]=useState<string|null>(null);
 const [snapshot,setSnapshot]=useState<Snapshot>(EMPTY);
 const [busy,setBusy]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{if(view==='horarios-sigo')setVisitedSigo(true);else setVisitedCategories(true);},[view]);
 const ownsBranch=Boolean(me?.is_active&&(me.role==='admin'||me.branches?.includes(scope.userBranch)));
 const canManageSigo=Boolean(ownsBranch&&(me?.role==='admin'||me?.role==='supervisor'||me?.role==='jdv'));
 const canSeeCategories=Boolean(ownsBranch&&(canAccessModule('branch_categories')||canManageSigo));
 useEffect(()=>{
  if(authLoading||permissionsLoading||!canSeeCategories)return;
  let active=true;
  setBusy(true);setError('');
  void Promise.resolve(supabase.rpc('branch_category_v2_data',{p_branch_key:scope.key,p_month:month}))
   .then(({data,error})=>{
     if(!active)return;
     if(error)throw error;
     const result=data as Snapshot|null;
     if(!result)throw new Error('No se recibieron datos de la sucursal.');
     setSnapshot(result);
     setHasScales(true);
     setLoadedMonth(month);
   }).catch(e=>{
     if(!active)return;
     setError(errorMessage(e,'No se pudieron consultar los datos de la sucursal.'));
   }).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};
 },[scope.key,month,authLoading,permissionsLoading,canSeeCategories]);
 if(authLoading||permissionsLoading)return <CategoryV2ContentSkeleton variant="permissions"/>;
 if(!ownsBranch||!canSeeCategories||(view==='horarios-sigo'&&!canManageSigo))return <AccesoDenegadoPage/>;
 const rows=snapshot.rows.map(row=>fromDbRow(row as Parameters<typeof fromDbRow>[0])) as CategoryPanelRow[];
 return <RequireAuth branches={[scope.userBranch]}>
  <main className="min-h-screen bg-[#f7f7f8] pb-16">
   <CategoryScaleHero metrics={snapshot.metrics} gates={snapshot.gates} loading={!hasScales&&busy} error={!hasScales?error:undefined}/>
   <div className="mx-auto max-w-[1500px] px-4 pb-8 sm:px-6 lg:px-8">
    <Link href={scope.basePath.replace('/categorias-v2','')} className="text-xs font-medium text-slate-500 hover:text-slate-950">← Volver a {scope.label}</Link>
    <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
     <div><h1 className="text-3xl font-semibold tracking-tight text-slate-950">Categorías V 2.0 · {scope.label}</h1></div>
     <label className="flex items-center gap-2 text-xs text-slate-600">Mes
       <CategoryMonthPicker value={month} onChange={setMonth} label="Mes de consulta"/>
      </label>
    </div>
    <nav aria-label="Secciones de Categorías V 2.0" className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      <Link scroll={false} href={scope.basePath+'/categorias'} aria-current={view==='categorias'?'page':undefined} className={'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors duration-200 '+(view==='categorias'?'border-slate-950 bg-slate-950 text-white':'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}><Layers3 className="h-4 w-4"/>Categorías</Link>
      <Link scroll={false} href={scope.basePath+'/detalle-categorias'} aria-current={view==='detalle-categorias'?'page':undefined} className={'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors duration-200 '+(view==='detalle-categorias'?'border-slate-950 bg-slate-950 text-white':'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}><Layers3 className="h-4 w-4"/>Detalle categorías</Link>
      {canManageSigo&&<Link scroll={false} href={scope.basePath+'/horarios-sigo'} aria-current={view==='horarios-sigo'?'page':undefined} className={'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors duration-200 '+(view==='horarios-sigo'?'border-slate-950 bg-slate-950 text-white':'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}><Clock3 className="h-4 w-4"/>Horarios SIGO</Link>}
    </nav>
    {canManageSigo&&visitedSigo&&<div hidden={view!=='horarios-sigo'} aria-hidden={view!=='horarios-sigo'}>
      <CategorySigoHistory branchScope={{branch:scope.branch,force:scope.force,editorRole:me?.role??'',editorName:me?.full_name??''}} month={month} onMonthChange={setMonth}/>
    </div>}
    {visitedCategories&&<div hidden={view==='horarios-sigo'} aria-hidden={view==='horarios-sigo'}>
      {busy&&loadedMonth!==month&&<CategoryV2ContentSkeleton variant="categories"/>}
      {error&&<div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      <div hidden={loadedMonth!==month||Boolean(error)}>
       <CategoryUnifiedOverview rows={rows} projections={snapshot.projections} month={month} availableMonths={snapshot.months} loadingMonth={busy} mode={view==='detalle-categorias'?'detail':'cards'}
        branchScope={scope.key} scopedDaily={snapshot.daily} scopedPersonnel={snapshot.personnel} scopedMetrics={snapshot.metrics} scopedGates={snapshot.gates}/>
      </div>
    </div>}
    <div className="hidden">{children}</div>
   </div>
  </main>
 </RequireAuth>;
}
