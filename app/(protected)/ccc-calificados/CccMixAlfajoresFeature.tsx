"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Boxes, Download, RefreshCw, Trash2 } from "lucide-react";
import { CCC_BRANCH_LABELS } from "./ccc-client-base.service";
import { getSharedPersonalDetailMeta } from "./ccc-shared-personal-detail.service";
import {
  deleteMixAlfajoresFile,
  downloadMixAlfajoresFile,
  getMixAlfajoresFileMeta,
  uploadMixAlfajoresFile,
  type CccMixAlfajoresFileMeta,
} from "./ccc-mix-alfajores.service";
import MixAlfajoresPanel from "./MixAlfajoresPanel";
import { errorMessage, notify } from "@/lib/notifications";

const CCC_LAST_BRANCH_KEY = "redcom:ccc:last-branch";

function currentBranch() {
  if (typeof window === "undefined") return "";
  return String(window.localStorage.getItem(CCC_LAST_BRANCH_KEY) || "")
    .trim()
    .toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatBytes(value?: number | null) {
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

async function validateReport(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["xlsx", "xls"].includes(extension)) {
    throw new Error("El reporte MIX Alfajores debe ser un archivo .xlsx o .xls.");
  }
  const XLSX = (window as any).XLSX;
  if (!XLSX) throw new Error("El motor de Excel todavía no terminó de cargar.");

  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("El reporte MIX Alfajores no contiene una hoja válida.");
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  const headers = (rows[0] || []).map((value) => String(value ?? "").trim().toUpperCase());

  const clientAtD = String((rows[0] || [])[3] ?? "").toUpperCase().includes("CLIENT");
  const vendorAtP = String((rows[0] || [])[15] ?? "").toUpperCase().includes("VENDEDOR");
  const quantityAtAp = String((rows[0] || [])[41] ?? "").trim().toUpperCase() === "CANTIDADES TOTALES";
  const namedColumns =
    headers.some((header) => header === "CLIENTES" || header === "CLIENTE") &&
    headers.some((header) => header.includes("DESCRIPCIÓN VENDEDOR") || header.includes("DESCRIPCION VENDEDOR")) &&
    headers.includes("CANTIDADES TOTALES");

  if (!(namedColumns || (clientAtD && vendorAtP && quantityAtAp))) {
    throw new Error(
      "El reporte debe incluir Cliente en D, Descripción Vendedor en P y Cantidades Totales en AP.",
    );
  }
}

function triggerDownload(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name || "MIX ALFAJORES.xlsx";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CccMixAlfajoresFeature() {
  const [active, setActive] = useState(false);
  const [branch, setBranch] = useState("");
  const [fileMeta, setFileMeta] = useState<CccMixAlfajoresFileMeta | null>(null);
  const [personalVersion, setPersonalVersion] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tabHost, setTabHost] = useState<HTMLElement | null>(null);
  const [uploadHost, setUploadHost] = useState<HTMLElement | null>(null);
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null);

  const branchLabel = CCC_BRANCH_LABELS[branch] || branch || "Sucursal";
  const busy = loadingMeta || uploading || downloading || deleting;

  const refresh = useCallback(async (targetBranch?: string) => {
    const nextBranch = String(targetBranch || currentBranch()).trim().toLowerCase();
    setBranch(nextBranch);
    if (!nextBranch) {
      setFileMeta(null);
      return;
    }
    setLoadingMeta(true);
    try {
      const [meta, detail] = await Promise.all([
        getMixAlfajoresFileMeta(nextBranch),
        getSharedPersonalDetailMeta(),
      ]);
      setFileMeta(meta);
      setPersonalVersion(detail?.updated_at || detail?.uploaded_at || null);
    } catch (error) {
      console.error(error);
      setFileMeta(null);
      notify.error(errorMessage(error, "No se pudo consultar MIX Alfajores."));
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const branchChanged = () => void refresh(currentBranch());
    const personalChanged = () => void refresh(currentBranch());
    window.addEventListener("ccc:branch-changed", branchChanged);
    window.addEventListener("ccc:shared-personal-detail-changed", personalChanged);
    return () => {
      window.removeEventListener("ccc:branch-changed", branchChanged);
      window.removeEventListener("ccc:shared-personal-detail-changed", personalChanged);
    };
  }, [refresh]);

  useEffect(() => {
    const install = () => {
      const nav = document.querySelector<HTMLElement>(".ccc-page .ccc-tabs");
      if (nav) {
        let host = document.getElementById("ccc-mix-alfajores-tab-host");
        if (!host) {
          host = document.createElement("span");
          host.id = "ccc-mix-alfajores-tab-host";
          host.style.display = "contents";
          nav.appendChild(host);
        }
        setTabHost(host);

        const onNativeTabClick = (event: Event) => {
          const target = event.target as HTMLElement | null;
          const button = target?.closest("button");
          if (!button || host?.contains(button)) return;
          setActive(false);
        };
        nav.addEventListener("click", onNativeTabClick);
        (nav as any).__mixAlfajoresListener = onNativeTabClick;
      }

      const grid = document.querySelector<HTMLElement>(".ccc-page .shared-upload-grid");
      if (grid) {
        let host = document.getElementById("ccc-mix-alfajores-upload-host");
        if (!host) {
          host = document.createElement("span");
          host.id = "ccc-mix-alfajores-upload-host";
          host.style.display = "none";
          grid.insertBefore(host, grid.lastElementChild);
        }
        setUploadHost(host);
      }

      const tabs = document.querySelector<HTMLElement>(".ccc-page .ccc-tabs");
      if (tabs) {
        let host = document.getElementById("ccc-mix-alfajores-panel-host");
        if (!host) {
          host = document.createElement("div");
          host.id = "ccc-mix-alfajores-panel-host";
          tabs.insertAdjacentElement("afterend", host);
        }
        setPanelHost(host);
      }
    };

    install();
    const observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      const nav = document.querySelector<HTMLElement>(".ccc-page .ccc-tabs");
      const listener = (nav as any)?.__mixAlfajoresListener;
      if (nav && listener) nav.removeEventListener("click", listener);
    };
  }, []);

  useEffect(() => {
    const nativePanels = [
      document.getElementById("ccc-panel-ccc"),
      document.getElementById("ccc-panel-mix"),
      document.getElementById("ccc-panel-dropsize"),
    ].filter(Boolean) as HTMLElement[];
    nativePanels.forEach((panel) => {
      panel.style.display = active ? "none" : "";
    });

    const grid = document.querySelector<HTMLElement>(".ccc-page .shared-upload-grid");
    const dropsizeSales = document.getElementById("dropDropsizeSales");
    const dropsizeIsolated = document.getElementById("dropDropsizeIsolated");
    if (uploadHost) uploadHost.style.display = active ? "contents" : "none";
    if (grid) grid.classList.toggle("upload-grid-3", active);
    if (active) {
      if (dropsizeSales) dropsizeSales.style.display = "none";
      if (dropsizeIsolated) dropsizeIsolated.style.display = "none";
    }

    return () => {
      nativePanels.forEach((panel) => { panel.style.display = ""; });
      if (grid) grid.classList.remove("upload-grid-3");
      if (dropsizeSales) dropsizeSales.style.display = "";
      if (dropsizeIsolated) dropsizeIsolated.style.display = "";
    };
  }, [active, uploadHost]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !branch) return;
    setUploading(true);
    try {
      await validateReport(file);
      const meta = await uploadMixAlfajoresFile({ branch, file });
      setFileMeta(meta);
      notify.success(`Reporte MIX Alfajores guardado correctamente para ${branchLabel}.`);
    } catch (error) {
      console.error(error);
      notify.error(errorMessage(error, "No se pudo guardar el reporte MIX Alfajores."));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!branch || !fileMeta) return;
    setDownloading(true);
    try {
      const { file } = await downloadMixAlfajoresFile(branch);
      triggerDownload(file);
    } catch (error) {
      notify.error(errorMessage(error, "No se pudo descargar MIX Alfajores."));
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!branch || !fileMeta) return;
    if (!window.confirm(`¿Eliminar "${fileMeta.original_name}" de ${branchLabel}?`)) return;
    setDeleting(true);
    try {
      await deleteMixAlfajoresFile(branch);
      setFileMeta(null);
      notify.success(`Reporte MIX Alfajores eliminado de ${branchLabel}.`);
    } catch (error) {
      notify.error(errorMessage(error, "No se pudo eliminar MIX Alfajores."));
    } finally {
      setDeleting(false);
    }
  };

  const xlsxReady = useMemo(
    () => typeof window !== "undefined" && Boolean((window as any).XLSX),
    [active, uploading, fileMeta?.updated_at],
  );

  const tab = tabHost
    ? createPortal(
        <button
          type="button"
          role="tab"
          aria-selected={active}
          className={active ? "is-active" : ""}
          onClick={() => setActive(true)}
        >
          <Boxes aria-hidden="true" />
          <span>MIX Alfajores</span>
        </button>,
        tabHost,
      )
    : null;

  const uploadCard = uploadHost
    ? createPortal(
        <label className={`drop stored-file-drop ${fileMeta ? "filled" : ""} ${uploading ? "is-uploading" : ""}`}>
          <input type="file" accept=".xlsx,.xls" disabled={!branch || busy} onChange={handleUpload} />
          <div className="ico">
            {uploading ? <RefreshCw className="spin" aria-hidden="true" /> : <Boxes aria-hidden="true" />}
          </div>
          <div className="label">Reporte MIX Alfajores</div>
          <div className="filename">
            {fileMeta?.original_name || "Seleccioná el reporte para cargar o reemplazar"}
          </div>
          {fileMeta && (
            <div className="upload-meta">
              Última carga: {formatDate(fileMeta.updated_at)}{fileMeta.size_bytes ? ` · ${formatBytes(fileMeta.size_bytes)}` : ""}
            </div>
          )}
          {fileMeta && (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <button type="button" className="ghost" disabled={busy} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void handleDownload(); }} style={{ padding: "6px 9px", fontSize: "10.5px", fontWeight: 800, color: "var(--greenDark)", borderColor: "#B9E2CB" }}>
                {downloading ? <RefreshCw className="spin" style={{ width: 14, height: 14 }} /> : <Download style={{ width: 14, height: 14 }} />}
                {downloading ? "Descargando…" : "Descargar"}
              </button>
              <button type="button" className="ghost" disabled={busy} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void handleDelete(); }} style={{ padding: "6px 9px", fontSize: "10.5px", fontWeight: 800, color: "var(--red)", borderColor: "#F0BBC5" }}>
                {deleting ? <RefreshCw className="spin" style={{ width: 14, height: 14 }} /> : <Trash2 style={{ width: 14, height: 14 }} />}
                {deleting ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          )}
        </label>,
        uploadHost,
      )
    : null;

  const panel = panelHost && active
    ? createPortal(
        <section className="pb-2 pt-0">
          <MixAlfajoresPanel
            active={active}
            branch={branch}
            branchLabel={branchLabel}
            xlsxReady={xlsxReady}
            fileMeta={fileMeta}
            personalDetailVersion={personalVersion}
          />
        </section>,
        panelHost,
      )
    : null;

  return <>{tab}{uploadCard}{panel}</>;
}
