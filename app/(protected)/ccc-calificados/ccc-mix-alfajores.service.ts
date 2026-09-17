import { supabase } from "@/lib/supabaseClient";
import { CCC_WORKSPACE_FILES_BUCKET } from "./ccc-client-base.service";

const MIX_FOLDER = "mix-alfajores";
const MIX_UPLOADS_FOLDER = "uploads";
const MIX_METADATA_FILE = "metadata.json";

export type CccMixAlfajoresFileMeta = {
  branch_key?: string;
  storage_path: string;
  metadata_path?: string | null;
  original_name: string;
  mime_type?: string | null;
  size_bytes: number | null;
  uploaded_by?: string | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
  updated_at: string;
  source?: "user" | "legacy";
};

function normalizeBranch(branch: string) {
  return String(branch || "").trim().toLowerCase();
}

function folderForBranch(branch: string) {
  return `${normalizeBranch(branch)}/${MIX_FOLDER}`;
}

function folderForUser(branch: string, userId: string) {
  return `${folderForBranch(branch)}/${MIX_UPLOADS_FOLDER}/${String(userId || "").trim()}`;
}

function metadataPathForUser(branch: string, userId: string) {
  return `${folderForUser(branch, userId)}/${MIX_METADATA_FILE}`;
}

function legacyMetadataPath(branch: string) {
  return `${folderForBranch(branch)}/${MIX_METADATA_FILE}`;
}

function safeFileName(value: string) {
  return String(value || "MIX ALFAJORES.xlsx")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || "";
}

async function readMetadata(path: string): Promise<CccMixAlfajoresFileMeta | null> {
  const { data, error } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .download(path);
  if (error) return null;

  try {
    const parsed = JSON.parse(await data.text()) as CccMixAlfajoresFileMeta;
    if (!parsed?.storage_path || !parsed?.original_name) return null;
    return { ...parsed, metadata_path: path };
  } catch {
    return null;
  }
}

async function readLegacyMetadata(branch: string): Promise<CccMixAlfajoresFileMeta | null> {
  const branchKey = normalizeBranch(branch);
  const stored = await readMetadata(legacyMetadataPath(branchKey));
  if (stored) return { ...stored, source: "legacy" };

  const { data, error } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .list(folderForBranch(branchKey), {
      limit: 100,
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
    metadata_path: null,
    original_name: rawName
      .replace(/^\d{13}-/, "")
      .replace(/^reporte\.(xlsx|xls)$/i, "MIX ALFAJORES.$1"),
    mime_type: object?.metadata?.mimetype || null,
    size_bytes: Number(object?.metadata?.size || 0) || null,
    uploaded_by: null,
    uploaded_by_name: null,
    uploaded_at: uploadedAt,
    updated_at: object.updated_at || uploadedAt,
    source: "legacy",
  };
}

async function listBranchUserIds(branch: string): Promise<string[]> {
  const branchKey = normalizeBranch(branch);
  const ids = new Set<string>();

  // Primera fuente: usuarios asignados formalmente a la sucursal.
  // Esto evita depender de que Storage devuelva carpetas virtuales al listar un prefijo.
  try {
    const { data, error } = await supabase
      .from("user_branches")
      .select("user_id")
      .eq("branch", branchKey);
    if (!error) {
      (data || []).forEach((row: any) => {
        const id = String(row?.user_id || "").trim();
        if (id) ids.add(id);
      });
    }
  } catch {
    // Seguimos con las otras fuentes: Storage y usuario actual.
  }

  // Segunda fuente: carpetas efectivamente existentes en Storage.
  try {
    const uploadsFolder = `${folderForBranch(branchKey)}/${MIX_UPLOADS_FOLDER}`;
    const { data, error } = await supabase.storage
      .from(CCC_WORKSPACE_FILES_BUCKET)
      .list(uploadsFolder, {
        limit: 1000,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      });
    if (!error) {
      (data || []).forEach((item: any) => {
        const id = String(item?.name || "").trim();
        if (id && id !== MIX_METADATA_FILE) ids.add(id);
      });
    }
  } catch {
    // La consulta por user_branches sigue cubriendo los usuarios de la sucursal.
  }

  const ownId = await currentUserId();
  if (ownId) ids.add(ownId);

  return Array.from(ids);
}

export async function getMixAlfajoresFileMeta(
  branch: string,
  userId?: string | null,
): Promise<CccMixAlfajoresFileMeta | null> {
  const branchKey = normalizeBranch(branch);
  if (!branchKey) return null;

  const normalizedUserId = String(userId || (await currentUserId()) || "").trim();
  if (normalizedUserId) {
    const own = await readMetadata(metadataPathForUser(branchKey, normalizedUserId));
    if (own) return { ...own, source: "user" };

    const legacy = await readLegacyMetadata(branchKey);
    if (legacy && (!legacy.uploaded_by || legacy.uploaded_by === normalizedUserId)) {
      return legacy;
    }
    return null;
  }

  return readLegacyMetadata(branchKey);
}

export async function listMixAlfajoresFiles(
  branch: string,
): Promise<CccMixAlfajoresFileMeta[]> {
  const branchKey = normalizeBranch(branch);
  if (!branchKey) return [];

  const userIds = await listBranchUserIds(branchKey);
  const userEntries = (
    await Promise.all(
      userIds.map(async (userId) => {
        const meta = await readMetadata(metadataPathForUser(branchKey, userId));
        return meta ? { ...meta, source: "user" as const } : null;
      }),
    )
  ).filter(Boolean) as CccMixAlfajoresFileMeta[];

  // Dedupe por archivo físico y, en segundo lugar, por usuario que lo subió.
  const dedupedByPath = new Map<string, CccMixAlfajoresFileMeta>();
  userEntries.forEach((entry) => dedupedByPath.set(entry.storage_path, entry));

  const legacy = await readLegacyMetadata(branchKey);
  if (legacy) {
    const sameUploader = legacy.uploaded_by
      ? Array.from(dedupedByPath.values()).some(
          (item) => item.uploaded_by === legacy.uploaded_by,
        )
      : false;
    const samePath = dedupedByPath.has(legacy.storage_path);
    if (!sameUploader && !samePath) dedupedByPath.set(legacy.storage_path, legacy);
  }

  return Array.from(dedupedByPath.values()).sort(
    (a, b) =>
      new Date(b.updated_at || b.uploaded_at).getTime() -
      new Date(a.updated_at || a.uploaded_at).getTime(),
  );
}

export async function uploadMixAlfajoresFile(params: {
  branch: string;
  file: File;
  userId: string;
  uploaderName?: string | null;
}): Promise<CccMixAlfajoresFileMeta> {
  const branchKey = normalizeBranch(params.branch);
  const userId = String(params.userId || "").trim();
  if (!branchKey) throw new Error("Seleccioná una sucursal antes de subir el reporte.");
  if (!userId) throw new Error("No se pudo identificar al usuario que realiza la carga.");

  const previous = await getMixAlfajoresFileMeta(branchKey, userId);
  const extension = params.file.name.toLowerCase().endsWith(".xls") ? "xls" : "xlsx";
  const storagePath = `${folderForUser(branchKey, userId)}/reporte.${extension}`;
  const metaPath = metadataPathForUser(branchKey, userId);
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
    metadata_path: metaPath,
    original_name: safeFileName(params.file.name),
    mime_type: params.file.type || null,
    size_bytes: params.file.size,
    uploaded_by: userId,
    uploaded_by_name: params.uploaderName || null,
    uploaded_at: uploadedAt,
    updated_at: uploadedAt,
    source: "user",
  };

  const metadataBlob = new Blob([JSON.stringify(meta)], {
    type: "application/octet-stream",
  });
  const { error: metadataError } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .upload(metaPath, metadataBlob, {
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

  if (
    previous?.source === "user" &&
    previous.storage_path &&
    previous.storage_path !== storagePath
  ) {
    await supabase.storage
      .from(CCC_WORKSPACE_FILES_BUCKET)
      .remove([previous.storage_path])
      .catch(() => undefined);
  }

  return meta;
}

export async function downloadMixAlfajoresFileByMeta(
  meta: CccMixAlfajoresFileMeta,
): Promise<{ file: File; meta: CccMixAlfajoresFileMeta }> {
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

export async function downloadMixAlfajoresFile(
  branch: string,
  userId?: string | null,
): Promise<{ file: File; meta: CccMixAlfajoresFileMeta }> {
  const meta = await getMixAlfajoresFileMeta(branch, userId);
  if (!meta) throw new Error("Todavía no hay un reporte MIX Alfajores guardado para este usuario.");
  return downloadMixAlfajoresFileByMeta(meta);
}

export async function deleteMixAlfajoresFile(
  branch: string,
  userId?: string | null,
): Promise<void> {
  const branchKey = normalizeBranch(branch);
  if (!branchKey) return;
  const meta = await getMixAlfajoresFileMeta(branchKey, userId);
  if (!meta) return;

  const paths = Array.from(
    new Set([meta.storage_path, meta.metadata_path].filter(Boolean) as string[]),
  );
  const { error } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .remove(paths);
  if (error) throw error;
}
