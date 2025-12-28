'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getBranchKeyFromPath } from '@/utils/branchFromPath';
import { SHEETDB_ENDPOINTS } from '@/utils/sheetdbEndpoints';

type Props = {
  sheetName?: string; // dejalo "" como venís usando
};

type SnapshotItem = {
  id: number;
  branch_key: string;
  period_year: number;
  period_month: number;
  closed_at: string;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function defaultPrevMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1); // ✅ mes anterior
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

export default function CategoriasFreezeDetector({ sheetName = '' }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  // params actuales (lo usa CategoriasGrid)
  const snapshotEnabled = search.get('snapshot') === '1';
  const snapshotYear = Number(search.get('year'));
  const snapshotMonth = Number(search.get('month'));

  // detectar branch + url API
  const detected = useMemo(() => {
    const branchKey = getBranchKeyFromPath(pathname);
    if (!branchKey) return { pathname, branchKey: null as any, url: null as string | null, reason: 'Ruta no mapeada' };

    const endpointBase = SHEETDB_ENDPOINTS[branchKey];
    if (!endpointBase || !endpointBase.trim()) {
      return { pathname, branchKey, url: null, reason: 'Endpoint vacío' };
    }

    const url = sheetName ? `${endpointBase}?sheet=${encodeURIComponent(sheetName)}` : endpointBase;
    return { pathname, branchKey, url, reason: null as string | null };
  }, [pathname, sheetName]);

  // -------------------------
  // LIVE data (solo para cerrar mes)
  // -------------------------
  const [liveData, setLiveData] = useState<any[] | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    if (!detected.url) return;

    const run = async () => {
      setLiveLoading(true);
      setLiveError(null);
      try {
        const url = detected.url;
        if (!url) return;

        const res = await fetch(url, { cache: 'no-store' });
        const json = await res.json().catch(() => null);

        if (!res.ok) throw new Error(json?.error ?? `SheetDB HTTP ${res.status}`);
        if (!Array.isArray(json)) throw new Error('SheetDB no devolvió un array');

        setLiveData(json);
      } catch (e: any) {
        setLiveError(e?.message ?? 'Error');
        setLiveData(null);
      } finally {
        setLiveLoading(false);
      }
    };

    run();
  }, [detected.url]);

  // -------------------------
  // Selector periodo a cerrar (default mes anterior)
  // -------------------------
  const def = useMemo(() => defaultPrevMonth(), []);
  const [closeYear, setCloseYear] = useState(def.y);
  const [closeMonth, setCloseMonth] = useState(def.m);

  // -------------------------
  // Listar meses cerrados (para elegir cuál ver)
  // -------------------------
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);

  const fetchSnapshots = async () => {
    if (!detected.branchKey) return;
    setSnapLoading(true);
    setSnapError(null);

    try {
      const res = await fetch(
        `/api/categorias/snapshots?branch_key=${encodeURIComponent(detected.branchKey)}`,
        { cache: 'no-store' }
      );
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.error ?? `HTTP ${res.status}`);

      setSnapshots(Array.isArray(out?.snapshots) ? out.snapshots : []);
    } catch (e: any) {
      setSnapError(e?.message ?? 'Error');
      setSnapshots([]);
    } finally {
      setSnapLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detected.branchKey]);

  // -------------------------
  // helpers para setear query params (switch live/snapshot)
  // -------------------------
  const goLive = () => {
    const params = new URLSearchParams(search.toString());
    params.delete('snapshot');
    params.delete('year');
    params.delete('month');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const goSnapshot = (y: number, m: number) => {
    const params = new URLSearchParams(search.toString());
    params.set('snapshot', '1');
    params.set('year', String(y));
    params.set('month', String(m));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // -------------------------
  // Cerrar mes (POST)
  // -------------------------
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const handleCloseMonth = async () => {
    if (!detected.branchKey || !detected.url) return;
    if (!liveData) return;

    setSaving(true);
    setSaveMsg(null);
    setSaveErr(null);

    try {
      const res = await fetch('/api/categorias/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_key: detected.branchKey,
          branch: String(detected.branchKey),
          period_year: closeYear,
          period_month: closeMonth,
          payload: liveData,
          meta: {
            source_url: detected.url,
            pathname: detected.pathname,
          },
        }),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out?.error ?? `HTTP ${res.status}`);

      setSaveMsg(`Guardado ${pad2(closeMonth)}/${closeYear}`);
      await fetchSnapshots();

      // (opcional) después de cerrar, te llevo directo a ver ese snapshot
      goSnapshot(closeYear, closeMonth);
    } catch (e: any) {
      setSaveErr(e?.message ?? 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 mt-40 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-slate-900">Meses cerrados (categorías)</div>
          <div className="text-xs text-slate-500">
            Cambiá entre <b>LIVE</b> (API) y <b>SNAPSHOT</b> (BD) usando los botones.
          </div>
        </div>

        <div className="text-xs text-slate-500 text-right">
          <div><b>Branch:</b> {String(detected.branchKey ?? '—')}</div>
          <div className="break-all"><b>API:</b> {detected.url ?? '—'}</div>
        </div>
      </div>

      {detected.reason && (
        <div className="text-xs text-red-600">{detected.reason}</div>
      )}

      {/* Toggle modo */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={goLive}
          className={[
            'rounded-lg px-3 py-2 text-xs font-semibold border',
            !snapshotEnabled ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900'
          ].join(' ')}
        >
          Ver LIVE (API)
        </button>

        <button
          type="button"
          disabled={snapshots.length === 0}
          onClick={() => {
            // si ya hay snapshot seleccionado, dejamos ese; si no, agarramos el más reciente
            if (snapshotEnabled && snapshotYear && snapshotMonth) return;
            const latest = snapshots[0];
            if (latest) goSnapshot(latest.period_year, latest.period_month);
          }}
          className={[
            'rounded-lg px-3 py-2 text-xs font-semibold border disabled:opacity-50',
            snapshotEnabled ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900'
          ].join(' ')}
        >
          Ver SNAPSHOT (BD)
        </button>

        {snapshotEnabled && snapshotYear && snapshotMonth && (
          <div className="ml-2 text-xs text-slate-600">
            Mostrando: <b>{pad2(snapshotMonth)}/{snapshotYear}</b>
          </div>
        )}
      </div>

      {/* Cerrar mes */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-bold text-slate-900">Cerrar mes</div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-700">Año</label>
            <input
              type="number"
              value={closeYear}
              onChange={(e) => setCloseYear(Number(e.target.value))}
              className="w-[110px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-700">Mes</label>
            <select
              value={closeMonth}
              onChange={(e) => setCloseMonth(Number(e.target.value))}
              className="w-[140px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {Array.from({ length: 12 }).map((_, i) => {
                const m = i + 1;
                return (
                  <option key={m} value={m}>
                    {pad2(m)}
                  </option>
                );
              })}
            </select>
          </div>

          <button
            type="button"
            onClick={handleCloseMonth}
            disabled={saving || liveLoading || !liveData || !!detected.reason}
            className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Cerrar mes'}
          </button>

          <div className="text-xs text-slate-600">
            {liveLoading && 'Cargando API…'}
            {liveError && <span className="text-red-600">API: {liveError}</span>}
            {saveErr && <span className="text-red-600"> · Guardar: {saveErr}</span>}
            {saveMsg && <span className="text-emerald-700"> · {saveMsg}</span>}
          </div>
        </div>
      </div>

      {/* Lista de meses cerrados */}
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-900">Meses cerrados</div>
          <button
            type="button"
            onClick={fetchSnapshots}
            className="text-xs rounded-md bg-slate-100 hover:bg-slate-200 px-3 py-2"
          >
            Actualizar
          </button>
        </div>

        {snapLoading && <div className="mt-2 text-xs text-slate-600">Cargando…</div>}
        {snapError && <div className="mt-2 text-xs text-red-600">{snapError}</div>}

        {!snapLoading && !snapError && snapshots.length === 0 && (
          <div className="mt-2 text-xs text-slate-500">No hay meses cerrados aún.</div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {snapshots.map((s) => {
            const active = snapshotEnabled && s.period_year === snapshotYear && s.period_month === snapshotMonth;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goSnapshot(s.period_year, s.period_month)}
                className={[
                  'rounded-lg px-3 py-2 text-xs border',
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900',
                ].join(' ')}
                title={`Cerrado: ${new Date(s.closed_at).toLocaleString()}`}
              >
                {pad2(s.period_month)}/{s.period_year}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
