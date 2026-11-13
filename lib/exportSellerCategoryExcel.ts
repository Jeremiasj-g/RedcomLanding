
import type {CategoryPanelRow} from '@/lib/categoryPanelExcel';
import type {SellerCategoryInput,CategoryAssessment} from '@/lib/categoryReached';
import {downloadCategoryWorkbook} from '@/lib/categoryKpiProjections';

type Cell=string|number|null;
type Params={name:string;branch:string;month:string;projectedCategory:string|null;row:CategoryPanelRow|null;elapsedDays:number;input:SellerCategoryInput;assessment:CategoryAssessment;comparison:boolean;calculations:boolean};
const safe=(n:number|null)=>n===null||!Number.isFinite(n)?null:n;
const clock=(hours:number|null)=>hours===null?'Sin datos':[Math.floor(hours),Math.floor(hours*60%60),Math.round(hours*3600%60)].map(n=>String(n).padStart(2,'0')).join(':');
export function exportSellerCategoryExcel(o:Params):void{
 const sheets:{name:string;rows:Cell[][]}[]=[];
 if(o.comparison){
  const rows:Cell[][]=[
   ['REDCOM · Análisis de categorías'],['Vendedor',o.name],['Sucursal',o.branch],['Mes',o.month],
   ['Categoría proyectada',o.projectedCategory??'Sin cargar'],['Categoría alcanzada',o.assessment.label],
   ['Puntaje mínimo',75],[],
   ['Condiciones de acceso'],['Condición','Requerido','Alcanzado','Estado'],
   ...o.assessment.gates.map(g=>[g.label,g.kind==='route'?clock(g.required):g.required,g.kind==='route'?clock(g.actual):safe(g.actual),g.passed===null?'Sin evaluar':g.passed?'Cumple':'No cumple'] as Cell[]),[]
  ];
  for(const tier of o.assessment.tiers){
   rows.push([tier.label+' · '+tier.score+' / '+tier.maximum+' puntos']);
   rows.push(['Indicador','Valor alcanzado','Requisito','Peso','Puntos obtenidos','Cumple']);
   for(const line of tier.lines){
    rows.push([
     line.projected?'Categoría proyectada':line.name,
     line.projected?o.projectedCategory??'Sin cargar':safe(line.actual),
     line.required,line.weight,line.passed===true?line.weight:0,
     line.passed===null?'Sin datos':line.passed?'Sí':'No'
    ]);
   }
   rows.push(['Total',null,null,tier.maximum,tier.score,tier.passed?'Supera el mínimo':'No alcanza el mínimo']);
   rows.push([]);
  }
  sheets.push({name:'Comparación',rows});
 }
 if(o.calculations){
  const r=o.row,nullable=(n:number|undefined)=>n===undefined?null:n;
  const visits=nullable(r?.visitados),planned=nullable(r?.visitasPlaneadas),sales=nullable(r?.cntFac);
  const pdv=nullable(r?.ventaPdv),distance=nullable(r?.ventaDistancia),billing=nullable(r?.importeFinalFacturado);
  const divide=(a:number|null,b:number|null)=>a!==null&&b!==null&&b>0?a/b:null;
  const percentage=(a:number|null,b:number|null)=>{const n=divide(a,b);return n===null?null:n*100};
  const daily=(n:number|null)=>n!==null&&o.elapsedDays>0?n/o.elapsedDays:null;
  sheets.push({name:'Datos y cálculos',rows:[
   ['REDCOM · Datos y cálculos'],['Vendedor',o.name],['Sucursal',o.branch],['Mes',o.month],
   ['Categoría alcanzada',o.assessment.label],[],
   ['Indicadores comerciales'],['Indicador','Resultado (%)','Numerador','Denominador','Fórmula'],
   ['Efectividad',percentage(visits,planned),visits,planned,'(Visitados / visitas planeadas) × 100'],
   ['Eficiencia',percentage(sales,visits),sales,visits,'(Total ventas / visitados) × 100'],
   ['% Ventas en PDV',percentage(pdv,sales),pdv,sales,'(Ventas PDV / total ventas) × 100'],
   ['% Ventas a distancia',percentage(distance,planned),distance,planned,'(Ventas distancia / visitas planeadas) × 100'],
   [],['Resumen del vendedor'],['KPI','Valor'],
   ['Facturación',billing],['Total de ventas',sales],['Visitados',visits],
   ['Visitas planeadas',planned],['Venta a distancia',distance],['Venta en PDV',pdv],
   [],['Datos de facturación'],['KPI','Valor','Fórmula'],
   ['Días considerados',o.elapsedDays,'Días laborales transcurridos, sin días excluidos'],
   ['Promedio boletas diarias',daily(sales),'Total de ventas / días'],
   ['Facturación promedio diaria',daily(billing),'Facturación / días'],
   ['Promedio $ por boleta',divide(billing,sales),'Facturación / total de ventas'],
   ['Categoría según proyección',o.projectedCategory??'Sin cargar','Importada desde KPIs']
  ]});
 }
 if(!sheets.length)throw new Error('Seleccioná al menos una sección para exportar.');
 const filename='REDCOM_'+o.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'')+'_'+(o.month||'periodo')+'.xlsx';
 downloadCategoryWorkbook(sheets,filename);
}
