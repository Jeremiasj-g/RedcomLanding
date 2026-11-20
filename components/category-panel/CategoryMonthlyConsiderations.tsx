'use client';
import {useEffect,useMemo,useState} from 'react';
import {CheckCircle2,Save,ShieldCheck} from 'lucide-react';
import CategoryMonthPicker from '@/components/category-panel/CategoryMonthPicker';
import {getActivePersonnelPeople,type CommercialPerson} from '@/lib/commercialPersonnelMaster';
import {fetchMonthlyConsiderations,saveMonthlyConsideration,hasMonthlyRecognition,type MonthlyConsideration,type MonthlyLevel} from '@/lib/categoryMonthlyConsiderations';
import type {CategoryScaleMetric,CategoryScaleGate} from '@/lib/categoryScale';
import {RedcomSearchableSelect,RedcomSelect} from '@/components/ui/redcom-select';
import {errorMessage,notify} from '@/lib/notifications';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogHeader,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from '@/components/ui/alert-dialog';

const branches=[
 {key:'corrientes_masivos',label:'Corrientes Masivos',name:'CASA CENTRAL',force:'ESQUEMA 1'},
 {key:'corrientes_refrigerados',label:'Corrientes Refrigerados',name:'CASA CENTRAL',force:'ESQUEMA REGRIGERADOS'},
 {key:'chaco',label:'Chaco',name:'SUCURSAL RESISTENCIA',force:'all'},
 {key:'misiones',label:'Misiones',name:'SUCURSAL POSADAS',force:'all'},
 {key:'obera',label:'Oberá',name:'SUCURSAL OBERA',force:'all'},
] as const;
type Choice={key:string;label:string;person:CommercialPerson};
const levels=[{value:'none',label:'Sin consideración'},{value:'junior',label:'Reconocer Junior'},{value:'semi',label:'Reconocer Semi Senior'},{value:'senior',label:'Reconocer Senior'}];
export default function CategoryMonthlyConsiderations({
 month,metrics,gates,onDirtyChange
}:{month:string;metrics:CategoryScaleMetric[];gates:CategoryScaleGate[];onDirtyChange?:(dirty:boolean)=>void}){
 const [selectedMonth,setSelectedMonth]=useState(()=>month||new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0'));
 const [people,setPeople]=useState<CommercialPerson[]>([]);
 const [records,setRecords]=useState<MonthlyConsideration[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [selected,setSelected]=useState('');
 const [search,setSearch]=useState('');
 const [metricLevels,setMetricLevels]=useState<Record<string,MonthlyLevel>>({});
 const [gateExemptions,setGateExemptions]=useState<Partial<Record<'route'|'effectiveness',boolean>>>({});
 const [reason,setReason]=useState('');
 const [baseline,setBaseline]=useState('');
 const [pendingChange,setPendingChange]=useState<{kind:'seller'|'month';value:string}|null>(null);
 const choices=useMemo(()=>people.flatMap(person=>{
  if(person.role!=='VENDEDOR')return [];
  const branch=branches.find(b=>b.name===person.branch&&(b.force==='all'||b.force===person.force));
  return branch?[{key:branch.key+':'+person.id,label:branch.label+' · '+person.id+' · '+person.name,person}]:[];
 }),[people]);
 const filtered=useMemo(()=>choices.filter(c=>c.label.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))),[choices,search]);
 const record=records.find(r=>r.branch_key+':'+r.seller_id===selected);
 const serialize=(levels:Record<string,MonthlyLevel>,gates:Partial<Record<'route'|'effectiveness',boolean>>,note:string)=>
  JSON.stringify([Object.entries(levels).sort(([a],[b])=>a.localeCompare(b)),Boolean(gates.route),Boolean(gates.effectiveness),note]);
 const current=serialize(metricLevels,gateExemptions,reason);
 const dirty=Boolean(selected&&current!==baseline);
 useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
 useEffect(()=>{if(!dirty)return;const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',unload);return()=>window.removeEventListener('beforeunload',unload);},[dirty]);
 useEffect(()=>{
  let live=true;setLoading(true);setSelected('');setSearch('');
  void Promise.all([getActivePersonnelPeople(),fetchMonthlyConsiderations(selectedMonth)])
   .then(([persons,saved])=>{if(live){setPeople(persons);setRecords(saved);}})
   .catch(e=>{if(live)notify.error(errorMessage(e,'No se pudieron cargar las consideraciones mensuales.'));})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[selectedMonth]);
 function openSeller(key:string){
  const saved=records.find(r=>r.branch_key+':'+r.seller_id===key);
  const levels={...(saved?.metric_levels??{})},gates={...(saved?.gate_exemptions??{})};
  const note=saved?.reason??'';
  setSelected(key);setMetricLevels(levels);setGateExemptions(gates);setReason(note);
  setBaseline(serialize(levels,gates,note));
 }
 function selectSeller(key:string){
  if(key===selected)return;
  if(dirty){setPendingChange({kind:'seller',value:key});return;}
  openSeller(key);
 }
 function requestMonth(next:string){
  if(next===selectedMonth)return;
  const now=new Date();
  const currentMonth=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  if(next>currentMonth){notify.warning('No se pueden registrar consideraciones para meses futuros.');return;}
  if(dirty){setPendingChange({kind:'month',value:next});return;}
  setSelectedMonth(next);
 }
 const selectedChoice=choices.find(c=>c.key===selected);
 const configured=Object.keys(metricLevels).length>0||Object.values(gateExemptions).some(Boolean);
 const validReason=reason.trim().length>=10&&reason.trim().length<=500;
 const canSave=Boolean(selectedChoice)&&dirty&&!saving&&!loading&&validReason&&(configured||Boolean(record));
 const saveHint=!dirty?'No hay cambios para guardar.':!configured&&!record?'Seleccioná al menos un indicador o condición.':!validReason?'Escribí un motivo de al menos 10 caracteres.':'';
 async function save(){
  if(!selectedChoice||!canSave)return;
  const [branchKey,sellerId]=selected.split(':');
  setSaving(true);
  try{
   const saved=await saveMonthlyConsideration({
    branchKey,month:selectedMonth,sellerId:Number(sellerId),metricLevels,gateExemptions,
    reason:reason.trim(),expectedRevision:record?.revision??0
   });
   setRecords(current=>[...current.filter(r=>r.branch_key+':'+r.seller_id!==selected),saved]);
   setReason(saved.reason);
   setBaseline(serialize(saved.metric_levels,saved.gate_exemptions,saved.reason));
   notify.success(configured?'Consideraciones guardadas para '+selectedMonth+'.':'Consideraciones retiradas para '+selectedMonth+'.');
  }catch(e){notify.error(errorMessage(e,'No se pudieron guardar las consideraciones mensuales.'));}
  finally{setSaving(false);}
 }
 return <section className="mt-6 rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h3 className="text-lg font-semibold text-slate-900">Consideraciones mensuales</h3>
    <p className="mt-1 text-xs text-slate-500">Reconocimientos excepcionales por mes. No modifican KPI ni las escalas permanentes.</p></div>
   <div className="flex flex-wrap items-center gap-2">
    <span className="text-xs text-slate-500">Mes</span>
    <CategoryMonthPicker value={selectedMonth} onChange={requestMonth} disabled={saving||loading} minMonth="2026-10" label="Mes de consideración"/>
   </div>
  </div>
  {loading?<div className="mt-5 h-24 animate-pulse rounded-xl bg-slate-100"/>:
  <>
   <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
    <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Vendedor</label>
     <RedcomSearchableSelect aria-label="Seleccionar vendedor" value={selected} onValueChange={selectSeller}
      options={filtered.map(c=>({value:c.key,label:c.label})).concat(selectedChoice&&!filtered.some(c=>c.key===selected)?[{value:selected,label:selectedChoice.label}]:[])}
      placeholder="Seleccioná un vendedor" searchPlaceholder="Buscar vendedor, ID o sucursal..." className="h-11 w-full"/>
    </div>
    <input aria-label="Filtrar padrón" value={search} onChange={e=>setSearch(e.target.value)}
     placeholder="Filtrar padrón" className="h-11 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-slate-400"/>
   </div>
   {selectedChoice&&<>
    <div className="mt-5 border-t border-slate-100 pt-4">
     <p className="text-sm font-semibold text-slate-900">Indicadores ponderados</p>
     <p className="mt-1 text-xs text-slate-500">Podés reconocer varios indicadores en una sola operación; el puntaje se toma del peso de cada indicador.</p>
     <div className="mt-3 grid gap-2 md:grid-cols-2">
      {metrics.filter(m=>m.weightPercent>0).map(metric=><div key={metric.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
       <div className="min-w-0"><p className="text-sm font-medium text-slate-800">{metric.metricName}</p><p className="text-xs text-slate-500">{metric.weightPercent} puntos</p></div>
       <RedcomSelect aria-label={'Reconocimiento de '+metric.metricName}
        value={metricLevels[String(metric.id)]??'none'}
        onValueChange={value=>setMetricLevels(curr=>{const next={...curr};if(value==='none')delete next[String(metric.id)];else next[String(metric.id)]=value as MonthlyLevel;return next;})}
        options={levels} className="h-10 w-full sm:w-48"/>
      </div>)}
     </div>
    </div>
    <div className="mt-5 border-t border-slate-100 pt-4">
     <p className="text-sm font-semibold text-slate-900">Condiciones de acceso</p>
     <p className="mt-1 text-xs text-slate-500">Reconocer el cumplimiento no cambia el horario o la efectividad real.</p>
     <div className="mt-3 grid gap-2 md:grid-cols-2">
      {(['route','effectiveness'] as const).map((gate,i)=><label key={gate} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm">
       <span>{gates.find(g=>gate==='route'?/hora|ruta/i.test(g.label):/efectividad/i.test(g.label))?.label??(i===0?'Horario de ruta':'Efectividad')}</span>
       <input type="checkbox" checked={Boolean(gateExemptions[gate])}
        onChange={e=>setGateExemptions(curr=>({...curr,[gate]:e.target.checked}))}
        className="h-4 w-4 accent-slate-800"/>
      </label>)}
     </div>
    </div>
    <div className="mt-5">
     <label htmlFor="monthly-consideration-reason" className="block text-xs font-medium text-slate-600">Motivo de la consideración (obligatorio)</label>
     <textarea id="monthly-consideration-reason" rows={3} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}
      placeholder="Explicá por qué se reconoce este puntaje o condición durante el mes seleccionado."
      className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-400"/>
     <p className="mt-1 text-xs text-slate-500">Escribí al menos 10 caracteres. Se registra el autor, la fecha y cada revisión. Para retirar todos los ajustes, dejá los indicadores sin consideración y guardá el motivo.</p>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
     <span className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4"/>Revisión {record?.revision??0}{hasMonthlyRecognition(record)&&<><CheckCircle2 className="ml-2 h-4 w-4 text-emerald-600"/>Con reconocimiento</>}</span>
     <div className="flex flex-col items-end gap-1">
     {saveHint&&<span role="status" className="text-xs text-slate-500">{saveHint}</span>}
     <button type="button" disabled={!canSave} onClick={()=>void save()}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-slate-700 disabled:opacity-40">
      <Save className="h-4 w-4"/>{saving?'Guardando…':'Guardar consideraciones del mes'}
     </button>
     </div>
    </div>
   </>}
   {!selectedChoice&&<p className="mt-5 text-sm text-slate-500">Seleccioná un vendedor para reconocer uno o varios KPI y/o condiciones en el mismo guardado.</p>}
  </>}
  <AlertDialog open={pendingChange!==null} onOpenChange={open=>{if(!open)setPendingChange(null);}}>
   <AlertDialogContent className="rounded-2xl bg-white">
    <AlertDialogHeader><AlertDialogTitle>Cambios sin guardar</AlertDialogTitle>
     <AlertDialogDescription>Hay consideraciones editadas que todavía no se guardaron.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
     <AlertDialogCancel>Seguir editando</AlertDialogCancel>
     <AlertDialogAction onClick={()=>{if(pendingChange?.kind==='seller')openSeller(pendingChange.value);else if(pendingChange?.kind==='month')setSelectedMonth(pendingChange.value);setPendingChange(null);}} className="bg-slate-900 text-white">Salir sin guardar</AlertDialogAction>
    </AlertDialogFooter>
   </AlertDialogContent>
  </AlertDialog>
 </section>;
}
