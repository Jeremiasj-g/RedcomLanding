'use client';
import {createContext,useContext,useEffect,useState,useCallback,useMemo,type ReactNode} from 'react';
import {supabase} from '@/lib/supabaseClient';
import {DEFAULT_CATEGORY_COLORS,CATEGORY_COLOR_KEYS,validHex,type CategoryColors,type CategoryColorKey} from '@/lib/categoryColors';
type State={colors:CategoryColors;loading:boolean;error:string;reload:()=>Promise<void>;save:(colors:CategoryColors)=>Promise<void>};
const Context=createContext<State>({colors:{...DEFAULT_CATEGORY_COLORS},loading:true,error:'',reload:async()=>{},save:async()=>{throw Error('Configuración no disponible');}});
export const useCategoryColors=()=>useContext(Context);
export default function CategoryColorsProvider({children}:{children:ReactNode}){
 const [colors,setColors]=useState<CategoryColors>({...DEFAULT_CATEGORY_COLORS});
 const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const reload=useCallback(async()=>{setLoading(true);setError('');try{const {data,error}=await supabase.from('category_colors').select('category_key,hex,text_hex');if(error)throw error;
 const next:CategoryColors={...DEFAULT_CATEGORY_COLORS,textColors:{}};
 if(data?.length!==4)throw Error('Configuración incompleta');
 for(const row of data){if(!CATEGORY_COLOR_KEYS.includes(row.category_key as CategoryColorKey)||!validHex(row.hex))throw Error('Color inválido');next[row.category_key as CategoryColorKey]=row.hex.toUpperCase();if(row.text_hex!==null&&!validHex(row.text_hex))throw Error('Color de texto inválido');next.textColors![row.category_key as CategoryColorKey]=row.text_hex?.toUpperCase()??null;}setColors(next);
 }catch{setError('No se pudo cargar la configuración de colores.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void reload();const focus=()=>void reload();window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus);},[reload]);
 const save=useCallback(async(next:CategoryColors)=>{if(!CATEGORY_COLOR_KEYS.every(k=>validHex(next[k])))throw Error('HEX inválido');const {data,error}=await supabase.rpc('save_category_color_styles',{p_colors:Object.fromEntries(CATEGORY_COLOR_KEYS.map(k=>[k,{hex:next[k],text_hex:next.textColors?.[k]??null}]))});if(error)throw error;if(data!==4)throw Error('No se confirmó el guardado');setColors({...next});setError('');},[]);
 const value=useMemo(()=>({colors,loading,error,reload,save}),[colors,loading,error,reload,save]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
