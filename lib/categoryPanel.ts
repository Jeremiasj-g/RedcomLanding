import { supabase } from '@/lib/supabaseClient';
import type { CategoryPanelRow } from '@/lib/categoryPanelExcel';

export type CategoryPanelState = {
  lastImportedAt: string | null;
  lastImportedBy: string | null;
  rowCount: number;
};

type DbCategoryPanelRow = {
  branch_key: string;
  branch_label: string;
  sector: number;
  seller_id: number;
  seller_name: string;
  visitados: number;
  venta_distancia: number;
  venta_pdv: number;
  visitas_planeadas: number;
  importe_final_facturado: number | string;
  cnt_fac: number;
  imported_at: string;
  imported_by: string | null;
};

function fromDbRow(row: DbCategoryPanelRow): CategoryPanelRow {
  return {
    branchKey: row.branch_key as CategoryPanelRow['branchKey'],
    branchLabel: row.branch_label,
    sector: Number(row.sector),
    sellerId: Number(row.seller_id),
    sellerName: row.seller_name,
    visitados: Number(row.visitados),
    ventaDistancia: Number(row.venta_distancia),
    ventaPdv: Number(row.venta_pdv),
    visitasPlaneadas: Number(row.visitas_planeadas),
    importeFinalFacturado: Number(row.importe_final_facturado),
    cntFac: Number(row.cnt_fac),
  };
}

export async function fetchCategoryPanelCurrent(): Promise<{
  rows: CategoryPanelRow[];
  state: CategoryPanelState;
}> {
  const [{ data: rows, error: rowsError }, { data: state, error: stateError }] =
    await Promise.all([
      supabase
        .from('category_panel_current')
        .select('*')
        .order('sector', { ascending: true }),
      supabase
        .from('category_panel_state')
        .select('last_imported_at,last_imported_by,row_count')
        .eq('id', 1)
        .maybeSingle(),
    ]);

  if (rowsError) throw rowsError;
  if (stateError) throw stateError;

  return {
    rows: ((rows ?? []) as DbCategoryPanelRow[]).map(fromDbRow),
    state: {
      lastImportedAt: state?.last_imported_at ?? null,
      lastImportedBy: state?.last_imported_by ?? null,
      rowCount: Number(state?.row_count ?? 0),
    },
  };
}

export async function replaceCategoryPanelCurrent(rows: CategoryPanelRow[]) {
  const payload = rows.map((row) => ({
    branch_key: row.branchKey,
    branch_label: row.branchLabel,
    sector: row.sector,
    seller_id: row.sellerId,
    seller_name: row.sellerName,
    visitados: row.visitados,
    venta_distancia: row.ventaDistancia,
    venta_pdv: row.ventaPdv,
    visitas_planeadas: row.visitasPlaneadas,
    importe_final_facturado: row.importeFinalFacturado,
    cnt_fac: row.cntFac,
  }));

  const { data, error } = await supabase.rpc('admin_replace_category_panel', {
    p_rows: payload,
  });

  if (error) throw error;

  return {
    rowCount: Number(data?.row_count ?? rows.length),
    importedAt: String(data?.imported_at ?? new Date().toISOString()),
  };
}
