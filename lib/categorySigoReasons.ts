/** Motivos admitidos en la columna Motivo del histórico SIGO. */
export const SIGO_REASONS=['Vacaciones','Desvinculado','Suspendido','Médico','Duelo','Otro'] as const;
export type SigoReason=typeof SIGO_REASONS[number];
export type SigoReasonSummary={reason:SigoReason;days:number};
type SigoReasonRow={visit_date:string;seller_id:number|null;branch:string;sales_force:string;reason:string|null};

/** Cuenta fechas distintas del mes por vendedor y equipo; los registros sin motivo no suman. */
export function summarizeSigoReasons(
 rows:readonly SigoReasonRow[],
 sellerId:number,
 branch:string,
 force:string,
):SigoReasonSummary[]{
 const byDate=new Map<string,SigoReason>();
 for(const row of rows){
  if(row.seller_id!==sellerId||row.branch!==branch||(force!=='all'&&row.sales_force!==force)||!row.reason)continue;
  const reason=SIGO_REASONS.find(item=>item===row.reason);
  if(!reason)continue;
  // Una fecha del vendedor cuenta una sola vez aunque el origen tenga filas repetidas.
  if(!byDate.has(row.visit_date))byDate.set(row.visit_date,reason);
 }
 return SIGO_REASONS.map(reason=>({reason,days:[...byDate.values()].filter(value=>value===reason).length}));
}
