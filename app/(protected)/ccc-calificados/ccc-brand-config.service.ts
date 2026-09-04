import { supabase } from "@/lib/supabaseClient";
import { getCccDashboardSnapshot } from "./ccc-dashboard-snapshots.service";

export const CCC_BRAND_CATALOG_BUCKET = "ccc-brand-catalog";

export type CccBrandCatalogMeta = {
  catalog_key: "global";
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  brands: string[];
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
  updated_at: string;
};

export type CccBranchBrandConfig = {
  id?: string;
  branch_key: string;
  brand_name: string;
  quota: number;
  sort_order: number;
  updated_by?: string | null;
  updated_by_name?: string | null;
  updated_at?: string;
};

export type CccBrandConfigDraft = {
  brand_name: string;
  quota: number;
};

function normalizeBranch(branch: string) {
  return String(branch || "").trim().toLowerCase();
}

function activeSnapshotId() {
  if (typeof window === "undefined") return 0;
  const value = Number(new URLSearchParams(window.location.search).get("ccc_snapshot") || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function normalizeBrandName(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function uniqueBrands(values: unknown[]) {
  const seen = new Set<string>();
  const brands: string[] = [];

  values.forEach((value) => {
    const brand = normalizeBrandName(value);
    if (!brand || brand === "MARCA" || seen.has(brand)) return;
    seen.add(brand);
    brands.push(brand);
  });

  return brands;
}

function brandsFromRows(rows: unknown[][]) {
  if (!rows.length) return [];

  let headerRow = -1;
  let brandColumn = 0;

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 20); rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const columnIndex = row.findIndex((cell) => normalizeBrandName(cell) === "MARCA");
    if (columnIndex >= 0) {
      headerRow = rowIndex;
      brandColumn = columnIndex;
      break;
    }
  }

  const startRow = headerRow >= 0 ? headerRow + 1 : 0;
  return uniqueBrands(
    rows
      .slice(startRow)
      .map((row) => row?.[brandColumn])
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== ""),
  );
}

function parseDelimitedText(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (!lines.length) return [];

  const delimiters = ["\t", ";", ","];
  const delimiter = delimiters.find((candidate) => lines.some((line) => line.includes(candidate)));
  const rows = lines.map((line) => delimiter ? line.split(delimiter) : [line]);
  return brandsFromRows(rows);
}

export async function parseBrandCatalogFile(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const XLSX = typeof window !== "undefined" ? (window as any).XLSX : null;

  if (XLSX) {
    try {
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (sheet) {
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: null,
          raw: false,
        }) as unknown[][];
        const brands = brandsFromRows(rows);
        if (brands.length) return brands;
      }
    } catch {
      // Algunos reportes .xls de VENDO son texto tabulado con extensión .xls.
      // En ese caso se utiliza el parser de texto de abajo.
    }
  }

  const text = new TextDecoder("utf-8").decode(buffer);
  const brands = parseDelimitedText(text);
  if (!brands.length) {
    throw new Error('No se encontraron marcas. El archivo debe contener una columna "MARCA".');
  }
  return brands;
}

export async function getBrandCatalogMeta(): Promise<CccBrandCatalogMeta | null> {
  const { data, error } = await supabase
    .from("ccc_brand_catalog")
    .select("*")
    .eq("catalog_key", "global")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...(data as CccBrandCatalogMeta),
    brands: uniqueBrands((data as CccBrandCatalogMeta).brands ?? []),
  };
}

export async function uploadBrandCatalog(params: {
  file: File;
  brands: string[];
  userId: string;
  uploaderName?: string | null;
}): Promise<CccBrandCatalogMeta> {
  const brands = uniqueBrands(params.brands);
  if (!brands.length) throw new Error("El catálogo no contiene marcas válidas.");

  const previous = await getBrandCatalogMeta();
  const lowerName = params.file.name.toLowerCase();
  const extension = lowerName.endsWith(".xlsx") ? "xlsx" : lowerName.endsWith(".xls") ? "xls" : "txt";
  const storagePath = `global/marcas.${extension}`;
  const uploadedAt = new Date().toISOString();

  const { error: storageError } = await supabase.storage
    .from(CCC_BRAND_CATALOG_BUCKET)
    .upload(storagePath, params.file, {
      upsert: true,
      contentType: params.file.type || "application/octet-stream",
      cacheControl: "0",
    });

  if (storageError) throw storageError;

  const payload = {
    catalog_key: "global",
    storage_path: storagePath,
    original_name: params.file.name,
    mime_type: params.file.type || null,
    size_bytes: params.file.size,
    brands,
    uploaded_by: params.userId,
    uploaded_by_name: params.uploaderName || null,
    uploaded_at: uploadedAt,
    updated_at: uploadedAt,
  };

  const { data, error } = await supabase
    .from("ccc_brand_catalog")
    .upsert(payload, { onConflict: "catalog_key" })
    .select("*")
    .single();

  if (error) throw error;

  if (previous?.storage_path && previous.storage_path !== storagePath) {
    await supabase.storage
      .from(CCC_BRAND_CATALOG_BUCKET)
      .remove([previous.storage_path])
      .catch(() => undefined);
  }

  return {
    ...(data as CccBrandCatalogMeta),
    brands: uniqueBrands((data as CccBrandCatalogMeta).brands ?? []),
  };
}

export async function downloadBrandCatalog(): Promise<{
  file: File;
  meta: CccBrandCatalogMeta;
}> {
  const meta = await getBrandCatalogMeta();
  if (!meta) throw new Error("Todavía no hay un catálogo de marcas guardado.");

  const { data, error } = await supabase.storage
    .from(CCC_BRAND_CATALOG_BUCKET)
    .download(meta.storage_path);

  if (error) throw error;

  return {
    meta,
    file: new File([data], meta.original_name || "marcas.xls", {
      type: meta.mime_type || "application/octet-stream",
      lastModified: new Date(meta.uploaded_at).getTime(),
    }),
  };
}

export async function deleteBrandCatalog(): Promise<void> {
  const meta = await getBrandCatalogMeta();
  if (!meta) return;

  const { error: storageError } = await supabase.storage
    .from(CCC_BRAND_CATALOG_BUCKET)
    .remove([meta.storage_path]);

  if (storageError) throw storageError;

  const { error } = await supabase
    .from("ccc_brand_catalog")
    .delete()
    .eq("catalog_key", "global");

  if (error) throw error;
}

export async function getBranchBrandConfig(
  branch: string,
): Promise<CccBranchBrandConfig[]> {
  const branchKey = normalizeBranch(branch);
  if (!branchKey) return [];

  const snapshotId = activeSnapshotId();
  if (snapshotId) {
    const snapshot = await getCccDashboardSnapshot(branchKey, snapshotId);
    return (snapshot.brand_config ?? []).map((row: any, index: number) => ({
      ...row,
      branch_key: branchKey,
      brand_name: normalizeBrandName(row.brand_name),
      quota: Number(row.quota),
      sort_order: Number(row.sort_order ?? index),
    }));
  }

  const { data, error } = await supabase
    .from("ccc_branch_brand_config")
    .select("*")
    .eq("branch_key", branchKey)
    .order("sort_order", { ascending: true })
    .order("brand_name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    brand_name: normalizeBrandName(row.brand_name),
    quota: Number(row.quota),
    sort_order: Number(row.sort_order ?? 0),
  }));
}

export async function saveBranchBrandConfig(params: {
  branch: string;
  items: CccBrandConfigDraft[];
  userId: string;
  updaterName?: string | null;
}): Promise<CccBranchBrandConfig[]> {
  if (activeSnapshotId()) {
    throw new Error("Volvé a Datos actuales antes de modificar marcas o cuotas.");
  }

  const branchKey = normalizeBranch(params.branch);
  if (!branchKey) throw new Error("Seleccioná una sucursal.");

  const deduped = new Map<string, number>();
  params.items.forEach((item) => {
    const brand = normalizeBrandName(item.brand_name);
    const quota = Math.trunc(Number(item.quota));
    if (!brand) return;
    if (!Number.isFinite(quota) || quota <= 0) {
      throw new Error(`La cuota de ${brand} debe ser mayor a 0.`);
    }
    if (deduped.has(brand)) throw new Error(`La marca ${brand} está repetida.`);
    deduped.set(brand, quota);
  });

  if (!deduped.size) {
    throw new Error("La sucursal debe tener al menos una marca configurada.");
  }

  const nextItems = Array.from(deduped.entries()).map(([brand_name, quota], index) => ({
    branch_key: branchKey,
    brand_name,
    quota,
    sort_order: index,
    updated_by: params.userId,
    updated_by_name: params.updaterName || null,
    updated_at: new Date().toISOString(),
  }));

  const { data: current, error: currentError } = await supabase
    .from("ccc_branch_brand_config")
    .select("brand_name")
    .eq("branch_key", branchKey);

  if (currentError) throw currentError;

  const nextNames = new Set(nextItems.map((item) => item.brand_name));
  const staleNames = (current ?? [])
    .map((row: any) => normalizeBrandName(row.brand_name))
    .filter((brand: string) => brand && !nextNames.has(brand));

  const { error: upsertError } = await supabase
    .from("ccc_branch_brand_config")
    .upsert(nextItems, { onConflict: "branch_key,brand_name" });

  if (upsertError) throw upsertError;

  if (staleNames.length) {
    const { error: deleteError } = await supabase
      .from("ccc_branch_brand_config")
      .delete()
      .eq("branch_key", branchKey)
      .in("brand_name", staleNames);

    if (deleteError) throw deleteError;
  }

  return getBranchBrandConfig(branchKey);
}