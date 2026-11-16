import {supabase} from '@/lib/supabaseClient';
import {readFirstWorksheet} from '@/lib/categoryPanelExcel';

/** El archivo original es el contrato de CCC y SKUs FOCO; los registros derivados son para Categorías. */
export type CommercialPerson={id:number;name:string;branch:string;role:'VENDEDOR'|'SUPERVISOR'|'GERENTE';superior:string;force:string};
export type PersonnelVersion={
 id:string;storage_path:string;original_name:string;size_bytes:number;created_at:string;
 uploaded_by_name:string|null;people_count:number;people:CommercialPerson[];
};
const BUCKET='ccc-shared-files';
const normalize=(v:unknown)=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toUpperCase();
const clean=(v:unknown)=>String(v??'').replace(/\s+/g,' ').trim();
const validRole=(v:unknown):CommercialPerson['role']|null=>{
 const role=normalize(v);
 if(role==='VENDEDOR')return 'VENDEDOR';
 if(role==='SUPERVISOR')return 'SUPERVISOR';
 if(['GERENTE','JEFE DE VENTAS','JEFE VENTAS','JDV'].includes(role))return 'GERENTE';
 return null;
};
export async function parseMasterPersonnel(file:File):Promise<CommercialPerson[]>{
 if(!/\.xlsx$/i.test(file.name))throw new Error('Seleccioná un archivo .xlsx de DetallePersonal.');
 if(!file.size||file.size>25*1024*1024)throw new Error('El Excel debe ocupar entre 1 byte y 25 MB.');
 const matrix=await readFirstWorksheet(file);
 const headerIndex=matrix.slice(0,40).findIndex(row=>{
  const h=row.map(normalize);
  return ['CODIGO','DESCRIPCION','SUCURSAL','CARGO','SUPERIOR'].every(k=>h.includes(k));
 });
 if(headerIndex<0)throw new Error('Faltan las columnas Código, Descripción, Sucursal, Cargo o Superior.');
 const headers=matrix[headerIndex].map(normalize);
 const at=(name:string)=>headers.indexOf(name);
 const forceIndex=headers.findIndex(v=>v==='FUERZA DE VENTA'||v==='FUERZA VENTA');
 const cancelledIndex=headers.findIndex(v=>v==='ANULADO'||v==='ANULADA');
 const people:CommercialPerson[]=[];
 const seen=new Set<string>();
 for(const [offset,row] of matrix.slice(headerIndex+1).entries()){
  if(cancelledIndex>=0&&['SI','S','TRUE','1'].includes(normalize(row[cancelledIndex])))continue;
  const role=validRole(row[at('CARGO')]);
  if(!role)continue;
  const id=Number(row[at('CODIGO')]),name=clean(row[at('DESCRIPCION')]),branch=clean(row[at('SUCURSAL')]);
  if(!Number.isSafeInteger(id)||id<=0||!name||!branch)throw new Error('Fila '+(headerIndex+offset+2)+': código, nombre o sucursal inválidos.');
  const key=normalize(branch)+':'+id;
  if(seen.has(key))throw new Error('Código duplicado en la misma sucursal: '+key);
  seen.add(key);
  people.push({id,name,branch,role,superior:clean(row[at('SUPERIOR')]),force:forceIndex>=0?clean(row[forceIndex]):''});
 }
 if(!people.length)throw new Error('El Excel no contiene gerentes, supervisores o vendedores válidos.');
 if(people.length>15000)throw new Error('El archivo supera el máximo de 15.000 personas.');
 return people;
}
export async function getActivePersonnelMeta(){
 const {data,error}=await supabase.from('ccc_shared_files').select('*').eq('file_key','personal_detail').maybeSingle();
 if(error)throw error;
 return data as {storage_path:string;original_name:string;updated_at:string;uploaded_by_name:string|null;size_bytes:number|null}|null;
}
export async function getPersonnelVersions():Promise<PersonnelVersion[]>{
 const {data,error}=await supabase.from('commercial_personnel_versions')
  .select('id,storage_path,original_name,size_bytes,created_at,uploaded_by_name,people_count')
  .order('created_at',{ascending:false}).limit(50);
 if(error)throw error;
 return (data??[]) as PersonnelVersion[];
}
export async function downloadActivePersonnel():Promise<File|null>{
 const meta=await getActivePersonnelMeta();
 if(!meta)return null;
 const {data,error}=await supabase.storage.from(BUCKET).download(meta.storage_path);
 if(error)throw error;
 return new File([data],meta.original_name,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
/** Publicación transaccional de las referencias SQL; nunca borra la versión anterior. */
export async function publishMasterPersonnel(file:File,people:CommercialPerson[],uploaderName:string){
 if(!people.length)throw new Error('Primero validá el archivo.');
 const path='global/versions/'+crypto.randomUUID()+'.xlsx';
 const {error:uploadError}=await supabase.storage.from(BUCKET).upload(path,file,{
  upsert:false,cacheControl:'0',contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
 });
 if(uploadError)throw uploadError;
 const {error}=await supabase.rpc('publish_commercial_personnel_master',{
  p_storage_path:path,p_original_name:file.name,p_size_bytes:file.size,
  p_uploaded_by_name:uploaderName,p_people:people
 });
 if(error){
  // Si falla la respuesta después de un commit, no borrar la versión activa.
  const active=await getActivePersonnelMeta().catch(()=>null);
  if(active?.storage_path!==path)await supabase.storage.from(BUCKET).remove([path]);
  if(error.code==='PGRST202')throw new Error('La base de datos todavía no tiene instalada la migración de Personal comercial. Aplicá las migraciones de DetallePersonal antes de publicar el archivo.');
  throw error;
 }
 return path;
}
export async function activatePersonnelVersion(versionId:string){
 const {error}=await supabase.rpc('activate_commercial_personnel_version',{p_version_id:versionId});
 if(error)throw error;
}
