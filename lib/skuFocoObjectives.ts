export type ObjectiveValues = Record<string, number>;
type WorkbookRow = Record<string, unknown>;
const normalize = (value: unknown) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/^\s*\(\d+\)\s*/, '').replace(/\s+/g, ' ').trim().toUpperCase();

export function objectiveKey(sellerId: number, line: string): string {
  return `${sellerId}|${normalize(line)}`;
}

/**
 * Excel format: first row = seller headers "20 ALAN AYALA", subsequent rows
 * = sales line labels "01 SECCO". Always match using seller ID, never name.
 * These matrices are for Casa Central (branch code 1).
 */
export function parseObjectiveMatrix(rows: WorkbookRow[]): ObjectiveValues {
  if (!rows.length) throw new Error('La planilla de objetivos está vacía.');
  const headers = Object.keys(rows[0]);
  const sellerColumns = headers.map(header => {
    const id = /^\s*(\d+)\s+/.exec(header);
    return {header, id: id ? Number(id[1]) : null};
  }).filter((column): column is {header:string;id:number} =>
    column.id !== null && column.id > 0);
  if (!sellerColumns.length) throw new Error('No se encontraron encabezados con ID de vendedor.');
  const descriptionColumn = headers.find(h => !sellerColumns.some(c => c.header === h));
  if (!descriptionColumn) throw new Error('No se encontró la columna de líneas.');
  const output: ObjectiveValues = {};
  for (const row of rows) {
    const line = normalize(row[descriptionColumn]);
    if (!line) continue;
    for (const col of sellerColumns) {
      const value = row[col.header];
      if (value === null || value === undefined || String(value).trim() === '') continue;
      const amount = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
      if (Number.isFinite(amount)) output[objectiveKey(col.id, line)] = amount;
    }
  }
  if (!Object.keys(output).length) throw new Error('No se encontraron objetivos numéricos.');
  return output;
}

export function findLineObjective(
  objectives: ObjectiveValues,
  vendorKey: string,
  ...lineLabels: string[]
): number | null {
  const [branch, sellerText] = vendorKey.split(':');
  // Los objetivos suministrados son de Casa Central; no asignar
  // accidentalmente el ID 01 de otra sucursal.
  if (branch !== '1') return null;
  const sellerId = Number(sellerText);
  for (const label of lineLabels) {
    const key = objectiveKey(sellerId, label);
    if (Object.prototype.hasOwnProperty.call(objectives, key)) return objectives[key];
  }
  return null;
}
