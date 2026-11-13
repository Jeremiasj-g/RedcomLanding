'use client';

import type { CategoryPanelRow } from '@/lib/categoryPanelExcel';

type Props={row:CategoryPanelRow|null;elapsedDays:number;projectedCategory:string|null;month:string};
const percent=(value:number|null)=>value===null?'—':value.toLocaleString('es-AR',{maximumFractionDigits:2})+'%';
const integer=(value:number|null)=>value===null?'—':value.toLocaleString('es-AR',{maximumFractionDigits:0});
const decimal=(value:number|null)=>value===null?'—':value.toLocaleString('es-AR',{maximumFractionDigits:2});
const currency=(value:number|null)=>value===null?'—':new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}).format(value);
function Metric({title,value,items,formula}:{title:string;value:string;items:{label:string;value:string}[];formula:string}){
 return <div className="min-w-0 border-b border-slate-200 pb-5">
  <p className="text-sm font-medium text-slate-700">{title}</p>
  <p className="mt-2 break-words text-3xl font-semibold tracking-tight tabular-nums text-slate-950">{value}</p>
  <div className="mt-4 space-y-1">{items.map(item=><div key={item.label} className="flex flex-wrap items-baseline justify-between gap-1 text-xs"><span className="text-slate-500">{item.label}</span><span className="font-medium tabular-nums text-slate-800">{item.value}</span></div>)}</div>
  <p className="mt-3 text-[11px] leading-5 text-slate-400">{formula}</p>
 </div>;
}
function Datum({label,value,description}:{label:string;value:string;description?:string}){
 return <div className="min-w-0 border-b border-slate-100 py-3">
  <p className="text-xs text-slate-500">{label}</p>
  <p className="mt-1 break-words text-lg font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
  {description&&<p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
 </div>;
}
export default function SellerDataCalculations({row,elapsedDays,projectedCategory,month}:Props){
 const visits=row?.visitados??null,planned=row?.visitasPlaneadas??null,sales=row?.cntFac??null;
 const pdv=row?.ventaPdv??null,distance=row?.ventaDistancia??null,billing=row?.importeFinalFacturado??null;
 const effectiveness=planned!==null&&planned>0&&visits!==null?visits/planned*100:null;
 const efficiency=visits!==null&&visits>0&&sales!==null?sales/visits*100:null;
 const pdvRate=sales!==null&&sales>0&&pdv!==null?pdv/sales*100:null;
 const distanceRate=planned!==null&&planned>0&&distance!==null?distance/planned*100:null;
 const invoicesDaily=sales!==null&&elapsedDays>0?sales/elapsedDays:null;
 const billingDaily=billing!==null&&elapsedDays>0?billing/elapsedDays:null;
 const averageInvoice=billing!==null&&sales!==null&&sales>0?billing/sales:null;
 const dataStatus=!row?'No hay un reporte unificado para este vendedor en el mes seleccionado.':'';
 return <div className="space-y-9">
  {dataStatus&&<p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{dataStatus}</p>}
  <section>
   <h3 className="text-base font-semibold text-slate-900">Indicadores comerciales</h3>
   <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
    <Metric title="Efectividad" value={percent(effectiveness)} items={[{label:'Visitas planeadas',value:integer(planned)},{label:'Visitados',value:integer(visits)}]} formula="(Visitados / visitas planeadas) × 100"/>
    <Metric title="Eficiencia" value={percent(efficiency)} items={[{label:'Visitados',value:integer(visits)},{label:'Total de ventas',value:integer(sales)}]} formula="(Total de ventas / visitados) × 100"/>
    <Metric title="% Ventas en PDV" value={percent(pdvRate)} items={[{label:'Total de ventas',value:integer(sales)},{label:'Ventas en PDV',value:integer(pdv)}]} formula="(Ventas PDV / total de ventas) × 100"/>
    <Metric title="% Ventas a distancia" value={percent(distanceRate)} items={[{label:'Visitas planeadas',value:integer(planned)},{label:'Ventas a distancia',value:integer(distance)}]} formula="(Ventas a distancia / visitas planeadas) × 100"/>
   </div>
  </section>
  <section className="border-t border-slate-200 pt-7">
   <h3 className="text-base font-semibold text-slate-900">Resumen del vendedor</h3>
   <div className="mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
    <Datum label="Facturación" value={currency(billing)} description="Importe final facturado"/>
    <Datum label="Total de ventas" value={integer(sales)} description="Cantidad de facturas / boletas"/>
    <Datum label="Visitados" value={integer(visits)} description="Clientes visitados"/>
    <Datum label="Visitas planeadas" value={integer(planned)} description="Objetivo de visitas"/>
    <Datum label="Venta a distancia" value={integer(distance)} description="Ventas sin PDV"/>
    <Datum label="Venta en PDV" value={integer(pdv)} description="Ventas en punto de venta"/>
   </div>
  </section>
  <section className="border-t border-slate-200 pt-7">
   <h3 className="text-base font-semibold text-slate-900">Datos de facturación</h3>
   <div className="mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-3 xl:grid-cols-5">
    <Datum label="Días considerados" value={integer(elapsedDays)} description="Lunes a sábado, sin días excluidos"/>
    <Datum label="Promedio boletas diarias" value={decimal(invoicesDaily)} description="Total de ventas / días"/>
    <Datum label="Facturación promedio diaria" value={currency(billingDaily)} description="Facturación / días"/>
    <Datum label="Promedio $ por boleta" value={currency(averageInvoice)} description="Facturación / ventas"/>
    <Datum label="Categoría según proyección" value={projectedCategory??'Sin cargar'} description="Importada desde la plantilla de KPIs"/>
   </div>
   {elapsedDays===0&&<p className="mt-3 text-xs text-amber-700">No hay días laborales transcurridos para este período. Los promedios diarios se muestran sin valor hasta contar con días válidos.</p>}
  </section>
 </div>;
}
