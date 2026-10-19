export type CategoryPanelBranchKey =
  | 'corrientes_masivos'
  | 'corrientes_refrigerados'
  | 'chaco'
  | 'misiones'
  | 'obera';

export type CategoryPanelRow = {
  branchKey: CategoryPanelBranchKey;
  branchLabel: string;
  sector: number;
  sellerId: number;
  sellerName: string;
  visitados: number;
  ventaDistancia: number;
  ventaPdv: number;
  visitasPlaneadas: number;
  importeFinalFacturado: number;
  cntFac: number;
  partialUpdatedAt?: string | null;
  partialUpdateSource?: string | null;
};

export type CategoryPanelMismatch = {
  key: string;
  branchLabel: string;
  sellerId: number;
  sellerName: string;
  source: 'pivot' | 'tmp';
};

export type CategoryPanelNameMismatch = {
  key: string;
  branchLabel: string;
  sellerId: number;
  pivotName: string;
  tmpName: string;
};

export type CategoryPanelParseResult = {
  rows: CategoryPanelRow[];
  pivotCount: number;
  tmpCount: number;
  unmatchedPivot: CategoryPanelMismatch[];
  unmatchedTmp: CategoryPanelMismatch[];
  nameMismatches: CategoryPanelNameMismatch[];
  duplicateKeys: string[];
  canSave: boolean;
};

type CellValue = string | number | boolean | null;
type Matrix = CellValue[][];

type PivotRecord = {
  key: string;
  branchKey: CategoryPanelBranchKey;
  branchLabel: string;
  sector: number;
  sellerId: number;
  sellerName: string;
  visitados: number;
  ventaDistancia: number;
  ventaPdv: number;
  visitasPlaneadas: number;
};

type TmpRecord = {
  key: string;
  branchKey: CategoryPanelBranchKey;
  branchLabel: string;
  sellerId: number;
  sellerName: string;
  importeFinalFacturado: number;
  cntFac: number;
};

const BRANCH_META: Record<
  CategoryPanelBranchKey,
  { label: string; order: number }
> = {
  corrientes_masivos: { label: 'Corrientes', order: 1 },
  corrientes_refrigerados: { label: 'Corrientes Refrigerados', order: 2 },
  chaco: { label: 'Chaco', order: 3 },
  misiones: { label: 'Misiones', order: 4 },
  obera: { label: 'Oberá', order: 5 },
};

function cleanText(value: unknown) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value: unknown) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function toNumber(value: CellValue) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean' || value === null) return 0;

  const raw = cleanText(value);
  if (!raw) return 0;

  const normalized =
    raw.includes(',') && !raw.includes('.')
      ? raw.replace(',', '.')
      : raw.replace(/,/g, '');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toInteger(value: CellValue) {
  return Math.round(toNumber(value));
}

function sellerIdentityFromSector(sector: number) {
  if (sector >= 1000 && sector < 1100) {
    return {
      branchKey: 'corrientes_masivos' as const,
      sellerId: sector - 1000,
    };
  }

  if (sector >= 1100 && sector < 1200) {
    return {
      branchKey: 'corrientes_refrigerados' as const,
      sellerId: sector - 1000,
    };
  }

  if (sector >= 2000 && sector < 3000) {
    return {
      branchKey: 'chaco' as const,
      sellerId: sector - 2000,
    };
  }

  if (sector >= 3000 && sector < 4000) {
    return {
      branchKey: 'misiones' as const,
      sellerId: sector - 3000,
    };
  }

  if (sector >= 4000 && sector < 5000) {
    return {
      branchKey: 'obera' as const,
      sellerId: sector - 4000,
    };
  }

  return null;
}

function makeKey(branchKey: CategoryPanelBranchKey, sellerId: number) {
  return `${branchKey}:${sellerId}`;
}

function findHeaderIndex(row: CellValue[], label: string) {
  const target = normalizeText(label);
  return row.findIndex((cell) => normalizeText(cell) === target);
}

function parsePivot(matrix: Matrix) {
  const headerRowIndex = matrix.findIndex((row) =>
    (row ?? []).some((cell) => normalizeText(cell) === 'SECTOR DE VENTAS'),
  );

  if (headerRowIndex < 0) {
    throw new Error(
      'No se encontró la columna "Sector de Ventas" en el reporte PivotGrid.',
    );
  }

  const headers = matrix[headerRowIndex] ?? [];
  const sectorIndex = findHeaderIndex(headers, 'Sector de Ventas');
  const visitadosIndex = findHeaderIndex(headers, 'Visitados');
  const distanciaIndex = findHeaderIndex(headers, 'Venta a Distancia');
  const pdvIndex = headers.findIndex((cell) =>
    ['VENTA EN EL PDV', 'VENTA EN PDV'].includes(normalizeText(cell)),
  );
  const planeadasIndex = findHeaderIndex(headers, 'Visitas Planeadas');

  if (
    [sectorIndex, visitadosIndex, distanciaIndex, pdvIndex, planeadasIndex].some(
      (index) => index < 0,
    )
  ) {
    throw new Error(
      'El reporte PivotGrid no contiene todas las columnas necesarias.',
    );
  }

  const records: PivotRecord[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();

  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const sectorRaw = cleanText(row[sectorIndex]);
    if (!sectorRaw) continue;

    const match = sectorRaw.match(/^\d+-(\d+)\s*-\s*(.+)$/);
    if (!match) continue;

    const sector = Number(match[1]);
    const sellerName = cleanText(match[2]);
    const normalizedName = normalizeText(sellerName);

    if (
      !Number.isFinite(sector) ||
      !sellerName ||
      normalizedName.includes('SIN VENDEDOR') ||
      normalizedName.includes('ESQUEMA')
    ) {
      continue;
    }

    const identity = sellerIdentityFromSector(sector);
    if (!identity || identity.sellerId <= 0) continue;

    const branchLabel = BRANCH_META[identity.branchKey].label;
    const key = makeKey(identity.branchKey, identity.sellerId);

    if (seen.has(key)) {
      duplicates.push(key);
      continue;
    }
    seen.add(key);

    records.push({
      key,
      branchKey: identity.branchKey,
      branchLabel,
      sector,
      sellerId: identity.sellerId,
      sellerName,
      visitados: toInteger(row[visitadosIndex]),
      ventaDistancia: toInteger(row[distanciaIndex]),
      ventaPdv: toInteger(row[pdvIndex]),
      visitasPlaneadas: toInteger(row[planeadasIndex]),
    });
  }

  if (!records.length) {
    throw new Error('No se encontraron vendedores válidos en PivotGrid.');
  }

  return { records, duplicates };
}

function detectTmpBranch(
  description: string,
  currentBranch: CategoryPanelBranchKey | null,
) {
  const normalized = normalizeText(description);

  if (normalized === 'CASA CENTRAL') {
    return 'corrientes_masivos' as const;
  }

  if (
    normalized.includes('ESQUEMA REGRIGERADOS') ||
    normalized.includes('ESQUEMA REFRIGERADOS')
  ) {
    return 'corrientes_refrigerados' as const;
  }

  if (normalized.includes('SUCURSAL RESISTENCIA')) {
    return 'chaco' as const;
  }

  if (normalized.includes('SUCURSAL POSADAS')) {
    return 'misiones' as const;
  }

  if (normalized.includes('SUCURSAL OBERA')) {
    return 'obera' as const;
  }

  return currentBranch;
}

function parseTmp(matrix: Matrix) {
  const headerRowIndex = matrix.findIndex((row) => {
    const normalized = (row ?? []).map(normalizeText);
    return (
      normalized.includes('CODIGO') &&
      normalized.includes('DESCRIPCION') &&
      normalized.includes('IMPORTE FINAL FACTURADO') &&
      normalized.includes('CNT.FAC.')
    );
  });

  if (headerRowIndex < 0) {
    throw new Error(
      'No se encontró el encabezado esperado en el reporte de facturación TMP.',
    );
  }

  const headers = matrix[headerRowIndex] ?? [];
  const codeIndex = headers.findIndex((cell) => normalizeText(cell) === 'CODIGO');
  const descriptionIndex = headers.findIndex(
    (cell) => normalizeText(cell) === 'DESCRIPCION',
  );
  const amountIndex = headers.findIndex(
    (cell) => normalizeText(cell) === 'IMPORTE FINAL FACTURADO',
  );
  const invoicesIndex = headers.findIndex(
    (cell) => normalizeText(cell) === 'CNT.FAC.',
  );

  const records: TmpRecord[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();
  let currentBranch: CategoryPanelBranchKey | null = null;

  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const description = cleanText(row[descriptionIndex]);
    if (!description) continue;

    currentBranch = detectTmpBranch(description, currentBranch);

    const normalizedDescription = normalizeText(description);
    if (
      !currentBranch ||
      normalizedDescription.includes('SIN VENDEDOR') ||
      normalizedDescription.includes('ESQUEMA') ||
      normalizedDescription.startsWith('SUCURSAL ') ||
      normalizedDescription === 'CASA CENTRAL'
    ) {
      continue;
    }

    const sellerId = toInteger(row[codeIndex]);
    if (sellerId <= 0) continue;

    const amountCell = row[amountIndex];
    const invoicesCell = row[invoicesIndex];

    if (
      (amountCell === null || cleanText(amountCell) === '') &&
      (invoicesCell === null || cleanText(invoicesCell) === '')
    ) {
      continue;
    }

    const branchLabel = BRANCH_META[currentBranch].label;
    const key = makeKey(currentBranch, sellerId);

    if (seen.has(key)) {
      duplicates.push(key);
      continue;
    }
    seen.add(key);

    records.push({
      key,
      branchKey: currentBranch,
      branchLabel,
      sellerId,
      sellerName: description,
      importeFinalFacturado: toNumber(amountCell),
      cntFac: toInteger(invoicesCell),
    });
  }

  if (!records.length) {
    throw new Error(
      'No se encontraron vendedores válidos en el reporte de facturación TMP.',
    );
  }

  return { records, duplicates };
}

function compareSellerNames(a: string, b: string) {
  return normalizeText(a) === normalizeText(b);
}

export function unifyCategoryPanelMatrices(
  pivotMatrix: Matrix,
  tmpMatrix: Matrix,
): CategoryPanelParseResult {
  const pivot = parsePivot(pivotMatrix);
  const tmp = parseTmp(tmpMatrix);

  const tmpByKey = new Map(tmp.records.map((record) => [record.key, record]));
  const pivotByKey = new Map(
    pivot.records.map((record) => [record.key, record]),
  );

  const rows: CategoryPanelRow[] = [];
  const unmatchedPivot: CategoryPanelMismatch[] = [];
  const unmatchedTmp: CategoryPanelMismatch[] = [];
  const nameMismatches: CategoryPanelNameMismatch[] = [];

  for (const pivotRecord of pivot.records) {
    const tmpRecord = tmpByKey.get(pivotRecord.key);

    if (!tmpRecord) {
      unmatchedPivot.push({
        key: pivotRecord.key,
        branchLabel: pivotRecord.branchLabel,
        sellerId: pivotRecord.sellerId,
        sellerName: pivotRecord.sellerName,
        source: 'pivot',
      });
      continue;
    }

    if (!compareSellerNames(pivotRecord.sellerName, tmpRecord.sellerName)) {
      nameMismatches.push({
        key: pivotRecord.key,
        branchLabel: pivotRecord.branchLabel,
        sellerId: pivotRecord.sellerId,
        pivotName: pivotRecord.sellerName,
        tmpName: tmpRecord.sellerName,
      });
    }

    rows.push({
      branchKey: pivotRecord.branchKey,
      branchLabel: pivotRecord.branchLabel,
      sector: pivotRecord.sector,
      sellerId: pivotRecord.sellerId,
      sellerName: pivotRecord.sellerName,
      visitados: pivotRecord.visitados,
      ventaDistancia: pivotRecord.ventaDistancia,
      ventaPdv: pivotRecord.ventaPdv,
      visitasPlaneadas: pivotRecord.visitasPlaneadas,
      importeFinalFacturado: tmpRecord.importeFinalFacturado,
      cntFac: tmpRecord.cntFac,
    });
  }

  for (const tmpRecord of tmp.records) {
    if (pivotByKey.has(tmpRecord.key)) continue;

    unmatchedTmp.push({
      key: tmpRecord.key,
      branchLabel: tmpRecord.branchLabel,
      sellerId: tmpRecord.sellerId,
      sellerName: tmpRecord.sellerName,
      source: 'tmp',
    });
  }

  rows.sort((a, b) => {
    const branchOrder =
      BRANCH_META[a.branchKey].order - BRANCH_META[b.branchKey].order;
    if (branchOrder !== 0) return branchOrder;
    return a.sellerId - b.sellerId;
  });

  const duplicateKeys = Array.from(
    new Set([...pivot.duplicates, ...tmp.duplicates]),
  );

  return {
    rows,
    pivotCount: pivot.records.length,
    tmpCount: tmp.records.length,
    unmatchedPivot,
    unmatchedTmp,
    nameMismatches,
    duplicateKeys,
    canSave:
      rows.length > 0 &&
      unmatchedPivot.length === 0 &&
      unmatchedTmp.length === 0 &&
      duplicateKeys.length === 0,
  };
}

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

function readUint16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const minimumOffset = Math.max(0, bytes.length - 65557);

  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      return offset;
    }
  }

  return -1;
}

function listZipEntries(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(bytes);

  if (eocdOffset < 0) {
    throw new Error('El archivo no parece ser un XLSX válido.');
  }

  const totalEntries = readUint16(view, eocdOffset + 10);
  const centralDirectoryOffset = readUint32(view, eocdOffset + 16);
  const decoder = new TextDecoder('utf-8');

  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (readUint32(view, offset) !== 0x02014b50) {
      throw new Error('No se pudo leer la estructura interna del XLSX.');
    }

    const compressionMethod = readUint16(view, offset + 10);
    const compressedSize = readUint32(view, offset + 20);
    const fileNameLength = readUint16(view, offset + 28);
    const extraLength = readUint16(view, offset + 30);
    const commentLength = readUint16(view, offset + 32);
    const localHeaderOffset = readUint32(view, offset + 42);
    const name = decoder.decode(
      bytes.slice(offset + 46, offset + 46 + fileNameLength),
    );

    entries.push({
      name,
      compressionMethod,
      compressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return { bytes, view, entries };
}

async function decompressDeflateRaw(data: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'Tu navegador no permite leer XLSX localmente. Probá con una versión reciente de Chrome o Edge.',
    );
  }

  const stream = new Blob([data])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipEntry(
  buffer: ArrayBuffer,
  matcher: (name: string) => boolean,
) {
  const { bytes, view, entries } = listZipEntries(buffer);
  const entry = entries.find((candidate) => matcher(candidate.name));

  if (!entry) return null;

  const localOffset = entry.localHeaderOffset;
  if (readUint32(view, localOffset) !== 0x04034b50) {
    throw new Error('No se pudo abrir una hoja dentro del XLSX.');
  }

  const fileNameLength = readUint16(view, localOffset + 26);
  const extraLength = readUint16(view, localOffset + 28);
  const dataOffset = localOffset + 30 + fileNameLength + extraLength;
  const compressed = bytes.slice(
    dataOffset,
    dataOffset + entry.compressedSize,
  );

  if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod === 8) {
    return decompressDeflateRaw(compressed);
  }

  throw new Error(
    `El XLSX usa un método de compresión no soportado (${entry.compressionMethod}).`,
  );
}

function parseXml(bytes: Uint8Array, label: string) {
  const xml = new TextDecoder('utf-8').decode(bytes);
  const document = new DOMParser().parseFromString(xml, 'application/xml');

  if (document.querySelector('parsererror')) {
    throw new Error(`No se pudo leer ${label} dentro del XLSX.`);
  }

  return document;
}

function parseSharedStrings(document: Document | null) {
  if (!document) return [] as string[];

  return Array.from(document.getElementsByTagName('si')).map((item) =>
    Array.from(item.getElementsByTagName('t'))
      .map((textNode) => textNode.textContent ?? '')
      .join(''),
  );
}

function columnIndexFromCellReference(reference: string) {
  const match = reference.match(/^([A-Z]+)/i);
  if (!match) return 0;

  return match[1]
    .toUpperCase()
    .split('')
    .reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseWorksheet(document: Document, sharedStrings: string[]) {
  const rows: Matrix = [];

  for (const rowNode of Array.from(document.getElementsByTagName('row'))) {
    const rowIndex = Math.max(
      0,
      Number(rowNode.getAttribute('r') || rows.length + 1) - 1,
    );
    const row: CellValue[] = rows[rowIndex] ?? [];

    for (const cellNode of Array.from(rowNode.getElementsByTagName('c'))) {
      const reference = cellNode.getAttribute('r') || '';
      const columnIndex = columnIndexFromCellReference(reference);
      const type = cellNode.getAttribute('t') || '';
      const valueNode = cellNode.getElementsByTagName('v')[0];
      const rawValue = valueNode?.textContent ?? '';

      let value: CellValue = null;

      if (type === 's') {
        value = sharedStrings[Number(rawValue)] ?? '';
      } else if (type === 'inlineStr') {
        value = Array.from(cellNode.getElementsByTagName('t'))
          .map((node) => node.textContent ?? '')
          .join('');
      } else if (type === 'str') {
        value = rawValue;
      } else if (type === 'b') {
        value = rawValue === '1';
      } else if (rawValue !== '') {
        const numeric = Number(rawValue);
        value = Number.isFinite(numeric) ? numeric : rawValue;
      }

      row[columnIndex] = value;
    }

    rows[rowIndex] = row;
  }

  return rows;
}

export async function readFirstWorksheet(file: File): Promise<Matrix> {
  const buffer = await file.arrayBuffer();

  const [sharedStringBytes, sheetBytes] = await Promise.all([
    readZipEntry(buffer, (name) => name === 'xl/sharedStrings.xml'),
    readZipEntry(
      buffer,
      (name) =>
        name === 'xl/worksheets/sheet1.xml' ||
        /^xl\/worksheets\/sheet\d+\.xml$/i.test(name),
    ),
  ]);

  if (!sheetBytes) {
    throw new Error(
      `No se encontró una hoja de cálculo dentro de ${file.name}.`,
    );
  }

  const sharedStrings = parseSharedStrings(
    sharedStringBytes
      ? parseXml(sharedStringBytes, 'los textos compartidos')
      : null,
  );

  return parseWorksheet(
    parseXml(sheetBytes, 'la primera hoja'),
    sharedStrings,
  );
}

export async function parseCategoryPanelFiles(
  pivotFile: File,
  tmpFile: File,
): Promise<CategoryPanelParseResult> {
  const [pivotMatrix, tmpMatrix] = await Promise.all([
    readFirstWorksheet(pivotFile),
    readFirstWorksheet(tmpFile),
  ]);

  return unifyCategoryPanelMatrices(pivotMatrix, tmpMatrix);
}

/** Importación parcial de PivotGrid: no requiere el reporte TMP. */
export async function parseSingleSellerPivot(file: File) {
  const matrix = await readFirstWorksheet(file);
  const parsed = parsePivot(matrix);
  if (parsed.duplicates.length) throw new Error('El reporte contiene IDs duplicados.');
  if (parsed.records.length !== 1) {
    throw new Error(`El archivo debe contener exactamente un vendedor. Se encontraron ${parsed.records.length}.`);
  }
  const { key, ...seller } = parsed.records[0];
  return seller;
}

/** TMP individual o general. Agrupa las filas del mismo vendedor (por período). */
export async function parseTmpSellerTotals(file: File) {
 const matrix = await readFirstWorksheet(file);
 const headerIndex = matrix.findIndex(row => {
   const values=(row??[]).map(normalizeText);
   return values.includes('CODIGO') && values.includes('DESCRIPCION') &&
     values.includes('IMPORTE FINAL FACTURADO') && values.includes('CNT.FAC.');
 });
 if(headerIndex<0) throw new Error('No se reconocieron las columnas del TMP.');
 const headers=matrix[headerIndex]??[];
 const ci=findHeaderIndex(headers,'Código'), di=findHeaderIndex(headers,'Descripción');
 const ai=findHeaderIndex(headers,'Importe Final Facturado'), ni=findHeaderIndex(headers,'Cnt.Fac.');
 const groups=new Map<string,{branchKey:CategoryPanelBranchKey;branchLabel:string;sellerId:number;sellerName:string;amount:number;invoices:number;periods:number}>();
 let branch:CategoryPanelBranchKey|null=null;
 for(const row of matrix.slice(headerIndex+1)){
   if(!row)continue;
   // Las filas de fecha/subtotal de cada período no son vendedores.
   if(typeof row[di] !== 'string') continue;
   const desc=cleanText(row[di]);
   if(!desc || /^\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}/.test(desc)) continue;
   branch=detectTmpBranch(desc,branch);
   const label=normalizeText(desc);
   if(!branch || label==='CASA CENTRAL' || label.includes('ESQUEMA') ||
     label.startsWith('SUCURSAL ') || label.includes('SIN VENDEDOR'))continue;
   const id=toInteger(row[ci]);
   if(id<=0)continue;
   if(cleanText(row[ai])==='' && cleanText(row[ni])==='')continue;
   const key=makeKey(branch,id),prev=groups.get(key);
   if(prev){
     prev.amount+=toNumber(row[ai]);
     prev.invoices+=toInteger(row[ni]);
     prev.periods++;
   } else {
     groups.set(key,{branchKey:branch,branchLabel:BRANCH_META[branch].label,
       sellerId:id,sellerName:desc,amount:toNumber(row[ai]),
       invoices:toInteger(row[ni]),periods:1});
   }
 }
 if(!groups.size)throw new Error('No se encontraron vendedores válidos en el TMP.');
 return [...groups.values()].sort((a,b)=>a.branchLabel.localeCompare(b.branchLabel,'es')||a.sellerId-b.sellerId);
}
