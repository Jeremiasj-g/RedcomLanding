"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Clock3, RefreshCw, Trophy, UsersRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { CCC_BRANCH_LABELS } from "./ccc-client-base.service";
import { downloadSharedPersonalDetail } from "./ccc-shared-personal-detail.service";
import { buildSellerSupervisorListFromDetailWorkbook } from "./dropsize-runtime";

const COMPETITION_END = new Date("2026-10-01T00:00:00-03:00").getTime();

const BRANCH_DETAIL_LABELS: Record<string, string> = {
  corrientes: "CASA CENTRAL",
  chaco: "SUCURSAL RESISTENCIA",
  misiones: "SUCURSAL POSADAS",
  obera: "SUCURSAL OBERA",
  refrigerados: "REFRIGERADOS",
};

type CompetitionReport = {
  branch_key: string;
  storage_path: string;
  original_name: string;
  uploaded_by?: string | null;
  uploaded_by_name?: string | null;
  uploaded_at: string;
  updated_at: string;
  signed_url: string;
};

type VendorStanding = {
  key: string;
  name: string;
  code: string;
  mix: number;
  clients: Set<string>;
};

type SupervisorStanding = {
  key: string;
  branchKey: string;
  branchLabel: string;
  name: string;
  mix: number;
  clients: number;
  vendors: Array<{
    key: string;
    name: string;
    code: string;
    mix: number;
    clients: number;
  }>;
};

type CompetitionResult = {
  supervisors: SupervisorStanding[];
  totalMix: number;
  totalClients: number;
  totalVendors: number;
  unmatchedVendors: string[];
  reports: CompetitionReport[];
  latestUpdate: string | null;
  branchesWithReports: number;
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

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function branchLabel(branch: string) {
  return CCC_BRANCH_LABELS[branch] || branch || "Sucursal";
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

function calculateRemaining() {
  const remaining = Math.max(0, COMPETITION_END - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    finished: remaining <= 0,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

async function getCompetitionReports(): Promise<CompetitionReport[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("La sesión venció. Volvé a iniciar sesión.");

  const response = await fetch("/api/ccc/alfajores-competition", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || "No se pudieron consultar los reportes de la competencia.");
  return Array.isArray(body?.reports) ? body.reports : [];
}

async function buildCompetitionResult(): Promise<CompetitionResult> {
  const XLSX = (window as any).XLSX;
  if (!XLSX) throw new Error("El motor de Excel todavía no terminó de cargar.");

  const [reports, detail] = await Promise.all([
    getCompetitionReports(),
    downloadSharedPersonalDetail(),
  ]);

  if (!reports.length) {
    return {
      supervisors: [],
      totalMix: 0,
      totalClients: 0,
      totalVendors: 0,
      unmatchedVendors: [],
      reports: [],
      latestUpdate: null,
      branchesWithReports: 0,
    };
  }

  const detailWorkbook = XLSX.read(await detail.file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
  const sellerList = buildSellerSupervisorListFromDetailWorkbook(XLSX, detailWorkbook) as Array<{
    sucursal: string;
    codigo: number;
    nombre: string;
    supervisor: string | null;
  }>;

  const globalByName = new Map<string, typeof sellerList>();
  const localByBranchAndName = new Map<string, typeof sellerList>();
  const register = (map: Map<string, typeof sellerList>, key: string, seller: (typeof sellerList)[number]) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(seller);
  };

  sellerList.forEach((seller) => {
    const nameKey = normalizeName(seller.nombre);
    register(globalByName, nameKey, seller);
    register(localByBranchAndName, `${normalizeBranch(seller.sucursal)}|${nameKey}`, seller);
  });

  const resolveSeller = (vendorName: unknown, vendorCode: unknown, reportBranch: string) => {
    const nameKey = normalizeName(vendorName);
    const expectedBranch = normalizeBranch(BRANCH_DETAIL_LABELS[reportBranch] || reportBranch);
    const code = Number(vendorCode);
    const choose = (candidates: typeof sellerList | undefined) => {
      if (!candidates?.length) return null;
      if (Number.isFinite(code)) {
        const exactCode = candidates.find((seller) => Number(seller.codigo) === code);
        if (exactCode) return exactCode;
      }
      return candidates.length === 1 ? candidates[0] : null;
    };
    return (
      choose(localByBranchAndName.get(`${expectedBranch}|${nameKey}`)) ||
      choose(globalByName.get(nameKey))
    );
  };

  const supervisors = new Map<string, {
    key: string;
    branchKey: string;
    branchLabel: string;
    name: string;
    vendors: Map<string, VendorStanding>;
  }>();
  const unmatched = new Set<string>();

  const downloadedReports = await Promise.all(
    reports.map(async (meta) => {
      const response = await fetch(meta.signed_url, { cache: "no-store" });
      if (!response.ok) throw new Error(`No se pudo leer ${meta.original_name}.`);
      return { meta, buffer: await response.arrayBuffer() };
    }),
  );

  for (const report of downloadedReports) {
    const reportBranch = String(report.meta.branch_key || "").trim().toLowerCase();
    const workbook = XLSX.read(report.buffer, { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
    if (!rows.length) continue;

    const headerRow = findHeaderRow(rows);
    const headers = (rows[headerRow] || []).map(normalize);
    const clientIndex = findHeaderIndex(headers, (header) => header === "CLIENTES" || header === "CLIENTE", 3);
    const clientCodeIndex = findHeaderIndex(headers, (header) => header.includes("COD. CLIENTE") || header === "COD CLIENTE", 4);
    const vendorCodeIndex = findHeaderIndex(headers, (header) => header === "VENDEDOR" || header.includes("CODIGO VENDEDOR"), 14);
    const vendorIndex = findHeaderIndex(headers, (header) => header.includes("DESCRIPCION VENDEDOR"), 15);
    const quantityIndex = findHeaderIndex(headers, (header) => header === "CANTIDADES TOTALES", 41);

    for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] || [];
      const vendorName = String(row[vendorIndex] ?? "").trim();
      const clientName = String(row[clientIndex] ?? "").trim();
      if (!vendorName || !clientName) continue;

      const quantity = safeNumber(row[quantityIndex]);
      if (quantity === 0) continue;

      const seller = resolveSeller(vendorName, row[vendorCodeIndex], reportBranch);
      const supervisorName = String(seller?.supervisor || "").trim();
      if (!seller || !supervisorName || normalize(supervisorName) === "SIN SUPERVISOR") {
        unmatched.add(`${branchLabel(reportBranch)} · ${vendorName}`);
        continue;
      }

      const supervisorKey = `${reportBranch}|${normalizeName(supervisorName)}`;
      if (!supervisors.has(supervisorKey)) {
        supervisors.set(supervisorKey, {
          key: supervisorKey,
          branchKey: reportBranch,
          branchLabel: branchLabel(reportBranch),
          name: supervisorName,
          vendors: new Map(),
        });
      }
      const supervisor = supervisors.get(supervisorKey)!;
      const vendorKey = `${reportBranch}|${seller.codigo || row[vendorCodeIndex] || ""}|${normalizeName(seller.nombre || vendorName)}`;
      if (!supervisor.vendors.has(vendorKey)) {
        supervisor.vendors.set(vendorKey, {
          key: vendorKey,
          code: String(seller.codigo || row[vendorCodeIndex] || ""),
          name: String(seller.nombre || vendorName).trim(),
          mix: 0,
          clients: new Set(),
        });
      }

      const vendor = supervisor.vendors.get(vendorKey)!;
      vendor.mix += quantity;
      const clientCode = String(row[clientCodeIndex] ?? "").trim();
      vendor.clients.add(`${reportBranch}|${clientCode || normalize(clientName)}`);
    }
  }

  const supervisorRows: SupervisorStanding[] = Array.from(supervisors.values())
    .map((supervisor) => {
      const vendors = Array.from(supervisor.vendors.values())
        .map((vendor) => ({
          key: vendor.key,
          name: vendor.name,
          code: vendor.code,
          mix: vendor.mix,
          clients: vendor.clients.size,
        }))
        .sort((a, b) => b.mix - a.mix || a.name.localeCompare(b.name));

      return {
        key: supervisor.key,
        branchKey: supervisor.branchKey,
        branchLabel: supervisor.branchLabel,
        name: supervisor.name,
        mix: vendors.reduce((sum, vendor) => sum + vendor.mix, 0),
        clients: new Set(
          Array.from(supervisor.vendors.values()).flatMap((vendor) => Array.from(vendor.clients)),
        ).size,
        vendors,
      };
    })
    .sort((a, b) => b.mix - a.mix || a.name.localeCompare(b.name));

  const allVendorEntries = Array.from(supervisors.values()).flatMap((supervisor) =>
    Array.from(supervisor.vendors.values()),
  );
  const totalClients = new Set(allVendorEntries.flatMap((vendor) => Array.from(vendor.clients))).size;
  const latestUpdate = reports.reduce<string | null>((latest, report) => {
    const current = report.updated_at || report.uploaded_at;
    if (!current) return latest;
    if (!latest) return current;
    return new Date(current).getTime() > new Date(latest).getTime() ? current : latest;
  }, null);

  return {
    supervisors: supervisorRows,
    totalMix: supervisorRows.reduce((sum, supervisor) => sum + supervisor.mix, 0),
    totalClients,
    totalVendors: allVendorEntries.length,
    unmatchedVendors: Array.from(unmatched).sort((a, b) => a.localeCompare(b)),
    reports,
    latestUpdate,
    branchesWithReports: new Set(reports.map((report) => report.branch_key)).size,
  };
}

function rankBadge(rank: number) {
  if (rank === 1) return "bg-amber-100 text-amber-800 border-amber-200";
  if (rank === 2) return "bg-slate-200 text-slate-700 border-slate-300";
  if (rank === 3) return "bg-orange-100 text-orange-800 border-orange-200";
  return "bg-white text-slate-500 border-slate-200";
}

export default function CccAlfajoresCompetition() {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CompetitionResult | null>(null);
  const [remaining, setRemaining] = useState(calculateRemaining);
  const [navHost, setNavHost] = useState<HTMLElement | null>(null);
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(calculateRemaining()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const install = () => {
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Navegación del módulo CCC"]');
      const navActions = nav?.firstElementChild as HTMLElement | null;
      if (!nav || !navActions) return;

      let host = document.getElementById("ccc-alfajores-competition-nav-host");
      if (!host) {
        host = document.createElement("span");
        host.id = "ccc-alfajores-competition-nav-host";
        host.className = "ml-1 inline-flex items-center";
        const snapshotHost = document.getElementById("ccc-snapshot-nav-host");
        if (snapshotHost?.parentElement === navActions) snapshotHost.insertAdjacentElement("afterend", host);
        else navActions.appendChild(host);
      }
      setNavHost(host);

      let contentHost = document.getElementById("ccc-alfajores-competition-panel-host");
      if (!contentHost) {
        contentHost = document.createElement("div");
        contentHost.id = "ccc-alfajores-competition-panel-host";
        nav.insertAdjacentElement("afterend", contentHost);
      }
      setPanelHost(contentHost);

      if (!(nav as any).__alfajoresCompetitionListener) {
        const listener = (event: Event) => {
          const target = event.target as HTMLElement | null;
          if (!target || host?.contains(target)) return;
          if (target.closest("button") || target.closest("select")) setActive(false);
        };
        nav.addEventListener("click", listener);
        nav.addEventListener("change", listener);
        (nav as any).__alfajoresCompetitionListener = listener;
      }
    };

    install();
    const observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Navegación del módulo CCC"]');
      const listener = (nav as any)?.__alfajoresCompetitionListener;
      if (nav && listener) {
        nav.removeEventListener("click", listener);
        nav.removeEventListener("change", listener);
        delete (nav as any).__alfajoresCompetitionListener;
      }
    };
  }, []);

  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Navegación del módulo CCC"]');
    const main = nav?.parentElement;
    if (!nav || !main || !panelHost) return;

    const hidden: Array<{ element: HTMLElement; display: string }> = [];
    if (active) {
      Array.from(main.children).forEach((child) => {
        const element = child as HTMLElement;
        if (element === nav || element === panelHost) return;
        hidden.push({ element, display: element.style.display });
        element.style.display = "none";
      });
      panelHost.style.display = "block";
    } else {
      panelHost.style.display = "none";
    }

    return () => {
      hidden.forEach(({ element, display }) => { element.style.display = display; });
      if (panelHost) panelHost.style.display = "";
    };
  }, [active, panelHost]);

  const refresh = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError("");
    try {
      setResult(await buildCompetitionResult());
    } catch (cause: any) {
      console.error(cause);
      setResult(null);
      setError(cause?.message || "No se pudieron preparar los resultados de la competencia.");
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    void refresh();
  }, [active, refresh]);

  const countdownItems = useMemo(
    () => [
      { label: "Días", value: remaining.days },
      { label: "Horas", value: remaining.hours },
      { label: "Min", value: remaining.minutes },
      { label: "Seg", value: remaining.seconds },
    ],
    [remaining],
  );

  const button = navHost
    ? createPortal(
        <button
          type="button"
          onClick={() => setActive(true)}
          aria-current={active ? "page" : undefined}
          className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
            active ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Trophy className="h-4 w-4" />
          <span>Resultados competencia alfajores</span>
        </button>,
        navHost,
      )
    : null;

  const content = panelHost && active
    ? createPortal(
        <div className="space-y-4 pb-6">
          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-lg">
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                  <Trophy className="h-6 w-6 text-amber-300" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Competencia de alfajores</p>
                  <h2 className="mt-1 text-xl font-semibold">Resultados generales REDCOM</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Consolidado de todas las sucursales. Esta es la única vista del CCC que compara equipos entre sucursales. Cierre: 30 de septiembre de 2026.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                  <Clock3 className="h-4 w-4" />
                  {remaining.finished ? "Competencia finalizada" : "Tiempo restante"}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {countdownItems.map((item) => (
                    <div key={item.label} className="min-w-[66px] rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-center">
                      <div className="font-mono text-lg font-bold tabular-nums text-white">
                        {String(item.value).padStart(2, "0")}
                      </div>
                      <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {loading ? (
            <div className="grid min-h-[300px] place-items-center rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-col items-center gap-3 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Consolidando resultados…</p>
                  <p className="mt-1 text-xs text-slate-500">Leyendo los reportes de todas las sucursales.</p>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
          ) : !result?.reports.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <Trophy className="mx-auto h-9 w-9 text-slate-300" />
              <h3 className="mt-3 text-sm font-semibold text-slate-900">Todavía no hay reportes para consolidar</h3>
              <p className="mt-1 text-xs text-slate-500">Los resultados aparecerán cuando los supervisores carguen sus reportes MIX Alfajores.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <div className="kpi-card" style={{ ["--kc" as any]: "#C8102E" }}>
                  <div className="k-label">MIX TOTAL</div>
                  <div className="k-value">{formatNumber(result.totalMix, 2)}</div>
                  <div className="k-sub">todas las sucursales</div>
                </div>
                <div className="kpi-card" style={{ ["--kc" as any]: "#C87E0A" }}>
                  <div className="k-label">SUPERVISORES</div>
                  <div className="k-value">{formatNumber(result.supervisors.length)}</div>
                  <div className="k-sub">equipos con resultados</div>
                </div>
                <div className="kpi-card" style={{ ["--kc" as any]: "#1B6FA8" }}>
                  <div className="k-label">VENDEDORES</div>
                  <div className="k-value">{formatNumber(result.totalVendors)}</div>
                  <div className="k-sub">vendedores vinculados</div>
                </div>
                <div className="kpi-card" style={{ ["--kc" as any]: "#1E8E5A" }}>
                  <div className="k-label">CLIENTES</div>
                  <div className="k-value">{formatNumber(result.totalClients)}</div>
                  <div className="k-sub">clientes con movimiento</div>
                </div>
                <div className="kpi-card" style={{ ["--kc" as any]: "#6557C7" }}>
                  <div className="k-label">REPORTES</div>
                  <div className="k-value">{formatNumber(result.reports.length)}</div>
                  <div className="k-sub">última act. {formatDate(result.latestUpdate)}</div>
                </div>
                <div className="kpi-card" style={{ ["--kc" as any]: "#475569" }}>
                  <div className="k-label">SUCURSALES</div>
                  <div className="k-value">{formatNumber(result.branchesWithReports)}</div>
                  <div className="k-sub">con reportes cargados</div>
                </div>
              </div>

              {result.unmatchedVendors.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
                  <strong>{result.unmatchedVendors.length} vendedor{result.unmatchedVendors.length === 1 ? "" : "es"}</strong> no pudieron vincularse con un supervisor válido y quedaron fuera del ranking.
                </div>
              )}

              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">Tabla general de la competencia</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">Ranking general de supervisores y vendedores de todas las sucursales.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    className="inline-flex h-8 items-center gap-1.5 self-start rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Actualizar
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] border-collapse text-[11px] leading-tight">
                    <thead className="sticky top-0 bg-slate-900 text-white">
                      <tr>
                        <th className="w-16 px-3 py-2 text-center font-semibold">Pos.</th>
                        <th className="w-32 px-3 py-2 text-left font-semibold">Sucursal</th>
                        <th className="px-3 py-2 text-left font-semibold">Supervisor / Vendedor</th>
                        <th className="w-24 px-3 py-2 text-right font-semibold">Clientes</th>
                        <th className="w-32 px-3 py-2 text-right font-semibold">Combo vendido</th>
                        <th className="w-28 px-3 py-2 text-right font-semibold">Participación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.supervisors.flatMap((supervisor, index) => {
                        const rank = index + 1;
                        const share = result.totalMix ? (supervisor.mix / result.totalMix) * 100 : 0;
                        const rows = [
                          <tr key={`supervisor:${supervisor.key}`} className="border-t border-slate-200 bg-slate-50/90">
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex min-w-8 items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${rankBadge(rank)}`}>
                                #{rank}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-600">{supervisor.branchLabel}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <UsersRound className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <div>
                                  <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Supervisor</div>
                                  <div className="font-semibold text-slate-950">{supervisor.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-700">{supervisor.clients}</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-950">{formatNumber(supervisor.mix, 2)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-700">{formatNumber(share, 1)}%</td>
                          </tr>,
                        ];

                        supervisor.vendors.forEach((vendor) => {
                          const vendorShare = result.totalMix ? (vendor.mix / result.totalMix) * 100 : 0;
                          rows.push(
                            <tr key={`vendor:${vendor.key}`} className="border-t border-slate-100 bg-white hover:bg-slate-50/70">
                              <td className="px-3 py-1.5 text-center text-slate-300">—</td>
                              <td className="px-3 py-1.5 text-slate-400">{supervisor.branchLabel}</td>
                              <td className="px-3 py-1.5 pl-8">
                                <span className="mr-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Vendedor</span>
                                <span className="font-medium text-slate-800">{vendor.name}</span>
                              </td>
                              <td className="px-3 py-1.5 text-right text-slate-600">{vendor.clients}</td>
                              <td className="px-3 py-1.5 text-right font-semibold text-slate-800">{formatNumber(vendor.mix, 2)}</td>
                              <td className="px-3 py-1.5 text-right text-slate-500">{formatNumber(vendorShare, 1)}%</td>
                            </tr>,
                          );
                        });
                        return rows;
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>,
        panelHost,
      )
    : null;

  return <>{button}{content}</>;
}
