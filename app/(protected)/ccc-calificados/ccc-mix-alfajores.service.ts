import { supabase } from "@/lib/supabaseClient";
import { CCC_WORKSPACE_FILES_BUCKET } from "./ccc-client-base.service";

const MIX_ALFAJORES_KIND = "mix_alfajores";

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

function legacyFolder(branch: string) {
  return `${normalizeBranch(branch)}/mix-alfajores`;
}

function legacyMeta(branch: string, object: any): CccMixAlfajoresFileMeta {
  const rawName = String(object?.name || "mix-alfajores.xlsx");
  const originalName = rawName.replace(/^\d{13}-/, "") || "mix-alfajores.xlsx";
  const uploadedAt = object?.created_at || object?.updated_at || new Date(0).toISOString();
  return {
    branch_key: normalizeBranch(branch),
    storage_path: `${legacyFolder(branch)}/${rawName}`,
    original_name: originalName,
    mime_type: object?.metadata?.mimetype || null,
    size_bytes: Number(object?.metadata?.size || 0) || null,
    uploaded_by: object?.owner_id || null,
    uploaded_by_name: null,
    uploaded_at: uploadedAt,
    updated_at: object?.updated_at || uploadedAt,
  };
}

async function getLegacyMeta(branch: string): Promise<CccMixAlfajoresFileMeta | null> {
  const { data, error } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .list(legacyFolder(branch), {
      limit: 20,
      offset: 0,
      sortBy: { column: "name", order: "desc" },
    });
  if (error) throw error;
  const object = (data || []).find((item: any) => item?.name && !item.name.endsWith("/"));
  return object ? legacyMeta(branch, object) : null;
}

export async function getMixAlfajoresFileMeta(
  branch: string,
): Promise<CccMixAlfajoresFileMeta | null> {
  const branchKey = normalizeBranch(branch);
  if (!branchKey) return null;

  const { data, error } = await supabase
    .from("ccc_workspace_files")
    .select("*")
    .eq("branch_key", branchKey)
    .eq("file_kind", MIX_ALFAJORES_KIND)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as CccMixAlfajoresFileMeta;

  // Compatibilidad con los primeros archivos de prueba guardados solo en Storage.
  return getLegacyMeta(branchKey);
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
  const storagePath = `${branchKey}/${MIX_ALFAJORES_KIND}.${extension}`;
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

  const payload = {
    branch_key: branchKey,
    file_kind: MIX_ALFAJORES_KIND,
    storage_path: storagePath,
    original_name: params.file.name,
    mime_type: params.file.type || null,
    size_bytes: params.file.size,
    uploaded_by: params.userId,
    uploaded_by_name: params.uploaderName || null,
    uploaded_at: uploadedAt,
    updated_at: uploadedAt,
  };

  const { data, error } = await supabase
    .from("ccc_workspace_files")
    .upsert(payload, { onConflict: "branch_key,file_kind" })
    .select("*")
    .single();
  if (error) throw error;

  if (previous?.storage_path && previous.storage_path !== storagePath) {
    await supabase.storage
      .from(CCC_WORKSPACE_FILES_BUCKET)
      .remove([previous.storage_path])
      .catch(() => undefined);
  }

  return data as CccMixAlfajoresFileMeta;
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

  const { error: storageError } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .remove([meta.storage_path]);
  if (storageError) throw storageError;

  const { error } = await supabase
    .from("ccc_workspace_files")
    .delete()
    .eq("branch_key", branchKey)
    .eq("file_kind", MIX_ALFAJORES_KIND);
  if (error) throw error;
}
