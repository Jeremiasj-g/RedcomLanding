'use client';

import Link from 'next/link';
import {useEffect,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {CheckCircle2,Clock3,Layers3,LockKeyhole} from 'lucide-react';
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
import {getCategoryV2ClosureResults,countCategoryV2ElapsedDays} from '@/lib/categoryV2Closure';
import {fetchMonthlyConsiderations,type MonthlyConsideration} from '@/lib/categoryMonthlyConsiderations';
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle} from '@/components/ui/alert-dialog';

type Scope={key:string;userBranch:string;branch:string;force:string;label:string;basePath:string};
type Daily={visit_date:string;branch:string;sales_force:string;seller_id:number|null;seller_name:string;first_visit:string|null;last_visit:string|null;corrected_start:string|null;corrected_end:string|null;reason:string|null};
type Person={id:number;name:string;branch:string;role:string;superior:string;force:string};
type Snapshot={percentTolerance:number;months:string[];rows:Record<string,unknown>[];projections:KpiProjection[];daily:Daily[];personnel:Person[];metrics:CategoryScaleMetric[];gates:CategoryScaleGate[];considerations:MonthlyConsideration[]};
const EMPTY:Snapshot={percentTolerance:1,months:[],rows:[],projections:[],daily:[],personnel:[],metrics:[],gates:[],considerations:[]};
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
 const [closure,setClosure]=useState<{revision:number;confirmed_at:string}|null>(null);
 const [closureLoading,setClosureLoading]=useState(false);
 const [confirmationOpen,setConfirmationOpen]=useState(false);
 const [reason,setReason]=useState('');
 const [confirming,setConfirming]=useState(false);
 useEffect(()=>{if(view==='horarios-sigo')setVisitedSigo(true);else setVisitedCategories(true);},[view]);
 const ownsBranch=Boolean(me?.is_active&&(me.role==='admin'||me.branches?.includes(scope.userBranch)));
 const canManageSigo=Boolean(ownsBranch&&(me?.role==='admin'||me?.role==='supervisor'||me?.role==='jdv'));
 const canSeeCategories=Boolean(ownsBranch&&(canAccessModule('branch_categories_v2')));
 const canConfirm=Boolean(me?.is_active&&me?.role==='admin');
 useEffect(()=>{
  if(!canConfirm)return;
  let active=true;setClosureLoading(true);setClosure(null);
  void Promise.resolve(supabase.from('category_v2_confirmed_closures').select('revision,confirmed_at')
   .eq('branch_key',scope.key).eq('month',month).order('revision',{ascending:false}).limit(1))
   .then(({data,error})=>{if(error)throw error;if(active)setClosure(data?.[0]??null);})
   .catch(e=>{if(active)notify.error(errorMessage(e,'No se pudo consultar el cierre del mes.'));})
   .finally(()=>{if(active)setClosureLoading(false);});
  return()=>{active=false;};
 },[scope.key,month,canConfirm]);
 const confirmClosure=async()=>{
  if(!canConfirm||confirming||busy||loadedMonth!==month||closureLoading)return;
  if(closure&&reason.trim().length<10){notify.warning('Ingresá un motivo de al menos 10 caracteres para reconfirmar.');return;}
  setConfirming(true);
  try{
   // Reconsultar para confirmar sobre el estado más reciente, no una pestaña cacheada.
   const [{data:latest,error:latestError},{data:excluded,error:excludedError},considerations]=await Promise.all([
    supabase.rpc('branch_category_v2_data',{p_branch_key:scope.key,p_month:month}),
    supabase.from('category_nonworking_days').select('day').gte('day',month+'-01')
     .lt('day',new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString().slice(0,10)),
    fetchMonthlyConsiderations(month,scope.key)
   ]);
   if(latestError)throw latestError;
   if(excludedError)throw excludedError;
   const data=latest as Snapshot|null;
   if(!data)throw new Error('No se pudieron recuperar los datos del mes.');
   const elapsed=countCategoryV2ElapsedDays(month,(excluded??[]).map(item=>item.day));
   const results=getCategoryV2ClosureResults({
    rows:data.rows.map(row=>fromDbRow(row as Parameters<typeof fromDbRow>[0])),
    projections:data.projections,personnel:data.personnel,daily:data.daily,
    metrics:data.metrics,gates:data.gates,considerations,percentTolerance:data.percentTolerance
   },scope.key,scope.branch,scope.force,elapsed);
   const {data:confirmed,error:confirmError}=await supabase.rpc('confirm_category_v2_closure',{
    p_branch_key:scope.key,p_month:month,p_results:results,
    p_expected_revision:closure?.revision??0,p_reason:reason.trim()||null
   });
   if(confirmError)throw confirmError;
   setClosure({revision:Number(confirmed.revision),confirmed_at:String(confirmed.confirmed_at)});
   setConfirmationOpen(false);setReason('');
   notify.success('Cierre de '+month+' confirmado · revisión '+confirmed.revision+'.');
  }catch(e){notify.error(errorMessage(e,'No se pudo confirmar el cierre de categorías.'));}
  finally{setConfirming(false);}
 };
 useEffect(()=>{
  if(authLoading||permissionsLoading||!canSeeCategories)return;
  let active=true;
  setBusy(true);setError('');
  void Promise.all([supabase.rpc('branch_category_v2_data',{p_branch_key:scope.key,p_month:month}),fetchMonthlyConsiderations(month,scope.key)])
   .then(([{data,error},considerations])=>{
     if(!active)return;
     if(error)throw error;
     const result=data as Snapshot|null;
     if(!result)throw new Error('No se recibieron datos de la sucursal.');
     setSnapshot({...result,considerations});
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
     <div className="flex flex-wrap items-center justify-end gap-2">
      <label className="flex items-center gap-2 text-xs text-slate-600">Mes
       <CategoryMonthPicker value={month} onChange={setMonth} minMonth="2026-10" label="Mes de consulta"/>
      </label>
      {canConfirm&&<button type="button" onClick={()=>{setReason('');setConfirmationOpen(true);}}
       disabled={busy||closureLoading||loadedMonth!==month||Boolean(error)||!snapshot.rows.length}
       className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 shadow-sm transition-colors duration-200 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-600 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none">
       {closure?<CheckCircle2 className="h-4 w-4 text-emerald-600"/>:<LockKeyhole className="h-4 w-4"/>}
       {closure?'Reconfirmar cierre':'Confirmar cierre de categorías'}
      </button>}
      {canConfirm&&closure&&<span className="w-full text-right text-[11px] text-slate-500">Confirmado · revisión {closure.revision} · {new Date(closure.confirmed_at).toLocaleDateString('es-AR')}</span>}
     </div>
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
        branchScope={scope.key} scopedDaily={snapshot.daily} scopedPersonnel={snapshot.personnel} scopedMetrics={snapshot.metrics} scopedGates={snapshot.gates} scopedConsiderations={snapshot.considerations} scopedTolerance={snapshot.percentTolerance}/>
      </div>
    </div>}
    <AlertDialog open={confirmationOpen} onOpenChange={open=>{if(!confirming)setConfirmationOpen(open);}}>
     <AlertDialogContent className="max-w-md rounded-2xl border-slate-200 bg-white">
      <AlertDialogHeader>
       <AlertDialogTitle>{closure?'Reconfirmar cierre de categorías':'Confirmar cierre de categorías'}</AlertDialogTitle>
       <AlertDialogDescription>
        {closure?`Se guardará una revisión ${closure.revision+1} para ${month}. La revisión anterior seguirá disponible en el histórico.`:`Se guardará una fotografía independiente de ${month}, con los KPI, horarios, escalas y categorías confirmadas de esta sucursal.`}
       </AlertDialogDescription>
      </AlertDialogHeader>
      {closure&&<div className="space-y-2">
       <label htmlFor="category-closure-reason" className="text-xs font-medium text-slate-700">Motivo de la corrección</label>
       <textarea id="category-closure-reason" value={reason} onChange={event=>setReason(event.target.value)} maxLength={500} rows={3}
        placeholder="Ej.: Se corrigieron los KPI del vendedor 3 del mes seleccionado"
        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus-visible:ring-2 focus-visible:ring-slate-100"/>
       <p className="text-[11px] text-slate-500">La corrección conserva la versión anterior y registra quién realizó el cierre.</p>
      </div>}
      <AlertDialogFooter>
       <AlertDialogCancel disabled={confirming}>Cancelar</AlertDialogCancel>
       <AlertDialogAction disabled={confirming||Boolean(closure&&reason.trim().length<10)}
        onClick={event=>{event.preventDefault();void confirmClosure();}}
        className="bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40">
        {confirming?'Confirmando…':closure?'Guardar nueva revisión':'Confirmar cierre'}
       </AlertDialogAction>
      </AlertDialogFooter>
     </AlertDialogContent>
    </AlertDialog>
    <div className="hidden">{children}</div>
   </div>
  </main>
 </RequireAuth>;
}
