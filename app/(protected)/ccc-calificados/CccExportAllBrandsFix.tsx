"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

const CCC_LAST_BRANCH_KEY = "redcom:ccc:last-branch";

type ReportRow = {
  sucursal?: string;
  cliente?: string;
  vendCod?: number;
  linea?: string;
  cantidad?: number;
  [key: string]: unknown;
};

function getCurrentBranch() {
  if (typeof window === "undefined") return "";

  const stored = window.localStorage.getItem(CCC_LAST_BRANCH_KEY)?.trim().toLowerCase();
  if (stored) return stored;

  const selector = document.querySelector<HTMLSelectElement>(".branch-selector select");
  return String(selector?.value || "").trim().toLowerCase();
}

function looksLikeReportRows(value: unknown): value is ReportRow[] {
  if (!Array.isArray(value) || value.length === 0) return false;

  const sampleSize = Math.min(value.length, 8);
  for (let index = 0; index < sampleSize; index += 1) {
    const row = value[index] as ReportRow | null;
    if (!row || typeof row !== "object") return false;
    if (!("linea" in row) || !("cliente" in row) || !("vendCod" in row) || !("cantidad" in row)) {
      return false;
    }
  }

  return true;
}

function isSingleLineSubset(rows: ReportRow[], allRows: ReportRow[]) {
  if (!looksLikeReportRows(rows) || !looksLikeReportRows(allRows)) return false;
  if (rows === allRows || rows.length >= allRows.length) return false;

  let firstLine = "";
  const sampleSize = Math.min(rows.length, 40);
  for (let index = 0; index < sampleSize; index += 1) {
    const line = String(rows[index]?.linea || "").trim().toUpperCase();
    if (!line) continue;
    if (!firstLine) firstLine = line;
    else if (line !== firstLine) return false;
  }

  return Boolean(firstLine);
}

/**
 * Corrección acotada para la matriz Excel de CCC.
 *
 * El dashboard visual se renderiza con una sola marca a la vez y el runtime
 * estaba pasando ese subconjunto al exportador. La matriz, en cambio, debe
 * seguir trabajando con todas las marcas configuradas. Durante los dos clicks
 * propios de la exportación (abrir modal y confirmar) sustituimos únicamente
 * las operaciones filter/map hechas sobre ese subconjunto por el dataset
 * completo persistido del dashboard.
 *
 * Así mantenemos intactos el modal, estilos, opciones y formato de Excel ya
 * existentes, sin alterar el comportamiento del resto de los dashboards.
 */
export default function CccExportAllBrandsFix() {
  useEffect(() => {
    let allRows: ReportRow[] = [];
    let disposed = false;

    const refreshRows = async () => {
      const branch = getCurrentBranch();
      if (!branch) {
        allRows = [];
        return;
      }

      const { data, error } = await supabase
        .from("ccc_dashboard_cache")
        .select("payload")
        .eq("branch_key", branch)
        .maybeSingle();

      if (disposed) return;
      if (error) {
        console.warn("[CCC] No se pudo preparar la exportación completa:", error);
        allRows = [];
        return;
      }

      const rows = (data as any)?.payload?.reportData?.rows;
      allRows = looksLikeReportRows(rows) ? rows : [];
    };

    const nativeFilter = Array.prototype.filter;
    const nativeMap = Array.prototype.map;
    let restoreTimer: number | null = null;

    const patchArrayMethodsForCurrentEvent = () => {
      if (!looksLikeReportRows(allRows)) return;

      if (restoreTimer !== null) window.clearTimeout(restoreTimer);

      (Array.prototype as any).filter = function patchedFilter(
        callback: (...args: any[]) => unknown,
        thisArg?: unknown,
      ) {
        const source = isSingleLineSubset(this as ReportRow[], allRows) ? allRows : this;
        return nativeFilter.call(source, callback as any, thisArg);
      };

      (Array.prototype as any).map = function patchedMap(
        callback: (...args: any[]) => unknown,
        thisArg?: unknown,
      ) {
        const source = isSingleLineSubset(this as ReportRow[], allRows) ? allRows : this;
        return nativeMap.call(source, callback as any, thisArg);
      };

      restoreTimer = window.setTimeout(() => {
        Array.prototype.filter = nativeFilter;
        Array.prototype.map = nativeMap;
        restoreTimer = null;
      }, 0);
    };

    const handleClickCapture = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;

      const isOpenExport = Boolean(target.closest("#btnExportVendorMatrix"));
      const isConfirmExport = Boolean(target.closest(".ccc-export-confirm"));
      if (!isOpenExport && !isConfirmExport) return;

      patchArrayMethodsForCurrentEvent();

      // Si todavía no se había recuperado la caché, la dejamos lista para el
      // siguiente click (normalmente el botón Confirmar del modal).
      if (!allRows.length) void refreshRows();
    };

    const handleDataChanged = () => {
      void refreshRows();
    };

    void refreshRows();
    document.addEventListener("click", handleClickCapture, true);
    window.addEventListener("ccc:processing-end", handleDataChanged as EventListener);
    window.addEventListener("ccc:branch-changed", handleDataChanged as EventListener);
    window.addEventListener("ccc:workspace-files-changed", handleDataChanged as EventListener);

    return () => {
      disposed = true;
      document.removeEventListener("click", handleClickCapture, true);
      window.removeEventListener("ccc:processing-end", handleDataChanged as EventListener);
      window.removeEventListener("ccc:branch-changed", handleDataChanged as EventListener);
      window.removeEventListener("ccc:workspace-files-changed", handleDataChanged as EventListener);
      if (restoreTimer !== null) window.clearTimeout(restoreTimer);
      Array.prototype.filter = nativeFilter;
      Array.prototype.map = nativeMap;
    };
  }, []);

  return null;
}
