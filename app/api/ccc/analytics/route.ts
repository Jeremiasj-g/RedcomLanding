import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SNAPSHOT_BUCKET = "ccc-workspace-files";
const CCC_PREFIX = "ccc:";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan variables de entorno de Supabase.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizeBranch(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) throw new Error("UNAUTHORIZED");

  const admin = getAdminClient();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) throw new Error("UNAUTHORIZED");

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, branch")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("UNAUTHORIZED");

  return { admin, user: authData.user, profile, token };
}

async function assertBranchAccess(admin: any, profile: any, userId: string, branch: string) {
  if (String(profile.role || "").toLowerCase() === "admin") return;

  const { data, error } = await admin
    .from("user_branches")
    .select("branch")
    .eq("user_id", userId);
  if (error) throw error;

  const allowed = new Set(
    [profile.branch, ...(data ?? []).map((row: any) => row.branch)]
      .map(normalizeBranch)
      .filter(Boolean),
  );
  if (!allowed.has(branch)) throw new Error("FORBIDDEN");
}

async function readStoragePayload(admin: any, storagePath: string) {
  const { data, error } = await admin.storage.from(SNAPSHOT_BUCKET).download(storagePath);
  if (error) throw error;
  if (!data) throw new Error("No se encontró el archivo histórico.");
  return JSON.parse(await data.text());
}

async function readSnapshotPayload(req: Request, admin: any, token: string, branch: string, row: any) {
  const storagePath = String(row?.meta?.snapshot_storage_path || "").trim();
  if (storagePath) return readStoragePayload(admin, storagePath);

  // Para cierres antiguos reutilizamos el endpoint de snapshots: ya sabe leer
  // payloads legacy por partes y migrarlos perezosamente a Storage.
  const url = new URL("/api/ccc/snapshots", req.url);
  url.searchParams.set("branch", branch);
  url.searchParams.set("id", String(row.id));
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  if (!data?.snapshot?.payload) throw new Error("El cierre histórico no contiene datos procesados.");
  return data.snapshot.payload;
}

function clientKey(row: any) {
  return `${normalize(row?.sucursal)}|${String(row?.cliente ?? "").trim()}`;
}

function vendorKey(branch: unknown, code: unknown) {
  return `${normalize(branch)}|${String(code ?? "").trim()}`;
}

function metricFromSets(params: {
  universe: Set<string>;
  unitsByClient: Map<string, number>;
  articlesByClient: Map<string, Set<string>>;
  quota: number;
}) {
  const { universe, unitsByClient, articlesByClient, quota } = params;
  let buyers = 0;
  let qualified = 0;
  let units = 0;
  let mixTotal = 0;

  universe.forEach((key) => {
    const value = unitsByClient.get(key) || 0;
    units += value;
    if (value > 0) {
      buyers += 1;
      mixTotal += articlesByClient.get(key)?.size || 0;
    }
    if (quota > 0 && value >= quota) qualified += 1;
  });

  return {
    clients: universe.size,
    buyers,
    qualified,
    coveragePct: round(pct(qualified, universe.size), 2),
    purchasePct: round(pct(buyers, universe.size), 2),
    units: round(units, 2),
    avgUnitsBuyer: round(buyers ? units / buyers : 0, 2),
    avgMixBuyer: round(buyers ? mixTotal / buyers : 0, 2),
  };
}

function buildAnalyticsSummary(payload: any, brandConfig: any[], row: any) {
  const reportRows = Array.isArray(payload?.reportData?.rows) ? payload.reportData.rows : [];
  const padron = Array.isArray(payload?.padron) ? payload.padron : [];
  const listado = Array.isArray(payload?.listado) ? payload.listado : [];
  const dropsizeResults = payload?.dropsizeReceipt?.results || {};

  const configs = (Array.isArray(brandConfig) ? brandConfig : [])
    .map((item: any) => ({
      code: normalize(item?.brand_name),
      label: String(item?.brand_name || "").trim(),
      quota: Math.max(0, Math.trunc(num(item?.quota))),
    }))
    .filter((item: any) => item.code && item.quota > 0);

  const vendorDirectory = new Map<string, any>();
  listado.forEach((vendor: any) => {
    vendorDirectory.set(vendorKey(vendor?.sucursal, vendor?.codigo), vendor);
  });

  const universe = new Set<string>();
  const clientVendor = new Map<string, any>();
  padron.forEach((client: any) => {
    const key = clientKey(client);
    if (!key || key.endsWith("|")) return;
    const vendor = vendorDirectory.get(vendorKey(client?.sucursal, client?.vendCod));
    if (!vendor) return;
    universe.add(key);
    clientVendor.set(key, vendor);
  });

  const brands = configs.map((config: any) => {
    const unitsByClient = new Map<string, number>();
    const articlesByClient = new Map<string, Set<string>>();

    reportRows.forEach((sale: any) => {
      if (normalize(sale?.linea) !== config.code) return;
      const key = clientKey(sale);
      if (!universe.has(key)) return;
      unitsByClient.set(key, (unitsByClient.get(key) || 0) + num(sale?.cantidad));
      const article = normalize(sale?.artKey || sale?.artDesc);
      if (article) {
        if (!articlesByClient.has(key)) articlesByClient.set(key, new Set());
        articlesByClient.get(key)!.add(article);
      }
    });

    const baseMetric = metricFromSets({ universe, unitsByClient, articlesByClient, quota: config.quota });
    const drop = dropsizeResults?.[config.code] || null;

    return {
      ...config,
      ...baseMetric,
      dropsize: drop?.dropsize == null ? null : round(num(drop.dropsize), 2),
      receipts: drop?.invoices == null ? null : Math.max(0, Math.trunc(num(drop.invoices))),
      dropsizeCargo: drop?.cargo == null ? null : round(num(drop.cargo), 2),
      unitsByClient,
      articlesByClient,
    };
  });

  const supervisorNames = new Set<string>();
  const vendorIds = new Set<string>();
  listado.forEach((vendor: any) => {
    const supervisor = String(vendor?.supervisor || "").trim();
    if (supervisor) supervisorNames.add(supervisor);
    vendorIds.add(vendorKey(vendor?.sucursal, vendor?.codigo));
  });

  const supervisors = Array.from(supervisorNames)
    .map((supervisorName) => {
      const supervisorUniverse = new Set<string>();
      const supervisorVendors = new Set<string>();

      universe.forEach((key) => {
        const vendor = clientVendor.get(key);
        if (String(vendor?.supervisor || "").trim() !== supervisorName) return;
        supervisorUniverse.add(key);
        supervisorVendors.add(vendorKey(vendor?.sucursal, vendor?.codigo));
      });

      return {
        name: supervisorName,
        sellers: supervisorVendors.size,
        clients: supervisorUniverse.size,
        brands: brands.map((brand: any) => ({
          code: brand.code,
          label: brand.label,
          quota: brand.quota,
          ...metricFromSets({
            universe: supervisorUniverse,
            unitsByClient: brand.unitsByClient,
            articlesByClient: brand.articlesByClient,
            quota: brand.quota,
          }),
        })),
      };
    })
    .filter((item) => item.clients > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const vendors = listado
    .map((vendor: any) => {
      const keyVendor = vendorKey(vendor?.sucursal, vendor?.codigo);
      const vendorUniverse = new Set<string>();
      universe.forEach((key) => {
        const assigned = clientVendor.get(key);
        if (vendorKey(assigned?.sucursal, assigned?.codigo) === keyVendor) vendorUniverse.add(key);
      });
      if (!vendorUniverse.size) return null;
      return {
        code: vendor?.codigo ?? "",
        name: String(vendor?.nombre || `Vendedor ${vendor?.codigo ?? ""}`).trim(),
        supervisor: String(vendor?.supervisor || "").trim(),
        clients: vendorUniverse.size,
        brands: brands.map((brand: any) => ({
          code: brand.code,
          label: brand.label,
          quota: brand.quota,
          ...metricFromSets({
            universe: vendorUniverse,
            unitsByClient: brand.unitsByClient,
            articlesByClient: brand.articlesByClient,
            quota: brand.quota,
          }),
        })),
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.name.localeCompare(b.name, "es"));

  return {
    version: 1,
    periodYear: Number(row.period_year),
    periodMonth: Number(row.period_month),
    closedAt: row.closed_at,
    generatedAt: payload?.generatedAt || row.closed_at,
    totals: {
      clients: universe.size,
      sellers: vendorIds.size,
      supervisors: supervisorNames.size,
    },
    brands: brands.map(({ unitsByClient, articlesByClient, ...brand }: any) => brand),
    supervisors,
    vendors,
  };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export async function GET(req: Request) {
  try {
    const { admin, user, profile, token } = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const branch = normalizeBranch(searchParams.get("branch"));
    if (!branch) return NextResponse.json({ error: "Falta branch." }, { status: 400 });

    await assertBranchAccess(admin, profile, user.id, branch);

    const branchKey = `${CCC_PREFIX}${branch}`;
    const { data, error } = await admin
      .from("categorias_snapshots")
      .select("id, branch_key, period_year, period_month, closed_at, meta")
      .eq("branch_key", branchKey)
      .order("period_year", { ascending: true })
      .order("period_month", { ascending: true });
    if (error) throw error;

    const rows = data ?? [];
    const periods = await mapWithConcurrency(rows, 2, async (row: any) => {
      const cached = row.meta?.ccc_analytics_summary;
      if (cached?.version === 1) {
        return { id: Number(row.id), summary: cached };
      }

      try {
        const payload = await readSnapshotPayload(req, admin, token, branch, row);
        const brandConfig = Array.isArray(row.meta?.brand_config) ? row.meta.brand_config : [];
        const summary = buildAnalyticsSummary(payload, brandConfig, row);
        const nextMeta = { ...(row.meta || {}), ccc_analytics_summary: summary };
        const { error: updateError } = await admin
          .from("categorias_snapshots")
          .update({ meta: nextMeta })
          .eq("id", row.id)
          .eq("branch_key", branchKey);
        if (updateError) console.warn("[CCC analytics] No se pudo cachear el resumen:", updateError);
        return { id: Number(row.id), summary };
      } catch (periodError: any) {
        console.error(`[CCC analytics] período ${row.id}`, periodError);
        return {
          id: Number(row.id),
          error: periodError?.message || "No se pudo preparar este período.",
          summary: null,
        };
      }
    });

    return NextResponse.json({ branch, periods });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Sesión inválida o vencida." }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "No tenés acceso a esta sucursal." }, { status: 403 });
    }
    console.error("[CCC analytics][GET]", error);
    return NextResponse.json({ error: error?.message || "No se pudo preparar la analítica histórica." }, { status: 500 });
  }
}
