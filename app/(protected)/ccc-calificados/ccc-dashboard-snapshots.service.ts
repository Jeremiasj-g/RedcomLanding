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
};

export type CccDashboardSnapshot = CccDashboardSnapshotMeta & {
  brand_config: CccBranchBrandConfig[];
  payload: CccDashboardCachePayload;
};

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

export async function getCccDashboardSnapshot(
  branch: string,
  id: number,
): Promise<CccDashboardSnapshot> {
  const headers = await authHeaders();
  const response = await fetch(
    `/api/ccc/snapshots?branch=${encodeURIComponent(branch)}&id=${encodeURIComponent(String(id))}`,
    { headers, cache: "no-store" },
  );
  const data = await readJson(response);
  if (!data?.snapshot) throw new Error("No se encontró el período congelado.");
  return data.snapshot as CccDashboardSnapshot;
}

export async function freezeCccDashboardSnapshot(params: {
  branch: string;
  periodYear: number;
  periodMonth: number;
  sourceFingerprint: string;
}): Promise<{ snapshot: CccDashboardSnapshotMeta; replaced: boolean }> {
  const headers = await authHeaders();
  const response = await fetch("/api/ccc/snapshots", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      branch: params.branch,
      period_year: params.periodYear,
      period_month: params.periodMonth,
      source_fingerprint: params.sourceFingerprint,
    }),
  });
  const data = await readJson(response);
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
}

export function formatCccSnapshotPeriod(year: number, month: number) {
  const date = new Date(year, month - 1, 1);
  const monthLabel = new Intl.DateTimeFormat("es-AR", { month: "long" }).format(date);
  return `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)} ${year}`;
}
