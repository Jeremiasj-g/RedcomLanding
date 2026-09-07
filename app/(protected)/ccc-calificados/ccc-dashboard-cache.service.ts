import { supabase } from "@/lib/supabaseClient";
import { getCccDashboardSnapshot } from "./ccc-dashboard-snapshots.service";

export type CccDashboardCachePayload = {
  version: 1;
  generatedAt: string;
  reportData: any;
  padron: any[];
  listado: any[];
  dropsizeReceipt?: any | null;
  dropsizeIsolated?: any | null;
};

export type CccDashboardCache = {
  branch_key: string;
  source_fingerprint: string;
  payload: CccDashboardCachePayload;
  generated_by: string | null;
  generated_at: string;
  updated_at: string;
};

function activeSnapshotId() {
  if (typeof window === "undefined") return 0;
  const value = Number(new URLSearchParams(window.location.search).get("ccc_snapshot") || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export async function getCccDashboardCache(
  branch: string,
  sourceFingerprint: string,
): Promise<CccDashboardCache | null> {
  const branchKey = String(branch || "").trim().toLowerCase();
  if (!branchKey) return null;

  const snapshotId = activeSnapshotId();
  if (snapshotId) {
    const snapshot = await getCccDashboardSnapshot(branchKey, snapshotId);
    return {
      branch_key: branchKey,
      source_fingerprint: `snapshot:${snapshot.id}`,
      payload: snapshot.payload,
      generated_by: snapshot.closed_by,
      generated_at: snapshot.closed_at,
      updated_at: snapshot.closed_at,
    };
  }

  if (!sourceFingerprint) return null;

  const { data, error } = await supabase
    .from("ccc_dashboard_cache")
    .select("*")
    .eq("branch_key", branchKey)
    .eq("source_fingerprint", sourceFingerprint)
    .maybeSingle();

  if (error) throw error;
  return (data as CccDashboardCache | null) ?? null;
}

export async function saveCccDashboardCache(params: {
  branch: string;
  sourceFingerprint: string;
  payload: CccDashboardCachePayload;
  userId?: string | null;
}): Promise<void> {
  if (activeSnapshotId()) return;

  const branchKey = String(params.branch || "").trim().toLowerCase();
  if (!branchKey || !params.sourceFingerprint) return;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("ccc_dashboard_cache")
    .upsert(
      {
        branch_key: branchKey,
        source_fingerprint: params.sourceFingerprint,
        payload: params.payload,
        generated_by: params.userId || null,
        generated_at: params.payload.generatedAt || now,
        updated_at: now,
      },
      { onConflict: "branch_key" },
    );

  if (error) throw error;
}

export async function deleteCccDashboardCache(branch: string): Promise<void> {
  const branchKey = String(branch || "").trim().toLowerCase();
  if (!branchKey) return;

  const { error } = await supabase
    .from("ccc_dashboard_cache")
    .delete()
    .eq("branch_key", branchKey);

  if (error) throw error;
}
