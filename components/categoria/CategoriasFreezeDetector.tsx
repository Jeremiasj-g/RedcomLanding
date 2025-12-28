'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getBranchKeyFromPath } from '@/utils/branchFromPath';
import { SHEETDB_ENDPOINTS } from '@/utils/sheetdbEndpoints';
import { useMe } from '@/hooks/useMe';

type Props = {
  sheetName?: string;
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
  d.setMonth(d.getMonth() - 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

/* ---------------------------------------
   UI helpers (card con header tipo "panel")
---------------------------------------- */

function PanelCard({
  title,
  subtitle,
  badge,
  tone = 'neutral',
  children,
  rightExtra,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  tone?: 'neutral' | 'admin' | 'snapshot';
  children: React.ReactNode;
  rightExtra?: React.ReactNode;
}) {
  const toneStyles =
    tone === 'admin'
      ? {
          header:
            'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900',
          badge: 'bg-white/10 text-white border-white/15',
        }
      : tone === 'snapshot'
      ? {
          header:
            'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900',
          badge: 'bg-emerald-400/10 text-emerald-200 border-emerald-300/20',
        }
      : {
          header:
            'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900',
          badge: 'bg-white/10 text-white border-white/15',
        };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
      <div className={['px-5 py-4', toneStyles.header].join(' ')}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-extrabold text-white tracking-wide">
              {title}
            </div>
            {subtitle && (
              <div className="mt-0.5 text-xs text-white/80">{subtitle}</div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {rightExtra}
            {badge && (
              <span
                className={[
                  'rounded-full border px-3 py-1 text-[11px] font-bold',
                  toneStyles.badge,
                ].join(' ')}
              >
                {badge}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-5">{children}</div>
    </div>
  );
}

function ChipButton({
  active,
  children,
  onClick,
  disabled,
  title,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'rounded-xl px-3 py-2 text-sm border transition disabled:opacity-50',
        active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export default function CategoriasFreezeDetector({ sheetName = '' }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  // user/role
  const { me } = useMe();
  const isAdmin = me?.role?.toLowerCase() === 'admin';

  // params
  const snapshotEnabled = search.get('snapshot') === '1';
  const snapshotYear = Number(search.get('year'));
  const snapshotMonth = Number(search.get('month'));

  // detectar branch + url API (no se muestra)
  const detected = useMemo(() => {
    const branchKey = getBranchKeyFromPath(pathname);
    if (!branchKey) {
      return {
        pathname,
        branchKey: null as any,
        url: null as string | null,
        reason: 'Ruta no mapeada',
      };
    }

    const endpointBase = SHEETDB_ENDPOINTS[branchKey];
    if (!endpointBase || !endpointBase.trim()) {
      return { pathname, branchKey, url: null, reason: 'Endpoint vacío' };
    }

    const url = sheetName
      ? `${endpointBase}?sheet=${encodeURIComponent(sheetName)}`
      : endpointBase;

    return { pathname, branchKey, url, reason: null as string | null };
  }, [pathname, sheetName]);

  // LIVE data (solo admin)
  const [liveData, setLiveData] = useState<any[] | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    if (!detected.url) return;

    const run = async () => {
      setLiveLoading(true);
      setLiveError(null);
      try {
        const res = await fetch(detected.url!, { cache: 'no-store' });
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
  }, [detected.url, isAdmin]);

  // selector periodo a cerrar
  const def = useMemo(() => defaultPrevMonth(), []);
  const [closeYear, setCloseYear] = useState(def.y);
  const [closeMonth, setCloseMonth] = useState(def.m);

  // snapshots list
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);

  const fetchSnapshots = async () => {
    if (!detected.branchKey) return;
    setSnapLoading(true);
    setSnapError(null);

    try {
      const res = await fetch(
        `/api/categorias/snapshots?branch_key=${encodeURIComponent(
          detected.branchKey
        )}`,
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

  // query params helpers
  const goLive = () => {
    const params = new URLSearchParams(search.toString());
    params.delete('snapshot');
    params.delete('year');
    params.delete('month');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const goSnapshot = (y: number, m: number) => {
    const params = new URLSearchParams(search.toString());
    params.set('snapshot', '1');
    params.set('year', String(y));
    params.set('month', String(m));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // cerrar mes
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const handleCloseMonth = async () => {
    if (!isAdmin) return;
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

      setSaveMsg(`Mes cerrado: ${pad2(closeMonth)}/${closeYear}`);
      await fetchSnapshots();
      goSnapshot(closeYear, closeMonth);
    } catch (e: any) {
      setSaveErr(e?.message ?? 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  const modeBadge =
    snapshotEnabled && snapshotYear && snapshotMonth
      ? `CERRADO ${pad2(snapshotMonth)}/${snapshotYear}`
      : 'ACTUAL';

  const canSeeSnapshot = snapshots.length > 0;

  return (
    <div className="mt-40 space-y-6">
      {/* error global de detección */}
      {detected.reason && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {detected.reason}
        </div>
      )}

      {/* Card: modo */}
      <PanelCard
        title="MODO DE VISUALIZACIÓN"
        subtitle="Alterná entre datos actuales y el mes cerrado."
        badge={modeBadge}
        tone={snapshotEnabled ? 'snapshot' : 'neutral'}
      >
        <div className="flex flex-wrap items-center gap-2">
          <ChipButton active={!snapshotEnabled} onClick={goLive}>
            Ver Actual
          </ChipButton>

          <ChipButton
            active={snapshotEnabled}
            onClick={() => {
              if (snapshotEnabled && snapshotYear && snapshotMonth) return;
              const latest = snapshots[0];
              if (latest) goSnapshot(latest.period_year, latest.period_month);
            }}
            disabled={!canSeeSnapshot}
          >
            Ver Cerrado
          </ChipButton>

          {!canSeeSnapshot && (
            <span className="text-xs text-slate-500">
              Todavía no hay meses cerrados.
            </span>
          )}
        </div>
      </PanelCard>

      {/* Card: admin */}
      {isAdmin && (
        <PanelCard
          title="PANEL ADMINISTRATIVO"
          subtitle="Cerrar períodos y crear snapshots."
          badge="ADMIN"
          tone="admin"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-700">
                AÑO A CERRAR
              </label>
              <input
                type="number"
                value={closeYear}
                onChange={(e) => setCloseYear(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-700">
                MES A CERRAR
              </label>
              <select
                value={closeMonth}
                onChange={(e) => setCloseMonth(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
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
              className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Cerrar mes'}
            </button>
          </div>

          <div className="mt-3 text-xs text-slate-600">
            {liveLoading && 'Preparando datos…'}
            {liveError && <span className="text-red-600">Error: {liveError}</span>}
            {saveErr && <span className="text-red-600"> · {saveErr}</span>}
            {saveMsg && <span className="text-emerald-700"> · {saveMsg}</span>}
          </div>
        </PanelCard>
      )}

      {/* Card: meses cerrados */}
      <PanelCard
        title="MESES CERRADOS"
        subtitle="Elegí un mes para visualizar el snapshot guardado."
        badge={`${snapshots.length} TOTAL`}
        tone="neutral"
        rightExtra={
          <button
            type="button"
            onClick={fetchSnapshots}
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white/15"
          >
            ACTUALIZAR
          </button>
        }
      >
        {snapLoading && <div className="text-sm text-slate-600">Cargando…</div>}
        {snapError && <div className="text-sm text-red-600">{snapError}</div>}

        {!snapLoading && !snapError && snapshots.length === 0 && (
          <div className="text-sm text-slate-500">No hay meses cerrados aún.</div>
        )}

        <div className="mt-1 flex flex-wrap gap-2">
          {snapshots.map((s) => {
            const active =
              snapshotEnabled &&
              s.period_year === snapshotYear &&
              s.period_month === snapshotMonth;

            return (
              <ChipButton
                key={s.id}
                active={active}
                onClick={() => goSnapshot(s.period_year, s.period_month)}
                title={`Cerrado: ${new Date(s.closed_at).toLocaleString()}`}
              >
                {pad2(s.period_month)}/{s.period_year}
              </ChipButton>
            );
          })}
        </div>
      </PanelCard>
    </div>
  );
}
