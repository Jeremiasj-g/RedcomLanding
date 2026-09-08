import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CCC_SNAPSHOT_PREFIX = "ccc:";
const SNAPSHOT_STORAGE_BUCKET = "ccc-workspace-files";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan variables de entorno de Supabase.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function normalizeBranch(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function snapshotBranchKey(branch: string) {
  return `${CCC_SNAPSHOT_PREFIX}${normalizeBranch(branch)}`;
}

function snapshotStoragePath(branch: string, year: number, month: number) {
  return `snapshots/${normalizeBranch(branch)}/${year}-${String(month).padStart(2, "0")}.json`;
}

function validPeriod(year: number, month: number) {
  return Number.isInteger(year) && year >= 2020 && year <= 2100 && Number.isInteger(month) && month >= 1 && month <= 12;
}

function isStatementTimeout(error: any) {
  const message = String(error?.message || error?.details || "").toLowerCase();
  return error?.code === "57014" || message.includes("statement timeout") || message.includes("canceling statement");
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
    .select("id, full_name, role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) throw new Error("UNAUTHORIZED");

  return { admin, user: authData.user, profile };
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "Sesión inválida o vencida." }, { status: 401 });
}

function snapshotMetaFromRow(row: any, branch: string) {
  return {
    id: Number(row.id),
    branch_key: branch,
    period_year: Number(row.period_year),
    period_month: Number(row.period_month),
    closed_at: row.closed_at,
    closed_by: row.closed_by ?? null,
    closed_by_name: row.meta?.closed_by_name ?? null,
    source_fingerprint: row.meta?.source_fingerprint ?? "",
    brand_config: Array.isArray(row.meta?.brand_config) ? row.meta.brand_config : [],
    payload_parts: row.meta?.payload_parts ?? undefined,
    storage_backed: Boolean(row.meta?.snapshot_storage_path),
  };
}

async function downloadStoredPayload(admin: any, path: string) {
  const { data, error } = await admin.storage
    .from(SNAPSHOT_STORAGE_BUCKET)
    .download(path);

  if (error) throw error;
  if (!data) throw new Error("El archivo histórico no está disponible en Storage.");

  const text = await data.text();
  return JSON.parse(text);
}

async function uploadStoredPayload(admin: any, path: string, payload: any) {
  const serialized = JSON.stringify(payload);
  const { error } = await admin.storage
    .from(SNAPSHOT_STORAGE_BUCKET)
    .upload(path, Buffer.from(serialized, "utf8"), {
      upsert: true,
      // Este bucket comparte infraestructura con los archivos CCC y permite
      // application/octet-stream. El nombre .json conserva el formato lógico,
      // mientras el MIME binario evita rechazos por la lista blanca del bucket.
      contentType: "application/octet-stream",
      cacheControl: "3600",
    });

  if (error) throw error;
  return Buffer.byteLength(serialized, "utf8");
}

async function readLegacyPayloadPart(
  admin: any,
  id: number,
  branchKey: string,
  jsonPath: string,
  alias: string,
) {
  const pathExpression = jsonPath
    .split(".")
    .filter(Boolean)
    .map((part) => `->${part}`)
    .join("");

  const { data, error } = await admin
    .from("categorias_snapshots")
    .select(`${alias}:payload${pathExpression}`)
    .eq("id", id)
    .eq("branch_key", branchKey)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("El período congelado no existe.");
  return (data as any)[alias];
}

async function readLegacyReportData(admin: any, id: number, branchKey: string) {
  try {
    return await readLegacyPayloadPart(admin, id, branchKey, "reportData", "part");
  } catch (error) {
    if (!isStatementTimeout(error)) throw error;

    // Corrientes puede tener decenas de miles de filas. Si el bloque completo
    // excede el statement_timeout, lo reconstruimos a partir de piezas más pequeñas.
    const rows = await readLegacyPayloadPart(admin, id, branchKey, "reportData.rows", "part");
    const periodo = await readLegacyPayloadPart(admin, id, branchKey, "reportData.periodo", "part");
    const lineasDetectadas = await readLegacyPayloadPart(admin, id, branchKey, "reportData.lineasDetectadas", "part");
    const selectedLineaCode = await readLegacyPayloadPart(admin, id, branchKey, "reportData.selectedLineaCode", "part");

    return {
      rows: Array.isArray(rows) ? rows : [],
      periodo,
      lineasDetectadas: Array.isArray(lineasDetectadas) ? lineasDetectadas : [],
      selectedLineaCode,
    };
  }
}

async function loadLegacyPayload(admin: any, id: number, branchKey: string) {
  // Los snapshots creados antes de esta optimización guardaban un JSON grande
  // dentro de PostgreSQL. Se leen por secciones para que ninguna consulta tenga
  // que serializar todo el histórico de Corrientes de una sola vez.
  const version = await readLegacyPayloadPart(admin, id, branchKey, "version", "part");
  const generatedAt = await readLegacyPayloadPart(admin, id, branchKey, "generatedAt", "part");
  const reportData = await readLegacyReportData(admin, id, branchKey);
  const padron = await readLegacyPayloadPart(admin, id, branchKey, "padron", "part");
  const listado = await readLegacyPayloadPart(admin, id, branchKey, "listado", "part");
  const dropsizeReceipt = await readLegacyPayloadPart(admin, id, branchKey, "dropsizeReceipt", "part");
  const dropsizeIsolated = await readLegacyPayloadPart(admin, id, branchKey, "dropsizeIsolated", "part");

  return {
    version: Number(version) || 1,
    generatedAt: String(generatedAt || ""),
    reportData,
    padron: Array.isArray(padron) ? padron : [],
    listado: Array.isArray(listado) ? listado : [],
    dropsizeReceipt: dropsizeReceipt ?? null,
    dropsizeIsolated: dropsizeIsolated ?? null,
  };
}

async function migrateLegacySnapshotToStorage(params: {
  admin: any;
  row: any;
  branch: string;
  branchKey: string;
  payload: any;
}) {
  const { admin, row, branch, payload } = params;
  const path = snapshotStoragePath(branch, Number(row.period_year), Number(row.period_month));
  const storageBytes = await uploadStoredPayload(admin, path, payload);
  const nextMeta = {
    ...(row.meta || {}),
    snapshot_storage_path: path,
    snapshot_storage_bytes: storageBytes,
    payload_parts: {
      dropsizeReceipt: Boolean(payload?.dropsizeReceipt),
      dropsizeIsolated: Boolean(payload?.dropsizeIsolated),
    },
    storage_migrated_at: new Date().toISOString(),
  };

  // Una vez respaldado en Storage dejamos PostgreSQL liviano. El histórico no
  // pierde información: el endpoint siempre reconstruye payload desde Storage.
  const { error } = await admin
    .from("categorias_snapshots")
    .update({
      payload: {
        version: Number(payload?.version) || 1,
        generatedAt: payload?.generatedAt || row.closed_at,
        archived: true,
      },
      meta: nextMeta,
    })
    .eq("id", row.id)
    .eq("branch_key", params.branchKey);

  if (error) throw error;
  return { path, storageBytes, meta: nextMeta };
}

export async function GET(req: Request) {
  try {
    const { admin } = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const branch = normalizeBranch(searchParams.get("branch"));
    const id = Number(searchParams.get("id") || 0);
    const metadataOnly = searchParams.get("meta") === "1";

    if (!branch) return NextResponse.json({ error: "Falta branch." }, { status: 400 });
    const branchKey = snapshotBranchKey(branch);

    if (id > 0) {
      // Primero obtenemos solamente metadata. Esta consulta es pequeña aun para
      // cierres muy grandes y permite resolver la ubicación del payload.
      const { data: row, error } = await admin
        .from("categorias_snapshots")
        .select("id, branch_key, branch, period_year, period_month, closed_at, closed_by, meta")
        .eq("id", id)
        .eq("branch_key", branchKey)
        .maybeSingle();

      if (error) throw error;
      if (!row) return NextResponse.json({ error: "El período congelado no existe." }, { status: 404 });

      const metaSnapshot = snapshotMetaFromRow(row, branch);
      if (metadataOnly) {
        return NextResponse.json({ snapshot: metaSnapshot });
      }

      let payload: any = null;
      const storagePath = String(row.meta?.snapshot_storage_path || "").trim();

      if (storagePath) {
        try {
          payload = await downloadStoredPayload(admin, storagePath);
        } catch (storageError) {
          console.error("[CCC snapshots][Storage read]", storageError);
          return NextResponse.json(
            { error: "No se pudo recuperar el archivo del período congelado. Intentá nuevamente." },
            { status: 503 },
          );
        }
      } else {
        try {
          payload = await loadLegacyPayload(admin, id, branchKey);

          // Migración perezosa: el primer acceso exitoso a un cierre viejo lo
          // mueve a Storage para que todos los accesos posteriores sean rápidos.
          try {
            await migrateLegacySnapshotToStorage({ admin, row, branch, branchKey, payload });
          } catch (migrationError) {
            console.warn("[CCC snapshots] No se pudo migrar el snapshot legacy a Storage:", migrationError);
          }
        } catch (legacyError: any) {
          console.error("[CCC snapshots][Legacy read]", legacyError);
          const timeout = isStatementTimeout(legacyError);
          return NextResponse.json(
            {
              error: timeout
                ? "El cierre histórico es muy grande y no pudo recuperarse dentro del tiempo permitido. Reintentá una vez; si persiste, reemplazá ese cierre para migrarlo al nuevo formato optimizado."
                : legacyError?.message || "No se pudo recuperar el período congelado.",
            },
            { status: timeout ? 504 : 500 },
          );
        }
      }

      return NextResponse.json({
        snapshot: {
          ...metaSnapshot,
          payload,
        },
      });
    }

    // El listado nunca descarga payloads; sólo metadata liviana.
    const { data, error } = await admin
      .from("categorias_snapshots")
      .select("id, period_year, period_month, closed_at, closed_by, meta")
      .eq("branch_key", branchKey)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .order("closed_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      snapshots: (data ?? []).map((row: any) => snapshotMetaFromRow(row, branch)),
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return unauthorizedResponse();
    console.error("[CCC snapshots][GET]", error);
    return NextResponse.json({ error: error?.message || "No se pudieron consultar los períodos congelados." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { admin, user, profile } = await requireUser(req);
    if (String(profile.role || "").toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Solo Administración puede congelar períodos." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const branch = normalizeBranch(body?.branch);
    const periodYear = Number(body?.period_year);
    const periodMonth = Number(body?.period_month);

    if (!branch || !validPeriod(periodYear, periodMonth)) {
      return NextResponse.json({ error: "Sucursal, año y mes son obligatorios." }, { status: 400 });
    }

    const { data: cache, error: cacheError } = await admin
      .from("ccc_dashboard_cache")
      .select("source_fingerprint, payload, generated_at, updated_at")
      .eq("branch_key", branch)
      .maybeSingle();

    if (cacheError) throw cacheError;
    if (!cache?.payload) {
      return NextResponse.json(
        { error: "No hay un dashboard procesado para esta sucursal. Volvé a Inicio y procesá los dashboards antes de congelar el período." },
        { status: 409 },
      );
    }

    const { data: brandConfig, error: brandError } = await admin
      .from("ccc_branch_brand_config")
      .select("branch_key, brand_name, quota, sort_order, updated_at")
      .eq("branch_key", branch)
      .order("sort_order", { ascending: true })
      .order("brand_name", { ascending: true });

    if (brandError) throw brandError;

    const branchKey = snapshotBranchKey(branch);
    const now = new Date().toISOString();
    const sourceFingerprint = String(cache.source_fingerprint || "");
    const storagePath = snapshotStoragePath(branch, periodYear, periodMonth);

    // El JSON pesado se guarda como archivo. PostgreSQL conserva sólo metadata y
    // un marcador pequeño, que es mucho más apropiado para históricos grandes.
    const storageBytes = await uploadStoredPayload(admin, storagePath, cache.payload);
    const meta = {
      module: "ccc",
      source_fingerprint: sourceFingerprint,
      brand_config: brandConfig ?? [],
      cache_generated_at: cache.generated_at ?? null,
      cache_updated_at: cache.updated_at ?? null,
      closed_by_name: profile.full_name || user.email || null,
      snapshot_storage_path: storagePath,
      snapshot_storage_bytes: storageBytes,
      payload_parts: {
        dropsizeReceipt: Boolean(cache.payload?.dropsizeReceipt),
        dropsizeIsolated: Boolean(cache.payload?.dropsizeIsolated),
      },
    };
    const compactPayload = {
      version: Number(cache.payload?.version) || 1,
      generatedAt: cache.payload?.generatedAt || cache.generated_at || now,
      archived: true,
    };

    const { data: existing, error: existingError } = await admin
      .from("categorias_snapshots")
      .select("id, meta")
      .eq("branch_key", branchKey)
      .eq("period_year", periodYear)
      .eq("period_month", periodMonth)
      .order("closed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    let snapshot: any = null;
    if (existing?.id) {
      const { data, error } = await admin
        .from("categorias_snapshots")
        .update({
          branch,
          payload: compactPayload,
          meta,
          closed_by: user.id,
          closed_at: now,
        })
        .eq("id", existing.id)
        .select("id, period_year, period_month, closed_at, closed_by, meta")
        .single();
      if (error) throw error;
      snapshot = data;
    } else {
      const { data, error } = await admin
        .from("categorias_snapshots")
        .insert({
          branch_key: branchKey,
          branch,
          period_year: periodYear,
          period_month: periodMonth,
          payload: compactPayload,
          meta,
          closed_by: user.id,
          closed_at: now,
        })
        .select("id, period_year, period_month, closed_at, closed_by, meta")
        .single();
      if (error) throw error;
      snapshot = data;
    }

    return NextResponse.json({
      ok: true,
      replaced: Boolean(existing?.id),
      snapshot: snapshotMetaFromRow(snapshot, branch),
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return unauthorizedResponse();
    console.error("[CCC snapshots][POST]", error);
    return NextResponse.json({ error: error?.message || "No se pudo congelar el período." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { admin, profile } = await requireUser(req);
    if (String(profile.role || "").toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Solo Administración puede eliminar períodos congelados." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const branch = normalizeBranch(searchParams.get("branch"));
    const id = Number(searchParams.get("id") || 0);
    if (!branch || !id) return NextResponse.json({ error: "Faltan branch o id." }, { status: 400 });

    const branchKey = snapshotBranchKey(branch);
    const { data: row, error: rowError } = await admin
      .from("categorias_snapshots")
      .select("id, meta")
      .eq("id", id)
      .eq("branch_key", branchKey)
      .maybeSingle();

    if (rowError) throw rowError;

    const { error } = await admin
      .from("categorias_snapshots")
      .delete()
      .eq("id", id)
      .eq("branch_key", branchKey);

    if (error) throw error;

    const storagePath = String(row?.meta?.snapshot_storage_path || "").trim();
    if (storagePath) {
      const { error: storageError } = await admin.storage
        .from(SNAPSHOT_STORAGE_BUCKET)
        .remove([storagePath]);
      if (storageError) {
        console.warn("[CCC snapshots] No se pudo eliminar el archivo histórico de Storage:", storageError);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return unauthorizedResponse();
    console.error("[CCC snapshots][DELETE]", error);
    return NextResponse.json({ error: error?.message || "No se pudo eliminar el período." }, { status: 500 });
  }
}