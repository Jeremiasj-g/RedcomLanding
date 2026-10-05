import { supabase } from '@/lib/supabaseClient';

export type ProjectTaskSheetCells = Record<string, string>;

export type ProjectTaskSheetColumnType =
  | 'text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'checkbox'
  | 'select';

export type ProjectTaskSheetColumnMeta = {
  type: ProjectTaskSheetColumnType;
  options?: string[];
  currency?: 'ARS' | 'USD';
};

export type ProjectTaskSheetColumnMetaMap = Record<
  string,
  ProjectTaskSheetColumnMeta
>;

export type ProjectTaskSheet = {
  id: number | null;
  task_id: number;
  rows_count: number;
  columns_count: number;
  cells: ProjectTaskSheetCells;
  column_meta: ProjectTaskSheetColumnMetaMap;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export const DEFAULT_SHEET_ROWS = 30;
export const DEFAULT_SHEET_COLUMNS = 12;
export const MAX_SHEET_ROWS = 200;
export const MAX_SHEET_COLUMNS = 52;

export function columnLabel(index: number) {
  let value = index + 1;
  let label = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }

  return label;
}

export function cellId(row: number, column: number) {
  return `${columnLabel(column)}${row + 1}`;
}

function columnIndex(label: string) {
  let result = 0;
  for (const char of label.toUpperCase()) {
    result = result * 26 + (char.charCodeAt(0) - 64);
  }
  return result - 1;
}

function parseCellReference(reference: string) {
  const match = /^([A-Z]+)([1-9]\d*)$/i.exec(reference.trim());
  if (!match) return null;

  return {
    column: columnIndex(match[1]),
    row: Number(match[2]) - 1,
  };
}

type FormulaToken =
  | { type: 'number'; value: number }
  | { type: 'ref'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '(' | ')' };

function tokenizeFormula(value: string): FormulaToken[] {
  const source = value.replace(/\s+/g, '');
  const tokens: FormulaToken[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (/[0-9.]/.test(char)) {
      let end = index + 1;
      while (end < source.length && /[0-9.]/.test(source[end])) end += 1;
      const raw = source.slice(index, end);
      if (!/^\d*\.?\d+$/.test(raw)) throw new Error('FORMULA');
      tokens.push({ type: 'number', value: Number(raw) });
      index = end;
      continue;
    }

    if (/[A-Za-z]/.test(char)) {
      let end = index + 1;
      while (end < source.length && /[A-Za-z0-9]/.test(source[end])) end += 1;
      const raw = source.slice(index, end).toUpperCase();
      if (!parseCellReference(raw)) throw new Error('REF');
      tokens.push({ type: 'ref', value: raw });
      index = end;
      continue;
    }

    if ('+-*/()'.includes(char)) {
      tokens.push({
        type: 'op',
        value: char as '+' | '-' | '*' | '/' | '(' | ')',
      });
      index += 1;
      continue;
    }

    throw new Error('FORMULA');
  }

  return tokens;
}

export function computeSheetCell(
  id: string,
  cells: ProjectTaskSheetCells,
  visiting = new Set<string>(),
): string {
  const raw = cells[id] ?? '';

  if (!raw.startsWith('=')) return raw;

  if (visiting.has(id)) return '#CYCLE!';

  const nextVisiting = new Set(visiting);
  nextVisiting.add(id);

  try {
    const tokens = tokenizeFormula(raw.slice(1));
    let cursor = 0;

    const readPrimary = (): number => {
      const token = tokens[cursor];
      if (!token) throw new Error('FORMULA');

      if (token.type === 'op' && (token.value === '+' || token.value === '-')) {
        cursor += 1;
        const value = readPrimary();
        return token.value === '-' ? -value : value;
      }

      if (token.type === 'number') {
        cursor += 1;
        return token.value;
      }

      if (token.type === 'ref') {
        cursor += 1;
        const referenced = computeSheetCell(token.value, cells, nextVisiting);
        if (referenced === '') return 0;
        if (referenced.startsWith('#')) throw new Error(referenced);

        const numeric = Number(referenced.replace(',', '.'));
        if (!Number.isFinite(numeric)) throw new Error('VALUE');
        return numeric;
      }

      if (token.type === 'op' && token.value === '(') {
        cursor += 1;
        const value = readExpression();
        const close = tokens[cursor];
        if (!close || close.type !== 'op' || close.value !== ')') {
          throw new Error('FORMULA');
        }
        cursor += 1;
        return value;
      }

      throw new Error('FORMULA');
    };

    const readTerm = (): number => {
      let value = readPrimary();

      while (cursor < tokens.length) {
        const token = tokens[cursor];
        if (
          token.type !== 'op' ||
          (token.value !== '*' && token.value !== '/')
        ) {
          break;
        }

        cursor += 1;
        const right = readPrimary();

        if (token.value === '*') value *= right;
        else {
          if (right === 0) throw new Error('DIV0');
          value /= right;
        }
      }

      return value;
    };

    const readExpression = (): number => {
      let value = readTerm();

      while (cursor < tokens.length) {
        const token = tokens[cursor];
        if (
          token.type !== 'op' ||
          (token.value !== '+' && token.value !== '-')
        ) {
          break;
        }

        cursor += 1;
        const right = readTerm();
        value = token.value === '+' ? value + right : value - right;
      }

      return value;
    };

    const result = readExpression();
    if (cursor !== tokens.length || !Number.isFinite(result)) {
      return '#ERROR!';
    }

    return Number.isInteger(result)
      ? String(result)
      : String(Number(result.toFixed(8)));
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'DIV0') return '#DIV/0!';
    if (code === 'VALUE') return '#VALUE!';
    if (code.startsWith('#')) return code;
    return '#ERROR!';
  }
}

export async function fetchProjectTaskSheet(
  taskId: number,
): Promise<ProjectTaskSheet> {
  const { data, error } = await supabase
    .from('project_task_sheets')
    .select('*')
    .eq('task_id', taskId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      id: null,
      task_id: taskId,
      rows_count: DEFAULT_SHEET_ROWS,
      columns_count: DEFAULT_SHEET_COLUMNS,
      cells: {},
      column_meta: {},
      updated_by: null,
      created_at: null,
      updated_at: null,
    };
  }

  return {
    ...data,
    id: Number(data.id),
    task_id: Number(data.task_id),
    rows_count: Number(data.rows_count),
    columns_count: Number(data.columns_count),
    cells: (data.cells ?? {}) as ProjectTaskSheetCells,
    column_meta: (data.column_meta ?? {}) as ProjectTaskSheetColumnMetaMap,
  } as ProjectTaskSheet;
}

export async function upsertProjectTaskSheet(params: {
  taskId: number;
  rowsCount: number;
  columnsCount: number;
  cells: ProjectTaskSheetCells;
  columnMeta: ProjectTaskSheetColumnMetaMap;
  updatedBy: string | null;
}): Promise<ProjectTaskSheet> {
  const { taskId, rowsCount, columnsCount, cells, columnMeta, updatedBy } = params;

  if (rowsCount < 1 || rowsCount > MAX_SHEET_ROWS) {
    throw new Error('Cantidad de filas fuera de rango.');
  }

  if (columnsCount < 1 || columnsCount > MAX_SHEET_COLUMNS) {
    throw new Error('Cantidad de columnas fuera de rango.');
  }

  const { data, error } = await supabase
    .from('project_task_sheets')
    .upsert(
      {
        task_id: taskId,
        rows_count: rowsCount,
        columns_count: columnsCount,
        cells,
        column_meta: columnMeta,
        updated_by: updatedBy,
      },
      { onConflict: 'task_id' },
    )
    .select('*')
    .single();

  if (error) throw error;

  return {
    ...data,
    id: Number(data.id),
    task_id: Number(data.task_id),
    rows_count: Number(data.rows_count),
    columns_count: Number(data.columns_count),
    cells: (data.cells ?? {}) as ProjectTaskSheetCells,
    column_meta: (data.column_meta ?? {}) as ProjectTaskSheetColumnMetaMap,
  } as ProjectTaskSheet;
}
