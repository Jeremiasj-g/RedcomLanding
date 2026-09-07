"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCccDashboardSnapshot } from "./ccc-dashboard-snapshots.service";

const CCC_LAST_BRANCH_KEY = "redcom:ccc:last-branch";
const SNAPSHOT_PARAM = "ccc_snapshot";

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

function getActiveSnapshotId() {
  if (typeof window === "undefined") return 0;
  const id = Number(new URLSearchParams(window.location.search).get(SNAPSHOT_PARAM) || 0);
  return Number.isFinite(id) && id > 0 ? id : 0;
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

function withoutVendorZero(rows: ReportRow[]) {
  return rows.filter((row) => Number(row?.vendCod) !== 0);
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
 * La matriz Excel siempre usa todas las marcas del dataset procesado y excluye
 * al vendedor código 0. Si se está consultando un período congelado, toma el
 * dataset del snapshot en lugar de la caché actual de la sucursal.
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

      try {
        const snapshotId = getActiveSnapshotId();
        if (snapshotId) {
          const snapshot = await getCccDashboardSnapshot(branch, snapshotId);
          if (disposed) return;
          const rows = snapshot?.payload?.reportData?.rows;
          allRows = looksLikeReportRows(rows) ? withoutVendorZero(rows) : [];
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
        allRows = looksLikeReportRows(rows) ? withoutVendorZero(rows) : [];
      } catch (error) {
        if (!disposed) {
          console.warn("[CCC] No se pudo preparar la exportación completa:", error);
          allRows = [];
        }
      }
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
