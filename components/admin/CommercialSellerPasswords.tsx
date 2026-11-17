'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {Copy,Shuffle,Users} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {RedcomSearchableSelect} from '@/components/ui/redcom-select';
import CommercialPersonnelDataTable from '@/components/admin/CommercialPersonnelDataTable';
import {notify,errorMessage} from '@/lib/notifications';
import type {PersonnelTableSnapshot} from '@/lib/commercialPersonnelMaster';
import {
 listSellerAccounts,listSellerLinks,linkSellerAccount,unlinkSellerAccount,
 randomSecurePassword,updateAuthPassword,sellerFromWorksheet,sellerKey,
 type SellerIdentity,type VendorAccount,
} from '@/lib/commercialPersonnelPasswords';

type Link={branch:string;person_code:number;person_name:string;auth_user_id:string;linked_at:string};
type Credential={seller:SellerIdentity;email:string;password:string};
type Failed={seller:SellerIdentity;error:string};

export default function CommercialSellerPasswords({snapshot,loading}:{snapshot:PersonnelTableSnapshot|null;loading:boolean}){
 const [links,setLinks]=useState<Link[]>([]);
 const [accounts,setAccounts]=useState<VendorAccount[]>([]);
 const [accountsLoading,setAccountsLoading]=useState(true);
 const [linkTarget,setLinkTarget]=useState<SellerIdentity|null>(null);
 const [selectedAccount,setSelectedAccount]=useState('');
 const [manualTarget,setManualTarget]=useState<SellerIdentity|null>(null);
 const [password,setPassword]=useState('');
 const [repeat,setRepeat]=useState('');
 const [randomTarget,setRandomTarget]=useState<SellerIdentity|null>(null);
 const [bulkConfirm,setBulkConfirm]=useState(false);
 const [busy,setBusy]=useState(false);
 const [progress,setProgress]=useState({done:0,total:0});
 const [credentials,setCredentials]=useState<Credential[]>([]);
 const [failures,setFailures]=useState<Failed[]>([]);
 const [showResults,setShowResults]=useState(false);
 const [loadError,setLoadError]=useState<string|null>(null);
 const [discardManual,setDiscardManual]=useState(false);
 const [discardLink,setDiscardLink]=useState(false);
 const [discardResults,setDiscardResults]=useState(false);
 const [copied,setCopied]=useState(false);

 const load=useCallback(async()=>{
  try{
   const [allLinks,allAccounts]=await Promise.all([listSellerLinks(),listSellerAccounts()]);
   setLinks(allLinks);setAccounts(allAccounts);setLoadError(null);
  }catch(error){setLoadError(errorMessage(error,'No se pudieron cargar las vinculaciones de vendedores. Revisá la migración SQL.'));}
  finally{setAccountsLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  if(!busy)return;
  const block=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',block);
  return()=>window.removeEventListener('beforeunload',block);
 },[busy]);
 const sellers=useMemo(()=>snapshot?.rows.map(row=>sellerFromWorksheet(snapshot.columns,row))
  .filter((seller):seller is NonNullable<typeof seller>=>Boolean(seller)&&seller?.role==='VENDEDOR')??[],[snapshot]);
 const sellerByKey=useMemo(()=>new Map(sellers.map(s=>[sellerKey(s),s])),[sellers]);
 const activeLinks=useMemo(()=>new Map(links.filter(link=>{
  const s=sellerByKey.get(sellerKey({branch:link.branch,code:link.person_code}));
  return s?.name===link.person_name && accounts.some(a=>a.id===link.auth_user_id&&a.is_active);
 }).map(link=>[sellerKey({branch:link.branch,code:link.person_code}),link])),[links,sellerByKey,accounts]);
 const linkedSellers=sellers.filter(s=>activeLinks.has(sellerKey(s)));
 const unlinkedCount=sellers.length-linkedSellers.length;
 const eligibleAccounts=accounts.filter(account=>!links.some(link=>link.auth_user_id===account.id&&(!linkTarget||sellerKey({branch:link.branch,code:link.person_code})!==sellerKey(linkTarget))));
 const currentAccount=(seller:SellerIdentity)=>accounts.find(account=>account.id===activeLinks.get(sellerKey(seller))?.auth_user_id);
 const beginLink=(seller:SellerIdentity)=>{setLinkTarget(seller);setSelectedAccount(activeLinks.get(sellerKey(seller))?.auth_user_id??'');};
 const changeLink=async()=>{
  if(!linkTarget||!selectedAccount||busy)return;
  try{setBusy(true);await linkSellerAccount(linkTarget,selectedAccount);await load();setLinkTarget(null);notify.success('Cuenta vinculada al vendedor.');}
  catch(error){notify.error(errorMessage(error,'No se pudo vincular la cuenta.'));}
  finally{setBusy(false);}
 };
 const unlink=async()=>{
  if(!linkTarget||busy)return;
  try{setBusy(true);await unlinkSellerAccount(linkTarget);await load();setLinkTarget(null);notify.success('Vinculación eliminada.');}
  catch(error){notify.error(errorMessage(error,'No se pudo desvincular la cuenta.'));}
  finally{setBusy(false);}
 };
 const manual=async()=>{
  if(!manualTarget||busy)return;
  if(password!==repeat){notify.error('Las contraseñas no coinciden.');return;}
  const account=currentAccount(manualTarget);
  if(!account){notify.error('Primero vinculá una cuenta de vendedor.');return;}
  try{setBusy(true);await updateAuthPassword(manualTarget,account.id,password);
   setManualTarget(null);setPassword('');setRepeat('');notify.success('Contraseña actualizada en Supabase Auth.');
  }catch(error){notify.error(errorMessage(error,'No se pudo actualizar la contraseña.'));}
  finally{setBusy(false);}
 };
 const changeRandom=async()=>{
  if(!randomTarget||busy)return;
  const seller=randomTarget,account=currentAccount(seller);
  if(!account){notify.error('La cuenta ya no está vinculada.');return;}
  try{setBusy(true);
   const newPassword=randomSecurePassword();
   await updateAuthPassword(seller,account.id,newPassword);
   setCredentials([{seller,email:account.email??'',password:newPassword}]);setFailures([]);
   setCopied(false);setRandomTarget(null);setShowResults(true);
  }catch(error){notify.error(errorMessage(error,'No se pudo generar la contraseña.'));}
  finally{setBusy(false);}
 };
 const bulk=async()=>{
  if(busy||!linkedSellers.length)return;
  setBulkConfirm(false);setBusy(true);setProgress({done:0,total:linkedSellers.length});
  const done:Credential[]=[],failed:Failed[]=[];
  for(const [index,seller] of linkedSellers.entries()){
   const account=currentAccount(seller);
   if(!account){failed.push({seller,error:'Cuenta no disponible'});setProgress({done:index+1,total:linkedSellers.length});continue;}
   try{
    const newPassword=randomSecurePassword();
    await updateAuthPassword(account.id,newPassword);
    done.push({seller,email:account.email??'',password:newPassword});
   }catch(error){failed.push({seller,error:errorMessage(error,'No se pudo cambiar la contraseña.')});}
   setCredentials([...done]);setFailures([...failed]);setProgress({done:index+1,total:linkedSellers.length});
  }
  setCopied(false);setBusy(false);setProgress({done:0,total:0});setShowResults(true);
  notify.info('Proceso finalizado. Revisá los resultados antes de cerrar.');
 };
 const report=credentials.map(x=>[x.seller.branch,x.seller.code,x.seller.name,x.email,x.password].join('\t')).join('\n');
 const copy=async()=>{
  try{await navigator.clipboard.writeText('Sucursal\tCódigo\tNombre\tCorreo\tContraseña\n'+report);setCopied(true);notify.success('Credenciales copiadas. Guardalas en un lugar seguro.');}
  catch{notify.error('No se pudieron copiar las credenciales.');}
 };
 return <>
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
   <div className="min-w-0">
    <h2 className="flex items-center gap-2 text-sm font-medium text-slate-900"><Users className="h-4 w-4"/>Contraseñas de vendedores</h2>
    <p className="mt-1 text-xs text-slate-500">{accountsLoading?'Cargando cuentas…':sellers.length+' vendedores · '+linkedSellers.length+' cuentas vinculadas · '+unlinkedCount+' pendientes'}</p>
    <p className="mt-1 text-[11px] text-slate-500">Las contraseñas se actualizan en Supabase Auth. No se guardan en el Excel ni se envían por correo.</p>
   </div>
   <button type="button" disabled={busy||accountsLoading||!linkedSellers.length||!!loadError} onClick={()=>setBulkConfirm(true)}
    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
    <Shuffle className="h-4 w-4"/>Generar claves para vinculados ({linkedSellers.length})
   </button>
   {loadError&&<p role="alert" className="w-full text-xs text-rose-600">{loadError}</p>}
   {busy&&progress.total>0&&<p role="status" className="w-full text-xs text-slate-600">Actualizando contraseñas: {progress.done}/{progress.total}. No cierres esta página.</p>}
  </div>
  <CommercialPersonnelDataTable snapshot={snapshot} loading={loading||accountsLoading}
   linkedAccountKeys={new Set(activeLinks.keys())}
   onSellerAction={(seller,action)=>{
    if(action==='link')beginLink(seller);
    if(action==='manual'){setPassword('');setRepeat('');setManualTarget(seller);}
    if(action==='random')setRandomTarget(seller);
   }}/>
  <Dialog open={!!linkTarget} onOpenChange={open=>{if(!open&&!busy){
   const current=linkTarget?activeLinks.get(sellerKey(linkTarget))?.auth_user_id??'':'';
   if(selectedAccount!==current)setDiscardLink(true);else setLinkTarget(null);
  }}}>
   <DialogContent className="rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none motion-reduce:transition-none">
    <DialogHeader><DialogTitle>Vincular cuenta de RedcomWeb</DialogTitle><DialogDescription>{linkTarget?.name} · Código {linkTarget?.code} · {linkTarget?.branch}</DialogDescription></DialogHeader>
    <p className="text-xs text-slate-500">Seleccioná la cuenta existente que corresponde a este vendedor. La coincidencia se confirma manualmente para evitar cambios en cuentas equivocadas.</p>
    <RedcomSearchableSelect accent="neutral" value={selectedAccount} onValueChange={setSelectedAccount} aria-label="Cuenta del vendedor" placeholder="Buscar usuario o correo" options={eligibleAccounts.map(a=>({value:a.id,label:(a.full_name??a.email??a.id)+(a.email?' · '+a.email:'')}))}/>
    <DialogFooter>
     {linkTarget&&activeLinks.has(sellerKey(linkTarget))&&<button type="button" disabled={busy} onClick={()=>void unlink()} className="rounded-lg border border-rose-200 px-3 py-2 text-xs text-rose-700">Desvincular</button>}
     <button type="button" disabled={busy||!selectedAccount} onClick={()=>void changeLink()} className="rounded-lg bg-slate-900 px-4 py-2 text-xs text-white disabled:opacity-40">{busy?'Guardando…':'Guardar vínculo'}</button>
    </DialogFooter>
   </DialogContent>
  </Dialog>
  <Dialog open={!!manualTarget} onOpenChange={open=>{if(!open&&!busy){
    if(password||repeat)setDiscardManual(true);
    else setManualTarget(null);
   }}}>
   <DialogContent className="rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none motion-reduce:transition-none">
    <DialogHeader><DialogTitle>Establecer contraseña</DialogTitle><DialogDescription>{manualTarget?.name} · {currentAccount(manualTarget??{branch:'',code:0,name:''})?.email??'Cuenta vinculada'}</DialogDescription></DialogHeader>
    <label className="space-y-1 text-xs text-slate-700"><span>Nueva contraseña</span><input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy} className="h-10 w-full rounded-lg border border-slate-200 px-3"/></label>
    <label className="space-y-1 text-xs text-slate-700"><span>Confirmar contraseña</span><input type="password" autoComplete="new-password" value={repeat} onChange={e=>setRepeat(e.target.value)} disabled={busy} className="h-10 w-full rounded-lg border border-slate-200 px-3"/></label>
    <p className="text-[11px] text-slate-500">12 a 128 caracteres con mayúscula, minúscula, número y símbolo. El cambio afecta la cuenta existente.</p>
    <DialogFooter><button type="button" disabled={busy||!password||!repeat} onClick={()=>void manual()} className="rounded-lg bg-slate-900 px-4 py-2 text-xs text-white disabled:opacity-40">{busy?'Guardando…':'Actualizar contraseña'}</button></DialogFooter>
   </DialogContent>
  </Dialog>
  <AlertDialog open={!!randomTarget} onOpenChange={open=>{if(!open&&!busy)setRandomTarget(null);}}>
   <AlertDialogContent className="rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none motion-reduce:transition-none">
    <AlertDialogHeader><AlertDialogTitle>Generar una nueva contraseña</AlertDialogTitle><AlertDialogDescription>Se reemplazará la contraseña de {randomTarget?.name}. El valor nuevo se mostrará una sola vez y no se enviará por correo.</AlertDialogDescription></AlertDialogHeader>
    <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e=>{e.preventDefault();void changeRandom();}}>Confirmar</AlertDialogAction></AlertDialogFooter>
   </AlertDialogContent>
  </AlertDialog>
  <AlertDialog open={bulkConfirm} onOpenChange={open=>{if(!busy)setBulkConfirm(open);}}>
   <AlertDialogContent className="rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none motion-reduce:transition-none">
    <AlertDialogHeader><AlertDialogTitle>Actualizar contraseñas en lote</AlertDialogTitle><AlertDialogDescription>Se reemplazarán las contraseñas de {linkedSellers.length} cuentas de vendedor vinculadas. {unlinkedCount} registros sin cuenta vinculada quedarán pendientes. Las claves aparecerán una sola vez; guardalas de forma segura antes de cerrar.</AlertDialogDescription></AlertDialogHeader>
    <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e=>{e.preventDefault();void bulk();}}>Generar contraseñas</AlertDialogAction></AlertDialogFooter>
   </AlertDialogContent>
  </AlertDialog>
  <Dialog open={showResults} onOpenChange={open=>{if(!open&&!busy){
   if(credentials.length&&!copied)setDiscardResults(true);
   else{setShowResults(false);setCredentials([]);setFailures([]);setCopied(false);}
  }}}>
   <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none motion-reduce:transition-none">
    <DialogHeader><DialogTitle>Contraseñas generadas</DialogTitle><DialogDescription>{credentials.length} actualizadas · {failures.length} errores. Copiá estos datos antes de cerrar: no se almacenan en esta página.</DialogDescription></DialogHeader>
    {credentials.length>0&&<button type="button" onClick={()=>void copy()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium hover:bg-slate-50"><Copy className="h-4 w-4"/>Copiar credenciales</button>}
    <div className="max-h-64 space-y-2 overflow-y-auto">{credentials.map(x=><div key={sellerKey(x.seller)} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span>{x.seller.name} · {x.seller.code}</span><code className="break-all font-mono">{x.password}</code></div>)}</div>
    {failures.map(x=><p key={sellerKey(x.seller)} className="text-xs text-rose-600">{x.seller.name}: {x.error}</p>)}
    <p className="text-[11px] text-amber-700">Compartí cada clave de manera privada. Evitá dejarlas en archivos públicos, chats grupales o repositorios.</p>
   </DialogContent>
  </Dialog>

  <AlertDialog open={discardManual} onOpenChange={setDiscardManual}>
   <AlertDialogContent className="rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none motion-reduce:transition-none"><AlertDialogHeader><AlertDialogTitle>Descartar contraseña sin guardar</AlertDialogTitle><AlertDialogDescription>Se perderán los cambios introducidos en el formulario.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Seguir editando</AlertDialogCancel><AlertDialogAction onClick={()=>{setPassword('');setRepeat('');setManualTarget(null);setDiscardManual(false);}}>Salir sin guardar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
  </AlertDialog>
  <AlertDialog open={discardLink} onOpenChange={setDiscardLink}>
   <AlertDialogContent className="rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none motion-reduce:transition-none"><AlertDialogHeader><AlertDialogTitle>Descartar vínculo sin guardar</AlertDialogTitle><AlertDialogDescription>La selección de cuenta no se guardará.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Seguir editando</AlertDialogCancel><AlertDialogAction onClick={()=>{setLinkTarget(null);setSelectedAccount('');setDiscardLink(false);}}>Salir sin guardar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
  </AlertDialog>
  <AlertDialog open={discardResults} onOpenChange={setDiscardResults}>
   <AlertDialogContent className="rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none motion-reduce:transition-none"><AlertDialogHeader><AlertDialogTitle>Cerrar sin copiar contraseñas</AlertDialogTitle><AlertDialogDescription>Las claves generadas no se almacenan. Si cerrás sin copiarlas, no podrás recuperarlas y será necesario regenerarlas.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Seguir viendo</AlertDialogCancel><AlertDialogAction onClick={()=>{setShowResults(false);setCredentials([]);setFailures([]);setCopied(false);setDiscardResults(false);}}>Cerrar y descartar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
  </AlertDialog>
 </>;
}
