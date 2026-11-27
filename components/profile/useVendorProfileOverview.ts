'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {buildMyCommercialCategory,fetchMyCommercialCategory,previousCategoryMonth,type CommercialProfileV2Snapshot} from '@/lib/commercialProfileCategory';
import {fetchMyVendorActionPlans,type MyVendorActionPlan} from '@/lib/myVendorActionPlans';
import {errorMessage} from '@/lib/notifications';

export function useVendorProfileOverview(enabled:boolean,userId:string|undefined){
 // Use explicit date parts for a stable YYYY-MM regardless of locale implementation.
 const parts=new Intl.DateTimeFormat('en-US',{year:'numeric',month:'2-digit',timeZone:'America/Argentina/Buenos_Aires'}).formatToParts(new Date());
 const currentMonth=parts.find(p=>p.type==='year')!.value+'-'+parts.find(p=>p.type==='month')!.value;
 const previousMonth=previousCategoryMonth(currentMonth);
 const cache=useMemo(()=>new Map<string,Promise<CommercialProfileV2Snapshot>>(),[userId]);
 const fetchCategory=useCallback((period:string)=>{
  const cached=cache.get(period);if(cached)return cached;
  const request=fetchMyCommercialCategory(period).catch(error=>{cache.delete(period);throw error;});
  cache.set(period,request);return request;
 },[cache]);
 const [categories,setCategories]=useState<(string|null)[]>([null,null]);
 const [categoryErrors,setCategoryErrors]=useState<boolean[]>([false,false]);
 const [categoriesLoading,setCategoriesLoading]=useState(true);
 const [plans,setPlans]=useState<MyVendorActionPlan[]>([]);
 const [plansLoading,setPlansLoading]=useState(true);
 const [plansError,setPlansError]=useState('');
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  if(!enabled)return;
  let live=true;setCategoriesLoading(true);setCategories([null,null]);setCategoryErrors([false,false]);
  void Promise.allSettled([currentMonth,previousMonth].map(async period=>{
   if(period<'2026-10')return null;
   const data=buildMyCommercialCategory(await fetchCategory(period));
   return data.row?data.assessment.label:null;
  })).then(results=>{if(live){setCategories(results.map(r=>r.status==='fulfilled'?r.value:null));setCategoryErrors(results.map(r=>r.status==='rejected'));setCategoriesLoading(false);}});
  return()=>{live=false;};
 },[enabled,currentMonth,previousMonth,fetchCategory]);
 useEffect(()=>{
  if(!enabled)return;
  let live=true;setPlansLoading(true);setPlansError('');setPlans([]);
  void fetchMyVendorActionPlans().then(data=>{if(live)setPlans(data);})
   .catch(error=>{if(live)setPlansError(errorMessage(error,'No se pudieron consultar tus planes.'));})
   .finally(()=>{if(live)setPlansLoading(false);});
  return()=>{live=false;};
 },[enabled,userId,reload]);
 const reloadPlans=useCallback(()=>setReload(n=>n+1),[]);
 return {currentMonth,previousMonth,categories,categoryErrors,categoriesLoading,fetchCategory,plans,plansLoading,plansError,reloadPlans};
}
