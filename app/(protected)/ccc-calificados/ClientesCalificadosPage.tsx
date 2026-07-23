"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { BarChart3, Boxes, Database, FileSpreadsheet, type LucideIcon, RefreshCw, UsersRound } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";
import DualSpinner from "@/components/ui/DualSpinner";
import { clientesCalificadosCss } from "./clientes-calificados.css";
import {
  CCC_BRANCH_LABELS,
  CCC_BRANCH_SUCURSAL_NAMES,
  CCC_REFRESH_DAYS,
  CccClientBaseMeta,
  downloadClientBase,
  getAllBranches,
  getBranchesForUser,
  getClientBaseFreshness,
  getClientBaseMeta,
  uploadClientBase,
} from "./ccc-client-base.service";

const ALLOWED_ROLES = new Set(["admin", "jdv", "supervisor"]);

type CccWorkspaceTab = "ccc" | "mix" | "dropsize";

const CCC_WORKSPACE_TABS: Array<{
  id: CccWorkspaceTab;
  label: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
}> = [
  {
    id: "ccc",
    label: "CCC Calificados",
    title: "CLIENTES CALIFICADOS",
    subtitle: "REDCOM S.A. · Seguimiento por Supervisor y Vendedor",
    icon: UsersRound,
  },
  {
    id: "mix",
    label: "MIX de artículos",
    title: "MIX DE ARTÍCULOS",
    subtitle: "REDCOM S.A. · Cobertura de mix por Supervisor y Vendedor",
    icon: Boxes,
  },
  {
    id: "dropsize",
    label: "DROPSIZE",
    title: "DROPSIZE",
    subtitle: "REDCOM S.A. · Seguimiento logístico por Supervisor y Vendedor",
    icon: BarChart3,
  },
];

type DashboardUser = {
  id: string;
  full_name: string | null;
  role: "admin" | "jdv" | "supervisor" | "vendedor" | "rrhh";
  branches: string[];
};

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

async function validateClientBaseFile(file: File) {
  const XLSX = (window as any).XLSX;
  if (!XLSX) throw new Error("El motor de Excel todavía no terminó de cargar.");

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["xlsx", "xls"].includes(extension)) {
    throw new Error("La base de clientes debe ser un archivo .xlsx o .xls.");
  }

  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });

  const clientes = workbook.Sheets["Clientes"];
  const rutas = workbook.Sheets["Rutas de Venta"];
  if (!clientes || !rutas) {
    throw new Error(
      'La base debe contener las hojas "Clientes" y "Rutas de Venta".',
    );
  }

  const clientesRows = XLSX.utils.sheet_to_json(clientes, {
    header: 1,
    defval: null,
  }) as unknown[][];
  const rutasRows = XLSX.utils.sheet_to_json(rutas, {
    header: 1,
    defval: null,
  }) as unknown[][];

  const clientesHeaders = (clientesRows[1] ?? []).map((value) =>
    String(value ?? "").trim(),
  );
  const rutasHeaders = (rutasRows[1] ?? []).map((value) =>
    String(value ?? "").trim(),
  );

  const requiredClientes = ["Cliente", "Código Ruta Vta.", "Anulado"];
  const requiredRutas = ["Código", "Descripción", "Código Vendedor"];
  const missing = [
    ...requiredClientes.filter((column) => !clientesHeaders.includes(column)),
    ...requiredRutas.filter((column) => !rutasHeaders.includes(column)),
  ];

  if (missing.length) {
    throw new Error(`Faltan columnas obligatorias: ${missing.join(", ")}.`);
  }
}

function ClientBaseStatus({
  meta,
  loading,
  branch,
}: {
  meta: CccClientBaseMeta | null;
  loading: boolean;
  branch: string;
}) {
  const freshness = getClientBaseFreshness(meta);
  const branchLabel = CCC_BRANCH_LABELS[branch] ?? branch;

  if (loading) {
    return (
      <div className="client-base-status is-loading">
        <RefreshCw className="status-icon spin" aria-hidden="true" />
        Consultando la base guardada de {branchLabel}…
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="client-base-status is-missing">
        <Database className="status-icon" aria-hidden="true" />
        <div>
          <strong>No hay una base de clientes guardada para {branchLabel}.</strong>
          <span>
            Subila una vez para que los demás usuarios habilitados de esta sucursal puedan reutilizarla.
          </span>
        </div>
      </div>
    );
  }

  let countdown = "";
  if (freshness.tone === "expired") {
    countdown = `Actualización vencida hace ${freshness.expiredDays} día${freshness.expiredDays === 1 ? "" : "s"}.`;
  } else if (freshness.daysRemaining === 0) {
    countdown = "Debe actualizarse hoy.";
  } else {
    countdown = `Restan ${freshness.daysRemaining} día${freshness.daysRemaining === 1 ? "" : "s"} para actualizarla.`;
  }

  return (
    <div className={`client-base-status is-${freshness.tone}`}>
      <Database className="status-icon" aria-hidden="true" />
      <div className="client-base-status-copy">
        <strong>{meta.original_name}</strong>
        <span>
          Última carga: {formatDate(meta.uploaded_at)}
          {meta.uploaded_by_name ? ` · por ${meta.uploaded_by_name}` : ""}
          {meta.size_bytes ? ` · ${formatBytes(meta.size_bytes)}` : ""}
        </span>
        <span className="countdown">{countdown}</span>
      </div>
    </div>
  );
}

function DashboardContent({ me }: { me: DashboardUser }) {
  const initialized = useRef(false);
  const selectedBranchRef = useRef("");
  const activeTabRef = useRef<CccWorkspaceTab>("ccc");
  const clientBaseMetaRef = useRef<CccClientBaseMeta | null>(null);
  const [activeTab, setActiveTab] = useState<CccWorkspaceTab>("ccc");
  const [xlsxReady, setXlsxReady] = useState(false);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [clientBaseMeta, setClientBaseMeta] = useState<CccClientBaseMeta | null>(null);
  const [clientBaseLoading, setClientBaseLoading] = useState(false);
  const [clientBaseUploading, setClientBaseUploading] = useState(false);
  const [clientBaseMessage, setClientBaseMessage] = useState<string | null>(null);
  const [clientBaseError, setClientBaseError] = useState<string | null>(null);

  useEffect(() => {
    selectedBranchRef.current = selectedBranch;
  }, [selectedBranch]);

  useEffect(() => {
    activeTabRef.current = activeTab;
    window.dispatchEvent(new Event("ccc:active-tab-changed"));
  }, [activeTab]);

  useEffect(() => {
    const emptyState = (icon: string, title: string, description: string) => `
      <div class="report-empty">
        <div class="report-empty-icon">${icon}</div>
        <h2>${title}</h2>
        <p>${description}</p>
      </div>`;

    const reportArea = document.getElementById("reportArea");
    if (reportArea) {
      reportArea.innerHTML = emptyState(
        "▦",
        "Importá los archivos para generar el dashboard",
        "La carga se conserva al cambiar entre CCC Calificados, MIX de artículos y DROPSIZE.",
      );
    }

    const mixReportArea = document.getElementById("mixReportArea");
    if (mixReportArea) {
      mixReportArea.innerHTML = emptyState(
        "▦",
        "Importá los archivos para generar el dashboard",
        "El análisis de MIX se procesa con el mismo archivo de ventas y queda disponible sin volver a cargarlo.",
      );
    }

    const dropsizeReportArea = document.getElementById("dropsizeReportArea");
    if (dropsizeReportArea) {
      dropsizeReportArea.innerHTML = emptyState(
        "↕",
        "Importá los archivos para generar el dashboard",
        "DROPSIZE utiliza el archivo de ventas compartido y requiere además Detalle personal.",
      );
    }

    const updatedBadge = document.getElementById("updatedBadge");
    if (updatedBadge) updatedBadge.style.display = "none";
    window.dispatchEvent(new Event("ccc:padron-status-changed"));
  }, [selectedBranch]);

  useEffect(() => {
    clientBaseMetaRef.current = clientBaseMeta;
    window.dispatchEvent(new Event("ccc:padron-status-changed"));
  }, [clientBaseMeta]);

  useEffect(() => {
    let cancelled = false;

    async function loadBranches() {
      setBranchesLoading(true);
      try {
        const branches =
          me.role === "admin"
            ? await getAllBranches()
            : Array.from(
                new Set([
                  ...(me.branches ?? []).map((branch) => branch.toLowerCase()),
                  ...(await getBranchesForUser(me.id)),
                ].filter(Boolean)),
              );

        if (cancelled) return;
        setAvailableBranches(branches);
        setSelectedBranch((current) =>
          current && branches.includes(current) ? current : branches[0] ?? "",
        );
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setClientBaseError(
            "No se pudieron consultar las sucursales habilitadas para tu usuario.",
          );
        }
      } finally {
        if (!cancelled) setBranchesLoading(false);
      }
    }

    loadBranches();
    return () => {
      cancelled = true;
    };
  }, [me.branches, me.role]);

  const refreshClientBaseMeta = useCallback(async (branch: string) => {
    if (!branch) {
      setClientBaseMeta(null);
      return;
    }

    setClientBaseLoading(true);
    setClientBaseError(null);
    try {
      const meta = await getClientBaseMeta(branch);
      if (selectedBranchRef.current === branch) setClientBaseMeta(meta);
    } catch (error: any) {
      console.error(error);
      if (selectedBranchRef.current === branch) {
        setClientBaseMeta(null);
        setClientBaseError(
          error?.message || "No se pudo consultar la base de clientes guardada.",
        );
      }
    } finally {
      if (selectedBranchRef.current === branch) setClientBaseLoading(false);
    }
  }, []);

  useEffect(() => {
    setClientBaseMeta(null);
    setClientBaseMessage(null);
    setClientBaseError(null);
    refreshClientBaseMeta(selectedBranch);
  }, [refreshClientBaseMeta, selectedBranch]);

  useEffect(() => {
    if (!xlsxReady || initialized.current) return;

    let cleanup: undefined | (() => void);
    let cancelled = false;

    import("./dashboard-runtime").then(({ initClientesCalificadosDashboard }) => {
      if (cancelled || initialized.current) return;
      cleanup = initClientesCalificadosDashboard({
        hasStoredPadron: () => Boolean(clientBaseMetaRef.current),
        getSelectedBranch: () => selectedBranchRef.current,
        getSelectedSucursalName: () =>
          CCC_BRANCH_SUCURSAL_NAMES[selectedBranchRef.current] || "",
        getSelectedBranchLabel: () =>
          CCC_BRANCH_LABELS[selectedBranchRef.current] || selectedBranchRef.current,
        getActiveTab: () => activeTabRef.current,
        resolvePadronFile: async () => {
          const branch = selectedBranchRef.current;
          if (!branch) throw new Error("Seleccioná una sucursal.");
          const { file, meta } = await downloadClientBase(branch);
          clientBaseMetaRef.current = meta;
          setClientBaseMeta(meta);
          return file;
        },
      });
      initialized.current = true;
    });

    return () => {
      cancelled = true;
      cleanup?.();
      initialized.current = false;
    };
  }, [xlsxReady]);

  const handleClientBaseUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedBranch) return;

    setClientBaseUploading(true);
    setClientBaseMessage(null);
    setClientBaseError(null);

    try {
      await validateClientBaseFile(file);
      const meta = await uploadClientBase({
        branch: selectedBranch,
        file,
        userId: me.id,
        uploaderName: me.full_name,
      });
      setClientBaseMeta(meta);
      setClientBaseMessage(
        `Base de ${CCC_BRANCH_LABELS[selectedBranch] ?? selectedBranch} guardada correctamente.`,
      );
    } catch (error: any) {
      console.error(error);
      setClientBaseError(
        error?.message || "No se pudo guardar la base de clientes.",
      );
    } finally {
      setClientBaseUploading(false);
    }
  };

  const selectedBranchLabel = useMemo(
    () => CCC_BRANCH_LABELS[selectedBranch] ?? selectedBranch,
    [selectedBranch],
  );

  const activeTabMeta = useMemo(
    () => CCC_WORKSPACE_TABS.find((tab) => tab.id === activeTab) ?? CCC_WORKSPACE_TABS[0],
    [activeTab],
  );

  return (
    <div className="ccc-page">
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
        strategy="afterInteractive"
        onLoad={() => setXlsxReady(true)}
        onReady={() => setXlsxReady(true)}
      />
      <style dangerouslySetInnerHTML={{ __html: clientesCalificadosCss }} />

      <div className="topbar">
        <div className="brand">
          <div className="logo-box">
            <img src="/logo_ic.png" alt="REDCOM Inteligencia Comercial" />
          </div>
          <div className="brand-copy" aria-live="polite">
            <h1>{activeTabMeta.title}</h1>
            <p>{activeTabMeta.subtitle}</p>
          </div>
        </div>

        <div className="updated-badge" id="updatedBadge" style={{ display: "none" }}>
          <span className="dot" /> Datos actualizados al <b id="updatedDate">—</b>
        </div>
      </div>

      <div className="ccc-main">
        <div className="upload-panel shared-upload-panel">
          <div className="upload-heading-row">
            <div>
              <h2>Prepará los datos para los dashboards</h2>
              <p className="sub">
                Cargá una sola vez los archivos compartidos. Al cambiar de pestaña se conservan la selección y los resultados procesados.
              </p>
            </div>

            <label className="branch-selector">
              <span>Sucursal de trabajo</span>
              <select
                value={selectedBranch}
                disabled={branchesLoading || clientBaseUploading}
                onChange={(event) => setSelectedBranch(event.target.value)}
              >
                {availableBranches.length === 0 ? (
                  <option value="">Sin sucursales asignadas</option>
                ) : (
                  availableBranches.map((branch) => (
                    <option key={branch} value={branch}>
                      {CCC_BRANCH_LABELS[branch] ?? branch}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          <div className={`upload-grid shared-upload-grid ${activeTab === "dropsize" ? "is-dropsize" : ""}`}>
            <label className="drop" id="dropBase">
              <input type="file" id="fileBase" accept=".xlsx,.xls" />
              <div className="ico"><FileSpreadsheet aria-hidden="true" /></div>
              <div className="label">Archivo de ventas (requerido)</div>
              <div className="hint">Se utiliza en los tres dashboards — .xlsx</div>
              <div className="filename" id="fileBaseName" />
            </label>

            <label className="drop" id="dropListado">
              <input type="file" id="fileListado" accept=".xlsx,.xls" />
              <div className="ico">👥</div>
              <div className="label">Listado Vendedor–Supervisor (opcional)</div>
              <div className="hint">Ya precargado — subí solo si cambió la estructura</div>
              <div className="filename" id="fileListadoName" />
            </label>

            <label
              className={`drop database-drop ${clientBaseMeta ? "filled" : ""} ${clientBaseUploading ? "is-uploading" : ""}`}
              id="dropPadron"
              aria-disabled={!selectedBranch || clientBaseUploading}
            >
              <input
                type="file"
                id="filePadron"
                accept=".xlsx,.xls"
                disabled={!selectedBranch || clientBaseUploading || !xlsxReady}
                onChange={handleClientBaseUpload}
              />
              <div className="ico">
                {clientBaseUploading ? (
                  <RefreshCw className="spin" aria-hidden="true" />
                ) : (
                  <Database aria-hidden="true" />
                )}
              </div>
              <div className="label">
                {clientBaseUploading
                  ? "Guardando base de clientes…"
                  : `Base de clientes · ${selectedBranchLabel || "Sucursal"}`}
              </div>
              <div className="hint">
                Se guarda en Supabase y se comparte con los usuarios de la sucursal
              </div>
              <div className="filename">
                {clientBaseMeta?.original_name || "Seleccioná el Excel para cargar o actualizar"}
              </div>
            </label>

            <label
              className={`drop detail-personal-drop ${activeTab === "dropsize" ? "" : "is-hidden"}`}
              id="dropDetalle"
              aria-hidden={activeTab !== "dropsize"}
            >
              <input type="file" id="fileDetalle" accept=".xlsx,.xls" tabIndex={activeTab === "dropsize" ? 0 : -1} />
              <div className="ico"><UsersRound aria-hidden="true" /></div>
              <div className="label">Detalle personal (requerido para DROPSIZE)</div>
              <div className="hint">Relaciona vendedor con superior/supervisor — .xlsx</div>
              <div className="filename" id="fileDetalleName" />
            </label>
          </div>

          <div className="refresh-rule">
            <strong>Actualización obligatoria:</strong> la base de clientes debe renovarse cada {CCC_REFRESH_DAYS} días. El dashboard reutiliza automáticamente la última versión guardada de la sucursal.
          </div>

          <ClientBaseStatus
            meta={clientBaseMeta}
            loading={clientBaseLoading}
            branch={selectedBranch}
          />

          {clientBaseMessage && <div className="database-message success">{clientBaseMessage}</div>}
          {clientBaseError && <div className="database-message error">{clientBaseError}</div>}

          <div className="actions">
            <button className="primary" id="btnProcess" disabled>
              Procesar dashboards
            </button>
            <button className="ghost" id="btnReset">Reiniciar</button>
            <span className="status" id="statusMsg">
              Esperando archivo de ventas…
            </span>
          </div>
        </div>

        <nav className="ccc-tabs" aria-label="Secciones de clientes calificados" role="tablist">
          {CCC_WORKSPACE_TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`ccc-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`ccc-panel-${tab.id}`}
                className={selected ? "is-active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <section
          id="ccc-panel-ccc"
          role="tabpanel"
          aria-labelledby="ccc-tab-ccc"
          className={`ccc-tab-panel ${activeTab === "ccc" ? "is-active" : ""}`}
        >
          <div id="reportArea" />
        </section>

        <section
          id="ccc-panel-mix"
          role="tabpanel"
          aria-labelledby="ccc-tab-mix"
          className={`ccc-tab-panel ${activeTab === "mix" ? "is-active" : ""}`}
        >
          <div id="mixReportArea" />
        </section>

        <section
          id="ccc-panel-dropsize"
          role="tabpanel"
          aria-labelledby="ccc-tab-dropsize"
          className={`ccc-tab-panel ${activeTab === "dropsize" ? "is-active" : ""}`}
        >
          <div id="dropsizeReportArea" />
        </section>
      </div>

      <div className="ccc-footer">REDCOM S.A. · Gerencia Comercial · Herramienta interna de seguimiento comercial</div>
    </div>
  );
}

export default function ClientesCalificadosPage() {
  const { me, loading } = useAuth();
  const router = useRouter();
  const allowed = Boolean(me && ALLOWED_ROLES.has(me.role));

  useEffect(() => {
    if (!loading && me && !allowed) router.replace("/acceso-denegado");
  }, [allowed, loading, me, router]);

  if (loading) {
    return (
      <div className="grid min-h-[75vh] place-items-center">
        <DualSpinner size={60} thickness={4} />
      </div>
    );
  }

  if (!me || !allowed) return null;
  return <DashboardContent me={me} />;
}
