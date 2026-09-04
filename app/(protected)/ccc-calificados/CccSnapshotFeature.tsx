"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Archive,
  CalendarClock,
  Eye,
  RefreshCw,
  Snowflake,
  Trash2,
  Undo2,
} from "lucide-react";
import { useMe } from "@/hooks/useMe";
import { errorMessage, notify } from "@/lib/notifications";
import { CCC_BRANCH_LABELS } from "./ccc-client-base.service";
import {
  deleteCccDashboardSnapshot,
  formatCccSnapshotPeriod,
  freezeCccDashboardSnapshot,
  getCccDashboardSnapshot,
  listCccDashboardSnapshots,
  type CccDashboardSnapshot,
  type CccDashboardSnapshotMeta,
} from "./ccc-dashboard-snapshots.service";

const CCC_LAST_BRANCH_KEY = "redcom:ccc:last-branch";
const SNAPSHOT_PARAM = "ccc_snapshot";
const PERIOD_PARAM = "ccc_period";
const BRANCH_PARAM = "ccc_branch";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function currentBranch() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const historicalBranch = String(params.get(BRANCH_PARAM) || "").trim().toLowerCase();
  if (historicalBranch) return historicalBranch;
  return String(window.localStorage.getItem(CCC_LAST_BRANCH_KEY) || "")
    .trim()
    .toLowerCase();
}

function activeSnapshotId() {
  if (typeof window === "undefined") return 0;
  const id = Number(new URLSearchParams(window.location.search).get(SNAPSHOT_PARAM) || 0);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function navigateSnapshot(snapshot: CccDashboardSnapshotMeta) {
  const url = new URL(window.location.href);
  url.searchParams.set(SNAPSHOT_PARAM, String(snapshot.id));
  url.searchParams.set(BRANCH_PARAM, snapshot.branch_key);
  url.searchParams.set(
    PERIOD_PARAM,
    `${snapshot.period_year}-${String(snapshot.period_month).padStart(2, "0")}`,
  );
  window.localStorage.setItem(CCC_LAST_BRANCH_KEY, snapshot.branch_key);
  window.location.assign(url.toString());
}

function navigateLive() {
  const url = new URL(window.location.href);
  url.searchParams.delete(SNAPSHOT_PARAM);
  url.searchParams.delete(PERIOD_PARAM);
  url.searchParams.delete(BRANCH_PARAM);
  window.location.assign(url.toString());
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function CccSnapshotFeature() {
  const { me, isAdmin } = useMe();
  const now = useMemo(() => new Date(), []);
  const [branch, setBranch] = useState("");
  const [snapshots, setSnapshots] = useState<CccDashboardSnapshotMeta[]>([]);
  const [activeSnapshot, setActiveSnapshot] = useState<CccDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [managerHost, setManagerHost] = useState<HTMLElement | null>(null);
  const [bannerHost, setBannerHost] = useState<HTMLElement | null>(null);

  const snapshotId = activeSnapshotId();
  const branchLabel = CCC_BRANCH_LABELS[branch] || branch || "Sucursal";

  const refresh = useCallback(async (targetBranch?: string) => {
    const nextBranch = String(targetBranch || currentBranch()).trim().toLowerCase();
    setBranch(nextBranch);
    if (!nextBranch || !me) {
      setSnapshots([]);
      return;
    }

    setLoading(true);
    try {
      const rows = await listCccDashboardSnapshots(nextBranch);
      setSnapshots(rows);
    } catch (error) {
      console.error(error);
      notify.error(errorMessage(error, "No se pudieron consultar los períodos congelados de CCC."));
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => {
    if (!me) return;

    const historicalBranch = currentBranch();
    if (snapshotId && historicalBranch) {
      window.localStorage.setItem(CCC_LAST_BRANCH_KEY, historicalBranch);
    }
    void refresh(historicalBranch);

    const handleBranchChange = () => {
      // ClientesCalificadosPage emite este evento también al inicializar la
      // última sucursal. No debemos salir del histórico por ese evento interno.
      if (snapshotId) return;
      void refresh(currentBranch());
    };

    window.addEventListener("ccc:branch-changed", handleBranchChange);
    return () => window.removeEventListener("ccc:branch-changed", handleBranchChange);
  }, [me, refresh, snapshotId]);

  useEffect(() => {
    if (!me || !branch || !snapshotId) {
      setActiveSnapshot(null);
      return;
    }

    let cancelled = false;
    void getCccDashboardSnapshot(branch, snapshotId)
      .then((snapshot) => {
        if (!cancelled) setActiveSnapshot(snapshot);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          notify.error(errorMessage(error, "No se pudo abrir el período congelado."));
          navigateLive();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [branch, me, snapshotId]);

  useEffect(() => {
    const installHosts = () => {
      const configHeading = Array.from(document.querySelectorAll("section h2")).find(
        (node) => node.textContent?.trim() === "Configuración de focos y cuotas",
      );
      const configSection = configHeading?.closest("section");
      if (configSection) {
        let host = document.getElementById("ccc-snapshot-manager-host");
        if (!host) {
          host = document.createElement("div");
          host.id = "ccc-snapshot-manager-host";
          configSection.insertAdjacentElement("afterend", host);
        }
        setManagerHost(host);
      }

      const uploadPanel = document.querySelector<HTMLElement>(".upload-panel.shared-upload-panel");
      if (uploadPanel) {
        let host = document.getElementById("ccc-snapshot-banner-host");
        if (!host) {
          host = document.createElement("div");
          host.id = "ccc-snapshot-banner-host";
          uploadPanel.insertAdjacentElement("beforebegin", host);
        }
        setBannerHost(host);
      }
    };

    installHosts();
    const observer = new MutationObserver(installHosts);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const uploadPanel = document.querySelector<HTMLElement>(".upload-panel.shared-upload-panel");
    if (!uploadPanel) return;
    const previousDisplay = uploadPanel.style.display;
    if (snapshotId) uploadPanel.style.display = "none";
    return () => {
      uploadPanel.style.display = previousDisplay;
    };
  }, [snapshotId, bannerHost]);

  const existingPeriod = snapshots.find(
    (item) => item.period_year === periodYear && item.period_month === periodMonth,
  );

  const handleFreeze = async () => {
    if (!isAdmin || !branch || snapshotId) return;
    if (existingPeriod) {
      const confirmed = window.confirm(
        `${formatCccSnapshotPeriod(periodYear, periodMonth)} ya está congelado. ¿Querés reemplazarlo por el dashboard actual?`,
      );
      if (!confirmed) return;
    }

    setBusy("freeze");
    try {
      const result = await freezeCccDashboardSnapshot({
        branch,
        periodYear,
        periodMonth,
      });
      notify.success(
        result.replaced
          ? `${formatCccSnapshotPeriod(periodYear, periodMonth)} fue actualizado correctamente.`
          : `${formatCccSnapshotPeriod(periodYear, periodMonth)} quedó congelado correctamente.`,
      );
      await refresh(branch);
      navigateSnapshot(result.snapshot);
    } catch (error) {
      console.error(error);
      notify.error(errorMessage(error, "No se pudo congelar el período."));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (snapshot: CccDashboardSnapshotMeta) => {
    if (!isAdmin || !branch) return;
    const label = formatCccSnapshotPeriod(snapshot.period_year, snapshot.period_month);
    if (!window.confirm(`¿Eliminar definitivamente el cierre de ${label}?`)) return;

    setBusy(`delete:${snapshot.id}`);
    try {
      await deleteCccDashboardSnapshot(branch, snapshot.id);
      notify.success(`${label} eliminado del histórico CCC.`);
      if (snapshot.id === snapshotId) {
        navigateLive();
        return;
      }
      await refresh(branch);
    } catch (error) {
      console.error(error);
      notify.error(errorMessage(error, "No se pudo eliminar el período."));
    } finally {
      setBusy(null);
    }
  };

  const manager = managerHost
    ? createPortal(
        <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
                <Archive className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-950">Histórico CCC</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Congelá cierres mensuales y consultalos aunque después cambien los archivos de trabajo.
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
              <Snowflake className="h-3.5 w-3.5" /> {branchLabel}
            </span>
          </div>

          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(330px,.8fr)]">
            <div className="border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Períodos congelados</p>
                  <p className="mt-1 text-xs text-slate-500">Seleccioná un cierre para volver a ver exactamente ese dashboard.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void refresh(branch)}
                  disabled={loading}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-45"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
                </button>
              </div>

              {loading ? (
                <div className="grid min-h-[120px] place-items-center text-xs text-slate-500">Cargando histórico…</div>
              ) : snapshots.length ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {snapshots.map((snapshot) => {
                    const active = snapshot.id === snapshotId;
                    return (
                      <div
                        key={snapshot.id}
                        className={`rounded-xl border p-3 ${active ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-slate-900">
                              {formatCccSnapshotPeriod(snapshot.period_year, snapshot.period_month)}
                            </p>
                            <p className="mt-1 text-[10px] leading-4 text-slate-500">
                              Cerrado {formatDate(snapshot.closed_at)}
                              {snapshot.closed_by_name ? ` · ${snapshot.closed_by_name}` : ""}
                            </p>
                          </div>
                          {active && (
                            <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">Viendo</span>
                          )}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => navigateSnapshot(snapshot)}
                            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-2 text-[11px] font-semibold text-white hover:bg-slate-800"
                          >
                            <Eye className="h-3.5 w-3.5" /> Ver
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => void handleDelete(snapshot)}
                              disabled={busy === `delete:${snapshot.id}`}
                              title="Eliminar período"
                              className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-45"
                            >
                              {busy === `delete:${snapshot.id}` ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
                  Todavía no hay períodos congelados para {branchLabel}.
                </div>
              )}
            </div>

            <aside className="bg-slate-50/40 p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600">
                  <CalendarClock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">Congelar período</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Guarda una copia del dashboard procesado actual con el mes y año que indiques.
                  </p>
                </div>
              </div>

              {isAdmin ? (
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Mes</span>
                    <select
                      value={periodMonth}
                      onChange={(event) => setPeriodMonth(Number(event.target.value))}
                      disabled={Boolean(snapshotId)}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 disabled:bg-slate-100"
                    >
                      {MONTHS.map((month, index) => (
                        <option key={month} value={index + 1}>{month}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Año</span>
                    <input
                      type="number"
                      min={2020}
                      max={2100}
                      value={periodYear}
                      onChange={(event) => setPeriodYear(Number(event.target.value))}
                      disabled={Boolean(snapshotId)}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 disabled:bg-slate-100"
                    />
                  </label>

                  {snapshotId ? (
                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] leading-5 text-sky-800">
                      Estás viendo un cierre histórico. Volvé a Datos actuales para crear o reemplazar cierres.
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleFreeze()}
                      disabled={busy === "freeze" || !branch}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-45"
                    >
                      {busy === "freeze" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Snowflake className="h-4 w-4" />}
                      {busy === "freeze"
                        ? "Congelando…"
                        : existingPeriod
                          ? `Reemplazar ${MONTHS[periodMonth - 1]} ${periodYear}`
                          : `Congelar ${MONTHS[periodMonth - 1]} ${periodYear}`}
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-3 text-[11px] leading-5 text-slate-500">
                  Solo Administración puede crear, reemplazar o eliminar cierres. Todos los usuarios habilitados pueden consultarlos.
                </div>
              )}
            </aside>
          </div>
        </section>,
        managerHost,
      )
    : null;

  const banner = bannerHost && snapshotId
    ? createPortal(
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-600 text-white">
              <Snowflake className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-sky-950">
                {activeSnapshot
                  ? `Visualizando ${formatCccSnapshotPeriod(activeSnapshot.period_year, activeSnapshot.period_month)}`
                  : "Visualizando un período congelado"}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-sky-800">
                Esta vista permanece fija aunque se carguen archivos nuevos para la sucursal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={navigateLive}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-sky-300 bg-white px-3 text-xs font-semibold text-sky-800 hover:bg-sky-100"
          >
            <Undo2 className="h-3.5 w-3.5" /> Volver a datos actuales
          </button>
        </div>,
        bannerHost,
      )
    : null;

  return <>{manager}{banner}</>;
}
