import { supabase } from "@/lib/supabaseClient";
import type { CccBranchBrandConfig } from "./ccc-brand-config.service";
import type { CccDashboardCachePayload } from "./ccc-dashboard-cache.service";

export type CccDashboardSnapshotMeta = {
  id: number;
  branch_key: string;
  period_year: number;
  period_month: number;
  closed_at: string;
  closed_by: string | null;
  closed_by_name: string | null;
  source_fingerprint: string;
  brand_config?: CccBranchBrandConfig[];
  payload_parts?: {
    dropsizeReceipt?: boolean;
    dropsizeIsolated?: boolean;
  };
  storage_backed?: boolean;
};

export type CccDashboardSnapshot = CccDashboardSnapshotMeta & {
  brand_config: CccBranchBrandConfig[];
  payload: CccDashboardCachePayload;
};

const snapshotValueCache = new Map<string, CccDashboardSnapshot>();
const snapshotPromiseCache = new Map<string, Promise<CccDashboardSnapshot>>();
const snapshotMetaCache = new Map<string, CccDashboardSnapshotMeta>();
const snapshotMetaPromiseCache = new Map<string, Promise<CccDashboardSnapshotMeta>>();

function normalizeBranch(branch: string) {
  return String(branch || "").trim().toLowerCase();
}

function snapshotCacheKey(branch: string, id: number) {
  return `${normalizeBranch(branch)}:${Number(id)}`;
}

function clearSnapshotCache(branch?: string, id?: number) {
  if (branch && id) {
    const key = snapshotCacheKey(branch, id);
    snapshotValueCache.delete(key);
    snapshotPromiseCache.delete(key);
    snapshotMetaCache.delete(key);
    snapshotMetaPromiseCache.delete(key);
    return;
  }

  if (branch) {
    const prefix = `${normalizeBranch(branch)}:`;
    for (const key of Array.from(snapshotValueCache.keys())) {
      if (key.startsWith(prefix)) snapshotValueCache.delete(key);
    }
    for (const key of Array.from(snapshotPromiseCache.keys())) {
      if (key.startsWith(prefix)) snapshotPromiseCache.delete(key);
    }
    for (const key of Array.from(snapshotMetaCache.keys())) {
      if (key.startsWith(prefix)) snapshotMetaCache.delete(key);
    }
    for (const key of Array.from(snapshotMetaPromiseCache.keys())) {
      if (key.startsWith(prefix)) snapshotMetaPromiseCache.delete(key);
    }
    return;
  }

  snapshotValueCache.clear();
  snapshotPromiseCache.clear();
  snapshotMetaCache.clear();
  snapshotMetaPromiseCache.clear();
}

async function authHeaders() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
  return { Authorization: `Bearer ${token}` };
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return data;
}

export async function listCccDashboardSnapshots(
  branch: string,
): Promise<CccDashboardSnapshotMeta[]> {
  const headers = await authHeaders();
  const response = await fetch(
    `/api/ccc/snapshots?branch=${encodeURIComponent(branch)}`,
    { headers, cache: "no-store" },
  );
  const data = await readJson(response);
  return Array.isArray(data?.snapshots) ? data.snapshots : [];
}

export async function getCccDashboardSnapshotMeta(
  branch: string,
  id: number,
): Promise<CccDashboardSnapshotMeta> {
  const key = snapshotCacheKey(branch, id);
  const cached = snapshotMetaCache.get(key);
  if (cached) return cached;

  const existingPromise = snapshotMetaPromiseCache.get(key);
  if (existingPromise) return existingPromise;

  const request = (async () => {
    const headers = await authHeaders();
    const response = await fetch(
      `/api/ccc/snapshots?branch=${encodeURIComponent(branch)}&id=${encodeURIComponent(String(id))}&meta=1`,
      { headers, cache: "no-store" },
    );
    const data = await readJson(response);
    if (!data?.snapshot) throw new Error("No se encontró el período congelado.");
    const snapshot = data.snapshot as CccDashboardSnapshotMeta;
    snapshotMetaCache.set(key, snapshot);
    return snapshot;
  })();

  snapshotMetaPromiseCache.set(key, request);
  try {
    return await request;
  } finally {
    snapshotMetaPromiseCache.delete(key);
  }
}

export async function getCccDashboardSnapshot(
  branch: string,
  id: number,
): Promise<CccDashboardSnapshot> {
  const key = snapshotCacheKey(branch, id);
  const cached = snapshotValueCache.get(key);
  if (cached) return cached;

  const existingPromise = snapshotPromiseCache.get(key);
  if (existingPromise) return existingPromise;

  // Todas las partes del módulo CCC reutilizan esta misma Promise. De esta forma
  // abrir un histórico dispara una sola transferencia del payload, aunque varias
  // pantallas necesiten datos del mismo cierre simultáneamente.
  const request = (async () => {
    const headers = await authHeaders();
    const response = await fetch(
      `/api/ccc/snapshots?branch=${encodeURIComponent(branch)}&id=${encodeURIComponent(String(id))}`,
      { headers, cache: "no-store" },
    );
    const data = await readJson(response);
    if (!data?.snapshot) throw new Error("No se encontró el período congelado.");
    const snapshot = data.snapshot as CccDashboardSnapshot;
    snapshotValueCache.set(key, snapshot);
    snapshotMetaCache.set(key, snapshot);
    return snapshot;
  })();

  snapshotPromiseCache.set(key, request);
  try {
    return await request;
  } catch (error) {
    snapshotValueCache.delete(key);
    throw error;
  } finally {
    snapshotPromiseCache.delete(key);
  }
}

export async function freezeCccDashboardSnapshot(params: {
  branch: string;
  periodYear: number;
  periodMonth: number;
}): Promise<{ snapshot: CccDashboardSnapshotMeta; replaced: boolean }> {
  const headers = await authHeaders();
  const response = await fetch("/api/ccc/snapshots", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      branch: params.branch,
      period_year: params.periodYear,
      period_month: params.periodMonth,
    }),
  });
  const data = await readJson(response);
  clearSnapshotCache(params.branch);
  return {
    snapshot: data.snapshot as CccDashboardSnapshotMeta,
    replaced: Boolean(data.replaced),
  };
}

export async function deleteCccDashboardSnapshot(
  branch: string,
  id: number,
): Promise<void> {
  const headers = await authHeaders();
  const response = await fetch(
    `/api/ccc/snapshots?branch=${encodeURIComponent(branch)}&id=${encodeURIComponent(String(id))}`,
    { method: "DELETE", headers },
  );
  await readJson(response);
  clearSnapshotCache(branch, id);
}

export function formatCccSnapshotPeriod(year: number, month: number) {
  const date = new Date(year, month - 1, 1);
  const monthLabel = new Intl.DateTimeFormat("es-AR", { month: "long" }).format(date);
  return `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)} ${year}`;
}
