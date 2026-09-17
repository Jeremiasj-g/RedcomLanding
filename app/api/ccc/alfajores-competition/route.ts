import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STORAGE_BUCKET = "ccc-workspace-files";
const BRANCHES = ["corrientes", "chaco", "misiones", "obera", "refrigerados"] as const;
const MIX_FOLDER = "mix-alfajores";
const MIX_UPLOADS_FOLDER = "uploads";
const META_FILE = "metadata.json";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan variables de entorno de Supabase.");
  return createClient(url, key, { auth: { persistSession: false } });
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
    .select("id, role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) throw new Error("UNAUTHORIZED");

  const role = String(profile.role || "").trim().toLowerCase();
  if (!["admin", "jdv", "supervisor"].includes(role)) throw new Error("FORBIDDEN");

  return { admin };
}

function metadataPath(branch: string, userId: string) {
  return `${branch}/${MIX_FOLDER}/${MIX_UPLOADS_FOLDER}/${userId}/${META_FILE}`;
}

function legacyMetadataPath(branch: string) {
  return `${branch}/${MIX_FOLDER}/${META_FILE}`;
}

async function readMetadata(admin: any, path: string, branch: string) {
  const { data, error } = await admin.storage.from(STORAGE_BUCKET).download(path);
  if (error || !data) return null;

  try {
    const parsed = JSON.parse(await data.text());
    if (!parsed?.storage_path || !parsed?.original_name) return null;
    return {
      ...parsed,
      branch_key: branch,
      metadata_path: path,
    };
  } catch {
    return null;
  }
}

async function readLegacy(admin: any, branch: string) {
  const stored = await readMetadata(admin, legacyMetadataPath(branch), branch);
  if (stored) return { ...stored, source: "legacy" };

  const folder = `${branch}/${MIX_FOLDER}`;
  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .list(folder, { limit: 100, offset: 0, sortBy: { column: "updated_at", order: "desc" } });
  if (error) return null;

  const object = (data || []).find((item: any) => {
    const name = String(item?.name || "");
    return name && name !== META_FILE && /\.(xlsx|xls)$/i.test(name);
  });
  if (!object) return null;

  const uploadedAt = object.created_at || object.updated_at || new Date(0).toISOString();
  return {
    branch_key: branch,
    storage_path: `${folder}/${object.name}`,
    metadata_path: null,
    original_name: String(object.name || "MIX ALFAJORES.xlsx")
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

async function branchUserIds(admin: any, branch: string) {
  const ids = new Set<string>();

  const { data: assigned } = await admin
    .from("user_branches")
    .select("user_id")
    .eq("branch", branch);

  (assigned || []).forEach((row: any) => {
    const id = String(row?.user_id || "").trim();
    if (id) ids.add(id);
  });

  const uploadsFolder = `${branch}/${MIX_FOLDER}/${MIX_UPLOADS_FOLDER}`;
  const { data: folders } = await admin.storage
    .from(STORAGE_BUCKET)
    .list(uploadsFolder, { limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } });

  (folders || []).forEach((item: any) => {
    const id = String(item?.name || "").trim();
    if (id && id !== META_FILE) ids.add(id);
  });

  return Array.from(ids);
}

async function reportsForBranch(admin: any, branch: string) {
  const ids = await branchUserIds(admin, branch);
  const entries = (
    await Promise.all(ids.map((userId) => readMetadata(admin, metadataPath(branch, userId), branch)))
  ).filter(Boolean) as any[];

  const byPath = new Map<string, any>();
  entries.forEach((entry) => byPath.set(entry.storage_path, { ...entry, source: "user" }));

  const legacy = await readLegacy(admin, branch);
  if (legacy && !byPath.has(legacy.storage_path)) {
    const sameUploader = legacy.uploaded_by
      ? Array.from(byPath.values()).some((item: any) => item.uploaded_by === legacy.uploaded_by)
      : false;
    if (!sameUploader) byPath.set(legacy.storage_path, legacy);
  }

  const signed = await Promise.all(
    Array.from(byPath.values()).map(async (entry: any) => {
      const { data, error } = await admin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(entry.storage_path, 180);
      if (error || !data?.signedUrl) return null;
      return { ...entry, signed_url: data.signedUrl };
    }),
  );

  return signed.filter(Boolean);
}

export async function GET(req: Request) {
  try {
    const { admin } = await requireUser(req);
    const grouped = await Promise.all(BRANCHES.map((branch) => reportsForBranch(admin, branch)));
    const reports = grouped.flat().sort((a: any, b: any) => {
      const aTime = new Date(a.updated_at || a.uploaded_at || 0).getTime();
      const bTime = new Date(b.updated_at || b.uploaded_at || 0).getTime();
      return bTime - aTime;
    });

    return NextResponse.json({ reports });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Sesión inválida o vencida." }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "No tenés acceso a los resultados de la competencia." }, { status: 403 });
    }
    console.error("[CCC competencia alfajores]", error);
    return NextResponse.json(
      { error: error?.message || "No se pudieron consultar los resultados de la competencia." },
      { status: 500 },
    );
  }
}
