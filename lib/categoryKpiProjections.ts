import type {CategoryPanelRow,CategoryPanelBranchKey} from '@/lib/categoryPanelExcel';
import {readFirstWorksheet} from '@/lib/categoryPanelExcel';
export type KpiProjection={branch_key:string;seller_id:number;projected_category:string|null;pop_percentage:number|null;exhibition_percentage:number|null;coverage_percentage:number|null;volume_percentage:number|null};
const branches:[CategoryPanelBranchKey,string][]=[['corrientes_masivos','Corrientes'],['corrientes_refrigerados','Refrigerados'],['chaco','Chaco'],['misiones','Misiones'],['obera','Oberá']];
const escapeXml=(s:unknown)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const col=(n:number)=>{let s='';for(let i=n+1;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;};
const crc32=(data:Uint8Array)=>{let v=-1;for(const b of data){v^=b;for(let i=0;i<8;i++)v=(v>>>1)^((v&1)?0xedb88320:0);}return (v^-1)>>>0;};
function zip(files:{name:string;data:string}[]):Blob{
 const encoder=new TextEncoder();const locals:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
 const u16=(v:DataView,p:number,x:number)=>v.setUint16(p,x,true);
 const u32=(v:DataView,p:number,x:number)=>v.setUint32(p,x,true);
 for(const f of files){
  const name=encoder.encode(f.name),data=encoder.encode(f.data),crc=crc32(data);
  const head=new Uint8Array(30+name.length),h=new DataView(head.buffer);u32(h,0,0x04034b50);u16(h,4,20);u16(h,8,0);u32(h,14,crc);u32(h,18,data.length);u32(h,22,data.length);u16(h,26,name.length);head.set(name,30);
  locals.push(head,data);
  const cd=new Uint8Array(46+name.length),c=new DataView(cd.buffer);u32(c,0,0x02014b50);u16(c,4,20);u16(c,6,20);u32(c,16,crc);u32(c,20,data.length);u32(c,24,data.length);u16(c,28,name.length);u32(c,42,offset);cd.set(name,46);central.push(cd);
  offset+=head.length+data.length;
 }
 const centralSize=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
 u32(e,0,0x06054b50);u16(e,8,files.length);u16(e,10,files.length);u32(e,12,centralSize);u32(e,16,offset);
 return new Blob([...locals,...central,end] as BlobPart[],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export function exportKpiProjectionTemplate(rows:CategoryPanelRow[],existing:KpiProjection[]):void{
 const saved=new Map(existing.map(p=>[p.branch_key+':'+p.seller_id,p]));
 const byBranch=branches.map(([key,label])=>({key,label,rows:rows.filter(r=>r.branchKey===key).sort((a,b)=>a.sellerId-b.sellerId)}));
 const max=Math.max(0,...byBranch.map(b=>b.rows.length));
 const cells:string[]=[];const merge:string[]=[];
 const put=(row:number,column:number,value:unknown,style=0)=>{
  if(value===null||value===undefined||value==='')return;
  const numeric=typeof value==='number';
  cells.push(`<c r="${col(column)}${row}" s="${style}"${numeric?'':' t="inlineStr"'}>${numeric?'<v>'+value+'</v>':'<is><t>'+escapeXml(value)+'</t></is>'}</c>`);
 };
 let xmlRows:string[]=[];
 for(let ri=1;ri<=max+2;ri++){
  cells.length=0;
  if(ri===1)byBranch.forEach((b,i)=>{put(ri,i*6,b.label,1);merge.push(`${col(i*6)}1:${col(i*6+5)}1`);});
  else if(ri===2)byBranch.forEach((b,i)=>['Vendedor (ID · nombre)','Categoría proyectada','POP (%)','Exhibición (%)','Cobertura (%)','Volumen (%)'].forEach((t,j)=>put(ri,i*6+j,t,2)));
  else byBranch.forEach((b,i)=>{const person=b.rows[ri-3];if(!person)return;const savedRow=saved.get(b.key+':'+person.sellerId);put(ri,i*6,`${person.sellerId} · ${person.sellerName}`,3);put(ri,i*6+1,savedRow?.projected_category,3);put(ri,i*6+2,savedRow?.pop_percentage,4);put(ri,i*6+3,savedRow?.exhibition_percentage,4);});
  xmlRows.push(`<row r="${ri}">${cells.join('')}</row>`);
 }
 const widths=byBranch.map((_,i)=>`<col min="${i*6+1}" max="${i*6+1}" width="30" customWidth="1"/><col min="${i*6+2}" max="${i*6+2}" width="24" customWidth="1"/><col min="${i*6+3}" max="${i*6+6}" width="17" customWidth="1"/>`).join('');
 const worksheet=`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${xmlRows.join('')}</sheetData><mergeCells count="${merge.length}">${merge.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells></worksheet>`;
 const styles=`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="12"/></font><font><b/><color rgb="FF1E293B"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0"/></cellXfs></styleSheet>`;
 const blob=zip([
  {name:'[Content_Types].xml',data:`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
  {name:'_rels/.rels',data:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
  {name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Proyecciones" sheetId="1" r:id="rId1"/></sheets></workbook>`},
  {name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
  {name:'xl/worksheets/sheet1.xml',data:worksheet},{name:'xl/styles.xml',data:styles},
 ]);
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='REDCOM_proyecciones_KPI.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const parsePct=(v:unknown):number|null=>{
 if(v===null||v===undefined||String(v).trim()==='')return null;
 const raw=String(v).trim().replace('%','').replace(',','.');const n=Number(raw);
 if(!Number.isFinite(n))throw new Error('Porcentaje inválido: '+v);
 const pct=String(v).includes('%')?n:typeof v==='number'&&n>0&&n<=1?n*100:n;
 if(pct<0||pct>100)throw new Error('Los porcentajes deben estar entre 0 y 100.');
 return Math.round(pct*1000)/1000;
};
export async function parseKpiProjectionFile(file:File,sellers:CategoryPanelRow[]):Promise<KpiProjection[]>{
 const matrix=await readFirstWorksheet(file);const result:KpiProjection[]=[];
 const valid=new Map(sellers.map(row=>[row.branchKey+':'+row.sellerId,row]));
 for(let i=0;i<branches.length;i++){
  const [key,label]=branches[i],base=i*6;
  if(String(matrix[0]?.[base]??'').trim()!==label||String(matrix[1]?.[base+1]??'')!=='Categoría proyectada')throw new Error('Plantilla no reconocida. Descargá una nueva desde KPIs.');
  for(let ri=2;ri<matrix.length;ri++){
   const name=String(matrix[ri]?.[base]??'').trim();if(!name)continue;
   const id=Number(/^\s*(\d+)\s*[·–-]/.exec(name)?.[1]);
   if(!Number.isInteger(id)||!valid.has(key+':'+id))throw new Error('Vendedor no reconocido en '+label+': '+name);
   const cat=String(matrix[ri]?.[base+1]??'').trim()||null;
   result.push({branch_key:key,seller_id:id,projected_category:cat,pop_percentage:parsePct(matrix[ri]?.[base+2]),exhibition_percentage:parsePct(matrix[ri]?.[base+3]),coverage_percentage:parsePct(matrix[ri]?.[base+4]),volume_percentage:parsePct(matrix[ri]?.[base+5])});
  }
 }
 const keys=new Set<string>();for(const row of result){const key=row.branch_key+':'+row.seller_id;if(keys.has(key))throw new Error('Vendedor duplicado en la plantilla: '+key);keys.add(key);}
 return result;
}
