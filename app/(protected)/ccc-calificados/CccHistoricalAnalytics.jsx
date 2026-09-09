"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  BarChart3,
  CalendarRange,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { CCC_BRANCH_LABELS } from "./ccc-client-base.service";

const CCC_LAST_BRANCH_KEY = "redcom:ccc:last-branch";
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function currentBranch() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return String(params.get("ccc_branch") || window.localStorage.getItem(CCC_LAST_BRANCH_KEY) || "")
    .trim()
    .toLowerCase();
}

function periodLabel(summary) {
  return `${MONTHS[Math.max(0, Number(summary?.periodMonth || 1) - 1)]} ${summary?.periodYear || ""}`.trim();
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value) || 0);
}

function formatCompact(value) {
  return new Intl.NumberFormat("es-AR", {
    notation: Math.abs(Number(value) || 0) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);
}

function findBrand(summary, code) {
  return summary?.brands?.find((brand) => brand.code === code) || null;
}

function getDelta(current, previous) {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  return Number(current) - Number(previous);
}

function DeltaBadge({ value, suffix = "" }) {
  if (value === null || Math.abs(value) < 0.005) {
    return <span className="text-[11px] font-semibold text-slate-400">Sin variación</span>;
  }
  const positive = value > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
      <Icon className="h-3.5 w-3.5" />
      {positive ? "+" : ""}{formatNumber(value, 1)}{suffix} vs. anterior
    </span>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyAnalytics({ branchLabel }) {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white">
          <CalendarRange className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-950">Todavía no hay históricos para analizar</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Cuando congeles períodos de {branchLabel}, esta sección va a comparar automáticamente su evolución sin volver a procesar los Excel.
        </p>
      </div>
    </div>
  );
}

function AnalyticsDashboard({ branch, periods, refresh, loading }) {
  const valid = useMemo(
    () => periods
      .filter((period) => period?.summary)
      .sort((a, b) => {
        const x = Number(a.summary.periodYear) * 100 + Number(a.summary.periodMonth);
        const y = Number(b.summary.periodYear) * 100 + Number(b.summary.periodMonth);
        return x - y;
      }),
    [periods],
  );

  const branchLabel = CCC_BRANCH_LABELS[branch] || branch || "Sucursal";
  const [brandCode, setBrandCode] = useState("");
  const [range, setRange] = useState("12");
  const [focusId, setFocusId] = useState(0);
  const [ranking, setRanking] = useState("supervisor");

  const brandOptions = useMemo(() => {
    const map = new Map();
    valid.forEach(({ summary }) => {
      (summary.brands || []).forEach((brand) => map.set(brand.code, brand.label));
    });
    return Array.from(map, ([code, label]) => ({ code, label }));
  }, [valid]);

  useEffect(() => {
    if (!brandOptions.length) return;
    if (!brandOptions.some((brand) => brand.code === brandCode)) setBrandCode(brandOptions[0].code);
  }, [brandCode, brandOptions]);

  useEffect(() => {
    if (!valid.length) return;
    if (!valid.some((period) => period.id === focusId)) setFocusId(valid[valid.length - 1].id);
  }, [focusId, valid]);

  const visible = useMemo(() => {
    const amount = Number(range);
    return amount > 0 ? valid.slice(-amount) : valid;
  }, [range, valid]);

  const focusIndex = valid.findIndex((period) => period.id === focusId);
  const focus = focusIndex >= 0 ? valid[focusIndex] : valid[valid.length - 1];
  const previous = focusIndex > 0 ? valid[focusIndex - 1] : null;
  const focusBrand = findBrand(focus?.summary, brandCode);
  const previousBrand = findBrand(previous?.summary, brandCode);

  const trend = useMemo(
    () => visible.map(({ id, summary }) => {
      const brand = findBrand(summary, brandCode);
      return {
        id,
        period: periodLabel(summary),
        coverage: Number(brand?.coveragePct || 0),
        purchase: Number(brand?.purchasePct || 0),
        qualified: Number(brand?.qualified || 0),
        buyers: Number(brand?.buyers || 0),
        clients: Number(brand?.clients ?? summary?.totals?.clients ?? 0),
        units: Number(brand?.units || 0),
        mix: Number(brand?.avgMixBuyer || 0),
        dropsize: brand?.dropsize === null || brand?.dropsize === undefined ? null : Number(brand.dropsize),
      };
    }),
    [brandCode, visible],
  );

  const rankingRows = useMemo(() => {
    if (!focus?.summary) return [];
    const source = ranking === "supervisor" ? focus.summary.supervisors || [] : focus.summary.vendors || [];
    return source
      .map((item) => {
        const brand = (item.brands || []).find((candidate) => candidate.code === brandCode);
        return {
          name: ranking === "supervisor" ? String(item.name || "") : String(item.name || item.code || ""),
          coverage: Number(brand?.coveragePct || 0),
          qualified: Number(brand?.qualified || 0),
          units: Number(brand?.units || 0),
        };
      })
      .filter((item) => item.name)
      .sort((a, b) => b.coverage - a.coverage)
      .slice(0, 12);
  }, [brandCode, focus, ranking]);

  const brandComparison = useMemo(
    () => (focus?.summary?.brands || []).map((brand) => ({
      brand: brand.label,
      coverage: Number(brand.coveragePct || 0),
      purchase: Number(brand.purchasePct || 0),
    })),
    [focus],
  );

  if (!valid.length && !loading) return <EmptyAnalytics branchLabel={branchLabel} />;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Analítica comercial histórica</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Evolución de {branchLabel}</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                Compara los períodos congelados del CCC. Los resúmenes quedan cacheados para no volver a descargar snapshots completos en cada visita.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </button>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Marca objetivo</span>
            <select value={brandCode} onChange={(event) => setBrandCode(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800">
              {brandOptions.map((brand) => <option key={brand.code} value={brand.code}>{brand.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Ventana histórica</span>
            <select value={range} onChange={(event) => setRange(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800">
              <option value="3">Últimos 3 cierres</option>
              <option value="6">Últimos 6 cierres</option>
              <option value="12">Últimos 12 cierres</option>
              <option value="0">Todo el histórico</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Período de detalle</span>
            <select value={focus?.id || ""} onChange={(event) => setFocusId(Number(event.target.value))} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800">
              {[...valid].reverse().map((period) => <option key={period.id} value={period.id}>{periodLabel(period.summary)}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">CCC · cumplimiento</p>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatNumber(focusBrand?.coveragePct || 0, 1)}%</div>
          <div className="mt-2"><DeltaBadge value={getDelta(focusBrand?.coveragePct, previousBrand?.coveragePct)} suffix=" pp" /></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Clientes que cumplieron</p>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatNumber(focusBrand?.qualified || 0)}</div>
          <div className="mt-2"><DeltaBadge value={getDelta(focusBrand?.qualified, previousBrand?.qualified)} /></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Unidades</p>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatCompact(focusBrand?.units || 0)}</div>
          <div className="mt-2"><DeltaBadge value={getDelta(focusBrand?.units, previousBrand?.units)} /></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Dropsize</p>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{focusBrand?.dropsize == null ? "—" : formatNumber(focusBrand.dropsize, 2)}</div>
          <div className="mt-2"><DeltaBadge value={getDelta(focusBrand?.dropsize, previousBrand?.dropsize)} /></div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Evolución de cumplimiento CCC" subtitle="Porcentaje de la cartera que alcanzó la cuota de la marca seleccionada.">
          <div className="h-[310px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(value, name) => [`${formatNumber(Number(value), 1)}%`, name === "coverage" ? "Cumplimiento CCC" : "Clientes con compra"]} />
                <Legend formatter={(value) => value === "coverage" ? "Cumplimiento CCC" : "Clientes con compra"} />
                <Line type="monotone" dataKey="coverage" stroke="#c8102e" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="purchase" stroke="#0f766e" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Volumen mensual" subtitle="Unidades correspondientes exclusivamente a la marca seleccionada.">
          <div className="h-[310px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
                <defs>
                  <linearGradient id="cccUnitsArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatCompact(Number(value))} />
                <Tooltip formatter={(value) => [formatNumber(Number(value)), "Unidades"]} />
                <Area type="monotone" dataKey="units" stroke="#2563eb" strokeWidth={2.5} fill="url(#cccUnitsArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Cartera, compradores y calificados" subtitle="Cómo evoluciona la cartera total hasta convertirse en compra y cumplimiento.">
          <div className="h-[310px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, name) => [formatNumber(Number(value)), name === "clients" ? "Cartera" : name === "buyers" ? "Compradores" : "Cumplieron"]} />
                <Legend formatter={(value) => value === "clients" ? "Cartera" : value === "buyers" ? "Compradores" : "Cumplieron"} />
                <Bar dataKey="clients" fill="#cbd5e1" radius={[5, 5, 0, 0]} />
                <Bar dataKey="buyers" fill="#0f766e" radius={[5, 5, 0, 0]} />
                <Bar dataKey="qualified" fill="#c8102e" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Dropsize histórico" subtitle="Unidades por comprobante cuando el período congelado contiene información de DROPSIZE.">
          <div className="h-[310px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip formatter={(value) => [value == null ? "—" : formatNumber(Number(value), 2), "Dropsize"]} />
                <Line type="monotone" connectNulls dataKey="dropsize" stroke="#d97706" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="MIX promedio por comprador" subtitle="Promedio de artículos distintos comprados por cliente con compra en cada cierre.">
          <div className="h-[310px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, "auto"]} />
                <Tooltip formatter={(value) => [formatNumber(Number(value), 2), "MIX promedio"]} />
                <Line type="monotone" dataKey="mix" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title={`Comparativa de marcas · ${focus ? periodLabel(focus.summary) : "—"}`} subtitle="Cumplimiento y penetración de compra de las marcas configuradas en ese cierre.">
          <div className="h-[310px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={brandComparison} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="brand" tick={{ fontSize: 10 }} interval={0} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(value, name) => [`${formatNumber(Number(value), 1)}%`, name === "coverage" ? "Cumplimiento CCC" : "Clientes con compra"]} />
                <Legend formatter={(value) => value === "coverage" ? "Cumplimiento CCC" : "Clientes con compra"} />
                <Bar dataKey="purchase" fill="#0f766e" radius={[5, 5, 0, 0]} />
                <Bar dataKey="coverage" fill="#c8102e" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <ChartCard title={`Ranking comercial · ${focus ? periodLabel(focus.summary) : "—"}`} subtitle="Ordenado de mayor a menor según cumplimiento CCC de la marca seleccionada.">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button type="button" onClick={() => setRanking("supervisor")} className={`rounded-md px-3 py-2 text-xs font-semibold ${ranking === "supervisor" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Supervisores</button>
            <button type="button" onClick={() => setRanking("vendor")} className={`rounded-md px-3 py-2 text-xs font-semibold ${ranking === "vendor" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Vendedores</button>
          </div>
          <span className="text-xs text-slate-400">Top {rankingRows.length} por cumplimiento</span>
        </div>
        <div style={{ height: Math.max(320, rankingRows.length * 42) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rankingRows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 18 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`${formatNumber(Number(value), 1)}%`, "Cumplimiento CCC"]} />
              <Bar dataKey="coverage" fill="#c8102e" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-950">Resumen período por período</h3>
          <p className="mt-1 text-xs text-slate-500">Lectura compacta de la evolución de la marca seleccionada.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3 text-right">Cartera</th>
                <th className="px-4 py-3 text-right">Compradores</th>
                <th className="px-4 py-3 text-right">Cumplieron</th>
                <th className="px-4 py-3 text-right">CCC %</th>
                <th className="px-4 py-3 text-right">Unidades</th>
                <th className="px-4 py-3 text-right">MIX</th>
                <th className="px-4 py-3 text-right">Dropsize</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...visible].reverse().map(({ id, summary }) => {
                const brand = findBrand(summary, brandCode);
                return (
                  <tr key={id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-800">{periodLabel(summary)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatNumber(brand?.clients || 0)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatNumber(brand?.buyers || 0)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatNumber(brand?.qualified || 0)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatNumber(brand?.coveragePct || 0, 1)}%</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatNumber(brand?.units || 0)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatNumber(brand?.avgMixBuyer || 0, 2)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{brand?.dropsize == null ? "—" : formatNumber(brand.dropsize, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {periods.some((period) => period?.error) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          Algunos cierres antiguos no pudieron resumirse. Los demás períodos se muestran normalmente y podés reintentar con “Actualizar”.
        </div>
      )}
    </div>
  );
}

export default function CccHistoricalAnalytics() {
  const [tabHost, setTabHost] = useState(null);
  const [panelHost, setPanelHost] = useState(null);
  const [active, setActive] = useState(false);
  const [branch, setBranch] = useState("");
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (targetBranch) => {
    const nextBranch = String(targetBranch || currentBranch()).trim().toLowerCase();
    setBranch(nextBranch);
    if (!nextBranch) {
      setPeriods([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = data.session?.access_token;
      if (!token) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");

      const response = await fetch(`/api/ccc/analytics?branch=${encodeURIComponent(nextBranch)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      setPeriods(Array.isArray(body?.periods) ? body.periods : []);
    } catch (loadError) {
      console.error(loadError);
      setPeriods([]);
      setError(loadError?.message || "No se pudo cargar la analítica histórica.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const install = () => {
      const nav = document.querySelector("nav.ccc-tabs");
      const dropsizePanel = document.getElementById("ccc-panel-dropsize");
      if (!nav || !dropsizePanel) return;

      let nextTabHost = document.getElementById("ccc-historical-analytics-tab-host");
      if (!nextTabHost) {
        nextTabHost = document.createElement("span");
        nextTabHost.id = "ccc-historical-analytics-tab-host";
        nextTabHost.className = "contents";
        nav.appendChild(nextTabHost);
      }
      setTabHost(nextTabHost);

      let nextPanelHost = document.getElementById("ccc-historical-analytics-panel-host");
      if (!nextPanelHost) {
        nextPanelHost = document.createElement("div");
        nextPanelHost.id = "ccc-historical-analytics-panel-host";
        dropsizePanel.insertAdjacentElement("afterend", nextPanelHost);
      }
      setPanelHost(nextPanelHost);
    };

    install();
    const observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const next = currentBranch();
    setBranch(next);
    const onBranch = () => {
      const nextBranch = currentBranch();
      setBranch(nextBranch);
      if (active) void load(nextBranch);
    };
    window.addEventListener("ccc:branch-changed", onBranch);
    return () => window.removeEventListener("ccc:branch-changed", onBranch);
  }, [active, load]);

  useEffect(() => {
    if (active && branch) void load(branch);
  }, [active, branch, load]);

  useEffect(() => {
    const nav = document.querySelector("nav.ccc-tabs");
    const panels = Array.from(document.querySelectorAll(".ccc-tab-panel"));
    if (!nav) return;

    nav.classList.toggle("ccc-analytics-active", active);
    panels.forEach((panel) => {
      if (active) {
        panel.dataset.cccAnalyticsDisplay = panel.style.display || "";
        panel.style.setProperty("display", "none", "important");
      } else if (panel.dataset.cccAnalyticsDisplay !== undefined) {
        panel.style.display = panel.dataset.cccAnalyticsDisplay || "";
        delete panel.dataset.cccAnalyticsDisplay;
      }
    });

    const handleNavClick = (event) => {
      const button = event.target?.closest?.("button");
      if (!button || button.closest("#ccc-historical-analytics-tab-host")) return;
      setActive(false);
    };
    nav.addEventListener("click", handleNavClick);
    return () => nav.removeEventListener("click", handleNavClick);
  }, [active]);

  const tab = tabHost
    ? createPortal(
        <button
          id="ccc-tab-analytics"
          type="button"
          role="tab"
          aria-selected={active}
          aria-controls="ccc-panel-analytics"
          className={`ccc-analytics-tab ${active ? "is-active" : ""}`}
          onClick={() => setActive(true)}
        >
          <Activity aria-hidden="true" />
          <span>Análisis histórico</span>
        </button>,
        tabHost,
      )
    : null;

  const panel = panelHost
    ? createPortal(
        <section id="ccc-panel-analytics" role="tabpanel" aria-labelledby="ccc-tab-analytics" className={active ? "block" : "hidden"}>
          <style>{`.ccc-tabs.ccc-analytics-active > button.is-active:not(.ccc-analytics-tab){color:var(--gray)!important;border-color:transparent!important;background:transparent!important}.ccc-historical-loading{min-height:420px}`}</style>
          {loading && !periods.length ? (
            <div className="ccc-historical-loading grid place-items-center rounded-2xl border border-slate-200 bg-white">
              <div className="text-center">
                <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-500" />
                <p className="mt-3 text-sm font-semibold text-slate-800">Preparando analítica histórica…</p>
                <p className="mt-1 text-xs text-slate-500">Los cierres antiguos se resumen una sola vez y luego quedan cacheados.</p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
          ) : (
            <AnalyticsDashboard branch={branch} periods={periods} refresh={() => void load(branch)} loading={loading} />
          )}
        </section>,
        panelHost,
      )
    : null;

  return <>{tab}{panel}</>;
}
