import {supabase} from '@/lib/supabaseClient';
import {randomSecurePassword,validateManualPassword,sellerKey,sellerFromWorksheet,type SellerIdentity} from '@/lib/commercialPersonnelPasswords';
export {randomSecurePassword,validateManualPassword,sellerKey,sellerFromWorksheet};
export type {SellerIdentity};

export type CommercialVendorAccess={
 branch:string;person_code:number;person_name:string;auth_user_id:string;login_email:string;
};
export type VendorLoginOption={
 branch:string;person_code:number;person_name:string;login_email:string|null;
};

export async function listCommercialVendorAccess():Promise<CommercialVendorAccess[]>{
 const {data,error}=await supabase.from('commercial_vendor_accounts')
  .select('branch,person_code,person_name,auth_user_id,login_email')
  .order('branch').order('person_code');
 if(error)throw error;
 return data??[];
}
export async function getCommercialVendorLoginOptions():Promise<VendorLoginOption[]>{
 const {data,error}=await supabase.rpc('commercial_vendor_login_directory');
 if(error)throw error;
 return (data??[]) as VendorLoginOption[];
}
export async function assignCommercialVendorPassword(seller:SellerIdentity,password:string){
 validateManualPassword(password);
 const {data,error}=await supabase.functions.invoke('commercial_vendor_admin',{
  body:{branch:seller.branch,person_code:seller.code,password},
 });
 if(error)throw new Error(error.message||'No se pudo preparar el acceso comercial.');
 if(!data?.ok)throw new Error(String(data?.error||'No se confirmó la contraseña comercial.'));
 return data as {ok:true;created:boolean;person_name:string};
}
