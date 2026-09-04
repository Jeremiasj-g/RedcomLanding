import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CCC_SNAPSHOT_PREFIX = "ccc:";

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

function validPeriod(year: number, month: number) {
  return Number.isInteger(year) && year >= 2020 && year <= 2100 && Number.isInteger(month) && month >= 1 && month <= 12;
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

export async function GET(req: Request) {
  try {
    const { admin } = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const branch = normalizeBranch(searchParams.get("branch"));
    const id = Number(searchParams.get("id") || 0);

    if (!branch) return NextResponse.json({ error: "Falta branch." }, { status: 400 });
    const branchKey = snapshotBranchKey(branch);

    if (id > 0) {
      const { data, error } = await admin
        .from("categorias_snapshots")
        .select("id, branch_key, branch, period_year, period_month, closed_at, closed_by, payload, meta")
        .eq("id", id)
        .eq("branch_key", branchKey)
        .maybeSingle();

      if (error) throw error;
      if (!data) return NextResponse.json({ error: "El período congelado no existe." }, { status: 404 });

      return NextResponse.json({
        snapshot: {
          id: data.id,
          branch_key: branch,
          period_year: Number(data.period_year),
          period_month: Number(data.period_month),
          closed_at: data.closed_at,
          closed_by: data.closed_by,
          closed_by_name: data.meta?.closed_by_name ?? null,
          source_fingerprint: data.meta?.source_fingerprint ?? "",
          brand_config: Array.isArray(data.meta?.brand_config) ? data.meta.brand_config : [],
          payload: data.payload,
        },
      });
    }

    const { data, error } = await admin
      .from("categorias_snapshots")
      .select("id, period_year, period_month, closed_at, closed_by, meta")
      .eq("branch_key", branchKey)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .order("closed_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      snapshots: (data ?? []).map((row: any) => ({
        id: Number(row.id),
        branch_key: branch,
        period_year: Number(row.period_year),
        period_month: Number(row.period_month),
        closed_at: row.closed_at,
        closed_by: row.closed_by ?? null,
        closed_by_name: row.meta?.closed_by_name ?? null,
        source_fingerprint: row.meta?.source_fingerprint ?? "",
      })),
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
    const sourceFingerprint = String(body?.source_fingerprint || "").trim();

    if (!branch || !validPeriod(periodYear, periodMonth) || !sourceFingerprint) {
      return NextResponse.json({ error: "Sucursal, año, mes y versión actual son obligatorios." }, { status: 400 });
    }

    const { data: cache, error: cacheError } = await admin
      .from("ccc_dashboard_cache")
      .select("source_fingerprint, payload, generated_at, updated_at")
      .eq("branch_key", branch)
      .eq("source_fingerprint", sourceFingerprint)
      .maybeSingle();

    if (cacheError) throw cacheError;
    if (!cache?.payload) {
      return NextResponse.json(
        { error: "No hay un dashboard procesado con los archivos actuales. Volvé a Inicio y procesá los dashboards antes de congelar el período." },
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
    const meta = {
      module: "ccc",
      source_fingerprint: sourceFingerprint,
      brand_config: brandConfig ?? [],
      cache_generated_at: cache.generated_at ?? null,
      cache_updated_at: cache.updated_at ?? null,
      closed_by_name: profile.full_name || user.email || null,
    };

    const { data: existing, error: existingError } = await admin
      .from("categorias_snapshots")
      .select("id")
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
          branch: branch,
          payload: cache.payload,
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
          payload: cache.payload,
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
      snapshot: {
        id: Number(snapshot.id),
        branch_key: branch,
        period_year: Number(snapshot.period_year),
        period_month: Number(snapshot.period_month),
        closed_at: snapshot.closed_at,
        closed_by: snapshot.closed_by ?? null,
        closed_by_name: snapshot.meta?.closed_by_name ?? null,
        source_fingerprint: snapshot.meta?.source_fingerprint ?? sourceFingerprint,
      },
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

    const { error } = await admin
      .from("categorias_snapshots")
      .delete()
      .eq("id", id)
      .eq("branch_key", snapshotBranchKey(branch));

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return unauthorizedResponse();
    console.error("[CCC snapshots][DELETE]", error);
    return NextResponse.json({ error: error?.message || "No se pudo eliminar el período." }, { status: 500 });
  }
}
