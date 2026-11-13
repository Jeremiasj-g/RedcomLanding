
import type {CategoryPanelRow} from '@/lib/categoryPanelExcel';
import type {SellerCategoryInput,CategoryAssessment} from '@/lib/categoryReached';

type Options={
 name:string;branch:string;month:string;projectedCategory:string|null;
 row:CategoryPanelRow|null;elapsedDays:number;input:SellerCategoryInput;
 assessment:CategoryAssessment;comparison:boolean;calculations:boolean;
};
type PdfDoc=import('jspdf').jsPDF;
const fmt=(n:number|null,digits=2)=>n===null||!Number.isFinite(n)?'Sin datos':n.toLocaleString('es-AR',{maximumFractionDigits:digits});
const currency=(n:number|null)=>n===null?'Sin datos':'$ '+fmt(n);
const percent=(n:number|null)=>n===null?'Sin datos':fmt(n)+'%';
const hours=(h:number|null)=>h===null?'Sin datos':[Math.floor(h),Math.floor(h*60%60),Math.round(h*3600%60)].map(n=>String(n).padStart(2,'0')).join(':');
const divide=(a:number|null,b:number|null)=>a!==null&&b!==null&&b>0?a/b:null;
const rgb={ink:[15,23,42],muted:[100,116,139],line:[226,232,240],green:[5,150,105],red:[220,38,38],pale:[248,250,252]} as const;

export async function exportSellerCategoryPdf(o:Options):Promise<void>{
 if(!o.comparison&&!o.calculations)throw new Error('Seleccioná al menos una sección para exportar.');
 const {jsPDF}=await import('jspdf');
 const pdf:PdfDoc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
 const width=210,left=17,right=17,inner=width-left-right,bottom=277;
 let y=18;
 const color=(c:readonly number[])=>pdf.setTextColor(c[0],c[1],c[2]);
 const lineColor=()=>pdf.setDrawColor(...rgb.line);
 const nextPage=()=>{pdf.addPage();y=18;};
 const ensure=(height:number)=>{if(y+height>bottom)nextPage();};
 const rule=()=>{ensure(6);lineColor();pdf.setLineWidth(.25);pdf.line(left,y,width-right,y);y+=6;};
 const title=(text:string,size=15)=>{
  ensure(size*.55+10);color(rgb.ink);pdf.setFont('helvetica','bold');pdf.setFontSize(size);
  pdf.text(text,left,y);y+=size*.45+5;pdf.setFont('helvetica','normal');
 };
 const heading=(text:string)=>{ensure(15);y+=3;title(text,12);};
 const labelText=(label:string,value:string)=>{
  const labelWidth=63,available=inner-labelWidth-3;
  pdf.setFont('helvetica','normal');pdf.setFontSize(9);
  const lines=pdf.splitTextToSize(value,available) as string[];
  ensure(Math.max(7,lines.length*4.4+2));
  color(rgb.muted);pdf.text(label,left,y);
  color(rgb.ink);pdf.setFont('helvetica','bold');pdf.text(lines,left+labelWidth,y);
  pdf.setFont('helvetica','normal');y+=Math.max(7,lines.length*4.4+2);
 };
 const wrapped=(text:string,maxWidth:number,fontSize=9)=>{
  pdf.setFontSize(fontSize);
  return pdf.splitTextToSize(text,maxWidth) as string[];
 };
 const tableRow=(cells:string[],widths:number[],options:{head?:boolean;tones?:('ok'|'bad'|'neutral')[]}={})=>{
  const padding=2.3;
  pdf.setFont('helvetica',options.head?'bold':'normal');
  const split=cells.map((cell,i)=>wrapped(cell,widths[i]-padding*2,8.3));
  const height=Math.max(7.5,...split.map(lines=>lines.length*4.15+padding*2));
  ensure(height);
  if(options.head){pdf.setFillColor(...rgb.pale);pdf.rect(left,y-4.5,inner,height,'F');}
  let x=left;
  for(let i=0;i<cells.length;i++){
   const tone=options.tones?.[i];color(tone==='ok'?rgb.green:tone==='bad'?rgb.red:options.head?rgb.muted:rgb.ink);
   pdf.setFontSize(8.3);
   pdf.text(split[i],x+padding,y);
   x+=widths[i];
  }
  y+=height;
  lineColor();pdf.setLineWidth(.18);pdf.line(left,y-4,width-right,y-4);
 };
 const sectionStart=(label:string)=>{
  if(y>25)nextPage();
  pdf.setFillColor(...rgb.ink);pdf.roundedRect(left,y-7,inner,13,3,3,'F');
  pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(12);
  pdf.text(label,left+5,y+1.5);y+=17;
  color(rgb.ink);pdf.setFont('helvetica','normal');
  labelText('Vendedor',o.name);labelText('Sucursal',o.branch);
  labelText('Período',o.month||'Sin período');labelText('Categoría alcanzada',o.assessment.label);
  y+=2;rule();
 };
 const metric=(label:string,value:string,details:string)=>{
  ensure(20);pdf.setFont('helvetica','normal');pdf.setFontSize(9);
  color(rgb.muted);pdf.text(label,left,y);y+=6;
  pdf.setFont('helvetica','bold');pdf.setFontSize(17);color(rgb.ink);pdf.text(value,left,y);y+=6;
  pdf.setFont('helvetica','normal');pdf.setFontSize(8.5);color(rgb.muted);
  const lines=wrapped(details,inner,8.5);ensure(lines.length*4+4);pdf.text(lines,left,y);y+=lines.length*4+6;
  rule();
 };
 if(o.comparison){
  sectionStart('Comparación de categorías');
  labelText('Categoría proyectada',o.projectedCategory??'Sin cargar');
  labelText('Puntaje requerido','75 puntos por categoría');
  heading('Condiciones para categorizar');
  for(const gate of o.assessment.gates){
   const required=gate.kind==='route'?hours(gate.required):percent(gate.required);
   const actual=gate.kind==='route'?hours(gate.actual):percent(gate.actual);
   labelText(gate.label,required+' requeridos / '+actual+' alcanzados / '+(gate.passed===null?'Sin evaluar':gate.passed?'Cumple':'No cumple'));
  }
  y+=2;
  for(const tier of o.assessment.tiers){
   heading(tier.label+'  ·  '+fmt(tier.score,0)+' / '+fmt(tier.maximum,0)+' puntos');
   tableRow(['Indicador','Requerido','Alcanzado','Puntos'],[68,37,43,28],{head:true});
   for(const item of tier.lines){
    const required=item.required===null?'Sin configurar':typeof item.required==='number'?fmt(item.required):item.required;
    const actual=item.projected?o.projectedCategory??'Sin cargar':item.actual===null?'Sin datos':fmt(item.actual);
    tableRow([item.projected?'Categoría proyectada':item.name,required,actual,item.passed===null?'—':(item.passed?'+':'')+fmt(item.passed?item.weight:0,0)], [68,37,43,28], {tones:['neutral','neutral',item.passed===true?'ok':item.passed===false?'bad':'neutral','neutral']});
   }
   labelText('Resultado',tier.passed?'Alcanza el mínimo de 75':'No alcanza el mínimo de 75');
   rule();
  }
 }
 if(o.calculations){
  sectionStart('Datos + cálculos');
  const row=o.row;
  const num=(n:number|undefined|null)=>n??null;
  const visits=num(row?.visitados),planned=num(row?.visitasPlaneadas),sales=num(row?.cntFac);
  const pdv=num(row?.ventaPdv),distance=num(row?.ventaDistancia),billing=num(row?.importeFinalFacturado);
  heading('Indicadores comerciales');
  metric('Efectividad',percent(divide(visits,planned)===null?null:divide(visits,planned)!*100),'(Visitados / visitas planeadas) x 100  ·  Visitados: '+fmt(visits,0)+'  ·  Planeadas: '+fmt(planned,0));
  metric('Eficiencia',percent(divide(sales,visits)===null?null:divide(sales,visits)!*100),'(Ventas / visitados) x 100  ·  Ventas: '+fmt(sales,0)+'  ·  Visitados: '+fmt(visits,0));
  metric('% Ventas en PDV',percent(divide(pdv,sales)===null?null:divide(pdv,sales)!*100),'(Ventas PDV / total ventas) x 100  ·  PDV: '+fmt(pdv,0)+'  ·  Ventas: '+fmt(sales,0));
  metric('% Ventas a distancia',percent(divide(distance,planned)===null?null:divide(distance,planned)!*100),'(Ventas distancia / visitas planeadas) x 100  ·  Distancia: '+fmt(distance,0)+'  ·  Planeadas: '+fmt(planned,0));
  heading('Resumen del vendedor');
  for(const [label,value] of [
   ['Facturación',currency(billing)],['Total de ventas',fmt(sales,0)],['Visitados',fmt(visits,0)],
   ['Visitas planeadas',fmt(planned,0)],['Venta a distancia',fmt(distance,0)],['Venta en PDV',fmt(pdv,0)]
  ])labelText(label,value);
  rule();
  heading('Datos de facturación');
  labelText('Días considerados',fmt(o.elapsedDays,0));
  labelText('Promedio boletas diarias',fmt(divide(sales,o.elapsedDays)));
  labelText('Facturación promedio diaria',currency(divide(billing,o.elapsedDays)));
  labelText('Promedio $ por boleta',currency(divide(billing,sales)));
  labelText('Categoría según proyección',o.projectedCategory??'Sin cargar');
 }
 const total=pdf.getNumberOfPages();
 for(let page=1;page<=total;page++){
  pdf.setPage(page);
  lineColor();pdf.setLineWidth(.2);pdf.line(left,287,width-right,287);
  color(rgb.muted);pdf.setFont('helvetica','normal');pdf.setFontSize(8);
  pdf.text('REDCOM  ·  Informe de categorización',left,292);
  pdf.text(page+' / '+total,width-right,292,{align:'right'});
 }
 const safeName=o.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'');
 pdf.save('REDCOM_'+safeName+'_'+(o.month||'periodo')+'.pdf');
}
