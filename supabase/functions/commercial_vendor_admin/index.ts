import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'},
});
const PASSWORD=/^(?=.{12,128}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/s;
const clean=(v:unknown)=>String(v??'').trim();
type Person={id:number;name:string;branch:string;role:string;force:string};
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
function getBranch(person:Person){
 const branch=normalize(person.branch);
 const force=normalize(person.force);
 if(branch==='CASA CENTRAL')return force.includes('REFRIGERAD')||force.includes('REGRIGERAD')?'refrigerados':'corrientes';
 if(branch.includes('RESISTENCIA'))return 'chaco';
 if(branch.includes('POSADAS'))return 'misiones';
 if(branch.includes('OBERA'))return 'obera';
 throw new Error('Sucursal comercial no soportada: '+person.branch);
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'Método no permitido'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!service)return json({error:'Servidor no configurado'},500);
  const token=(req.headers.get('Authorization')??'').replace(/^Bearer\s+/i,'');
  if(!token)return json({error:'Sesión requerida'},401);
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:verified,error:authError}=await admin.auth.getUser(token);
  if(authError||!verified.user)return json({error:'Sesión no válida'},401);
  const {data:actor,error:actorError}=await admin.from('profiles').select('role,is_active').eq('id',verified.user.id).maybeSingle();
  if(actorError||actor?.role!=='admin'||actor?.is_active!==true)
   return json({error:'Solo administradores activos pueden modificar contraseñas'},403);

  let body:Record<string,unknown>;
  try{body=await req.json()}catch{return json({error:'Solicitud inválida'},400)}
  const branch=clean(body.branch),code=Number(body.person_code),password=String(body.password??'');
  const approveIdentity=body.action==='approve_identity';
  if(!branch||branch.length>160||!Number.isSafeInteger(code)||code<1||
      (!approveIdentity&&!PASSWORD.test(password)))
   return json({error:'Datos de vendedor o contraseña inválidos.'},400);

  const {data:master,error:masterError}=await admin.from('category_commercial_personnel').select('people').eq('id',1).single();
  if(masterError||!Array.isArray(master?.people))return json({error:'No está disponible el padrón comercial'},503);
  const person=(master.people as Person[]).find(p=>p.branch===branch&&p.id===code&&p.role==='VENDEDOR');
  if(!person)return json({error:'El vendedor no figura activo en DetallePersonal'},409);
  const profileBranch=getBranch(person);
  const {data:branchInfo,error:branchError}=await admin.from('branches').select('id,code').eq('code',profileBranch).single();
  if(branchError||!branchInfo)return json({error:'No se pudo validar la sucursal'},503);

  const {data:existing,error:existingError}=await admin.from('commercial_vendor_accounts')
   .select('auth_user_id,login_email,person_name,needs_review').eq('branch',branch).eq('person_code',code).maybeSingle();
  if(existingError)return json({error:'No se pudo consultar el acceso comercial'},503);
  if(approveIdentity){
   if(!existing||existing.needs_review!==true)
    return json({error:'No existe un cambio de identidad pendiente de revisión'},409);
   // The administrator confirms that the person in the new roster is the
   // same individual as the owner of this existing Auth account.
   const {error:mapError}=await admin.from('commercial_vendor_accounts').update({
     person_name:person.name,needs_review:false,updated_at:new Date().toISOString(),
   }).eq('branch',branch).eq('person_code',code).eq('auth_user_id',existing.auth_user_id);
   if(mapError)return json({error:'No se pudo confirmar la identidad'},422);
   const {error:profileError}=await admin.from('profiles').update({
     full_name:person.name,is_active:true,branch:profileBranch,
   }).eq('id',existing.auth_user_id);
   if(profileError){
    // Leave the access blocked if the profile could not be restored.
    await admin.from('commercial_vendor_accounts').update({needs_review:true})
      .eq('auth_user_id',existing.auth_user_id);
    return json({error:'No se pudo reactivar el perfil'},422);
   }
   const {error:branchesError}=await admin.from('user_branches').delete()
      .eq('user_id',existing.auth_user_id).neq('branch',profileBranch);
   const {error:branchLinkError}=branchesError?{error:branchesError}:
      await admin.from('user_branches').upsert({
        user_id:existing.auth_user_id,branch:profileBranch,branch_id:branchInfo.id,
      },{onConflict:'user_id,branch'});
   if(branchLinkError){
     await admin.from('commercial_vendor_accounts').update({needs_review:true})
       .eq('auth_user_id',existing.auth_user_id);
     await admin.from('profiles').update({is_active:false}).eq('id',existing.auth_user_id);
     return json({error:'No se pudo sincronizar la sucursal. El acceso permanece bloqueado.'},422);
   }
   return json({ok:true,reviewed:true,person_name:person.name});
  }
  if(existing&&(existing.person_name!==person.name||existing.needs_review===true))
   return json({error:'El vendedor tiene una revisión de identidad pendiente. No se cambiaron contraseñas.'},409);

  let id=existing?.auth_user_id as string|undefined;
  let internalEmail=existing?.login_email as string|undefined;
  let created=false;
  if(!id){
   internalEmail='vendor-'+crypto.randomUUID()+'@example.com';
   const {data:newUser,error:createError}=await admin.auth.admin.createUser({
    email:internalEmail,password,email_confirm:true,
    user_metadata:{full_name:person.name},
   });
   if(createError||!newUser.user)return json({error:'No se pudo crear el acceso comercial: '+(createError?.message??'Error desconocido')},422);
   id=newUser.user.id;
   created=true;
  }
  try{
   // Auth mantiene las sesiones y la RLS existente. Esta identidad es nueva,
   // no se vincula a ninguna cuenta creada desde el CRUD.
   const {error:profileError}=await admin.from('profiles').upsert({
    id,email:internalEmail,full_name:person.name,role:'vendedor',
    is_active:true,branch:profileBranch,
   },{onConflict:'id'});
   if(profileError)throw profileError;
   const {error:userBranchError}=await admin.from('user_branches').upsert({
    user_id:id,branch:profileBranch,branch_id:branchInfo.id,
   },{onConflict:'user_id,branch'});
   if(userBranchError)throw userBranchError;
   const {error:mapError}=await admin.from('commercial_vendor_accounts').upsert({
    branch,person_code:code,person_name:person.name,auth_user_id:id,
    login_email:internalEmail,needs_review:false,updated_at:new Date().toISOString(),
   },{onConflict:'branch,person_code'});
   if(mapError)throw mapError;
   // El cambio de contraseña se hace al final, una vez validado el mapeo.
   if(!created){
    const {error:updateError}=await admin.auth.admin.updateUserById(id,{password});
    if(updateError)throw updateError;
   }
  }catch(error){
   if(created){
    await admin.auth.admin.deleteUser(id).catch(()=>{});
   }
   return json({error:'No se pudo establecer el acceso: '+(error instanceof Error?error.message:String(error))},422);
  }
  return json({ok:true,created,branch,person_code:code,person_name:person.name});
 }catch(error){
  console.error('commercial_vendor_admin failed:',error instanceof Error?error.name:'unknown');
  return json({error:'No se pudo completar la operación'},500);
 }
});
