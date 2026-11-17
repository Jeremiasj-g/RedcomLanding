/** Identidad comercial derivada del Excel; no corresponde a un usuario del CRUD. */
export type SellerIdentity={branch:string;code:number;name:string};
export const sellerKey=(seller:Pick<SellerIdentity,'branch'|'code'>)=>JSON.stringify([seller.branch,seller.code]);
export const sellerFromWorksheet=(columns:{key:string;label:string}[],row:Record<string,string>):(SellerIdentity&{role:string})|null=>{
 const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
 const get=(...labels:string[])=>{
  const col=columns.find(c=>labels.includes(normalize(c.label)));
  return col?row[col.key]?.trim()??'':'';
 };
 const code=Number(get('CODIGO','COD'));
 const branch=get('SUCURSAL').replace(/\s+/g,' ');
 const name=get('DESCRIPCION','NOMBRE').replace(/\s+/g,' ');
 if(!Number.isSafeInteger(code)||code<=0||!branch||!name)return null;
 return {branch,code,name,role:normalize(get('CARGO'))};
};

const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
export function randomSecurePassword(length=18){
 if(!Number.isInteger(length)||length<12||length>128)throw new Error('Longitud de contraseña inválida.');
 const limit=256-(256%ALPHABET.length);
 while(true){
  let value='';
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
