'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Loader2, Pencil, Plus, Save, Search, Trash2, UserRound, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { type CategoryScaleMetric, type CategoryScaleGate } from '@/lib/categoryScale';
import {
  fetchSellerConsiderations, saveSellerConsideration, deleteSellerConsideration,
  type SellerConsideration, type ConsiderationRule, type MetricRules, type GateRules,
} from '@/lib/categorySellerConsiderations';
import { errorMessage, notify } from '@/lib/notifications';

type Seller = { branch_key: string; branch_label: string; seller_id: number; seller_name: string };
type Cell = 'senior' | 'semi' | 'junior' | 'improvement' | 'weight';
const cells: Array<{key: Cell; label: string; color: string}> = [
  {key: 'senior', label: 'Senior', color: 'bg-emerald-900 text-white'},
  {key: 'semi', label: 'Semi Senior', color: 'bg-emerald-200 text-emerald-950'},
  {key: 'junior', label: 'Junior', color: 'bg-amber-200 text-amber-950'},
  {key: 'improvement', label: 'Plan de Mejora', color: 'bg-rose-200 text-rose-950'},
  {key: 'weight', label: 'Peso', color: 'bg-slate-100 text-slate-700'},
];
const baseValue = (m: CategoryScaleMetric, key: Cell) =>
  key === 'senior' ? m.seniorValue :
  key === 'semi' ? m.semiSeniorValue :
  key === 'junior' ? m.juniorValue :
  key === 'improvement' ? m.improvementValue : m.weightPercent;

function RuleEditor({rule, inherited, onChange}: {
 rule?: ConsiderationRule; inherited: string; onChange: (next?: ConsiderationRule) => void;
}) {
  const mode = rule?.mode ?? 'inherit';
  return (
    <div className="flex min-w-[116px] flex-col gap-1.5">
      <select aria-label="Tipo de consideración" value={mode}
        onChange={(e) => {
          const m=e.target.value;
          onChange(m==='inherit' ? undefined : m==='exempt' ? {mode:'exempt'} : {mode:'custom',value:rule?.mode==='custom'?rule.value:0});
        }}
        className="h-8 w-full rounded-lg border border-slate-200 bg-white px-1.5 text-[11px] text-slate-800 outline-none focus:border-blue-400">
        <option value="inherit">General</option>
        <option value="custom">Personalizado</option>
        <option value="exempt">Exento</option>
      </select>
      {rule?.mode==='custom' ? (
        <input type="number" step="any" aria-label="Valor personalizado" value={rule.value}
          onChange={(e)=>onChange({mode:'custom',value:Number(e.target.value)})}
          className="h-8 w-full rounded-lg border border-blue-200 bg-blue-50 px-2 text-xs font-semibold text-slate-900 outline-none"/>
      ) : (
        <span className="truncate text-center text-[10px] text-slate-400">{mode==='exempt'?'No se exige':inherited}</span>
      )}
    </div>
  );
}

export default function SellerConsiderations({
  metrics, gates,
}: {metrics: CategoryScaleMetric[]; gates: CategoryScaleGate[]}) {
  const [sellers,setSellers]=useState<Seller[]>([]);
  const [entries,setEntries]=useState<SellerConsideration[]>([]);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<string>('');
  const [editing,setEditing]=useState(false);
  const [reason,setReason]=useState('');
  const [metricRules,setMetricRules]=useState<MetricRules>({});
  const [gateRules,setGateRules]=useState<GateRules>({});
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    let mounted=true;
    void (async()=>{
      try {
        const [{data,error},saved]=await Promise.all([
          supabase.from('category_panel_current')
            .select('branch_key,branch_label,seller_id,seller_name')
            .order('branch_key').order('seller_id'),
          fetchSellerConsiderations(),
        ]);
        if(error) throw error;
        if(mounted){setSellers((data??[]) as Seller[]);setEntries(saved);}
      } catch(e) {if(mounted) notify.error(errorMessage(e,'No se pudieron cargar los vendedores.'));}
      finally{if(mounted)setLoading(false);}
    })();
    return ()=>{mounted=false;};
  },[]);

  const byKey=useMemo(()=>new Map(sellers.map(s=>[s.branch_key+':'+s.seller_id,s])),[sellers]);
  const selectedSeller=byKey.get(selected);
  const current=entries.find(e=>e.branch_key+':'+e.seller_id===selected);
  const listed=useMemo(()=>sellers.filter(s=>
    (s.branch_key+' '+s.branch_label+' '+s.seller_id+' '+s.seller_name).toLowerCase().includes(query.toLowerCase())
  ),[sellers,query]);

  function openSeller(key:string) {
    const entry=entries.find(e=>e.branch_key+':'+e.seller_id===key);
    setSelected(key);
    setReason(entry?.reason??'');
    setMetricRules(structuredClone(entry?.metric_rules??{}));
    setGateRules(structuredClone(entry?.gate_rules??{}));
    setEditing(true);
  }
  function updateMetric(id:number,key:Cell,rule?:ConsiderationRule) {
    setMetricRules(old=>{
      const next={...old};
      const group={...(next[String(id)]??{})};
      if(rule) group[key]=rule; else delete group[key];
      if(Object.keys(group).length)next[String(id)]=group;else delete next[String(id)];
      return next;
    });
  }
  function updateGate(id:number,rule?:ConsiderationRule){
    setGateRules(old=>{const next={...old};if(rule)next[String(id)]=rule;else delete next[String(id)];return next;});
  }
  async function save() {
    if(!selectedSeller) return;
    const hasException=Object.keys(metricRules).length>0||Object.keys(gateRules).length>0;
    if(!hasException){notify.error('Elegí al menos un requisito personalizado o exento.');return;}
    try {
      setSaving(true);
      await saveSellerConsideration({branchKey:selectedSeller.branch_key,sellerId:selectedSeller.seller_id,reason,metricRules,gateRules});
      setEntries(await fetchSellerConsiderations());
      setEditing(false);
      notify.success('Consideraciones del vendedor guardadas.');
    } catch(e){notify.error(errorMessage(e,'No se pudieron guardar las consideraciones.'));}
    finally{setSaving(false);}
  }
  async function remove(entry:SellerConsideration){
    if(!window.confirm('¿Quitar las consideraciones de este vendedor? Volverá a regirse por la escala general.'))return;
    try {
      await deleteSellerConsideration(entry.branch_key,entry.seller_id);
      setEntries(old=>old.filter(x=>x!==entry && !(x.branch_key===entry.branch_key && x.seller_id===entry.seller_id)));
      if(selected===entry.branch_key+':'+entry.seller_id){setSelected('');setEditing(false);}
      notify.success('Consideraciones eliminadas.');
    }catch(e){notify.error(errorMessage(e,'No se pudieron quitar las consideraciones.'));}
  }

  return (
    <section className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,.035)] sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.11em] text-blue-600">Excepciones individuales</div>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Consideraciones por vendedor</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">Ajustá requisitos o marcá exenciones sin alterar la escala general. Cada vendedor se identifica por sucursal e ID.</p>
        </div>
        <button type="button" onClick={()=>setEditing(v=>!v)}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-800">
          {editing?<X className="h-4 w-4"/>:<Plus className="h-4 w-4"/>}
          {editing?'Cerrar editor':'Agregar consideración'}
        </button>
      </div>
      {loading ? <div className="py-12 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin"/>Cargando...</div> : (
        <>
          {editing && (
            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/>
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar vendedor por ID, nombre o sucursal"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none focus:border-blue-300"/>
              </div>
              <div className="relative">
                <select value={selected} onChange={e=>openSeller(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm font-medium text-slate-800 outline-none focus:border-blue-400">
                  <option value="">Seleccionar un vendedor de los KPIs guardados</option>
                  {listed.map(s=><option key={s.branch_key+':'+s.seller_id} value={s.branch_key+':'+s.seller_id}>
                    {s.branch_label} · ID {s.seller_id} · {s.seller_name}
                  </option>)}
                  {selectedSeller && !listed.some(s=>s.branch_key+':'+s.seller_id===selected) && (
                    <option value={selected}>{selectedSeller.branch_label} · ID {selectedSeller.seller_id} · {selectedSeller.seller_name}</option>
                  )}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400"/>
              </div>
              {!sellers.length && <p className="mt-3 text-xs text-amber-700">Primero importá y guardá los KPIs para poder seleccionar vendedores.</p>}
              {selectedSeller && <>
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-900"><UserRound className="h-4 w-4 text-blue-600"/>ID {selectedSeller.seller_id} · {selectedSeller.seller_name} <span className="text-xs font-normal text-slate-400">({selectedSeller.branch_label})</span></div>
                <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Motivo / observación</label>
                <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={2} placeholder="Ej.: cartera reducida, reemplazo temporal, situación excepcional..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none focus:border-blue-400"/>
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[980px] border-collapse text-left text-xs">
                    <thead className="bg-slate-50"><tr>
                      <th className="w-[260px] px-3 py-3 text-slate-500">Métrica / KPI</th>
                      {cells.map(cell=><th key={cell.key} className={'px-2 py-3 text-center '+cell.color}>{cell.label}</th>)}
                    </tr></thead>
                    <tbody>{metrics.map(metric=><tr key={metric.id} className="border-t border-slate-100">
                      <td className="px-3 py-4"><div className="font-semibold text-slate-800">{metric.metricName}</div><div className="mt-1 text-[10px] text-slate-400">{metric.sectionName}</div></td>
                      {cells.map(cell=><td key={cell.key} className="border-l border-slate-100 px-2 py-2 align-top">
                        <RuleEditor rule={metricRules[String(metric.id)]?.[cell.key]} inherited={'General: '+(baseValue(metric,cell.key)??'—')}
                          onChange={rule=>updateMetric(metric.id,cell.key,rule)}/>
                      </td>)}
                    </tr>)}</tbody>
                  </table>
                </div>
                <h4 className="mt-5 text-sm font-semibold text-slate-900">Puertas de apertura</h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {gates.map(g=><div key={g.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                    <div className="text-xs font-semibold text-slate-800">{g.label}<div className="mt-1 text-[10px] text-slate-400">General: {g.valueText}</div></div>
                    <div className="w-40"><RuleEditor rule={gateRules[String(g.id)]} inherited={'General: '+g.valueText} onChange={rule=>updateGate(g.id,rule)}/></div>
                  </div>)}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={()=>setEditing(false)} className="h-10 rounded-xl px-4 text-xs text-slate-500">Cancelar</button>
                  <button onClick={()=>void save()} disabled={saving}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white disabled:opacity-60">
                    {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Guardar consideraciones
                  </button>
                </div>
              </>}
            </div>
          )}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Vendedores con consideraciones · {entries.length}</div>
            {!entries.length?<p className="py-5 text-center text-xs text-slate-400">Todavía no se configuraron excepciones individuales.</p>:
            <div className="grid gap-2 md:grid-cols-2">
              {entries.map(entry=>{
                const k=entry.branch_key+':'+entry.seller_id;
                const seller=byKey.get(k);
                return <div key={k} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="min-w-0"><div className="truncate text-xs font-semibold text-slate-900">{seller?.seller_name??entry.seller_name_snapshot}</div>
                    <div className="mt-1 text-[10px] text-slate-500">{seller?.branch_label??entry.branch_key} · ID {entry.seller_id} · {Object.keys(entry.metric_rules).length} KPI(s) · {Object.keys(entry.gate_rules).length} puerta(s)</div>
                    {entry.reason&&<div className="mt-1 truncate text-[10px] text-slate-400">{entry.reason}</div>}
                  </div>
                  <div className="flex gap-1">
                    <button title="Editar" disabled={!seller} onClick={()=>openSeller(k)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white disabled:opacity-30"><Pencil className="h-3.5 w-3.5"/></button>
                    <button title="Eliminar" onClick={()=>void remove(entry)} className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5"/></button>
                  </div>
                </div>;
              })}
            </div>}
          </div>
        </>
      )}
    </section>
  );
}
