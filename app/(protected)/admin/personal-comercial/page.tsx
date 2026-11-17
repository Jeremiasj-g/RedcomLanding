'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {compareCommercialPersonnel,type PersonnelImportChange} from '@/lib/commercialPersonnelDiff';
import CommercialSellerPasswords from '@/components/admin/CommercialSellerPasswords';
import {FileSpreadsheet,Upload,Download,History,RefreshCw,CheckCircle2} from 'lucide-react';
import {motion,useReducedMotion} from 'framer-motion';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {useMe} from '@/hooks/useMe';
import {notify,errorMessage} from '@/lib/notifications';
import {parseMasterPersonnel,publishMasterPersonnel,getActivePersonnelMeta,getPersonnelVersions,downloadActivePersonnel,activatePersonnelVersion,type CommercialPerson,type PersonnelVersion,getActivePersonnelTable,type PersonnelTableSnapshot,getActivePersonnelPeople,getPersonnelImportChanges} from '@/lib/commercialPersonnelMaster';

export default function MasterPersonnelAdminPage(){
 const {me}=useMe();
 const reduced=useReducedMotion();
 const [meta,setMeta]=useState<Awaited<ReturnType<typeof getActivePersonnelMeta>>>(null);
 const [versions,setVersions]=useState<PersonnelVersion[]>([]);
 const [snapshot,setSnapshot]=useState<PersonnelTableSnapshot|null>(null);
 const [activePeople,setActivePeople]=useState<CommercialPerson[]>([]);
 const [lastChanges,setLastChanges]=useState<PersonnelImportChange[]>([]);
 const [file,setFile]=useState<File|null>(null);
 const [preview,setPreview]=useState<CommercialPerson[]|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [confirmVersion,setConfirmVersion]=useState<string|null>(null);
 const load=useCallback(async()=>{
  const [m,v,table,people,changes]=await Promise.all([
   getActivePersonnelMeta(),getPersonnelVersions(),getActivePersonnelTable(),
   getActivePersonnelPeople(),getPersonnelImportChanges(),
  ]);
  setMeta(m);setVersions(v);setSnapshot(table);setActivePeople(people);setLastChanges(changes);
 },[]);
 useEffect(()=>{let alive=true;void load().catch(e=>{if(alive)notify.error(errorMessage(e,'No se pudo consultar DetallePersonal. ¿Aplicaste la migración SQL?'));}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[load]);
 const selectFile=async(next:File|null)=>{
  setFile(next);setPreview(null);
  if(!next)return;
  try{setBusy(true);setPreview(await parseMasterPersonnel(next));}
  catch(e){notify.error(errorMessage(e,'No se pudo leer DetallePersonal.'));}
  finally{setBusy(false);}
 };
 const publish=async()=>{
  if(!file||!preview||busy||me?.role!=='admin')return;
  try{setBusy(true);await publishMasterPersonnel(file,preview,me.full_name??'Administrador');await load();
   setFile(null);setPreview(null);notify.success('DetallePersonal actualizado para CCC, SKUs FOCO y Categorías.');
  }catch(e){notify.error(errorMessage(e,'No se pudo publicar el archivo. Se conserva la versión anterior.'));}
  finally{setBusy(false);}
 };
 const download=async()=>{
  try{setBusy(true);const data=await downloadActivePersonnel();if(!data)throw new Error('No hay archivo activo.');
   const url=URL.createObjectURL(data);const link=document.createElement('a');link.href=url;link.download=data.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){notify.error(errorMessage(e,'No se pudo descargar el archivo.'));}finally{setBusy(false);}
 };
 const restore=async()=>{
  if(!confirmVersion||busy)return;
  try{setBusy(true);await activatePersonnelVersion(confirmVersion);await load();setConfirmVersion(null);notify.success('Versión restaurada para todos los módulos.');}
  catch(e){notify.error(errorMessage(e,'No se pudo restaurar la versión.'));}
  finally{setBusy(false);}
 };
 const proposedChanges=useMemo(()=>preview?compareCommercialPersonnel(activePeople,preview):[],[preview,activePeople]);
 const changeCount=(status:PersonnelImportChange['status'])=>proposedChanges.filter(c=>c.status===status).length;
 const counts=(people:CommercialPerson[])=>[
  {label:'Gerentes',count:people.filter(p=>p.role==='GERENTE').length},
  {label:'Supervisores',count:people.filter(p=>p.role==='SUPERVISOR').length},
  {label:'Vendedores',count:people.filter(p=>p.role==='VENDEDOR').length},
 ];
 return <motion.section initial={reduced?false:{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:0.2}} className="w-full min-w-0 space-y-5 pb-12">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <h1 className="text-2xl font-semibold text-slate-950">Personal comercial</h1>
   <button type="button" onClick={()=>void load().catch(e=>notify.error(errorMessage(e,'No se pudo actualizar.')))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 transition-colors duration-200 hover:bg-slate-50"><RefreshCw className="mr-2 inline h-4 w-4"/>Actualizar</button>
  </div>
  <section className="rounded-2xl border border-slate-200 bg-white p-5">
   <div className="flex items-center gap-3"><FileSpreadsheet className="h-6 w-6 text-slate-600"/><div className="min-w-0"><h2 className="font-medium">DetallePersonal maestro</h2><p className="text-xs text-slate-500">{loading?'Cargando…':meta?meta.original_name+' · '+new Date(meta.updated_at).toLocaleString('es-AR'):'Sin archivo publicado'}</p></div></div>
   <div className="mt-5 flex flex-wrap gap-2">
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors duration-200 hover:bg-slate-100"><Upload className="h-4 w-4"/>Seleccionar XLSX<input className="sr-only" type="file" accept=".xlsx" disabled={busy} onChange={e=>{void selectFile(e.target.files?.[0]??null);e.currentTarget.value='';}}/></label>
    <button type="button" disabled={!meta||busy} onClick={()=>void download()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-40"><Download className="h-4 w-4"/>Descargar actual</button>
   </div>
   {preview&&<div className="mt-5 border-t border-slate-100 pt-4">
    <p className="text-sm font-medium">Vista previa · {preview.length} personas</p>
    <div className="mt-3 grid grid-cols-3 gap-2">{counts(preview).map(x=><div key={x.label} className="rounded-lg bg-slate-50 p-3"><div className="text-lg font-semibold">{x.count}</div><div className="text-xs text-slate-500">{x.label}</div></div>)}</div>
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
     <span className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">{changeCount('new')} incorporaciones</span>
     <span className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">{changeCount('modified')} modificados</span>
     <span className="rounded-lg bg-rose-50 px-3 py-2 text-rose-800">{changeCount('removed')} bajas</span>
     <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">{preview.length-changeCount('new')-changeCount('modified')} sin cambios</span>
    </div>
    {changeCount('removed')>0&&<p className="mt-2 text-xs text-amber-700">Las bajas dejarán de aparecer en el login comercial. Sus contraseñas no se borran; sus cuentas comerciales quedan inactivas.</p>}
    {proposedChanges.some(c=>c.status==='modified'&&c.previous_person?.name!==c.current_person?.name)&&
      <p className="mt-2 text-xs text-amber-700">Hay cambios de nombre: por seguridad, esos accesos quedarán pendientes de revisión de identidad. Sus contraseñas se conservan.</p>}
    <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50"><tr>{['Código','Nombre','Sucursal','Cargo','Superior'].map(h=><th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead><tbody>{preview.slice(0,30).map(p=><tr key={p.branch+':'+p.id} className="border-t border-slate-100"><td className="px-3 py-2">{p.id}</td><td className="px-3 py-2">{p.name}</td><td className="px-3 py-2">{p.branch}</td><td className="px-3 py-2">{p.role}</td><td className="px-3 py-2">{p.superior}</td></tr>)}</tbody></table></div>
    <p className="mt-2 text-xs text-slate-500">Se muestran 30 filas de ejemplo. Confirmar reemplaza la versión activa para los tres módulos; las anteriores permanecen disponibles.</p>
    <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={()=>{setFile(null);setPreview(null);}} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancelar</button><button type="button" disabled={busy} onClick={()=>void publish()} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy?'Guardando…':'Confirmar y publicar'}</button></div>
   </div>}
  </section>
  <CommercialSellerPasswords snapshot={snapshot} loading={loading} importChanges={lastChanges}/>
  <section className="rounded-2xl border border-slate-200 bg-white p-5">
   <h2 className="flex items-center gap-2 text-sm font-medium"><History className="h-4 w-4"/>Historial de versiones</h2>
   {!versions.length&&<p className="mt-4 text-xs text-slate-500">No hay versiones registradas. La primera importación creará el historial.</p>}
   <div className="mt-3 divide-y divide-slate-100">{versions.map(v=><div key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
    <div className="min-w-0"><div className="font-medium text-slate-900">{v.original_name}</div><div className="mt-1 text-slate-500">{new Date(v.created_at).toLocaleString('es-AR')} · {v.people_count} personas · {v.uploaded_by_name??'Administración'}</div></div>
    {meta?.storage_path===v.storage_path?<span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4"/>Activa</span>:<button type="button" disabled={busy} onClick={()=>setConfirmVersion(v.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50">Restaurar</button>}
   </div>)}</div>
  </section>
  <AlertDialog open={Boolean(confirmVersion)} onOpenChange={open=>{if(!open&&!busy)setConfirmVersion(null);}}>
   <AlertDialogContent className="max-w-sm rounded-2xl border border-slate-200 bg-white">
    <AlertDialogHeader><AlertDialogTitle>Restaurar versión anterior</AlertDialogTitle><AlertDialogDescription>Todos los módulos comenzarán a utilizar esta versión del personal. Los reportes congelados permanecerán intactos.</AlertDialogDescription></AlertDialogHeader>
    <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event=>{event.preventDefault();void restore();}} className="bg-slate-900 text-white hover:bg-slate-800">Confirmar restauración</AlertDialogAction></AlertDialogFooter>
   </AlertDialogContent>
  </AlertDialog>
 </motion.section>;
}
