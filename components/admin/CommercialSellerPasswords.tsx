import {format} from 'date-fns';
'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {Copy,Shuffle,Users,KeyRound} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import CommercialPersonnelDataTable from '@/components/admin/CommercialPersonnelDataTable';
import {RedcomDatePicker} from '@/components/ui/redcom-date-picker';
import {notify,errorMessage} from '@/lib/notifications';
import type {PersonnelTableSnapshot} from '@/lib/commercialPersonnelMaster';
import type {PersonnelImportChange} from '@/lib/commercialPersonnelDiff';
import {listCommercialVendorAccess,setCommercialVendorHireDate,assignCommercialVendorPassword,randomSecurePassword,validateManualPassword,sellerFromWorksheet,sellerKey,type SellerIdentity,type CommercialVendorAccess} from '@/lib/commercialVendorAccess';

type Credential={seller:SellerIdentity;password:string};
type Failed={seller:SellerIdentity;error:string};

export default function CommercialSellerPasswords({snapshot,loading,importChanges}:{snapshot:PersonnelTableSnapshot|null;loading:boolean;importChanges:PersonnelImportChange[]}){
 const [accounts,setAccounts]=useState<CommercialVendorAccess[]>([]);
 const [accountsLoading,setAccountsLoading]=useState(true);
 const [loadError,setLoadError]=useState<string|null>(null);
 const [manualTarget,setManualTarget]=useState<SellerIdentity|null>(null);
 const [manualPassword,setManualPassword]=useState('');
 const [manualRepeat,setManualRepeat]=useState('');
 const [randomTarget,setRandomTarget]=useState<SellerIdentity|null>(null);
 const [hireTarget,setHireTarget]=useState<SellerIdentity|null>(null);
 const [hireDate,setHireDate]=useState('');
 const [initialHireDate,setInitialHireDate]=useState('');
 const [discardHire,setDiscardHire]=useState(false);
 const [bulkConfirm,setBulkConfirm]=useState(false);
 const [bulkScope,setBulkScope]=useState<'pending'|'all'>('pending');
 const [rotationTarget,setRotationTarget]=useState<SellerIdentity|null>(null);
 const [rotationChoice,setRotationChoice]=useState(false);
 const [busy,setBusy]=useState(false);
 const [progress,setProgress]=useState({done:0,total:0});
 const [credentials,setCredentials]=useState<Credential[]>([]);
 const [failures,setFailures]=useState<Failed[]>([]);
 const [showResults,setShowResults]=useState(false);
 const [copied,setCopied]=useState(false);
 const [discardManual,setDiscardManual]=useState(false);
 const [discardResults,setDiscardResults]=useState(false);

 const load=useCallback(async()=>{
  try{setAccounts(await listCommercialVendorAccess());setLoadError(null);}
  catch(e){setLoadError(errorMessage(e,'No se pudieron consultar los accesos comerciales.'));}
  finally{setAccountsLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  if(!busy&&!((manualTarget!==null)&&(manualPassword!==''||manualRepeat!==''))&&!(hireTarget&&hireDate!==initialHireDate))return;
  const onBeforeUnload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
  window.addEventListener('beforeunload',onBeforeUnload);
  return()=>window.removeEventListener('beforeunload',onBeforeUnload);
 },[busy,manualTarget,manualPassword,manualRepeat]);

 const sellers=useMemo(()=>snapshot?.rows
  .map(row=>sellerFromWorksheet(snapshot.columns,row))
  .filter((person):person is NonNullable<typeof person>=>person!==null&&person.role==='VENDEDOR')??[],[snapshot]);
 const accountKeys=useMemo(()=>new Set(accounts
  .filter(a=>sellers.some(s=>sellerKey(s)===sellerKey({branch:a.branch,code:a.person_code})&&s.name===a.person_name&&!a.needs_review))
  .map(a=>sellerKey({branch:a.branch,code:a.person_code}))),[accounts,sellers]);
 const reviewKeys=useMemo(()=>new Set(accounts.filter(a=>a.needs_review).map(a=>sellerKey({branch:a.branch,code:a.person_code}))),[accounts]);
 const hireDates=useMemo(()=>new Map<string,string|null>(accounts.map(a=>[sellerKey({branch:a.branch,code:a.person_code}),a.hire_date] as const)),[accounts]);
 const pendingSellers=sellers.filter(s=>!accounts.some(a=>sellerKey({branch:a.branch,code:a.person_code})===sellerKey(s)));
 const waiting=pendingSellers.length;
 const isRotation=(seller:SellerIdentity)=>rotationTarget!==null&&sellerKey(rotationTarget)===sellerKey(seller);

 const saveHireDate=async()=>{
  if(!hireTarget||busy)return;
  setBusy(true);
  try{
   await setCommercialVendorHireDate(hireTarget,hireDate||null);
   setHireTarget(null);setHireDate('');setInitialHireDate('');
   await load();
   notify.success('Fecha de ingreso actualizada.');
  }catch(error){notify.error(errorMessage(error,'No se pudo guardar la fecha de ingreso.'));}
  finally{setBusy(false);}
 };
 const closeHireDate=()=>{
  if(busy)return;
  if(hireDate!==initialHireDate){setDiscardHire(true);return;}
  setHireTarget(null);setHireDate('');setInitialHireDate('');
 };
 const setManual=async()=>{
  if(!manualTarget||busy)return;
  if(manualPassword!==manualRepeat){notify.error('Las contraseñas no coinciden.');return;}
  try{
   validateManualPassword(manualPassword);
   setBusy(true);
   await assignCommercialVendorPassword(manualTarget,manualPassword,{rotateHolder:isRotation(manualTarget)});
   setManualTarget(null);setRotationTarget(null);setManualPassword('');setManualRepeat('');
   await load();
   notify.success('Acceso comercial preparado. Ya puede iniciar sesión con su clave.');
  }catch(e){notify.error(errorMessage(e,'No se pudo guardar la contraseña.'));}
  finally{setBusy(false);}
 };
 const randomOne=async()=>{
  if(!randomTarget||busy)return;
  const seller=randomTarget;
  try{
   setBusy(true);
   const password=randomSecurePassword();
   await assignCommercialVendorPassword(seller,password,{rotateHolder:isRotation(seller)});
   setCredentials([{seller,password}]);setFailures([]);setCopied(false);
   setRandomTarget(null);setRotationTarget(null);setShowResults(true);await load();
  }catch(e){notify.error(errorMessage(e,'No se pudo asignar la contraseña.'));}
  finally{setBusy(false);}
 };
 const bulk=async()=>{
  const targets=bulkScope==='pending'?pendingSellers:sellers.filter(s=>!reviewKeys.has(sellerKey(s)));
  if(busy||targets.length===0)return;
  setBulkConfirm(false);setBusy(true);setProgress({done:0,total:targets.length});
  const done:Credential[]=[],failed:Failed[]=[];
  for(const [index,seller] of targets.entries()){
   try{
    const password=randomSecurePassword();
    await assignCommercialVendorPassword(seller,password);
    done.push({seller,password});
   }catch(e){failed.push({seller,error:errorMessage(e,'No se pudo asignar la contraseña.')});}
   setProgress({done:index+1,total:targets.length});
  }
  setCredentials(done);setFailures(failed);setCopied(false);
  setBusy(false);setProgress({done:0,total:0});setShowResults(true);
  await load();
 };
 const copy=async()=>{
  const tsv=['Sucursal\tCódigo\tNombre\tContraseña',...credentials.map(c=>
   [c.seller.branch,String(c.seller.code).padStart(2,'0'),c.seller.name,c.password].join('\t'))].join('\n');
  try{await navigator.clipboard.writeText(tsv);setCopied(true);notify.success('Contraseñas copiadas. Compartilas únicamente por un canal seguro.');}
  catch{notify.error('No se pudo copiar el listado.');}
 };
 const closeResults=()=>{
  if(credentials.length&&!copied){setDiscardResults(true);return;}
  setShowResults(false);setCredentials([]);setFailures([]);setCopied(false);
 };
 return <>
  <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
   <div>
    <h2 className="flex items-center gap-2 text-sm font-medium text-slate-900"><Users className="h-4 w-4"/>Accesos del personal vendedor</h2>
    <p className="mt-1 text-xs text-slate-500">{accountsLoading?'Consultando…':sellers.length+' vendedores · '+accountKeys.size+' con clave · '+waiting+' sin acceso · '+reviewKeys.size+' por revisar'}</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <button type="button" disabled={busy||accountsLoading||loading||waiting===0||!!loadError} onClick={()=>{setBulkScope('pending');setBulkConfirm(true);}}
     className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors duration-200 hover:bg-slate-800 disabled:opacity-40">
     <Shuffle className="h-4 w-4"/>Generar solo para pendientes ({waiting})
    </button>
    <button type="button" disabled={busy||accountsLoading||loading||sellers.length===0||!!loadError} onClick={()=>{setBulkScope('all');setBulkConfirm(true);}}
     className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-40">Regenerar todas las claves</button>
   </div>
   {loadError&&<p role="alert" className="w-full text-xs text-rose-600">{loadError}</p>}
   {busy&&progress.total>0&&<p role="status" className="w-full text-xs text-slate-600">Generando accesos: {progress.done} de {progress.total}. No cierres esta página.</p>}
  </section>

  <CommercialPersonnelDataTable snapshot={snapshot} loading={loading||accountsLoading}
   linkedAccountKeys={accountKeys} reviewAccountKeys={reviewKeys} importChanges={importChanges} hireDates={hireDates}
   onSellerAction={(seller,action)=>{
    if(busy)return;
    if(action==='review'){setRotationTarget(seller);setRotationChoice(true);return;}
    if(action==='hire-date'){
      const initial=hireDates.get(sellerKey(seller))??'';
      setHireTarget(seller);setHireDate(initial);setInitialHireDate(initial);return;
    }
    if(action==='manual'){setManualTarget(seller);setManualPassword('');setManualRepeat('');}
    else setRandomTarget(seller);
   }}/>

  <Dialog open={!!manualTarget} onOpenChange={open=>{if(!open&&!busy){
   if(manualPassword||manualRepeat)setDiscardManual(true);
   else{setManualTarget(null);setRotationTarget(null);}
  }}}>
   <DialogContent className="rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none">
    <DialogHeader><DialogTitle>Establecer contraseña</DialogTitle>
     <DialogDescription>{manualTarget?.name} · Código {manualTarget?.code} · {manualTarget?.branch}</DialogDescription></DialogHeader>
    <p className="text-xs text-slate-500">{manualTarget&&isRotation(manualTarget)?'Se mantendrá la misma cuenta del código comercial, pero se cambiarán el nombre y la contraseña para el nuevo titular. Las sesiones anteriores se cerrarán.':'Este acceso es independiente de los usuarios del CRUD. Si aún no existe, se crea exclusivamente para el padrón comercial.'}</p>
    <label className="space-y-1 text-xs text-slate-700"><span>Contraseña</span><input type="password" autoComplete="new-password" value={manualPassword} onChange={e=>setManualPassword(e.target.value)} disabled={busy} className="h-10 w-full rounded-xl border border-slate-200 px-3"/></label>
    <label className="space-y-1 text-xs text-slate-700"><span>Repetir contraseña</span><input type="password" autoComplete="new-password" value={manualRepeat} onChange={e=>setManualRepeat(e.target.value)} disabled={busy} className="h-10 w-full rounded-xl border border-slate-200 px-3"/></label>
    <p className="text-[11px] text-slate-500">12–128 caracteres, con mayúsculas, minúsculas, número y símbolo.</p>
    <DialogFooter><button type="button" disabled={busy||!manualPassword||!manualRepeat} onClick={()=>void setManual()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs text-white disabled:opacity-40"><KeyRound className="h-4 w-4"/>{busy?'Guardando…':'Guardar contraseña'}</button></DialogFooter>
   </DialogContent>
  </Dialog>
  <Dialog open={!!hireTarget} onOpenChange={open=>{if(!open)closeHireDate();}}>
   <DialogContent className="max-w-md rounded-2xl bg-white">
    <DialogHeader><DialogTitle>Fecha de ingreso</DialogTitle>
     <DialogDescription>{hireTarget?String(hireTarget.code).padStart(2,'0')+' '+hireTarget.name:''} · Titular actual</DialogDescription>
    </DialogHeader>
    <div className="space-y-2">
     <label className="block text-sm font-medium text-slate-700">Ingreso a la empresa</label>
     <RedcomDatePicker value={hireDate} onChange={setHireDate} maxDate={format(new Date(),'yyyy-MM-dd')} minDate="1900-01-01" yearSelection clearable disabled={busy} aria-label="Fecha de ingreso del vendedor" className="rounded-xl"/>
     <p className="text-xs text-slate-500">Al rotar el titular del código, esta fecha se borrará automáticamente.</p>
    </div>
    <DialogFooter>
     <button type="button" disabled={busy} onClick={closeHireDate} className="h-10 rounded-xl border border-slate-200 px-4 text-sm text-slate-700 transition-colors duration-200 hover:bg-slate-50">Cancelar</button>
     <button type="button" disabled={busy||hireDate===initialHireDate} onClick={()=>void saveHireDate()} className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-slate-800 disabled:opacity-40">{busy?'Guardando…':'Guardar fecha'}</button>
    </DialogFooter>
   </DialogContent>
  </Dialog>
  <AlertDialog open={discardHire} onOpenChange={setDiscardHire}>
   <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cambios sin guardar</AlertDialogTitle><AlertDialogDescription>La fecha elegida no se guardará.</AlertDialogDescription></AlertDialogHeader>
    <AlertDialogFooter><AlertDialogCancel>Seguir editando</AlertDialogCancel><AlertDialogAction onClick={()=>{setDiscardHire(false);setHireTarget(null);setHireDate('');setInitialHireDate('');}}>Salir sin guardar</AlertDialogAction></AlertDialogFooter>
   </AlertDialogContent>
  </AlertDialog>
  <AlertDialog open={!!randomTarget} onOpenChange={open=>{if(!open&&!busy){setRandomTarget(null);setRotationTarget(null);}}}>
   <AlertDialogContent className="rounded-2xl bg-white"><AlertDialogHeader><AlertDialogTitle>Generar contraseña aleatoria</AlertDialogTitle><AlertDialogDescription>{randomTarget&&isRotation(randomTarget)?'El código comercial seguirá teniendo una sola cuenta. Se actualizará el nombre y se reemplazará obligatoriamente la contraseña del titular anterior.':'Se creará o actualizará la contraseña comercial de '+randomTarget?.name+'.'} La clave se mostrará una sola vez.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e=>{e.preventDefault();void randomOne();}}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
  </AlertDialog>
  <AlertDialog open={bulkConfirm} onOpenChange={open=>{if(!busy)setBulkConfirm(open);}}>
   <AlertDialogContent className="rounded-2xl bg-white"><AlertDialogHeader><AlertDialogTitle>{bulkScope==='pending'?'Crear accesos pendientes':'Regenerar contraseñas existentes'}</AlertDialogTitle><AlertDialogDescription>{bulkScope==='pending'?'Se crearán claves únicamente para '+waiting+' vendedores sin acceso. No se modificarán las contraseñas existentes.':'Esta acción REEMPLAZARÁ las contraseñas existentes, incluidas las que cambiaron los vendedores desde Perfil. Se excluyen las identidades pendientes de revisión.'} Copiá los resultados antes de cerrar.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e=>{e.preventDefault();void bulk();}}>{bulkScope==='pending'?'Crear pendientes':'Reemplazar contraseñas'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
  </AlertDialog>
  <AlertDialog open={rotationChoice} onOpenChange={open=>{if(!open&&!busy){setRotationChoice(false);setRotationTarget(null);}}}>
   <AlertDialogContent className="rounded-2xl bg-white">
    <AlertDialogHeader>
     <AlertDialogTitle>Rotar el titular del código comercial</AlertDialogTitle>
     <AlertDialogDescription>
      El código {rotationTarget?.code} de {rotationTarget?.branch} seguirá siendo la misma cuenta técnica.
      El nombre se actualizará según DetallePersonal y es obligatorio establecer una contraseña nueva.
      Se revocarán las sesiones persistentes del anterior titular.
     </AlertDialogDescription>
    </AlertDialogHeader>
    {rotationTarget&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
     <div>Anterior: {accounts.find(a=>sellerKey({branch:a.branch,code:a.person_code})===sellerKey(rotationTarget))?.person_name??'Sin registro'}</div>
     <div>Actual: {rotationTarget.name}</div>
    </div>}
    <AlertDialogFooter>
     <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
     <button type="button" disabled={busy||!rotationTarget} onClick={()=>{setManualTarget(rotationTarget);setManualPassword('');setManualRepeat('');setRotationChoice(false);}} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 transition-colors duration-200 hover:bg-slate-50">Clave manual</button>
     <AlertDialogAction disabled={busy||!rotationTarget} onClick={e=>{e.preventDefault();setRandomTarget(rotationTarget);setRotationChoice(false);}}>Generar aleatoria</AlertDialogAction>
    </AlertDialogFooter>
   </AlertDialogContent>
  </AlertDialog>
  <Dialog open={showResults} onOpenChange={open=>{if(!open&&!busy)closeResults();}}>
   <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl bg-white motion-reduce:animate-none">
    <DialogHeader><DialogTitle>Contraseñas generadas</DialogTitle><DialogDescription>{credentials.length} accesos preparados · {failures.length} fallidos. Las claves se muestran una sola vez.</DialogDescription></DialogHeader>
    {!!credentials.length&&<button type="button" onClick={()=>void copy()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium hover:bg-slate-50"><Copy className="h-4 w-4"/>Copiar listado</button>}
    <div className="max-h-64 space-y-2 overflow-y-auto">{credentials.map(c=><div key={sellerKey(c.seller)} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span>{String(c.seller.code).padStart(2,'0')} {c.seller.name}</span><code className="break-all">{c.password}</code></div>)}</div>
    {failures.map(f=><p key={sellerKey(f.seller)} className="text-xs text-rose-600">{f.seller.name}: {f.error}</p>)}
    <p className="text-xs text-amber-700">No publiques ni compartas este listado en un repositorio o un chat grupal.</p>
   </DialogContent>
  </Dialog>
  <AlertDialog open={discardManual} onOpenChange={setDiscardManual}>
   <AlertDialogContent className="rounded-2xl bg-white"><AlertDialogHeader><AlertDialogTitle>Cambios sin guardar</AlertDialogTitle><AlertDialogDescription>La contraseña introducida se perderá.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Seguir editando</AlertDialogCancel><AlertDialogAction onClick={()=>{setManualTarget(null);setRotationTarget(null);setManualPassword('');setManualRepeat('');setDiscardManual(false);}}>Salir sin guardar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
  </AlertDialog>
  <AlertDialog open={discardResults} onOpenChange={setDiscardResults}>
   <AlertDialogContent className="rounded-2xl bg-white"><AlertDialogHeader><AlertDialogTitle>Descartar contraseñas generadas</AlertDialogTitle><AlertDialogDescription>Las claves no se guardan en el sistema. Si cerrás sin copiarlas, tendrás que generarlas nuevamente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Seguir viendo</AlertDialogCancel><AlertDialogAction onClick={()=>{setShowResults(false);setCredentials([]);setFailures([]);setCopied(false);setDiscardResults(false);}}>Cerrar sin copiar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
  </AlertDialog>
 </>;
}
