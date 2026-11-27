'use client';
import {useEffect,useState,useRef} from 'react';
import {RedcomSelect} from '@/components/ui/redcom-select';
import CategoryColorPalette from '@/components/ui/category-color-palette';
import {useCategoryColors} from '@/components/providers/CategoryColorsProvider';
import {CATEGORY_COLOR_KEYS,CATEGORY_COLOR_LABELS,DEFAULT_CATEGORY_COLORS,validHex,categoryStyle,contrastRatio,contrastText,type CategoryColorKey,type CategoryColors} from '@/lib/categoryColors';
import {notify,errorMessage} from '@/lib/notifications';
export default function CategoryColorsTab({onDirtyChange}:{onDirtyChange:(dirty:boolean)=>void}){
 const {colors,loading,error,reload,save}=useCategoryColors();
 const [draft,setDraft]=useState<CategoryColors|null>(null);const [key,setKey]=useState<CategoryColorKey>('SENIOR');const [hex,setHex]=useState<string|null>(null);const [saving,setSaving]=useState(false);const lock=useRef(false);
 const [target,setTarget]=useState<'background'|'text'>('background');
 const current=draft??colors;const custom=current.textColors?.[key]??null;const editingText=target==='text'&&custom!==null;const activeColor=editingText?custom:current[key];const input=hex??activeColor;const invalid=!validHex(input);const dirty=CATEGORY_COLOR_KEYS.some(k=>current[k]!==colors[k]||(current.textColors?.[k]??null)!==(colors.textColors?.[k]??null));
 const lowContrast=CATEGORY_COLOR_KEYS.filter(k=>contrastRatio(current[k],categoryStyle(current,k).color)<4.5);
 useEffect(()=>{onDirtyChange(dirty||invalid);return()=>onDirtyChange(false);},[dirty,invalid,onDirtyChange]);
 const choose=(v:string)=>{setHex(v);if(validHex(v))setDraft(editingText?{...current,textColors:{...current.textColors,[key]:v.toUpperCase()}}:{...current,[key]:v.toUpperCase()});};
 const setMode=(manual:boolean)=>{setHex(null);setDraft({...current,textColors:{...current.textColors,[key]:manual?(custom??contrastText(current[key])):null}});};
 const submit=async()=>{if(lock.current||invalid||!dirty||error||loading)return;lock.current=true;setSaving(true);try{await save(current);setDraft(null);setHex(null);notify.success('Colores guardados.');}catch(e){notify.error(errorMessage(e,'No se pudieron guardar los colores.'));}finally{lock.current=false;setSaving(false);}};
 if(loading&&!draft)return <div role="status" aria-label="Cargando colores" className="mt-4 h-[480px] animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none"/>;
 if(error)return <section className="mt-4 rounded-2xl border bg-white p-5"><p className="text-sm text-rose-700">{error}</p><button type="button" onClick={()=>void reload()} className="mt-3 rounded-lg border px-4 py-2 text-sm">Reintentar</button></section>;
 return <section className="mt-4 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
 <h2 className="text-lg font-medium">Colores de categorías</h2>
 <RedcomSelect aria-label="Categoría" value={key} onValueChange={v=>{setKey(v as CategoryColorKey);setHex(null);}} disabled={saving||invalid} options={CATEGORY_COLOR_KEYS.map(k=>({value:k,label:CATEGORY_COLOR_LABELS[k]}))} className="h-10 w-full sm:max-w-xs"/>
 <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-slate-600">Editar</span>{(['background','text'] as const).map(t=><button key={t} type="button" aria-pressed={target===t} disabled={saving||invalid} onClick={()=>{setTarget(t);setHex(null);}} className={'rounded-lg border px-4 py-2 text-sm transition-colors duration-200 '+(target===t?'bg-slate-900 text-white':'bg-white text-slate-700')}>{t==='background'?'Fondo':'Texto'}</button>)}</div>
 {target==='text'&&<RedcomSelect aria-label="Modo del color de texto" value={custom===null?'auto':'manual'} onValueChange={v=>setMode(v==='manual')} disabled={saving} options={[{value:'auto',label:'Automático (contraste)'},{value:'manual',label:'Personalizado'}]} className="h-10 w-full sm:max-w-xs"/>}
 {(target==='background'||editingText)&&<CategoryColorPalette value={activeColor} onChange={choose} disabled={saving}/>}
 {(target==='background'||editingText)&&<label className="flex items-center gap-3 text-sm">HEX<input type="color" value={activeColor} onChange={e=>choose(e.target.value)} disabled={saving}/><input value={input} disabled={saving} maxLength={7} aria-invalid={invalid} onChange={e=>choose(e.target.value)} className="h-10 w-32 rounded-lg border px-3 font-mono uppercase"/></label>}{invalid&&<p className="text-xs text-rose-700">Usá #RRGGBB.</p>}
 <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{CATEGORY_COLOR_KEYS.map(k=><button key={k} type="button" disabled={saving||invalid} onClick={()=>{setKey(k);setHex(null);}} aria-pressed={key===k} style={categoryStyle(current,k)} className="rounded-xl p-4 text-left focus-visible:outline focus-visible:outline-2"><span className="block text-sm font-medium">{CATEGORY_COLOR_LABELS[k]}</span><span className="mt-1 block text-xs">{current[k]} · {current.textColors?.[k]??'Auto'}</span></button>)}</div>
 {lowContrast.length>0&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Contraste inferior a 4,5:1 en {lowContrast.map(k=>CATEGORY_COLOR_LABELS[k]).join(', ')}. Podés guardar igualmente, pero se recomienda un texto más legible.</p>}
 <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><button type="button" disabled={saving} onClick={()=>{setDraft({...DEFAULT_CATEGORY_COLORS});setHex(null);}} className="rounded-xl border px-4 py-2.5 text-sm">Restablecer colores</button><button type="button" disabled={saving||!dirty||invalid||loading} onClick={()=>void submit()} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40">{saving?'Guardando…':'Guardar cambios'}</button></div>
 </section>;
}
