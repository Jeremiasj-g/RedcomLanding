import {supabase} from '@/lib/supabaseClient';

export type SellerIdentity={branch:string;code:number;name:string};
export type VendorAccount={id:string;full_name:string|null;email:string|null;is_active:boolean};
export type AccountLink=SellerIdentity&{auth_user_id:string;person_code:number;person_name:string;linked_at:string};

export const sellerKey=(seller:Pick<SellerIdentity,'branch'|'code'>)=>JSON.stringify([seller.branch,seller.code]);
export const sellerFromWorksheet=(columns:{key:string;label:string}[],row:Record<string,string>):(SellerIdentity&{role:string})|null=>{
 const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
 const get=(...labels:string[])=>{
  const col=columns.find(c=>labels.includes(normalize(c.label)));
  return col?row[col.key]?.trim()??'':'';
 };
 const code=Number(get('CODIGO','COD')),branch=get('SUCURSAL').replace(/\s+/g,' '),name=get('DESCRIPCION','NOMBRE').replace(/\s+/g,' ');
 if(!Number.isSafeInteger(code)||code<=0||!branch||!name)return null;
 return {branch,code,name,role:normalize(get('CARGO'))};
};

export async function listSellerAccounts(){
 const {data,error}=await supabase.from('profiles').select('id,full_name,email,is_active')
  .eq('role','vendedor').eq('is_active',true).order('full_name');
 if(error)throw error;
 return (data??[]) as VendorAccount[];
}
export async function listSellerLinks(){
 const {data,error}=await supabase.from('commercial_personnel_account_links')
  .select('branch,person_code,person_name,auth_user_id,linked_at');
 if(error)throw error;
 return (data??[]) as Array<{branch:string;person_code:number;person_name:string;auth_user_id:string;linked_at:string}>;
}
export async function linkSellerAccount(seller:SellerIdentity,userId:string){
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)throw new Error('No hay sesión válida.');
 const {error}=await supabase.from('commercial_personnel_account_links').upsert({
  branch:seller.branch,person_code:seller.code,person_name:seller.name,auth_user_id:userId,linked_by:user.id,linked_at:new Date().toISOString(),
 },{onConflict:'branch,person_code'});
 if(error)throw error;
}
export async function unlinkSellerAccount(seller:SellerIdentity){
 const {error}=await supabase.from('commercial_personnel_account_links').delete()
  .eq('branch',seller.branch).eq('person_code',seller.code);
 if(error)throw error;
}
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
export function randomSecurePassword(length=18){
 if(length<12||length>128)throw new Error('Longitud de contraseña inválida.');
 let value='';
 const limit=256-(256%ALPHABET.length);
 while(true){
  value='';
  while(value.length<length){
  const random=new Uint8Array(Math.max(24,length));
  crypto.getRandomValues(random);
  for(const byte of random){
   if(byte<limit)value+=ALPHABET[byte%ALPHABET.length];
   if(value.length===length)break;
  }
  }
  if(/[A-Z]/.test(value)&&/[a-z]/.test(value)&&/[0-9]/.test(value)&&/[^A-Za-z0-9]/.test(value))return value;
 }
}
export function validateManualPassword(password:string){
 if(password.length<12||password.length>128)throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
 if(!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||!/[^A-Za-z0-9]/.test(password))
  throw new Error('Debe incluir mayúsculas, minúsculas, números y símbolos.');
}
export async function updateAuthPassword(seller:SellerIdentity,userId:string,password:string){
 validateManualPassword(password);
 // Verifica el vínculo y el rol actual justo antes de alterar Supabase Auth.
 const [{data:link,error:linkError},{data:profile,error:profileError}]=await Promise.all([
  supabase.from('commercial_personnel_account_links').select('auth_user_id,person_name')
   .eq('branch',seller.branch).eq('person_code',seller.code).maybeSingle(),
  supabase.from('profiles').select('role,is_active').eq('id',userId).maybeSingle(),
 ]);
 if(linkError||profileError)throw new Error('No se pudo verificar la cuenta vinculada.');
 if(link?.auth_user_id!==userId||link?.person_name!==seller.name||profile?.role!=='vendedor'||profile?.is_active!==true)
  throw new Error('El vínculo cambió o la cuenta dejó de ser un vendedor activo. Actualizá la tabla.');
 const {data,error}=await supabase.functions.invoke('admin_set_password',{
  body:{user_id:userId,password},
 });
 if(error)throw new Error(error.message||'Falló el cambio de contraseña.');
 if(!data?.ok)throw new Error(String(data?.error||'No se confirmó el cambio de contraseña.'));
}
