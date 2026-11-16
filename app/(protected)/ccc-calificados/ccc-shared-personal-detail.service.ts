import { supabase } from "@/lib/supabaseClient";
import { getCccDashboardSnapshot } from "./ccc-dashboard-snapshots.service";

export const CCC_SHARED_FILES_BUCKET = "ccc-shared-files";
export const CCC_SHARED_PERSONAL_DETAIL_KEY = "personal_detail";
const CCC_LAST_BRANCH_KEY = "redcom:ccc:last-branch";

export type CccSharedFileMeta = {
  file_key: "personal_detail";
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
  updated_at: string;
};

function activeSnapshotId() {
  if (typeof window === "undefined") return 0;
  const value = Number(new URLSearchParams(window.location.search).get("ccc_snapshot") || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function snapshotMeta(): Promise<CccSharedFileMeta | null> {
  if (typeof window === "undefined") return null;
  const snapshotId = activeSnapshotId();
  const branch = String(window.localStorage.getItem(CCC_LAST_BRANCH_KEY) || "")
    .trim()
    .toLowerCase();
  if (!snapshotId || !branch) return null;

  const snapshot = await getCccDashboardSnapshot(branch, snapshotId);
  return {
    file_key: CCC_SHARED_PERSONAL_DETAIL_KEY,
    storage_path: "",
    original_name: "Detalle personal incluido en período congelado",
    mime_type: null,
    size_bytes: null,
    uploaded_by: snapshot.closed_by,
    uploaded_by_name: snapshot.closed_by_name,
    uploaded_at: snapshot.closed_at,
    updated_at: snapshot.closed_at,
  };
}

export async function getSharedPersonalDetailMeta(): Promise<CccSharedFileMeta | null> {
  const historical = await snapshotMeta();
  if (historical) return historical;

  const { data, error } = await supabase
    .from("ccc_shared_files")
    .select("*")
    .eq("file_key", CCC_SHARED_PERSONAL_DETAIL_KEY)
    .maybeSingle();

  if (error) throw error;
  return (data as CccSharedFileMeta | null) ?? null;
}

export async function downloadSharedPersonalDetail(): Promise<{
  file: File;
  meta: CccSharedFileMeta;
}> {
  if (activeSnapshotId()) throw new Error("El período congelado ya contiene la jerarquía procesada.");

  const meta = await getSharedPersonalDetailMeta();
  if (!meta) {
    throw new Error("Todavía no hay un archivo Detalle personal global guardado.");
  }

  const { data, error } = await supabase.storage
    .from(CCC_SHARED_FILES_BUCKET)
    .download(meta.storage_path);

  if (error) throw error;

  return {
    meta,
    file: new File([data], meta.original_name || "DetallePersonal.xlsx", {
      type:
        meta.mime_type ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      lastModified: new Date(meta.uploaded_at).getTime(),
    }),
  };
}

