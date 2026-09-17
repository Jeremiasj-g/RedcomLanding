import { supabase } from "@/lib/supabaseClient";
import { CCC_WORKSPACE_FILES_BUCKET } from "./ccc-client-base.service";

const MIX_FOLDER = "mix-alfajores";
const MIX_METADATA_FILE = "metadata.json";

export type CccMixAlfajoresFileMeta = {
  branch_key?: string;
  storage_path: string;
  original_name: string;
  mime_type?: string | null;
  size_bytes: number | null;
  uploaded_by?: string | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
  updated_at: string;
};

function normalizeBranch(branch: string) {
  return String(branch || "").trim().toLowerCase();
}

function folderForBranch(branch: string) {
  return `${normalizeBranch(branch)}/${MIX_FOLDER}`;
}

function metadataPath(branch: string) {
  return `${folderForBranch(branch)}/${MIX_METADATA_FILE}`;
}

function safeFileName(value: string) {
  return String(value || "MIX ALFAJORES.xlsx")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

async function readStoredMetadata(branch: string): Promise<CccMixAlfajoresFileMeta | null> {
  const { data, error } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .download(metadataPath(branch));

  if (error) return null;

  try {
    const parsed = JSON.parse(await data.text()) as CccMixAlfajoresFileMeta;
    if (!parsed?.storage_path || !parsed?.original_name) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readLegacyMetadata(branch: string): Promise<CccMixAlfajoresFileMeta | null> {
  const branchKey = normalizeBranch(branch);
  const { data, error } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .list(folderForBranch(branchKey), {
      limit: 50,
      offset: 0,
      sortBy: { column: "updated_at", order: "desc" },
    });

  if (error) throw error;

  const object = (data || []).find((item: any) => {
    const name = String(item?.name || "");
    return name && name !== MIX_METADATA_FILE && /\.(xlsx|xls)$/i.test(name);
  });
  if (!object) return null;

  const rawName = String(object.name);
  const uploadedAt = object.created_at || object.updated_at || new Date(0).toISOString();
  return {
    branch_key: branchKey,
    storage_path: `${folderForBranch(branchKey)}/${rawName}`,
    original_name: rawName
      .replace(/^\d{13}-/, "")
      .replace(/^reporte\.(xlsx|xls)$/i, "MIX ALFAJORES.$1"),
    mime_type: object?.metadata?.mimetype || null,
    size_bytes: Number(object?.metadata?.size || 0) || null,
    uploaded_by: null,
    uploaded_by_name: null,
    uploaded_at: uploadedAt,
    updated_at: object.updated_at || uploadedAt,
  };
}

export async function getMixAlfajoresFileMeta(
  branch: string,
): Promise<CccMixAlfajoresFileMeta | null> {
  const branchKey = normalizeBranch(branch);
  if (!branchKey) return null;

  const stored = await readStoredMetadata(branchKey);
  if (stored) return stored;

  return readLegacyMetadata(branchKey);
}

export async function uploadMixAlfajoresFile(params: {
  branch: string;
  file: File;
  userId: string;
  uploaderName?: string | null;
}): Promise<CccMixAlfajoresFileMeta> {
  const branchKey = normalizeBranch(params.branch);
  if (!branchKey) throw new Error("Seleccioná una sucursal antes de subir el reporte.");

  const previous = await getMixAlfajoresFileMeta(branchKey);
  const extension = params.file.name.toLowerCase().endsWith(".xls") ? "xls" : "xlsx";
  const storagePath = `${folderForBranch(branchKey)}/reporte.${extension}`;
  const uploadedAt = new Date().toISOString();

  const { error: storageError } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .upload(storagePath, params.file, {
      upsert: true,
      contentType:
        params.file.type ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      cacheControl: "0",
    });
  if (storageError) throw storageError;

  const meta: CccMixAlfajoresFileMeta = {
    branch_key: branchKey,
    storage_path: storagePath,
    original_name: safeFileName(params.file.name),
    mime_type: params.file.type || null,
    size_bytes: params.file.size,
    uploaded_by: params.userId,
    uploaded_by_name: params.uploaderName || null,
    uploaded_at: uploadedAt,
    updated_at: uploadedAt,
  };

  const metadataBlob = new Blob([JSON.stringify(meta)], {
    type: "application/octet-stream",
  });
  const { error: metadataError } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .upload(metadataPath(branchKey), metadataBlob, {
      upsert: true,
      contentType: "application/octet-stream",
      cacheControl: "0",
    });

  if (metadataError) {
    await supabase.storage
      .from(CCC_WORKSPACE_FILES_BUCKET)
      .remove([storagePath])
      .catch(() => undefined);
    throw metadataError;
  }

  if (previous?.storage_path && previous.storage_path !== storagePath) {
    await supabase.storage
      .from(CCC_WORKSPACE_FILES_BUCKET)
      .remove([previous.storage_path])
      .catch(() => undefined);
  }

  return meta;
}

export async function downloadMixAlfajoresFile(
  branch: string,
): Promise<{ file: File; meta: CccMixAlfajoresFileMeta }> {
  const meta = await getMixAlfajoresFileMeta(branch);
  if (!meta) throw new Error("Todavía no hay un reporte MIX Alfajores guardado para esta sucursal.");

  const { data, error } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .download(meta.storage_path);
  if (error) throw error;

  return {
    meta,
    file: new File([data], meta.original_name || "MIX ALFAJORES.xlsx", {
      type:
        meta.mime_type ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      lastModified: new Date(meta.uploaded_at).getTime(),
    }),
  };
}

export async function deleteMixAlfajoresFile(branch: string): Promise<void> {
  const branchKey = normalizeBranch(branch);
  if (!branchKey) return;
  const meta = await getMixAlfajoresFileMeta(branchKey);
  if (!meta) return;

  const paths = Array.from(
    new Set([meta.storage_path, metadataPath(branchKey)].filter(Boolean)),
  );
  const { error } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .remove(paths);
  if (error) throw error;
}
