import {
  downloadSharedPersonalDetail,
  getSharedPersonalDetailMeta,
} from "./ccc-shared-personal-detail.service";

export type CccEligibleHierarchy = {
  detailVersion: string;
  eligibleKeys: Set<string>;
  eligibleNamesByBranch: Map<string, Set<string>>;
};

let cachedHierarchy: CccEligibleHierarchy | null = null;
let cachedPromise: Promise<CccEligibleHierarchy | null> | null = null;

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizePersonCode(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const normalized = Number(text.replace(",", "."));
  if (Number.isFinite(normalized) && /^\d+(?:[.,]0+)?$/.test(text)) {
    return String(Math.trunc(normalized));
  }
  return normalizeKey(text);
}

export function normalizeCccHierarchyBranch(value: unknown) {
  const normalized = normalizeKey(value);
  if (!normalized) return "";
  if (normalized === "CORRIENTES" || normalized.includes("CASA CENTRAL")) return "CASA CENTRAL";
  if (normalized === "CHACO" || normalized.includes("RESISTENCIA")) return "SUCURSAL RESISTENCIA";
  if (normalized === "MISIONES" || normalized.includes("POSADAS")) return "SUCURSAL POSADAS";
  if (normalized.includes("OBERA")) return "SUCURSAL OBERA";
  if (normalized.includes("REFRIGER") || normalized.includes("REGRIGER")) return "REFRIGERADOS";
  return normalized;
}

function branchFromAppKey(branch: string) {
  const normalized = String(branch || "").trim().toLowerCase();
  if (normalized === "corrientes") return "CASA CENTRAL";
  if (normalized === "chaco") return "SUCURSAL RESISTENCIA";
  if (normalized === "misiones") return "SUCURSAL POSADAS";
  if (normalized === "obera") return "SUCURSAL OBERA";
  if (normalized === "refrigerados") return "REFRIGERADOS";
  return normalizeCccHierarchyBranch(branch);
}

function personNameAliases(value: unknown) {
  const base = normalizeKey(value);
  if (!base) return [];
  const aliases = new Set<string>([base]);
  const withoutLeadingCode = base
    .replace(/^\(?\d+\)?\s*[-–—:]\s*/, "")
    .replace(/^\(?\d+\)?\s+/, "")
    .trim();
  if (withoutLeadingCode) aliases.add(withoutLeadingCode);
  const withoutBranchTag = withoutLeadingCode.replace(/\s*\([^)]{1,14}\)\s*$/, "").trim();
  if (withoutBranchTag) aliases.add(withoutBranchTag);
  const withoutRole = withoutBranchTag
    .replace(/\b(JEFE DE VENTAS|JEFE VENTAS|JDV|SUPERVISOR|SUP\.?|VENDEDOR)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (withoutRole) aliases.add(withoutRole);
  return Array.from(aliases).filter(Boolean);
}

function isManagerRole(role: unknown, label: unknown = "") {
  const value = normalizeKey(`${String(role ?? "")} ${String(label ?? "")}`);
  return value.includes("JEFE DE VENTAS")
    || value.includes("JEFE VENTAS")
    || /\bJDV\b/.test(value)
    || value.includes("GERENTE COMERCIAL")
    || value.includes("GERENTE");
}

function isSupervisorRole(role: unknown, label: unknown = "") {
  const value = normalizeKey(`${String(role ?? "")} ${String(label ?? "")}`);
  return value.includes("SUPERVISOR") || /\bSUP\.?\b/.test(value);
}

function looksCancelled(value: unknown) {
  const normalized = normalizeKey(value);
  return normalized === "TRUE" || normalized === "SI" || normalized === "S" || normalized === "1";
}

function findHeaderIndex(headers: string[], predicates: Array<(header: string) => boolean>, fallback = -1) {
  for (const predicate of predicates) {
    const index = headers.findIndex(predicate);
    if (index >= 0) return index;
  }
  return fallback;
}

function findHeaderRow(rows: unknown[][]) {
  const limit = Math.min(rows.length, 40);
  for (let index = 0; index < limit; index += 1) {
    const headers = (rows[index] || []).map(normalizeKey);
    const hasName = headers.some((header) => header === "DESCRIPCION" || header === "NOMBRE" || header === "VENDEDOR" || header.includes("PERSONAL"));
    const hasSuperior = headers.some((header) => header === "SUPERIOR" || header.includes("SUPERVISOR") || header.includes("JEFE"));
    const hasRole = headers.some((header) => header === "CARGO" || header.includes("PUESTO") || header === "ROL" || header.includes("FUNCION"));
    if (hasName && hasSuperior && hasRole) return index;
  }
  return 0;
}

type Person = {
  code: string;
  label: string;
  superiorLabel: string;
  role: string;
  branch: string;
};

async function buildHierarchy(file: File, detailVersion: string): Promise<CccEligibleHierarchy | null> {
  if (typeof window === "undefined") return null;
  const XLSX = (window as any).XLSX;
  if (!XLSX) return null;

  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return null;

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  const headerRow = findHeaderRow(rows);
  const headers = (rows[headerRow] || []).map(normalizeKey);
  const indices = {
    cancelled: findHeaderIndex(headers, [(header) => header === "ANULADO" || header === "ANULADA"], -1),
    code: findHeaderIndex(headers, [(header) => header === "CODIGO" || header === "COD." || header.includes("LEGAJO") || header === "ID"], 1),
    name: findHeaderIndex(headers, [(header) => header === "DESCRIPCION" || header === "NOMBRE" || header === "VENDEDOR" || header.includes("PERSONAL")], 2),
    branch: findHeaderIndex(headers, [(header) => header === "SUCURSAL" || header.includes("DESCRIPCION SUCURSAL")], 4),
    salesForce: findHeaderIndex(headers, [(header) => header.includes("FUERZA DE VENTA") || header.includes("FUERZA VENTA")], 5),
    superior: findHeaderIndex(headers, [(header) => header === "SUPERIOR" || header.includes("SUPERVISOR") || header.includes("JEFE")], 9),
    role: findHeaderIndex(headers, [(header) => header === "CARGO" || header.includes("PUESTO") || header === "ROL" || header.includes("FUNCION")], 10),
  };

  const people: Person[] = [];
  const byBranchName = new Map<string, Map<string, Person[]>>();

  const register = (person: Person) => {
    if (!byBranchName.has(person.branch)) byBranchName.set(person.branch, new Map());
    const branchMap = byBranchName.get(person.branch)!;
    for (const alias of personNameAliases(person.label)) {
      if (!branchMap.has(alias)) branchMap.set(alias, []);
      branchMap.get(alias)!.push(person);
    }
  };

  for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    if (indices.cancelled >= 0 && looksCancelled(row[indices.cancelled])) continue;
    const label = String(row[indices.name] ?? "").trim();
    if (!label) continue;
    const salesForce = String(row[indices.salesForce] ?? "").trim();
    const branch = /REFRIGER|REGRIGER/i.test(salesForce)
      ? "REFRIGERADOS"
      : normalizeCccHierarchyBranch(row[indices.branch]);
    if (!branch) continue;

    const person: Person = {
      code: normalizePersonCode(row[indices.code]),
      label,
      superiorLabel: String(row[indices.superior] ?? "").trim(),
      role: String(row[indices.role] ?? "").trim(),
      branch,
    };
    people.push(person);
    register(person);
  }

  const findByName = (value: unknown, branch: string) => {
    const branchMap = byBranchName.get(normalizeCccHierarchyBranch(branch));
    for (const alias of personNameAliases(value)) {
      const candidates = branchMap?.get(alias) || [];
      if (candidates.length) return candidates[0];
    }
    return null;
  };

  const eligibleKeys = new Set<string>();
  const eligibleNamesByBranch = new Map<string, Set<string>>();

  for (const vendor of people) {
    const numericCode = Number(vendor.code);
    if (!Number.isFinite(numericCode) || numericCode <= 0) continue;
    if (isManagerRole(vendor.role, vendor.label) || isSupervisorRole(vendor.role, vendor.label)) continue;
    if (!vendor.superiorLabel) continue;

    const supervisor = findByName(vendor.superiorLabel, vendor.branch);
    // Regla comercial: el vendedor solo entra al análisis si su superior existe
    // realmente en Detalle personal y está identificado como Supervisor.
    if (!supervisor || !isSupervisorRole(supervisor.role, supervisor.label)) continue;

    let manager: Person | null = null;
    let current: Person | null = supervisor;
    const seen = new Set<string>();
    for (let depth = 0; current?.superiorLabel && depth < 8; depth += 1) {
      const next = findByName(current.superiorLabel, current.branch);
      if (!next) break;
      const key = `${next.branch}|${normalizeKey(next.label)}`;
      if (seen.has(key)) break;
      seen.add(key);
      if (isManagerRole(next.role, next.label)) {
        manager = next;
        break;
      }
      current = next;
    }
    if (!manager) continue;

    const branch = normalizeCccHierarchyBranch(vendor.branch);
    eligibleKeys.add(`${branch}|${Math.trunc(numericCode)}`);
    if (!eligibleNamesByBranch.has(branch)) eligibleNamesByBranch.set(branch, new Set());
    const names = eligibleNamesByBranch.get(branch)!;
    personNameAliases(vendor.label).forEach((alias) => names.add(alias));
  }

  if (!eligibleKeys.size) return null;
  return { detailVersion, eligibleKeys, eligibleNamesByBranch };
}

export async function getCurrentEligibleCccHierarchy(): Promise<CccEligibleHierarchy | null> {
  if (typeof window === "undefined") return null;
  const snapshotId = Number(new URLSearchParams(window.location.search).get("ccc_snapshot") || 0);
  if (snapshotId > 0) return null;

  const meta = await getSharedPersonalDetailMeta();
  if (!meta) return null;
  const detailVersion = meta.updated_at || meta.uploaded_at;
  if (cachedHierarchy?.detailVersion === detailVersion) return cachedHierarchy;
  if (cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    try {
      const { file } = await downloadSharedPersonalDetail();
      const hierarchy = await buildHierarchy(file, detailVersion);
      cachedHierarchy = hierarchy;
      return hierarchy;
    } catch (error) {
      console.warn("[CCC] No se pudo preparar el filtro de jerarquía comercial:", error);
      return null;
    } finally {
      cachedPromise = null;
    }
  })();

  return cachedPromise;
}

function eligibleByCode(hierarchy: CccEligibleHierarchy, branch: unknown, code: unknown) {
  const normalizedCode = normalizePersonCode(code);
  if (!normalizedCode) return false;
  return hierarchy.eligibleKeys.has(`${normalizeCccHierarchyBranch(branch)}|${normalizedCode}`);
}

function eligibleByName(hierarchy: CccEligibleHierarchy, branch: unknown, name: unknown) {
  const names = hierarchy.eligibleNamesByBranch.get(normalizeCccHierarchyBranch(branch));
  if (!names?.size) return false;
  return personNameAliases(name).some((alias) => names.has(alias));
}

function sanitizeDropsizeStructure(structure: any, hierarchy: CccEligibleHierarchy, appBranch: string) {
  if (!structure?.managers || typeof structure.managers !== "object") return structure;
  const branch = branchFromAppKey(appBranch);
  const nextManagers: Record<string, any> = {};

  Object.entries<any>(structure.managers).forEach(([managerKey, manager]) => {
    if (!manager?.label) return;
    const nextSupervisors: Record<string, any> = {};
    Object.entries<any>(manager.supervisors || {}).forEach(([supervisorKey, supervisor]) => {
      const supervisorLabel = normalizeKey(supervisor?.label);
      if (!supervisorLabel || supervisorLabel === "SIN SUPERVISOR") return;
      const nextVendors: Record<string, any> = {};
      Object.entries<any>(supervisor.vendors || {}).forEach(([vendorKey, vendor]) => {
        if (!eligibleByName(hierarchy, branch, vendor?.label)) return;
        nextVendors[vendorKey] = vendor;
      });
      if (Object.keys(nextVendors).length) {
        nextSupervisors[supervisorKey] = { ...supervisor, vendors: nextVendors };
      }
    });
    if (Object.keys(nextSupervisors).length) {
      nextManagers[managerKey] = { ...manager, supervisors: nextSupervisors };
    }
  });

  return { ...structure, managers: nextManagers };
}

export async function sanitizeCccDashboardPayload<T extends any>(
  payload: T,
  appBranch: string,
): Promise<T> {
  if (!payload || typeof payload !== "object") return payload;
  const hierarchy = await getCurrentEligibleCccHierarchy();
  if (!hierarchy) return payload;

  const copy = typeof structuredClone === "function"
    ? structuredClone(payload)
    : JSON.parse(JSON.stringify(payload));

  const filterRows = (rows: any[]) => (Array.isArray(rows)
    ? rows.filter((row) => eligibleByCode(hierarchy, row?.sucursal, row?.vendCod))
    : []);

  if (Array.isArray(copy.listado)) {
    copy.listado = copy.listado.filter((vendor: any) =>
      eligibleByCode(hierarchy, vendor?.sucursal, vendor?.codigo),
    );
  }
  if (Array.isArray(copy.padron)) {
    copy.padron = copy.padron.filter((row: any) =>
      eligibleByCode(hierarchy, row?.sucursal, row?.vendCod),
    );
  }
  if (copy.reportData && typeof copy.reportData === "object") {
    copy.reportData.rows = filterRows(copy.reportData.rows);
    if (copy.reportData.rowsByLine && typeof copy.reportData.rowsByLine === "object") {
      Object.keys(copy.reportData.rowsByLine).forEach((lineCode) => {
        copy.reportData.rowsByLine[lineCode] = filterRows(copy.reportData.rowsByLine[lineCode]);
      });
    }
  }

  if (copy.dropsizeReceipt?.hierarchyByLine) {
    Object.values<any>(copy.dropsizeReceipt.hierarchyByLine).forEach((parsed) => {
      if (parsed?.structure) parsed.structure = sanitizeDropsizeStructure(parsed.structure, hierarchy, appBranch);
    });
  }
  if (copy.dropsizeIsolated?.parsed?.structure) {
    copy.dropsizeIsolated.parsed.structure = sanitizeDropsizeStructure(
      copy.dropsizeIsolated.parsed.structure,
      hierarchy,
      appBranch,
    );
  }

  return copy;
}
