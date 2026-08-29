import { supabase } from "@/lib/supabaseClient";

export const CCC_CLIENT_BASE_BUCKET = "ccc-client-bases";
export const CCC_WORKSPACE_FILES_BUCKET = "ccc-workspace-files";
export const CCC_REFRESH_DAYS = 15;

export const CCC_BRANCH_LABELS: Record<string, string> = {
  corrientes: "Corrientes",
  chaco: "Chaco",
  misiones: "Misiones",
  obera: "Oberá",
  refrigerados: "Refrigerados",
};

export const CCC_BRANCH_SUCURSAL_NAMES: Record<string, string> = {
  corrientes: "CASA CENTRAL",
  chaco: "SUCURSAL RESISTENCIA",
  misiones: "SUCURSAL POSADAS",
  obera: "SUCURSAL OBERA",
  refrigerados: "REFRIGERADOS",
};

export type CccWorkspaceFileKind =
  | "sales"
  | "dropsize_sales"
  | "seller_supervisor"
  | "personal_detail";

export type CccWorkspaceFileMeta = {
  id: string;
  branch_key: string;
  file_kind: CccWorkspaceFileKind;
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
  updated_at: string;
};

export type CccWorkspaceFilesMap = Partial<
  Record<CccWorkspaceFileKind, CccWorkspaceFileMeta>
>;

export type CccClientBaseMeta = {
  id: string;
  branch_key: string;
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
  next_update_at: string;
  updated_at: string;
};

function normalizeBranch(branch: string) {
  return String(branch || "").trim().toLowerCase();
}

export async function getAllBranches(): Promise<string[]> {
  const { data, error } = await supabase
    .from("branches")
    .select("code")
    .order("id", { ascending: true });

  if (error) throw error;

  const branches = (data ?? [])
    .map((row: { code?: string | null }) => normalizeBranch(row.code ?? ""))
    .filter(Boolean);

  // Refrigerados forma parte del módulo CCC como sucursal operativa propia.
  // Se asegura su presencia en el selector incluso si la tabla branches
  // llega a quedar temporalmente desactualizada.
  if (!branches.includes("refrigerados")) branches.push("refrigerados");

  return branches;
}

export async function getBranchesForUser(userId: string): Promise<string[]> {
  const [{ data: assigned, error: assignedError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase.from("user_branches").select("branch").eq("user_id", userId),
      supabase.from("profiles").select("branch").eq("id", userId).maybeSingle(),
    ]);

  if (assignedError) throw assignedError;
  if (profileError) throw profileError;

  return Array.from(
    new Set(
      [
        ...(assigned ?? []).map((row: { branch?: string | null }) => row.branch),
        profile?.branch,
      ]
        .map((branch) => normalizeBranch(branch ?? ""))
        .filter(Boolean),
    ),
  );
}

export async function getClientBaseMeta(
  branch: string,
): Promise<CccClientBaseMeta | null> {
  const branchKey = normalizeBranch(branch);
  if (!branchKey) return null;

  const { data, error } = await supabase
    .from("ccc_client_bases")
    .select("*")
    .eq("branch_key", branchKey)
    .maybeSingle();

  if (error) throw error;
  return (data as CccClientBaseMeta | null) ?? null;
}

export async function uploadClientBase(params: {
  branch: string;
  file: File;
  userId: string;
  uploaderName?: string | null;
}): Promise<CccClientBaseMeta> {
  const branchKey = normalizeBranch(params.branch);
  if (!branchKey) throw new Error("Seleccioná una sucursal antes de subir la base.");

  const extension = params.file.name.toLowerCase().endsWith(".xls") ? "xls" : "xlsx";
  const storagePath = `${branchKey}/base-clientes.${extension}`;
  const uploadedAt = new Date();
  const nextUpdateAt = new Date(uploadedAt);
  nextUpdateAt.setDate(nextUpdateAt.getDate() + CCC_REFRESH_DAYS);

  const { error: storageError } = await supabase.storage
    .from(CCC_CLIENT_BASE_BUCKET)
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
    storage_path: storagePath,
    original_name: params.file.name,
    mime_type: params.file.type || null,
    size_bytes: params.file.size,
    uploaded_by: params.userId,
    uploaded_by_name: params.uploaderName || null,
    uploaded_at: uploadedAt.toISOString(),
    next_update_at: nextUpdateAt.toISOString(),
    updated_at: uploadedAt.toISOString(),
  };

  const { data, error } = await supabase
    .from("ccc_client_bases")
    .upsert(payload, { onConflict: "branch_key" })
    .select("*")
    .single();

  if (error) throw error;
  return data as CccClientBaseMeta;
}

export async function downloadClientBase(
  branch: string,
): Promise<{ file: File; meta: CccClientBaseMeta }> {
  const meta = await getClientBaseMeta(branch);
  if (!meta) {
    throw new Error(
      "La sucursal seleccionada todavía no tiene una base de clientes guardada.",
    );
  }

  const { data, error } = await supabase.storage
    .from(CCC_CLIENT_BASE_BUCKET)
    .download(meta.storage_path);

  if (error) throw error;

  const file = new File([data], meta.original_name || "base-clientes.xlsx", {
    type:
      meta.mime_type ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    lastModified: new Date(meta.uploaded_at).getTime(),
  });

  return { file, meta };
}

export async function deleteClientBase(branch: string): Promise<void> {
  const branchKey = normalizeBranch(branch);
  if (!branchKey) throw new Error("Seleccioná una sucursal antes de eliminar la base.");

  const meta = await getClientBaseMeta(branchKey);
  if (!meta) return;

  const { error: storageError } = await supabase.storage
    .from(CCC_CLIENT_BASE_BUCKET)
    .remove([meta.storage_path]);

  if (storageError) throw storageError;

  const { error } = await supabase
    .from("ccc_client_bases")
    .delete()
    .eq("branch_key", branchKey);

  if (error) throw error;
}

export async function getWorkspaceFilesMeta(
  branch: string,
): Promise<CccWorkspaceFilesMap> {
  const branchKey = normalizeBranch(branch);
  if (!branchKey) return {};

  const { data, error } = await supabase
    .from("ccc_workspace_files")
    .select("*")
    .eq("branch_key", branchKey);

  if (error) throw error;

  return (data ?? []).reduce<CccWorkspaceFilesMap>((acc, row) => {
    const meta = row as CccWorkspaceFileMeta;
    acc[meta.file_kind] = meta;
    return acc;
  }, {});
}

export async function getWorkspaceFileMeta(
  branch: string,
  kind: CccWorkspaceFileKind,
): Promise<CccWorkspaceFileMeta | null> {
  const branchKey = normalizeBranch(branch);
  if (!branchKey) return null;

  const { data, error } = await supabase
    .from("ccc_workspace_files")
    .select("*")
    .eq("branch_key", branchKey)
    .eq("file_kind", kind)
    .maybeSingle();

  if (error) throw error;
  return (data as CccWorkspaceFileMeta | null) ?? null;
}

export async function uploadWorkspaceFile(params: {
  branch: string;
  kind: CccWorkspaceFileKind;
  file: File;
  userId: string;
  uploaderName?: string | null;
}): Promise<CccWorkspaceFileMeta> {
  const branchKey = normalizeBranch(params.branch);
  if (!branchKey) throw new Error("Seleccioná una sucursal antes de subir el archivo.");

  const extension = params.file.name.toLowerCase().endsWith(".xls") ? "xls" : "xlsx";
  const storagePath = `${branchKey}/${params.kind}.${extension}`;
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
    file_kind: params.kind,
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
  return data as CccWorkspaceFileMeta;
}

export async function downloadWorkspaceFile(
  branch: string,
  kind: CccWorkspaceFileKind,
): Promise<{ file: File; meta: CccWorkspaceFileMeta }> {
  const meta = await getWorkspaceFileMeta(branch, kind);
  if (!meta) throw new Error("No hay un archivo guardado para la sucursal seleccionada.");

  const { data, error } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .download(meta.storage_path);

  if (error) throw error;

  const file = new File([data], meta.original_name || `${kind}.xlsx`, {
    type:
      meta.mime_type ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    lastModified: new Date(meta.uploaded_at).getTime(),
  });

  return { file, meta };
}

export async function deleteWorkspaceFile(
  branch: string,
  kind: CccWorkspaceFileKind,
): Promise<void> {
  const branchKey = normalizeBranch(branch);
  if (!branchKey) throw new Error("Seleccioná una sucursal antes de eliminar el archivo.");

  const meta = await getWorkspaceFileMeta(branchKey, kind);
  if (!meta) return;

  const { error: storageError } = await supabase.storage
    .from(CCC_WORKSPACE_FILES_BUCKET)
    .remove([meta.storage_path]);

  if (storageError) throw storageError;

  const { error } = await supabase
    .from("ccc_workspace_files")
    .delete()
    .eq("branch_key", branchKey)
    .eq("file_kind", kind);

  if (error) throw error;
}

export function getClientBaseFreshness(meta: CccClientBaseMeta | null) {
  if (!meta) {
    return {
      tone: "missing" as const,
      daysRemaining: null,
      daysElapsed: null,
      expiredDays: null,
    };
  }

  const now = new Date();
  const uploadedAt = new Date(meta.uploaded_at);
  const nextUpdateAt = new Date(meta.next_update_at);
  const dayMs = 86_400_000;
  const daysElapsed = Math.max(
    0,
    Math.floor((now.getTime() - uploadedAt.getTime()) / dayMs),
  );
  const rawRemaining = Math.ceil(
    (nextUpdateAt.getTime() - now.getTime()) / dayMs,
  );

  if (rawRemaining < 0) {
    return {
      tone: "expired" as const,
      daysRemaining: 0,
      daysElapsed,
      expiredDays: Math.abs(rawRemaining),
    };
  }

  return {
    tone: rawRemaining <= 5 ? ("warning" as const) : ("fresh" as const),
    daysRemaining: rawRemaining,
    daysElapsed,
    expiredDays: 0,
  };
}
