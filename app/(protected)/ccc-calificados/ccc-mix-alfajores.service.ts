import { supabase } from "@/lib/supabaseClient";
import { CCC_WORKSPACE_FILES_BUCKET } from "./ccc-client-base.service";

export type CccMixAlfajoresFileMeta = {
  storage_path: string;
  original_name: string;
  size_bytes: number | null;
  uploaded_at: string;
  updated_at: string;
};

function normalizeBranch(branch: string) {
  return String(branch || "").trim().toLowerCase();
}

function safeName(value: string) {
  return String(value || "MIX-ALFAJORES.xlsx")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function folderForBranch(branch: string) {
  return `${normalizeBranch(branch)}/mix-alfajores`;
}

function metaFromObject(branch: string, object: any): CccMixAlfajoresFileMeta {
  const rawName = String(object?.name || "mix-alfajores.xlsx");
  const originalName = rawName.replace(/^\d{13}-/, "") || "mix-alfajores.xlsx";
  const uploadedAt = object?.created_at || object?.updated_at || new Date(0).toISOString();
  return {
    storage_path: `${folderForBranch(branch)}/${rawName}`,
    original_name: originalName,
    size_bytes: Number(object?.metadata?.size || 0) || null,
    uploaded_at: uploadedAt,
    updated_at: object?.updated_at || uploadedAt,
  };
}

export async function getMixAlfajoresFileMeta(
  branch: string,
): Promise<CccMixAlfajoresFileMeta | null> {
  const branchKey = normalizeBranch(branch);
  if (!branchKey) return null;

  const { data, error } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .list(folderForBranch(branchKey), {
      limit: 20,
      offset: 0,
      sortBy: { column: "name", order: "desc" },
    });

  if (error) throw error;
  const object = (data || []).find((item: any) => item?.name && !item.name.endsWith("/"));
  return object ? metaFromObject(branchKey, object) : null;
}

export async function uploadMixAlfajoresFile(params: {
  branch: string;
  file: File;
}): Promise<CccMixAlfajoresFileMeta> {
  const branchKey = normalizeBranch(params.branch);
  if (!branchKey) throw new Error("Seleccioná una sucursal antes de subir el reporte.");

  const previous = await getMixAlfajoresFileMeta(branchKey);
  const originalName = safeName(params.file.name);
  const uploadedAt = new Date().toISOString();
  const storagePath = `${folderForBranch(branchKey)}/${Date.now()}-${originalName}`;
  const { error } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .upload(storagePath, params.file, {
      upsert: false,
      contentType:
        params.file.type ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      cacheControl: "0",
    });

  if (error) throw error;

  // Primero queda asegurada la nueva versión. Recién después se elimina la anterior,
  // de modo que un fallo de red durante el reemplazo nunca deja a la sucursal sin archivo.
  if (previous?.storage_path && previous.storage_path !== storagePath) {
    const { error: removeError } = await supabase.storage
      .from(CCC_WORKSPACE_FILES_BUCKET)
      .remove([previous.storage_path]);
    if (removeError) {
      console.warn("[CCC MIX Alfajores] No se pudo limpiar el archivo anterior:", removeError);
    }
  }

  return {
    storage_path: storagePath,
    original_name: originalName,
    size_bytes: params.file.size,
    uploaded_at: uploadedAt,
    updated_at: uploadedAt,
  };
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
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      lastModified: new Date(meta.uploaded_at).getTime(),
    }),
  };
}

export async function deleteMixAlfajoresFile(branch: string): Promise<void> {
  const meta = await getMixAlfajoresFileMeta(branch);
  if (!meta) return;
  const { error } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .remove([meta.storage_path]);
  if (error) throw error;
}
