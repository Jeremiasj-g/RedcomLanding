"use client";

import {
  ChangeEvent,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Database,
  Download,
  FileSpreadsheet,
  Home,
  type LucideIcon,
  RefreshCw,
  Settings2,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";
import DualSpinner from "@/components/ui/DualSpinner";
import { clientesCalificadosCss } from "./clientes-calificados.css";
import CccBrandConfigurationPanel from "./CccBrandConfigurationPanel";
import {
  getBranchBrandConfig,
  type CccBranchBrandConfig,
} from "./ccc-brand-config.service";
import {
  CccSharedFileMeta,
  downloadSharedPersonalDetail,
  getSharedPersonalDetailMeta,
} from "./ccc-shared-personal-detail.service";
import { errorMessage, notify } from "@/lib/notifications";
import { useModulePermissions } from "@/components/permissions/ModulePermissionsProvider";
import {
  CCC_BRANCH_LABELS,
  CCC_BRANCH_SUCURSAL_NAMES,
  CCC_REFRESH_DAYS,
  CccClientBaseMeta,
  CccWorkspaceFileKind,
  CccWorkspaceFileMeta,
  CccWorkspaceFilesMap,
  deleteClientBase,
  deleteWorkspaceFile,
  downloadClientBase,
  downloadWorkspaceFile,
  getAllBranches,
  getBranchesForUser,
  getClientBaseFreshness,
  getClientBaseMeta,
  getWorkspaceFilesMeta,
  uploadClientBase,
  uploadWorkspaceFile,
} from "./ccc-client-base.service";

const CCC_LAST_BRANCH_KEY = "redcom:ccc:last-branch";
const CCC_LAST_TAB_KEY = "redcom:ccc:last-tab";

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

const CCC_WORKSPACE_FILE_LABELS: Record<CccWorkspaceFileKind, string> = {
  sales: "Archivo de ventas",
  dropsize_sales: "Reporte de comprobantes DROPSIZE",
  dropsize_isolated: "Reporte aislado DROPSIZE",
  seller_supervisor: "Listado Vendedor–Supervisor",
  personal_detail: "Detalle personal",
};

type DashboardUser = {
  id: string;
  full_name: string | null;
  role: string;
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

function fileMetaLine(meta?: {
  uploaded_at: string;
  uploaded_by_name: string | null;
  size_bytes: number | null;
} | null) {
  if (!meta) return null;
  return [
    `Última carga: ${formatDate(meta.uploaded_at)}`,
    meta.uploaded_by_name ? `por ${meta.uploaded_by_name}` : null,
    meta.size_bytes ? formatBytes(meta.size_bytes) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function triggerBrowserDownload(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name || "archivo.xlsx";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function validateExcelExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["xlsx", "xls"].includes(extension)) {
    throw new Error("El archivo debe tener formato .xlsx o .xls.");
  }
}

async function validateDropsizeReportFile(file: File) {
  validateExcelExtension(file);

  const XLSX = (window as any).XLSX;
  if (!XLSX) throw new Error("El motor de Excel todavía no terminó de cargar.");

  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("El reporte DROPSIZE no contiene una hoja válida.");

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as unknown[][];

  const headers = (rows[0] ?? []).map((value) =>
    String(value ?? "").trim().toUpperCase(),
  );

  const hasReceipt = headers.includes("COMPROBANTES") && headers.includes("CÓDIGO");
  const hasQuantity =
    headers.includes("CANTIDADES CON CARGO") ||
    headers.includes("CANTIDADES TOTALES");
  const brandIndex = headers.indexOf("MARCA");
  const hasBrandDescription =
    brandIndex >= 0 &&
    String((rows[0] ?? [])[brandIndex + 1] ?? "").trim().toUpperCase() === "DESCRIPCIÓN";

  if (!hasReceipt || !hasQuantity || !hasBrandDescription) {
    throw new Error(
      'El reporte DROPSIZE debe incluir Comprobantes, Código, Marca/Descripción y "Cantidades Totales" (o "Cantidades CON Cargo").',
    );
  }
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

function StoredFileActions({
  onDownload,
  onDelete,
  downloading,
  deleting,
  disabled,
}: {
  onDownload: (event: ReactMouseEvent<HTMLButtonElement>) => void | Promise<void>;
  onDelete: (event: ReactMouseEvent<HTMLButtonElement>) => void | Promise<void>;
  downloading?: boolean;
  deleting?: boolean;
  disabled?: boolean;
}) {
  const busy = Boolean(downloading || deleting);
  const buttonBaseStyle = {
    padding: "6px 9px",
    fontSize: "10.5px",
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    minHeight: "31px",
    opacity: disabled || busy ? 0.62 : 1,
  } as const;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "7px",
        flexWrap: "wrap",
        marginTop: "10px",
        width: "100%",
      }}
    >
      <button
        type="button"
        className="ghost"
        disabled={disabled || busy}
        onClick={onDownload}
        title="Descargar el archivo guardado"
        style={{ ...buttonBaseStyle, color: "var(--greenDark)", borderColor: "#B9E2CB" }}
      >
        {downloading ? (
          <RefreshCw className="spin" aria-hidden="true" style={{ width: 14, height: 14 }} />
        ) : (
          <Download aria-hidden="true" style={{ width: 14, height: 14 }} />
        )}
        {downloading ? "Descargando…" : "Descargar"}
      </button>
      <button
        type="button"
        className="ghost"
        disabled={disabled || busy}
        onClick={onDelete}
        title="Eliminar el archivo guardado"
        style={{ ...buttonBaseStyle, color: "var(--red)", borderColor: "#F0BBC5" }}
      >
        {deleting ? (
          <RefreshCw className="spin" aria-hidden="true" style={{ width: 14, height: 14 }} />
        ) : (
          <Trash2 aria-hidden="true" style={{ width: 14, height: 14 }} />
        )}
        {deleting ? "Eliminando…" : "Eliminar"}
      </button>
    </div>
  );
}

function DashboardContent({ me }: { me: DashboardUser }) {
  const initialized = useRef(false);
  const lastAutoProcessFingerprintRef = useRef("");
  const selectedBranchRef = useRef("");
  const activeTabRef = useRef<CccWorkspaceTab>("ccc");
  const clientBaseMetaRef = useRef<CccClientBaseMeta | null>(null);
  const workspaceFilesRef = useRef<CccWorkspaceFilesMap>({});
  const sharedPersonalDetailMetaRef = useRef<CccSharedFileMeta | null>(null);
  const brandConfigRef = useRef<CccBranchBrandConfig[]>([]);
  const [activeTab, setActiveTab] = useState<CccWorkspaceTab>("ccc");
  const [dropsizeView, setDropsizeView] = useState<"receipts" | "hierarchy">("receipts");
  const [pageTab, setPageTab] = useState<"home" | "config">("home");
  const [xlsxReady, setXlsxReady] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [clientBaseMeta, setClientBaseMeta] = useState<CccClientBaseMeta | null>(null);
  const [clientBaseLoading, setClientBaseLoading] = useState(false);
  const [clientBaseUploading, setClientBaseUploading] = useState(false);
  const [clientBaseDownloading, setClientBaseDownloading] = useState(false);
  const [clientBaseDeleting, setClientBaseDeleting] = useState(false);
  const [clientBaseMessage, setClientBaseMessage] = useState<string | null>(null);
  const [clientBaseError, setClientBaseError] = useState<string | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<CccWorkspaceFilesMap>({});
  const [workspaceFilesLoading, setWorkspaceFilesLoading] = useState(false);
  const [workspaceUploadingKind, setWorkspaceUploadingKind] = useState<CccWorkspaceFileKind | null>(null);
  const [workspaceDownloadingKind, setWorkspaceDownloadingKind] = useState<CccWorkspaceFileKind | null>(null);
  const [workspaceDeletingKind, setWorkspaceDeletingKind] = useState<CccWorkspaceFileKind | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [sharedPersonalDetailMeta, setSharedPersonalDetailMeta] = useState<CccSharedFileMeta | null>(null);
  const [sharedPersonalDetailLoading, setSharedPersonalDetailLoading] = useState(true);
  const [sharedPersonalDetailError, setSharedPersonalDetailError] = useState<string | null>(null);
  const [brandConfig, setBrandConfig] = useState<CccBranchBrandConfig[]>([]);
  const [brandConfigLoading, setBrandConfigLoading] = useState(true);
  const [dashboardProcessing, setDashboardProcessing] = useState(false);

  const fileActionBusy = Boolean(
    clientBaseUploading ||
      clientBaseDownloading ||
      clientBaseDeleting ||
      workspaceUploadingKind ||
      workspaceDownloadingKind ||
      workspaceDeletingKind,
  );

  useEffect(() => {
    const handleProcessingStart = () => setDashboardProcessing(true);
    const handleProcessingEnd = () => setDashboardProcessing(false);

    window.addEventListener("ccc:processing-start", handleProcessingStart);
    window.addEventListener("ccc:processing-end", handleProcessingEnd);

    return () => {
      window.removeEventListener("ccc:processing-start", handleProcessingStart);
      window.removeEventListener("ccc:processing-end", handleProcessingEnd);
    };
  }, []);

  const handleBrandConfigChange = useCallback((config: CccBranchBrandConfig[]) => {
    brandConfigRef.current = config;
    setBrandConfig(config);
  }, []);

  const handleBrandConfigLoadingChange = useCallback((loading: boolean) => {
    setBrandConfigLoading(loading);
  }, []);

  useEffect(() => {
    brandConfigRef.current = brandConfig;
    window.dispatchEvent(new Event("ccc:brand-config-changed"));
  }, [brandConfig]);

  useEffect(() => {
    let cancelled = false;

    brandConfigRef.current = [];
    setBrandConfig([]);
    setBrandConfigLoading(Boolean(selectedBranch));

    async function loadBranchBrandConfig() {
      if (!selectedBranch) {
        setBrandConfigLoading(false);
        return;
      }

      try {
        const config = await getBranchBrandConfig(selectedBranch);
        if (cancelled) return;
        brandConfigRef.current = config;
        setBrandConfig(config);
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        notify.error(errorMessage(error, "No se pudo cargar la configuración de marcas de la sucursal."));
      } finally {
        if (!cancelled) setBrandConfigLoading(false);
      }
    }

    void loadBranchBrandConfig();

    return () => {
      cancelled = true;
    };
  }, [selectedBranch]);

  useEffect(() => {
    selectedBranchRef.current = selectedBranch;
    if (selectedBranch) window.localStorage.setItem(CCC_LAST_BRANCH_KEY, selectedBranch);
    window.dispatchEvent(new Event("ccc:branch-changed"));
  }, [selectedBranch]);

  useEffect(() => {
    activeTabRef.current = activeTab;
    window.localStorage.setItem(CCC_LAST_TAB_KEY, activeTab);
    window.dispatchEvent(new Event("ccc:active-tab-changed"));
  }, [activeTab]);

  useEffect(() => {
    const storedTab = window.localStorage.getItem(CCC_LAST_TAB_KEY);
    if (storedTab && CCC_WORKSPACE_TABS.some((tab) => tab.id === storedTab)) {
      setActiveTab(storedTab as CccWorkspaceTab);
    }
  }, []);

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
        "DROPSIZE utiliza su reporte de comprobantes y analiza únicamente las marcas configuradas para la sucursal.",
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
    workspaceFilesRef.current = workspaceFiles;
    window.dispatchEvent(new Event("ccc:workspace-files-changed"));
  }, [workspaceFiles]);

  const refreshSharedPersonalDetailMeta = useCallback(async () => {
    setSharedPersonalDetailLoading(true);
    setSharedPersonalDetailError(null);
    try {
      const meta = await getSharedPersonalDetailMeta();
      sharedPersonalDetailMetaRef.current = meta;
      setSharedPersonalDetailMeta(meta);
      window.dispatchEvent(new Event("ccc:shared-personal-detail-status-changed"));
    } catch (error) {
      console.error(error);
      sharedPersonalDetailMetaRef.current = null;
      setSharedPersonalDetailMeta(null);
      setSharedPersonalDetailError(
        errorMessage(error, "No se pudo consultar Detalle personal global."),
      );
      window.dispatchEvent(new Event("ccc:shared-personal-detail-status-changed"));
    } finally {
      setSharedPersonalDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSharedPersonalDetailMeta();
    const refresh = () => void refreshSharedPersonalDetailMeta();
    window.addEventListener("ccc:shared-personal-detail-changed", refresh);
    return () => {
      window.removeEventListener("ccc:shared-personal-detail-changed", refresh);
    };
  }, [refreshSharedPersonalDetailMeta]);

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
        const storedBranch = window.localStorage.getItem(CCC_LAST_BRANCH_KEY) || "";
        setSelectedBranch((current) => {
          if (current && branches.includes(current)) return current;
          if (storedBranch && branches.includes(storedBranch)) return storedBranch;
          return branches[0] ?? "";
        });
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

  const refreshWorkspaceFiles = useCallback(async (branch: string) => {
    if (!branch) {
      setWorkspaceFiles({});
      return;
    }

    setWorkspaceFilesLoading(true);
    setWorkspaceError(null);
    try {
      const files = await getWorkspaceFilesMeta(branch);
      if (selectedBranchRef.current === branch) setWorkspaceFiles(files);
    } catch (error: any) {
      console.error(error);
      if (selectedBranchRef.current === branch) {
        setWorkspaceFiles({});
        setWorkspaceError(
          error?.message || "No se pudieron consultar los archivos guardados de la sucursal.",
        );
      }
    } finally {
      if (selectedBranchRef.current === branch) setWorkspaceFilesLoading(false);
    }
  }, []);

  useEffect(() => {
    setClientBaseMeta(null);
    setWorkspaceFiles({});
    setClientBaseMessage(null);
    setClientBaseError(null);
    setWorkspaceMessage(null);
    setWorkspaceError(null);
    refreshClientBaseMeta(selectedBranch);
    refreshWorkspaceFiles(selectedBranch);
  }, [refreshClientBaseMeta, refreshWorkspaceFiles, selectedBranch]);

  const autoProcessFingerprint = useMemo(() => {
    if (
      !selectedBranch ||
      !clientBaseMeta ||
      !workspaceFiles.sales ||
      !sharedPersonalDetailMeta ||
      !brandConfig.length
    ) return "";

    const brandFingerprint = brandConfig
      .map((item) => `${item.brand_name}:${item.quota}`)
      .join(",");

    return [
      selectedBranch,
      clientBaseMeta.updated_at || clientBaseMeta.uploaded_at,
      workspaceFiles.sales.updated_at || workspaceFiles.sales.uploaded_at,
      workspaceFiles.dropsize_sales?.updated_at || workspaceFiles.dropsize_sales?.uploaded_at || "sin-dropsize",
      workspaceFiles.dropsize_isolated?.updated_at || workspaceFiles.dropsize_isolated?.uploaded_at || "sin-dropsize-aislado",
      sharedPersonalDetailMeta.updated_at || sharedPersonalDetailMeta.uploaded_at,
      brandFingerprint,
    ].join("|");
  }, [
    brandConfig,
    clientBaseMeta,
    selectedBranch,
    sharedPersonalDetailMeta,
    workspaceFiles.sales,
    workspaceFiles.dropsize_sales,
    workspaceFiles.dropsize_isolated,
  ]);

  useEffect(() => {
    if (
      !runtimeReady ||
      !autoProcessFingerprint ||
      clientBaseLoading ||
      workspaceFilesLoading ||
      sharedPersonalDetailLoading ||
      brandConfigLoading ||
      clientBaseUploading ||
      clientBaseDeleting ||
      workspaceUploadingKind ||
      workspaceDeletingKind
    ) {
      return;
    }

    if (lastAutoProcessFingerprintRef.current === autoProcessFingerprint) return;

    const timeoutId = window.setTimeout(() => {
      lastAutoProcessFingerprintRef.current = autoProcessFingerprint;
      window.dispatchEvent(
        new CustomEvent("ccc:auto-process", {
          detail: { fingerprint: autoProcessFingerprint },
        }),
      );
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [
    autoProcessFingerprint,
    clientBaseDeleting,
    clientBaseLoading,
    clientBaseUploading,
    brandConfigLoading,
    sharedPersonalDetailLoading,
    runtimeReady,
    workspaceDeletingKind,
    workspaceFilesLoading,
    workspaceUploadingKind,
  ]);

  useEffect(() => {
    if (!xlsxReady || initialized.current) return;

    let cleanup: undefined | (() => void);
    let cancelled = false;

    import("./dashboard-runtime").then(({ initClientesCalificadosDashboard }) => {
      if (cancelled || initialized.current) return;
      cleanup = initClientesCalificadosDashboard({
        hasStoredPadron: () => Boolean(clientBaseMetaRef.current),
        hasStoredWorkspaceFile: (kind: CccWorkspaceFileKind) =>
          (kind === "sales" || kind === "dropsize_sales" || kind === "dropsize_isolated") &&
          Boolean(workspaceFilesRef.current[kind]),
        hasSharedPersonalDetail: () => Boolean(sharedPersonalDetailMetaRef.current),
        getSelectedBranch: () => selectedBranchRef.current,
        getSelectedSucursalName: () =>
          CCC_BRANCH_SUCURSAL_NAMES[selectedBranchRef.current] || "",
        getSelectedBranchLabel: () =>
          CCC_BRANCH_LABELS[selectedBranchRef.current] || selectedBranchRef.current,
        getActiveTab: () => activeTabRef.current,
        getBrandConfig: () => brandConfigRef.current,
        resolvePadronFile: async () => {
          const branch = selectedBranchRef.current;
          if (!branch) throw new Error("Seleccioná una sucursal.");
          const { file, meta } = await downloadClientBase(branch);
          clientBaseMetaRef.current = meta;
          setClientBaseMeta((current) =>
            current?.updated_at === meta.updated_at ? current : meta,
          );
          return file;
        },
        resolveWorkspaceFile: async (kind: CccWorkspaceFileKind) => {
          if (kind !== "sales" && kind !== "dropsize_sales" && kind !== "dropsize_isolated") {
            throw new Error("Ese archivo ya no se gestiona por sucursal.");
          }
          const branch = selectedBranchRef.current;
          if (!branch) throw new Error("Seleccioná una sucursal.");
          const { file, meta } = await downloadWorkspaceFile(branch, kind);
          setWorkspaceFiles((current) =>
            current[kind]?.updated_at === meta.updated_at
              ? current
              : { ...current, [kind]: meta },
          );
          return file;
        },
        resolveSharedPersonalDetail: async () => {
          const { file, meta } = await downloadSharedPersonalDetail();
          sharedPersonalDetailMetaRef.current = meta;
          setSharedPersonalDetailMeta((current) =>
            current?.updated_at === meta.updated_at ? current : meta,
          );
          return file;
        },
      });
      initialized.current = true;
      setRuntimeReady(true);
    });

    return () => {
      cancelled = true;
      cleanup?.();
      initialized.current = false;
      setRuntimeReady(false);
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
      const message = `Base de ${CCC_BRANCH_LABELS[selectedBranch] ?? selectedBranch} guardada correctamente.`;
      setClientBaseMessage(message);
      notify.success(message);
    } catch (error: any) {
      console.error(error);
      const message = errorMessage(error, "No se pudo guardar la base de clientes.");
      setClientBaseError(message);
      notify.error(message);
    } finally {
      setClientBaseUploading(false);
    }
  };

  const handleWorkspaceFileUpload =
    (kind: CccWorkspaceFileKind) =>
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !selectedBranch) return;

      setWorkspaceUploadingKind(kind);
      setWorkspaceMessage(null);
      setWorkspaceError(null);

      try {
        if (kind === "dropsize_sales") {
          await validateDropsizeReportFile(file);
        } else {
          validateExcelExtension(file);
        }
        const meta = await uploadWorkspaceFile({
          branch: selectedBranch,
          kind,
          file,
          userId: me.id,
          uploaderName: me.full_name,
        });
        setWorkspaceFiles((current) => ({ ...current, [kind]: meta }));

        const message = `${CCC_WORKSPACE_FILE_LABELS[kind]} guardado correctamente para ${selectedBranchLabel}.`;
        setWorkspaceMessage(message);
        notify.success(message);
      } catch (error: any) {
        console.error(error);
        const message = errorMessage(error, "No se pudo guardar el archivo.");
        setWorkspaceError(message);
        notify.error(message);
      } finally {
        setWorkspaceUploadingKind(null);
      }
    };

  const handleClientBaseDownload = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedBranch || !clientBaseMeta) return;

    setClientBaseDownloading(true);
    setClientBaseMessage(null);
    setClientBaseError(null);
    try {
      const { file } = await downloadClientBase(selectedBranch);
      triggerBrowserDownload(file);
      const message = `Descarga iniciada: ${file.name}.`;
      setClientBaseMessage(message);
      notify.success(message);
    } catch (error: any) {
      console.error(error);
      const message = errorMessage(error, "No se pudo descargar la base de clientes.");
      setClientBaseError(message);
      notify.error(message);
    } finally {
      setClientBaseDownloading(false);
    }
  };

  const handleWorkspaceFileDownload =
    (kind: CccWorkspaceFileKind) =>
    async (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!selectedBranch || !workspaceFiles[kind]) return;

      setWorkspaceDownloadingKind(kind);
      setWorkspaceMessage(null);
      setWorkspaceError(null);
      try {
        const { file } = await downloadWorkspaceFile(selectedBranch, kind);
        triggerBrowserDownload(file);
        const message = `Descarga iniciada: ${file.name}.`;
        setWorkspaceMessage(message);
        notify.success(message);
      } catch (error: any) {
        console.error(error);
        const message = errorMessage(error, "No se pudo descargar el archivo.");
        setWorkspaceError(message);
        notify.error(message);
      } finally {
        setWorkspaceDownloadingKind(null);
      }
    };

  const handleClientBaseDelete = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedBranch || !clientBaseMeta) return;

    const confirmed = window.confirm(
      `¿Eliminar "${clientBaseMeta.original_name}" de ${selectedBranchLabel}?\n\nEl archivo dejará de estar disponible para todos los usuarios habilitados de esta sucursal.`,
    );
    if (!confirmed) return;

    setClientBaseDeleting(true);
    setClientBaseMessage(null);
    setClientBaseError(null);
    try {
      await deleteClientBase(selectedBranch);
      clientBaseMetaRef.current = null;
      setClientBaseMeta(null);
      lastAutoProcessFingerprintRef.current = "";
      document.getElementById("btnReset")?.click();

      const message = `Base de clientes eliminada de ${selectedBranchLabel}.`;
      setClientBaseMessage(message);
      notify.success(message);
    } catch (error: any) {
      console.error(error);
      const message = errorMessage(error, "No se pudo eliminar la base de clientes.");
      setClientBaseError(message);
      notify.error(message);
    } finally {
      setClientBaseDeleting(false);
    }
  };

  const handleWorkspaceFileDelete =
    (kind: CccWorkspaceFileKind) =>
    async (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const meta = workspaceFiles[kind];
      if (!selectedBranch || !meta) return;

      const confirmed = window.confirm(
        `¿Eliminar "${meta.original_name}" de ${selectedBranchLabel}?\n\nEl archivo dejará de estar disponible para todos los usuarios habilitados de esta sucursal.`,
      );
      if (!confirmed) return;

      setWorkspaceDeletingKind(kind);
      setWorkspaceMessage(null);
      setWorkspaceError(null);
      try {
        await deleteWorkspaceFile(selectedBranch, kind);

        const nextFiles = { ...workspaceFilesRef.current };
        delete nextFiles[kind];
        workspaceFilesRef.current = nextFiles;
        setWorkspaceFiles(nextFiles);
        lastAutoProcessFingerprintRef.current = "";
        document.getElementById("btnReset")?.click();

        const message = `${CCC_WORKSPACE_FILE_LABELS[kind]} eliminado de ${selectedBranchLabel}.`;
        setWorkspaceMessage(message);
        notify.success(message);
      } catch (error: any) {
        console.error(error);
        const message = errorMessage(error, "No se pudo eliminar el archivo.");
        setWorkspaceError(message);
        notify.error(message);
      } finally {
        setWorkspaceDeletingKind(null);
      }
    };

  const selectedBranchLabel = useMemo(
    () => CCC_BRANCH_LABELS[selectedBranch] ?? selectedBranch,
    [selectedBranch],
  );

  const clientBaseFreshness = useMemo(() => {
    if (!clientBaseMeta) return null;

    const freshness = getClientBaseFreshness(clientBaseMeta);
    const expiredDays = freshness.expiredDays ?? 0;
    const daysRemaining = freshness.daysRemaining ?? 0;

    if (freshness.tone === "expired") {
      return {
        toneClass: "freshness-expired",
        message: `Actualización vencida hace ${expiredDays} día${expiredDays === 1 ? "" : "s"}`,
      };
    }

    if (freshness.tone === "warning") {
      return {
        toneClass: "freshness-warning",
        message: `Restan ${daysRemaining} día${daysRemaining === 1 ? "" : "s"} para actualizar`,
      };
    }

    return {
      toneClass: "freshness-fresh",
      message: `Restan ${daysRemaining} días para actualizar`,
    };
  }, [clientBaseMeta]);

  const activeTabMeta = useMemo(
    () => CCC_WORKSPACE_TABS.find((tab) => tab.id === activeTab) ?? CCC_WORKSPACE_TABS[0],
    [activeTab],
  );

  return (
    <div className="ccc-page">
      <Script
        src="https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js"
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
            <h1>{pageTab === "config" ? "CONFIGURACIÓN CCC" : activeTabMeta.title}</h1>
            <p>
              {pageTab === "config"
                ? "REDCOM S.A. · Marcas foco y cuotas por sucursal"
                : activeTabMeta.subtitle}
            </p>
          </div>
        </div>

        <div className="updated-badge" id="updatedBadge" style={{ display: "none" }}>
          <span className="dot" /> Datos actualizados al <b id="updatedDate">—</b>
        </div>
      </div>

      <div className="ccc-main">
        <nav
          className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          aria-label="Navegación del módulo CCC"
        >
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setPageTab("home")}
              aria-current={pageTab === "home" ? "page" : undefined}
              className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
                pageTab === "home"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Home className="h-4 w-4" />
              Inicio
            </button>
            <button
              type="button"
              onClick={() => setPageTab("config")}
              aria-current={pageTab === "config" ? "page" : undefined}
              className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
                pageTab === "config"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Settings2 className="h-4 w-4" />
              Panel de configuración
            </button>
          </div>
          <span className="hidden px-3 text-xs font-medium text-slate-400 lg:block">
            {pageTab === "home"
              ? "Carga de archivos y dashboards"
              : "Marcas y cuotas independientes por sucursal"}
          </span>
        </nav>

        <div
          className={pageTab === "home" ? "" : "hidden"}
          aria-hidden={pageTab !== "home"}
        >
        <div className="upload-panel shared-upload-panel">
          <div className="upload-heading-row">
            <div>
              <h2>Prepará los datos para los dashboards</h2>
              <p className="sub">
                Cargá una sola vez los archivos compartidos. Al volver a esta página se recuperan y procesan automáticamente para la última sucursal utilizada.
              </p>
            </div>

            <label className="branch-selector">
              <span>Sucursal de trabajo</span>
              <select
                value={selectedBranch}
                disabled={branchesLoading || fileActionBusy}
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

          <div className={`upload-grid shared-upload-grid ${activeTab === "dropsize" ? "upload-grid-4" : ""}`}>
            <label
              className={`drop stored-file-drop ${workspaceFiles.sales ? "filled" : ""} ${workspaceUploadingKind === "sales" ? "is-uploading" : ""}`}
              id="dropBase"
            >
              <input
                type="file"
                id="fileBase"
                accept=".xlsx,.xls"
                disabled={!selectedBranch || fileActionBusy}
                onChange={handleWorkspaceFileUpload("sales")}
              />
              <div className="ico">
                {workspaceUploadingKind === "sales" ? <RefreshCw className="spin" aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}
              </div>
              <div className="label">Archivo de ventas (requerido)</div>
                            <div className="filename" id="fileBaseName">
                {workspaceFiles.sales?.original_name || "Seleccioná el Excel para cargar o reemplazar"}
              </div>
              {workspaceFiles.sales && <div className="upload-meta">{fileMetaLine(workspaceFiles.sales)}</div>}
              {workspaceFiles.sales && (
                <StoredFileActions
                  onDownload={handleWorkspaceFileDownload("sales")}
                  onDelete={handleWorkspaceFileDelete("sales")}
                  downloading={workspaceDownloadingKind === "sales"}
                  deleting={workspaceDeletingKind === "sales"}
                  disabled={fileActionBusy && workspaceDownloadingKind !== "sales" && workspaceDeletingKind !== "sales"}
                />
              )}
            </label>

            {activeTab === "dropsize" && (
              <label
                className={`drop stored-file-drop ${workspaceFiles.dropsize_sales ? "filled" : ""} ${workspaceUploadingKind === "dropsize_sales" ? "is-uploading" : ""}`}
                id="dropDropsizeSales"
              >
                <input
                  type="file"
                  id="fileDropsizeSales"
                  accept=".xlsx,.xls"
                  disabled={!selectedBranch || fileActionBusy || !xlsxReady}
                  onChange={handleWorkspaceFileUpload("dropsize_sales")}
                />
                <div className="ico">
                  {workspaceUploadingKind === "dropsize_sales" ? (
                    <RefreshCw className="spin" aria-hidden="true" />
                  ) : (
                    <FileSpreadsheet aria-hidden="true" />
                  )}
                </div>
                <div className="label">Reporte de comprobantes DROPSIZE</div>
                <div className="filename">
                  {workspaceFiles.dropsize_sales?.original_name ||
                    "Seleccioná el reporte con comprobantes"}
                </div>
                {workspaceFiles.dropsize_sales && (
                  <div className="upload-meta">{fileMetaLine(workspaceFiles.dropsize_sales)}</div>
                )}
                {workspaceFiles.dropsize_sales && (
                  <StoredFileActions
                    onDownload={handleWorkspaceFileDownload("dropsize_sales")}
                    onDelete={handleWorkspaceFileDelete("dropsize_sales")}
                    downloading={workspaceDownloadingKind === "dropsize_sales"}
                    deleting={workspaceDeletingKind === "dropsize_sales"}
                    disabled={
                      fileActionBusy &&
                      workspaceDownloadingKind !== "dropsize_sales" &&
                      workspaceDeletingKind !== "dropsize_sales"
                    }
                  />
                )}
              </label>
            )}

            {activeTab === "dropsize" && (
              <label
                className={`drop stored-file-drop ${workspaceFiles.dropsize_isolated ? "filled" : ""} ${workspaceUploadingKind === "dropsize_isolated" ? "is-uploading" : ""}`}
                id="dropDropsizeIsolated"
              >
                <input
                  type="file"
                  id="fileDropsizeIsolated"
                  accept=".xlsx,.xls"
                  disabled={!selectedBranch || fileActionBusy || !xlsxReady}
                  onChange={handleWorkspaceFileUpload("dropsize_isolated")}
                />
                <div className="ico">
                  {workspaceUploadingKind === "dropsize_isolated" ? (
                    <RefreshCw className="spin" aria-hidden="true" />
                  ) : (
                    <FileSpreadsheet aria-hidden="true" />
                  )}
                </div>
                <div className="label">Reporte aislado DROPSIZE</div>
                <div className="filename">
                  {workspaceFiles.dropsize_isolated?.original_name ||
                    "Seleccioná el reporte aislado de una marca"}
                </div>
                {workspaceFiles.dropsize_isolated && (
                  <div className="upload-meta">{fileMetaLine(workspaceFiles.dropsize_isolated)}</div>
                )}
                {workspaceFiles.dropsize_isolated && (
                  <StoredFileActions
                    onDownload={handleWorkspaceFileDownload("dropsize_isolated")}
                    onDelete={handleWorkspaceFileDelete("dropsize_isolated")}
                    downloading={workspaceDownloadingKind === "dropsize_isolated"}
                    deleting={workspaceDeletingKind === "dropsize_isolated"}
                    disabled={
                      fileActionBusy &&
                      workspaceDownloadingKind !== "dropsize_isolated" &&
                      workspaceDeletingKind !== "dropsize_isolated"
                    }
                  />
                )}
              </label>
            )}

            <label
              className={`drop database-drop ${clientBaseMeta ? "filled" : ""} ${clientBaseFreshness?.toneClass ?? ""} ${clientBaseUploading ? "is-uploading" : ""}`}
              id="dropPadron"
              aria-disabled={!selectedBranch || fileActionBusy}
            >
              <input
                type="file"
                id="filePadron"
                accept=".xlsx,.xls"
                disabled={!selectedBranch || fileActionBusy || !xlsxReady}
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
              <div className="filename">
                {clientBaseMeta?.original_name || "Seleccioná el Excel para cargar o actualizar"}
              </div>
              {clientBaseMeta && <div className="upload-meta">{fileMetaLine(clientBaseMeta)}</div>}
              {clientBaseFreshness && (
                <div className="client-base-freshness" role="status" aria-live="polite">
                  {clientBaseFreshness.message}
                </div>
              )}
              {clientBaseMeta && (
                <StoredFileActions
                  onDownload={handleClientBaseDownload}
                  onDelete={handleClientBaseDelete}
                  downloading={clientBaseDownloading}
                  deleting={clientBaseDeleting}
                  disabled={fileActionBusy && !clientBaseDownloading && !clientBaseDeleting}
                />
              )}
            </label>

          </div>

          <div className="refresh-rule">
            <strong>Actualización obligatoria:</strong> la base de clientes debe renovarse cada {CCC_REFRESH_DAYS} días. El dashboard reutiliza automáticamente la última versión guardada de la sucursal.
          </div>

          {workspaceFilesLoading && (
            <div className="database-message neutral">Consultando los archivos guardados de {selectedBranchLabel}…</div>
          )}
          {workspaceMessage && <div className="database-message success">{workspaceMessage}</div>}
          {workspaceError && <div className="database-message error">{workspaceError}</div>}
          {sharedPersonalDetailError && (
            <div className="database-message error">{sharedPersonalDetailError}</div>
          )}
          {!sharedPersonalDetailLoading && !sharedPersonalDetailMeta && (
            <div className="database-message neutral">
              Administración debe cargar Detalle personal global desde el Panel de configuración.
            </div>
          )}
          {clientBaseMessage && <div className="database-message success">{clientBaseMessage}</div>}
          {clientBaseError && <div className="database-message error">{clientBaseError}</div>}

          <div className="actions">
            <button
              className="primary"
              id="btnProcess"
              disabled
              aria-busy={dashboardProcessing}
              onClick={() => setDashboardProcessing(true)}
            >
              <span>Procesar dashboards</span>
              {dashboardProcessing && (
                <span className="inline-flex items-center" aria-hidden="true">
                  <DualSpinner size={16} thickness={2} />
                </span>
              )}
            </button>
            <button className="ghost" id="btnReset">Reiniciar</button>
            <span className="status" id="statusMsg">
              {workspaceFilesLoading || clientBaseLoading || sharedPersonalDetailLoading
                ? "Consultando archivos guardados…"
                : "Esperando archivo de ventas…"}
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
          {dashboardProcessing && (
            <DashboardProcessingState />
          )}
          <div id="reportArea" className={dashboardProcessing ? "hidden" : ""} />
        </section>

        <section
          id="ccc-panel-mix"
          role="tabpanel"
          aria-labelledby="ccc-tab-mix"
          className={`ccc-tab-panel ${activeTab === "mix" ? "is-active" : ""}`}
        >
          {dashboardProcessing && (
            <DashboardProcessingState />
          )}
          <div id="mixReportArea" className={dashboardProcessing ? "hidden" : ""} />
        </section>

        <section
          id="ccc-panel-dropsize"
          role="tabpanel"
          aria-labelledby="ccc-tab-dropsize"
          className={`ccc-tab-panel ${activeTab === "dropsize" ? "is-active" : ""}`}
        >
          {dashboardProcessing && (
            <DashboardProcessingState />
          )}
          <div className={dashboardProcessing ? "hidden" : ""}>
            <div className="dropsize-mode-tabs" role="tablist" aria-label="Vistas de DROPSIZE">
              <button
                type="button"
                role="tab"
                aria-selected={dropsizeView === "receipts"}
                className={dropsizeView === "receipts" ? "is-active" : ""}
                onClick={() => setDropsizeView("receipts")}
              >
                Por comprobantes
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={dropsizeView === "hierarchy"}
                className={dropsizeView === "hierarchy" ? "is-active" : ""}
                onClick={() => setDropsizeView("hierarchy")}
              >
                Detalle comercial
              </button>
            </div>

            <div className={dropsizeView === "receipts" ? "" : "hidden"}>
              <div id="dropsizeReportArea" />
            </div>
            <div className={dropsizeView === "hierarchy" ? "" : "hidden"}>
              <div id="dropsizeHierarchyArea" />
            </div>
          </div>
        </section>
        </div>

        <div
          className={pageTab === "config" ? "space-y-4" : "hidden"}
          aria-hidden={pageTab !== "config"}
        >
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Panel de configuración
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">
                    Marcas foco y cuotas
                  </h2>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                    La configuración se guarda de forma independiente para cada sucursal y define qué marcas entran al procesamiento.
                  </p>
                </div>

                <label className="branch-selector sm:min-w-[260px]">
                  <span>Sucursal a configurar</span>
                  <select
                    value={selectedBranch}
                    disabled={branchesLoading || fileActionBusy}
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
            </section>

            <CccBrandConfigurationPanel
              me={me}
              branch={selectedBranch}
              branchLabel={selectedBranchLabel}
              onConfigChange={handleBrandConfigChange}
              onLoadingChange={handleBrandConfigLoadingChange}
            />
          </div>
      </div>

      <div className="ccc-footer">REDCOM S.A. · Gerencia Comercial · Herramienta interna de seguimiento comercial</div>
    </div>
  );
}

function DashboardProcessingState() {
  return (
    <div
      className="grid min-h-[318px] place-items-center rounded-2xl bg-white"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <DualSpinner size={60} thickness={4} />
        <div>
          <p className="text-base font-semibold text-slate-900">Procesando dashboard…</p>
          <p className="mt-1 text-sm text-slate-500">
            Estamos preparando los datos. Esto puede demorar unos segundos.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ClientesCalificadosPage() {
  const { me, loading } = useAuth();
  const { loading: permissionsLoading, canAccessModule } = useModulePermissions();
  const router = useRouter();
  const allowed = Boolean(me && canAccessModule("quarterly_indicators"));

  useEffect(() => {
    if (!loading && !permissionsLoading && me && !allowed) router.replace("/acceso-denegado");
  }, [allowed, loading, me, permissionsLoading, router]);

  if (loading || permissionsLoading) {
    return (
      <div className="grid min-h-[75vh] place-items-center">
        <DualSpinner size={60} thickness={4} />
      </div>
    );
  }

  if (!me || !allowed) return null;
  return <DashboardContent me={me} />;
}
