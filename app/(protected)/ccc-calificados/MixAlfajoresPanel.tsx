"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw, UsersRound } from "lucide-react";
import { downloadSharedPersonalDetail } from "./ccc-shared-personal-detail.service";
import {
  downloadMixAlfajoresFile,
  type CccMixAlfajoresFileMeta,
} from "./ccc-mix-alfajores.service";
import { buildSellerSupervisorListFromDetailWorkbook } from "./dropsize-runtime";

const BRANCH_DETAIL_LABELS: Record<string, string> = {
  corrientes: "CASA CENTRAL",
  chaco: "SUCURSAL RESISTENCIA",
  misiones: "SUCURSAL POSADAS",
  obera: "SUCURSAL OBERA",
  refrigerados: "REFRIGERADOS",
};

type ClientMetric = {
  key: string;
  name: string;
  mix: number;
};

type VendorMetric = {
  key: string;
  code: string;
  name: string;
  supervisor: string;
  mix: number;
  clients: ClientMetric[];
};

type SupervisorMetric = {
  name: string;
  mix: number;
  clients: number;
  vendors: VendorMetric[];
};

type MixResult = {
  periodLabel: string;
  totalMix: number;
  totalClients: number;
  totalVendors: number;
  totalSupervisors: number;
  supervisors: SupervisorMetric[];
  unmatchedVendors: string[];
};

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizeName(value: unknown) {
  return normalize(value)
    .replace(/^\(?\d+\)?\s*[-–—:]\s*/, "")
    .replace(/^\(?\d+\)?\s+/, "")
    .replace(/\s*\([^)]{1,14}\)\s*$/, "")
    .replace(/\b(VENDEDOR|SUPERVISOR|SUP\.?|JEFE DE VENTAS|JEFE VENTAS|JDV)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBranch(value: unknown) {
  const branch = normalize(value);
  if (!branch) return "";
  if (branch.includes("CASA CENTRAL") || branch === "CORRIENTES") return "CASA CENTRAL";
  if (branch.includes("RESISTENCIA") || branch === "CHACO") return "SUCURSAL RESISTENCIA";
  if (branch.includes("POSADAS") || branch === "MISIONES") return "SUCURSAL POSADAS";
  if (branch.includes("OBERA")) return "SUCURSAL OBERA";
  if (branch.includes("REFRIGER") || branch.includes("REGRIGER")) return "REFRIGERADOS";
  return branch;
}

function safeNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return 0;
  const normalizedValue = raw.includes(",") && raw.includes(".")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(",", ".");
  const parsed = Number(normalizedValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value || 0);
}

function findHeaderRow(rows: unknown[][]) {
  const max = Math.min(rows.length, 20);
  for (let index = 0; index < max; index += 1) {
    const headers = (rows[index] || []).map(normalize);
    const hasClient = headers.some((header) => header === "CLIENTES" || header === "CLIENTE");
    const hasVendor = headers.some((header) => header.includes("DESCRIPCION VENDEDOR"));
    const hasQuantity = headers.some((header) => header === "CANTIDADES TOTALES");
    if (hasClient && hasVendor && hasQuantity) return index;
  }
  return 0;
}

function findHeaderIndex(headers: string[], predicate: (header: string) => boolean, fallback: number) {
  const index = headers.findIndex(predicate);
  return index >= 0 ? index : fallback;
}

async function parseMixAlfajores(params: {
  XLSX: any;
  mixFile: File;
  detailFile: File;
  branch: string;
}): Promise<MixResult> {
  const { XLSX, mixFile, detailFile, branch } = params;
  const [mixBuffer, detailBuffer] = await Promise.all([
    mixFile.arrayBuffer(),
    detailFile.arrayBuffer(),
  ]);
  const mixWorkbook = XLSX.read(mixBuffer, { type: "array", cellDates: true });
  const detailWorkbook = XLSX.read(detailBuffer, { type: "array", cellDates: true });
  const sheet = mixWorkbook.Sheets[mixWorkbook.SheetNames[0]];
  if (!sheet) throw new Error("El reporte MIX Alfajores no contiene una hoja válida.");

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  if (!rows.length) throw new Error("El reporte MIX Alfajores está vacío.");

  const headerRow = findHeaderRow(rows);
  const headers = (rows[headerRow] || []).map(normalize);
  const indices = {
    period: findHeaderIndex(headers, (header) => header === "PERIODOS", 0),
    client: findHeaderIndex(headers, (header) => header === "CLIENTES" || header === "CLIENTE", 3),
    clientCode: findHeaderIndex(headers, (header) => header.includes("COD. CLIENTE") || header === "COD CLIENTE", 4),
    vendorCode: findHeaderIndex(headers, (header) => header === "VENDEDOR" || header.includes("CODIGO VENDEDOR"), 14),
    vendor: findHeaderIndex(headers, (header) => header.includes("DESCRIPCION VENDEDOR"), 15),
    quantity: findHeaderIndex(headers, (header) => header === "CANTIDADES TOTALES", 41),
  };

  if (indices.client < 0 || indices.vendor < 0 || indices.quantity < 0) {
    throw new Error("El reporte debe contener Cliente, Descripción Vendedor y Cantidades Totales.");
  }

  const sellerList = buildSellerSupervisorListFromDetailWorkbook(XLSX, detailWorkbook) as Array<{
    sucursal: string;
    codigo: number;
    nombre: string;
    supervisor: string | null;
  }>;
  const expectedBranch = normalizeBranch(BRANCH_DETAIL_LABELS[branch] || branch);
  const localByName = new Map<string, typeof sellerList>();
  const globalByName = new Map<string, typeof sellerList>();

  const register = (map: Map<string, typeof sellerList>, key: string, seller: (typeof sellerList)[number]) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(seller);
  };

  sellerList.forEach((seller) => {
    const key = normalizeName(seller.nombre);
    register(globalByName, key, seller);
    if (normalizeBranch(seller.sucursal) === expectedBranch) register(localByName, key, seller);
  });

  const resolveSeller = (vendorName: unknown, vendorCode: unknown) => {
    const nameKey = normalizeName(vendorName);
    const code = Number(vendorCode);
    const choose = (candidates: typeof sellerList | undefined) => {
      if (!candidates?.length) return null;
      if (Number.isFinite(code)) {
        const exactCode = candidates.find((seller) => Number(seller.codigo) === code);
        if (exactCode) return exactCode;
      }
      return candidates.length === 1 ? candidates[0] : null;
    };
    return choose(localByName.get(nameKey)) || choose(globalByName.get(nameKey));
  };

  const supervisors = new Map<string, {
    name: string;
    vendors: Map<string, {
      key: string;
      code: string;
      name: string;
      supervisor: string;
      mix: number;
      clients: Map<string, ClientMetric>;
    }>;
  }>();
  const unmatched = new Set<string>();
  let periodLabel = "";

  for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const vendorName = String(row[indices.vendor] ?? "").trim();
    const clientName = String(row[indices.client] ?? "").trim();
    if (!vendorName || !clientName) continue;

    const quantity = safeNumber(row[indices.quantity]);
    if (quantity === 0) continue;
    if (!periodLabel) periodLabel = String(row[indices.period] ?? "").trim();

    const seller = resolveSeller(vendorName, row[indices.vendorCode]);
    const supervisorName = String(seller?.supervisor || "").trim();
    if (!seller || !supervisorName || normalize(supervisorName) === "SIN SUPERVISOR") {
      unmatched.add(vendorName);
      continue;
    }

    if (!supervisors.has(supervisorName)) {
      supervisors.set(supervisorName, { name: supervisorName, vendors: new Map() });
    }
    const supervisor = supervisors.get(supervisorName)!;
    const vendorKey = `${seller.codigo || row[indices.vendorCode] || ""}|${normalizeName(seller.nombre || vendorName)}`;
    if (!supervisor.vendors.has(vendorKey)) {
      supervisor.vendors.set(vendorKey, {
        key: vendorKey,
        code: String(seller.codigo || row[indices.vendorCode] || ""),
        name: String(seller.nombre || vendorName).trim(),
        supervisor: supervisorName,
        mix: 0,
        clients: new Map(),
      });
    }
    const vendor = supervisor.vendors.get(vendorKey)!;
    vendor.mix += quantity;

    const clientCode = String(row[indices.clientCode] ?? "").trim();
    const clientKey = clientCode || normalize(clientName);
    if (!vendor.clients.has(clientKey)) {
      vendor.clients.set(clientKey, { key: clientKey, name: clientName, mix: 0 });
    }
    vendor.clients.get(clientKey)!.mix += quantity;
  }

  const supervisorRows: SupervisorMetric[] = Array.from(supervisors.values()).map((supervisor) => {
    const vendors: VendorMetric[] = Array.from(supervisor.vendors.values()).map((vendor) => ({
      ...vendor,
      clients: Array.from(vendor.clients.values()).sort((a, b) => b.mix - a.mix || a.name.localeCompare(b.name)),
    })).sort((a, b) => b.mix - a.mix || a.name.localeCompare(b.name));
    return {
      name: supervisor.name,
      mix: vendors.reduce((sum, vendor) => sum + vendor.mix, 0),
      clients: new Set(vendors.flatMap((vendor) => vendor.clients.map((client) => client.key))).size,
      vendors,
    };
  }).sort((a, b) => b.mix - a.mix || a.name.localeCompare(b.name));

  const allVendors = supervisorRows.flatMap((supervisor) => supervisor.vendors);
  return {
    periodLabel,
    totalMix: supervisorRows.reduce((sum, supervisor) => sum + supervisor.mix, 0),
    totalClients: new Set(allVendors.flatMap((vendor) => vendor.clients.map((client) => client.key))).size,
    totalVendors: allVendors.length,
    totalSupervisors: supervisorRows.length,
    supervisors: supervisorRows,
    unmatchedVendors: Array.from(unmatched).sort((a, b) => a.localeCompare(b)),
  };
}

export default function MixAlfajoresPanel({
  active,
  branch,
  branchLabel,
  xlsxReady,
  fileMeta,
  personalDetailVersion,
}: {
  active: boolean;
  branch: string;
  branchLabel: string;
  xlsxReady: boolean;
  fileMeta: CccMixAlfajoresFileMeta | null;
  personalDetailVersion?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MixResult | null>(null);
  const [supervisorFilter, setSupervisorFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [openSupervisors, setOpenSupervisors] = useState<Set<string>>(new Set());
  const [openVendors, setOpenVendors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!active || !branch || !fileMeta || !xlsxReady || !personalDetailVersion) {
      if (!fileMeta) setResult(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      downloadMixAlfajoresFile(branch),
      downloadSharedPersonalDetail(),
    ])
      .then(async ([mix, detail]) => {
        const XLSX = (window as any).XLSX;
        if (!XLSX) throw new Error("El motor de Excel todavía no terminó de cargar.");
        const parsed = await parseMixAlfajores({
          XLSX,
          mixFile: mix.file,
          detailFile: detail.file,
          branch,
        });
        if (cancelled) return;
        setResult(parsed);
        setSupervisorFilter("all");
        setVendorFilter("all");
        setOpenSupervisors(new Set(parsed.supervisors.slice(0, 1).map((item) => item.name)));
        setOpenVendors(new Set());
      })
      .catch((cause) => {
        if (cancelled) return;
        console.error(cause);
        setResult(null);
        setError(cause?.message || "No se pudo procesar el reporte MIX Alfajores.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active, branch, fileMeta?.updated_at, personalDetailVersion, xlsxReady]);

  const vendorOptions = useMemo(() => {
    if (!result) return [];
    const source = supervisorFilter === "all"
      ? result.supervisors
      : result.supervisors.filter((item) => item.name === supervisorFilter);
    return source.flatMap((item) => item.vendors);
  }, [result, supervisorFilter]);

  useEffect(() => {
    if (vendorFilter !== "all" && !vendorOptions.some((vendor) => vendor.key === vendorFilter)) {
      setVendorFilter("all");
    }
  }, [vendorFilter, vendorOptions]);

  const visibleSupervisors = useMemo(() => {
    if (!result) return [];
    let supervisors = supervisorFilter === "all"
      ? result.supervisors
      : result.supervisors.filter((item) => item.name === supervisorFilter);
    if (vendorFilter !== "all") {
      supervisors = supervisors
        .map((item) => ({ ...item, vendors: item.vendors.filter((vendor) => vendor.key === vendorFilter) }))
        .filter((item) => item.vendors.length)
        .map((item) => ({
          ...item,
          mix: item.vendors.reduce((sum, vendor) => sum + vendor.mix, 0),
          clients: new Set(item.vendors.flatMap((vendor) => vendor.clients.map((client) => client.key))).size,
        }));
    }
    return supervisors;
  }, [result, supervisorFilter, vendorFilter]);

  const visibleTotals = useMemo(() => {
    const vendors = visibleSupervisors.flatMap((item) => item.vendors);
    return {
      mix: visibleSupervisors.reduce((sum, item) => sum + item.mix, 0),
      clients: new Set(vendors.flatMap((vendor) => vendor.clients.map((client) => client.key))).size,
      vendors: vendors.length,
      supervisors: visibleSupervisors.length,
    };
  }, [visibleSupervisors]);

  const toggleSupervisor = (name: string) => {
    setOpenSupervisors((current) => {
      const next = new Set(current);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleVendor = (key: string) => {
    setOpenVendors((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (!fileMeta) {
    return (
      <div className="report-empty">
        <div className="report-empty-icon">▦</div>
        <h2>Importá el reporte MIX Alfajores</h2>
        <p>Usamos Cliente (D), Descripción Vendedor (P) y Cantidades Totales (AP). La relación vendedor → supervisor se toma de Detalle personal global.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid min-h-[320px] place-items-center rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col items-center gap-3 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-500" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Procesando MIX Alfajores…</p>
            <p className="mt-1 text-xs text-slate-500">Vinculando vendedores con la jerarquía de Detalle personal.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>;
  }

  if (!result) return null;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">MIX ALFAJORES</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Seguimiento por Supervisor y Vendedor</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {result.periodLabel ? `Período detectado: ${result.periodLabel}. ` : ""}
              La cantidad de MIX se suma desde Cantidades Totales (columna AP).
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Supervisor</span>
              <select value={supervisorFilter} onChange={(event) => setSupervisorFilter(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold">
                <option value="all">Todos los supervisores</option>
                {result.supervisors.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Vendedor</span>
              <select value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold">
                <option value="all">Todos los vendedores</option>
                {vendorOptions.map((vendor) => <option key={vendor.key} value={vendor.key}>{vendor.name}</option>)}
              </select>
            </label>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="kpi-card" style={{ ["--kc" as any]: "#C8102E" }}>
          <div className="k-label">MIX VENDIDO</div>
          <div className="k-value">{formatNumber(visibleTotals.mix, 2)}</div>
          <div className="k-sub">suma neta de Cantidades Totales</div>
        </div>
        <div className="kpi-card" style={{ ["--kc" as any]: "#1E8E5A" }}>
          <div className="k-label">CLIENTES</div>
          <div className="k-value">{formatNumber(visibleTotals.clients)}</div>
          <div className="k-sub">clientes con cantidad distinta de cero</div>
        </div>
        <div className="kpi-card" style={{ ["--kc" as any]: "#1B6FA8" }}>
          <div className="k-label">VENDEDORES</div>
          <div className="k-value">{formatNumber(visibleTotals.vendors)}</div>
          <div className="k-sub">vinculados con Detalle personal</div>
        </div>
        <div className="kpi-card" style={{ ["--kc" as any]: "#C87E0A" }}>
          <div className="k-label">SUPERVISORES</div>
          <div className="k-value">{formatNumber(visibleTotals.supervisors)}</div>
          <div className="k-sub">jerarquía comercial identificada</div>
        </div>
      </div>

      {result.unmatchedVendors.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          <strong>{result.unmatchedVendors.length} vendedor{result.unmatchedVendors.length === 1 ? "" : "es"}</strong> no pudieron vincularse con un supervisor válido en Detalle personal y quedaron fuera del análisis.
        </div>
      )}

      <div className="toolbar">
        <div>
          <div className="title">Detalle por Supervisor</div>
          <div className="subtitle">Ordenado de mayor a menor cantidad de MIX vendido.</div>
        </div>
      </div>

      {visibleSupervisors.length ? visibleSupervisors.map((supervisor) => {
        const isOpen = openSupervisors.has(supervisor.name) || supervisorFilter !== "all" || vendorFilter !== "all";
        return (
          <section key={supervisor.name} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <button type="button" onClick={() => toggleSupervisor(supervisor.name)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50">
              <div className="flex min-w-0 items-center gap-3">
                {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Supervisor</div>
                  <div className="truncate text-sm font-semibold text-slate-950">{supervisor.name}</div>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 text-[11px] font-semibold">
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">{supervisor.clients} clientes</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">{supervisor.vendors.length} vendedores</span>
                <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">MIX {formatNumber(supervisor.mix, 2)}</span>
              </div>
            </button>

            {isOpen && (
              <div className="space-y-2 border-t border-slate-100 bg-slate-50/50 p-4">
                {supervisor.vendors.map((vendor) => {
                  const vendorOpen = openVendors.has(vendor.key) || vendorFilter !== "all";
                  return (
                    <div key={vendor.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <button type="button" onClick={() => toggleVendor(vendor.key)} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50">
                        <div className="flex min-w-0 items-center gap-3">
                          {vendorOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                          <UsersRound className="h-4 w-4 shrink-0 text-slate-400" />
                          <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Vendedor</div>
                            <div className="truncate text-sm font-semibold text-slate-900">{vendor.name}</div>
                          </div>
                        </div>
                        <div className="flex gap-2 text-[11px] font-semibold">
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">{vendor.clients.length} clientes</span>
                          <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">MIX {formatNumber(vendor.mix, 2)}</span>
                        </div>
                      </button>

                      {vendorOpen && (
                        <div className="border-t border-slate-100 p-3">
                          <div className="overflow-hidden rounded-lg border border-slate-200">
                            <table className="w-full border-collapse text-xs">
                              <thead className="bg-slate-900 text-white">
                                <tr>
                                  <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                                  <th className="px-3 py-2 text-right font-semibold">MIX vendido</th>
                                </tr>
                              </thead>
                              <tbody>
                                {vendor.clients.map((client) => (
                                  <tr key={client.key} className="border-t border-slate-100 first:border-t-0">
                                    <td className="px-3 py-2 font-medium text-slate-700">{client.name}</td>
                                    <td className="px-3 py-2 text-right font-semibold text-slate-950">{formatNumber(client.mix, 2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      }) : (
        <div className="report-empty">
          <div className="report-empty-icon">▦</div>
          <h2>No hay resultados para los filtros seleccionados</h2>
        </div>
      )}
    </div>
  );
}
