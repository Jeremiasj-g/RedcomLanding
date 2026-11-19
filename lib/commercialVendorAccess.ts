import {supabase} from '@/lib/supabaseClient';
import {randomSecurePassword,validateManualPassword,sellerKey,sellerFromWorksheet,type SellerIdentity} from '@/lib/commercialPersonnelPasswords';
export {randomSecurePassword,validateManualPassword,sellerKey,sellerFromWorksheet};
export type {SellerIdentity};

export type CommercialVendorAccess={
 branch:string;person_code:number;person_name:string;auth_user_id:string;login_email:string;needs_review:boolean;hire_date:string|null;
};
export type VendorLoginOption={
 branch:string;person_code:number;person_name:string;login_email:string|null;
};

export async function listCommercialVendorAccess():Promise<CommercialVendorAccess[]>{
 const {data,error}=await supabase.from('commercial_vendor_accounts')
  .select('branch,person_code,person_name,auth_user_id,login_email,needs_review,hire_date')
  .order('branch').order('person_code');
 if(error)throw error;
 return data??[];
}
export async function getCommercialVendorLoginOptions():Promise<VendorLoginOption[]>{
 const {data,error}=await supabase.rpc('commercial_vendor_login_directory');
 if(error)throw error;
 return (data??[]) as VendorLoginOption[];
}
/** Muestra el cuerpo de error de FunctionsHttpError en vez de 'non-2xx'. */
async function invokeCommercialAdmin(body:Record<string,unknown>){
 const {data,error}=await supabase.functions.invoke('commercial_vendor_admin',{body});
 if(error){
  let message=error.message||'No se pudo completar la operación.';
  const context=(error as {context?:unknown}).context;
  if(context instanceof Response){
   try{
    const payload=await context.json() as {error?:unknown};
    if(typeof payload?.error==='string'&&payload.error.trim())message=payload.error;
   }catch{/* Mantener el mensaje original cuando no hay JSON. */}
  }
  throw new Error(message);
 }
 if(!data?.ok)throw new Error(String(data?.error||'La operación no fue confirmada.'));
 return data;
}
export async function assignCommercialVendorPassword(
 seller:SellerIdentity,password:string,options?:{rotateHolder?:boolean},
){
 validateManualPassword(password);
 return invokeCommercialAdmin({
  branch:seller.branch,person_code:seller.code,password,
  ...(options?.rotateHolder?{action:'rotate_holder'}:{}),
 }) as Promise<{ok:true;created:boolean;rotated?:boolean;person_name:string}>;
}

/** Cuenta técnica del código comercial vigente; nunca depende del nombre. */
export async function isMyCommercialVendorAccount(){
 const {data,error}=await supabase.rpc('is_current_commercial_vendor');
 if(error)throw error;
 return data===true;
}

/** Administración: guarda la fecha de ingreso del titular del código (o null para limpiar). */
export async function setCommercialVendorHireDate(seller:SellerIdentity,hireDate:string|null){
 const {data,error}=await supabase.rpc('set_commercial_vendor_hire_date',{
  p_branch:seller.branch,p_person_code:seller.code,p_hire_date:hireDate,
 });
 if(error)throw error;
 return data as string|null;
}
export type CommercialEmployment={hire_date:string|null;person_code:number;branch:string};
export async function getMyCommercialEmployment():Promise<CommercialEmployment>{
 const {data,error}=await supabase.rpc('my_commercial_vendor_employment');
 if(error)throw error;
 if(!data||typeof data!=='object')throw new Error('No se pudo consultar la antigüedad comercial.');
 return data as CommercialEmployment;
}
