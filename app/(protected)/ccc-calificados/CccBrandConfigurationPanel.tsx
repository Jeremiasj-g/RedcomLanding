"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  Database,
  Download,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { errorMessage, notify } from "@/lib/notifications";
import {
  CccBrandCatalogMeta,
  CccBrandConfigDraft,
  CccBranchBrandConfig,
  deleteBrandCatalog,
  downloadBrandCatalog,
  getBrandCatalogMeta,
  getBranchBrandConfig,
  normalizeBrandName,
  parseBrandCatalogFile,
  saveBranchBrandConfig,
  uploadBrandCatalog,
} from "./ccc-brand-config.service";

type DashboardUser = {
  id: string;
  full_name: string | null;
  role: string;
};

type Props = {
  me: DashboardUser;
  branch: string;
  branchLabel: string;
  onConfigChange: (config: CccBranchBrandConfig[]) => void;
  onLoadingChange: (loading: boolean) => void;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function triggerDownload(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name || "marcas.xls";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export default function CccBrandConfigurationPanel({
  me,
  branch,
  branchLabel,
  onConfigChange,
  onLoadingChange,
}: Props) {
  const isAdmin = String(me.role || "").toLowerCase() === "admin";
  const [catalog, setCatalog] = useState<CccBrandCatalogMeta | null>(null);
  const [drafts, setDrafts] = useState<CccBrandConfigDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalogBusy, setCatalogBusy] = useState<"upload" | "download" | "delete" | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!branch) {
        setDrafts([]);
        onConfigChange([]);
        setLoading(false);
        onLoadingChange(false);
        return;
      }

      setLoading(true);
      onLoadingChange(true);
      try {
        const [catalogMeta, config] = await Promise.all([
          getBrandCatalogMeta(),
          getBranchBrandConfig(branch),
        ]);

        if (cancelled) return;
        setCatalog(catalogMeta);
        setDrafts(config.map((item) => ({
          brand_name: item.brand_name,
          quota: item.quota,
        })));
        onConfigChange(config);
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        notify.error(errorMessage(error, "No se pudo cargar la configuración de marcas."));
        setDrafts([]);
        onConfigChange([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          onLoadingChange(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [branch, onConfigChange, onLoadingChange]);

  const catalogBrands = useMemo(
    () => Array.from(new Set([
      ...(catalog?.brands ?? []).map(normalizeBrandName),
      ...drafts.map((item) => normalizeBrandName(item.brand_name)),
    ].filter(Boolean))),
    [catalog?.brands, drafts],
  );

  const usedBrands = useMemo(
    () => new Set(drafts.map((item) => normalizeBrandName(item.brand_name))),
    [drafts],
  );

  const availableToAdd = catalogBrands.filter((brand) => !usedBrands.has(brand));

  const updateDraft = (index: number, patch: Partial<CccBrandConfigDraft>) => {
    setDrafts((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    ));
  };

  const addBrand = () => {
    const nextBrand = availableToAdd[0];
    if (!nextBrand) {
      notify.info(catalog ? "Todas las marcas del catálogo ya están agregadas." : "Administración debe importar primero el catálogo de marcas.");
      return;
    }

    setDrafts((current) => [...current, { brand_name: nextBrand, quota: 1 }]);
  };

  const removeBrand = (index: number) => {
    setDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const save = async () => {
    if (!branch) return;
    setSaving(true);
    try {
      const saved = await saveBranchBrandConfig({
        branch,
        items: drafts,
        userId: me.id,
        updaterName: me.full_name,
      });
      setDrafts(saved.map((item) => ({ brand_name: item.brand_name, quota: item.quota })));
      onConfigChange(saved);
      window.dispatchEvent(new Event("ccc:brand-config-changed"));
      notify.success(`Configuración de ${branchLabel} guardada correctamente.`);
    } catch (error) {
      console.error(error);
      notify.error(errorMessage(error, "No se pudo guardar la configuración."));
    } finally {
      setSaving(false);
    }
  };

  const handleCatalogUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !isAdmin) return;

    setCatalogBusy("upload");
    try {
      const brands = await parseBrandCatalogFile(file);
      const meta = await uploadBrandCatalog({
        file,
        brands,
        userId: me.id,
        uploaderName: me.full_name,
      });
      setCatalog(meta);
      notify.success(`Catálogo actualizado: ${meta.brands.length} marcas disponibles.`);
    } catch (error) {
      console.error(error);
      notify.error(errorMessage(error, "No se pudo importar el catálogo de marcas."));
    } finally {
      setCatalogBusy(null);
    }
  };

  const handleCatalogDownload = async () => {
    setCatalogBusy("download");
    try {
      const { file } = await downloadBrandCatalog();
      triggerDownload(file);
    } catch (error) {
      console.error(error);
      notify.error(errorMessage(error, "No se pudo descargar el catálogo."));
    } finally {
      setCatalogBusy(null);
    }
  };

  const handleCatalogDelete = async () => {
    if (!isAdmin || !catalog) return;
    if (!window.confirm("¿Eliminar el catálogo de marcas guardado? Las configuraciones actuales por sucursal se conservarán.")) return;

    setCatalogBusy("delete");
    try {
      await deleteBrandCatalog();
      setCatalog(null);
      notify.success("Catálogo de marcas eliminado. Las configuraciones actuales se conservaron.");
    } catch (error) {
      console.error(error);
      notify.error(errorMessage(error, "No se pudo eliminar el catálogo."));
    } finally {
      setCatalogBusy(null);
    }
  };

  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Configuración de focos y cuotas</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Definí qué marcas procesa <strong>{branchLabel || "la sucursal"}</strong> y la cuota mínima mensual de cada una.
            </p>
          </div>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
          <Database className="h-3.5 w-3.5" />
          Configuración independiente por sucursal
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
        <div className="border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Marcas activas</p>
              <p className="mt-1 text-xs text-slate-500">
                Durante el procesamiento se eliminan del conjunto de trabajo todas las filas que no pertenezcan a estas marcas.
              </p>
            </div>
            <button
              type="button"
              onClick={addBrand}
              disabled={loading || saving || !availableToAdd.length}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus className="h-4 w-4" />
              Agregar marca
            </button>
          </div>

          {loading ? (
            <div className="grid min-h-[170px] place-items-center">
              <div className="flex flex-col items-center gap-3 text-xs text-slate-500">
                <RefreshCw className="h-5 w-5 animate-spin" />
                Cargando configuración…
              </div>
            </div>
          ) : drafts.length ? (
            <div className="space-y-2">
              {drafts.map((item, index) => {
                const currentBrand = normalizeBrandName(item.brand_name);
                const options = catalogBrands.filter((brand) =>
                  brand === currentBrand || !usedBrands.has(brand),
                );

                return (
                  <div
                    key={`${currentBrand}-${index}`}
                    className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_150px_36px] sm:items-center"
                  >
                    <label className="min-w-0">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Marca</span>
                      <select
                        value={currentBrand}
                        onChange={(event) => updateDraft(index, { brand_name: event.target.value })}
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-red-500"
                      >
                        {options.map((brand) => (
                          <option key={brand} value={brand}>{brand}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Cuota mensual</span>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={item.quota}
                          onChange={(event) => updateDraft(index, { quota: Number(event.target.value) })}
                          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 pr-12 text-xs font-semibold text-slate-800 outline-none focus:border-red-500"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">unid.</span>
                      </div>
                    </label>

                    <button
                      type="button"
                      onClick={() => removeBrand(index)}
                      disabled={saving || drafts.length <= 1}
                      title="Quitar marca"
                      className="mt-4 grid h-9 w-9 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-35 sm:mt-4"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
              Esta sucursal no tiene marcas configuradas.
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={loading || saving || drafts.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Guardando…" : "Guardar configuración"}
            </button>
          </div>
        </div>

        <aside className="bg-slate-50/40 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900">Catálogo maestro de marcas</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Define las marcas disponibles para agregar a cualquier sucursal.
              </p>
            </div>
          </div>

          {catalog ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
              <p className="truncate text-xs font-semibold text-emerald-800" title={catalog.original_name}>
                {catalog.original_name}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-emerald-700">
                {catalog.brands.length} marcas · actualizado {formatDate(catalog.updated_at)}
                {catalog.uploaded_by_name ? ` · por ${catalog.uploaded_by_name}` : ""}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs leading-5 text-slate-500">
              Todavía no se importó un catálogo. Las marcas configuradas actualmente siguen funcionando.
            </div>
          )}

          {isAdmin ? (
            <div className="mt-4 space-y-2">
              <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 ${catalogBusy ? "pointer-events-none opacity-50" : ""}`}>
                {catalogBusy === "upload" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {catalog ? "Reemplazar catálogo" : "Importar catálogo"}
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv,.txt"
                  className="hidden"
                  disabled={Boolean(catalogBusy)}
                  onChange={handleCatalogUpload}
                />
              </label>

              {catalog && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCatalogDownload}
                    disabled={Boolean(catalogBusy)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-45"
                  >
                    {catalogBusy === "download" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Descargar
                  </button>
                  <button
                    type="button"
                    onClick={handleCatalogDelete}
                    disabled={Boolean(catalogBusy)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-45"
                  >
                    {catalogBusy === "delete" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Eliminar
                  </button>
                </div>
              )}

              <p className="pt-1 text-[10px] leading-4 text-slate-400">
                Solo usuarios Administrador pueden importar, reemplazar o eliminar este archivo.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-500">
              El catálogo maestro es administrado exclusivamente por Administración.
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
