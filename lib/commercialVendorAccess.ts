import {supabase} from '@/lib/supabaseClient';
import {randomSecurePassword,validateManualPassword,sellerKey,sellerFromWorksheet,type SellerIdentity} from '@/lib/commercialPersonnelPasswords';
export {randomSecurePassword,validateManualPassword,sellerKey,sellerFromWorksheet};
export type {SellerIdentity};

export type CommercialVendorAccess={
 branch:string;person_code:number;person_name:string;auth_user_id:string;login_email:string;needs_review:boolean;
};
export type VendorLoginOption={
 branch:string;person_code:number;person_name:string;login_email:string|null;
};

export async function listCommercialVendorAccess():Promise<CommercialVendorAccess[]>{
 const {data,error}=await supabase.from('commercial_vendor_accounts')
  .select('branch,person_code,person_name,auth_user_id,login_email,needs_review')
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
 seller:SellerIdentity,password:string,options?:{replaceIdentity?:boolean},
){
 validateManualPassword(password);
 return invokeCommercialAdmin({
  branch:seller.branch,person_code:seller.code,password,
  ...(options?.replaceIdentity?{action:'replace_identity'}:{}),
 }) as Promise<{ok:true;created:boolean;replaced?:boolean;person_name:string}>;
}

/** Reanuda un acceso con nombre cambiado solo tras validación explícita del administrador. */
export async function approveCommercialVendorIdentity(seller:SellerIdentity){
 await invokeCommercialAdmin({
  action:'approve_identity',branch:seller.branch,person_code:seller.code,
 });
}
