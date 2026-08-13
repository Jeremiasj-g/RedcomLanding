'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Archive, CalendarClock, Eye, LockKeyhole, RefreshCw } from 'lucide-react';
import { getBranchKeyFromPath } from '@/utils/branchFromPath';
import { SHEETDB_ENDPOINTS } from '@/utils/sheetdbEndpoints';
import { useMe } from '@/hooks/useMe';

type Props = { sheetName?: string };
type SnapshotItem = { id: number; branch_key: string; period_year: number; period_month: number; closed_at: string };
type TabId = 'visualizacion' | 'cerrados' | 'cerrar';

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function defaultPrevMonth() {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return { y: date.getFullYear(), m: date.getMonth() + 1 };
}

function Card({ title, subtitle, badge, action, children }: { title: string; subtitle: string; badge?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-extrabold tracking-wide text-white">{title}</div>
            <div className="mt-0.5 text-xs text-white/80">{subtitle}</div>
          </div>
          <div className="flex items-center gap-2">
            {action}
            {badge && <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-white">{badge}</span>}
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Chip({ active, disabled, title, onClick, children }: { active?: boolean; disabled?: boolean; title?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={[
      'rounded-xl border px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45',
      active ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50',
    ].join(' ')}>
      {children}
    </button>
  );
}

function Tab({ active, disabled, adminOnly, icon, label, detail, onClick }: { active: boolean; disabled?: boolean; adminOnly?: boolean; icon: React.ReactNode; label: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      title={adminOnly ? 'Solo disponible para administradores' : undefined}
      className={[
        'flex min-h-[70px] items-center gap-3 rounded-xl px-4 py-3 text-left transition',
        active ? 'bg-slate-950 text-white shadow-sm' : disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
      ].join(' ')}
    >
      <span className={['grid h-9 w-9 shrink-0 place-items-center rounded-lg border', active ? 'border-white/10 bg-white/10' : 'border-slate-200 bg-white'].join(' ')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-extrabold">
          {label}
          {adminOnly && <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-slate-500"><LockKeyhole className="h-2.5 w-2.5" /> Admin</span>}
        </span>
        <span className={['mt-0.5 block text-[11px]', active ? 'text-white/65' : 'text-slate-400'].join(' ')}>{detail}</span>
      </span>
    </button>
  );
}

export default function CategoriasFreezeDetector({ sheetName = '' }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { me } = useMe();
  const isAdmin = me?.role?.toLowerCase() === 'admin';
  const [tab, setTab] = useState<TabId>('visualizacion');

  const snapshotEnabled = search.get('snapshot') === '1';
  const snapshotYear = Number(search.get('year'));
  const snapshotMonth = Number(search.get('month'));

  const detected = useMemo(() => {
    const branchKey = getBranchKeyFromPath(pathname);
    if (!branchKey) return { pathname, branchKey: null as any, url: null as string | null, reason: 'Ruta no mapeada' };
    const endpointBase = SHEETDB_ENDPOINTS[branchKey];
    if (!endpointBase?.trim()) return { pathname, branchKey, url: null, reason: 'Endpoint vacío' };
    return { pathname, branchKey, url: sheetName ? `${endpointBase}?sheet=${encodeURIComponent(sheetName)}` : endpointBase, reason: null as string | null };
  }, [pathname, sheetName]);

  const [liveData, setLiveData] = useState<any[] | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || !detected.url) return;
    const run = async () => {
      setLiveLoading(true);
      setLiveError(null);
      try {
        const response = await fetch(detected.url!, { cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? `SheetDB HTTP ${response.status}`);
        if (!Array.isArray(data)) throw new Error('SheetDB no devolvió un array');
        setLiveData(data);
      } catch (error: any) {
        setLiveError(error?.message ?? 'Error');
        setLiveData(null);
      } finally {
        setLiveLoading(false);
      }
    };
    run();
  }, [detected.url, isAdmin]);

  const initialPeriod = useMemo(() => defaultPrevMonth(), []);
  const [closeYear, setCloseYear] = useState(initialPeriod.y);
  const [closeMonth, setCloseMonth] = useState(initialPeriod.m);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);

  const fetchSnapshots = async () => {
    if (!detected.branchKey) return;
    setSnapLoading(true);
    setSnapError(null);
    try {
      const response = await fetch(`/api/categorias/snapshots?branch_key=${encodeURIComponent(detected.branchKey)}`, { cache: 'no-store' });
      const output = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(output?.error ?? `HTTP ${response.status}`);
      setSnapshots(Array.isArray(output?.snapshots) ? output.snapshots : []);
    } catch (error: any) {
      setSnapError(error?.message ?? 'Error');
      setSnapshots([]);
    } finally {
      setSnapLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detected.branchKey]);

  useEffect(() => {
    if (!isAdmin && tab === 'cerrar') setTab('visualizacion');
  }, [isAdmin, tab]);

  const goLive = () => {
    const params = new URLSearchParams(search.toString());
    params.delete('snapshot');
    params.delete('year');
    params.delete('month');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const goSnapshot = (year: number, month: number) => {
    const params = new URLSearchParams(search.toString());
    params.set('snapshot', '1');
    params.set('year', String(year));
    params.set('month', String(month));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const handleCloseMonth = async () => {
    if (!isAdmin || !detected.branchKey || !detected.url || !liveData) return;
    setSaving(true);
    setSaveMsg(null);
    setSaveErr(null);
    try {
      const response = await fetch('/api/categorias/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_key: detected.branchKey, branch: String(detected.branchKey), period_year: closeYear, period_month: closeMonth, payload: liveData, meta: { source_url: detected.url, pathname: detected.pathname } }),
      });
      const output = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(output?.error ?? `HTTP ${response.status}`);
      setSaveMsg(`Mes cerrado: ${pad2(closeMonth)}/${closeYear}`);
      await fetchSnapshots();
      goSnapshot(closeYear, closeMonth);
    } catch (error: any) {
      setSaveErr(error?.message ?? 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  const modeBadge = snapshotEnabled && snapshotYear && snapshotMonth ? `CERRADO ${pad2(snapshotMonth)}/${snapshotYear}` : 'ACTUAL';
  const canSeeSnapshot = snapshots.length > 0;

  return (
    <div className="mt-40 space-y-4">
      {detected.reason && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{detected.reason}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="grid gap-1 md:grid-cols-3" role="tablist" aria-label="Gestión de períodos de categorías">
          <Tab active={tab === 'visualizacion'} icon={<Eye className="h-4 w-4" />} label="Visualización" detail="Actual o período cerrado" onClick={() => setTab('visualizacion')} />
          <Tab active={tab === 'cerrados'} icon={<Archive className="h-4 w-4" />} label="Meses cerrados" detail={`${snapshots.length} snapshot${snapshots.length === 1 ? '' : 's'} disponible${snapshots.length === 1 ? '' : 's'}`} onClick={() => setTab('cerrados')} />
          <Tab active={tab === 'cerrar'} disabled={!isAdmin} adminOnly={!isAdmin} icon={isAdmin ? <CalendarClock className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />} label="Cerrar mes" detail={isAdmin ? 'Crear un nuevo snapshot' : 'Acceso restringido'} onClick={() => isAdmin && setTab('cerrar')} />
        </div>
      </div>

      {tab === 'visualizacion' && (
        <Card title="VISUALIZACIÓN" subtitle="Elegí qué versión de los datos querés consultar." badge={modeBadge}>
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={!snapshotEnabled} onClick={goLive}>Ver actual</Chip>
            <Chip active={snapshotEnabled} disabled={!canSeeSnapshot} onClick={() => {
              if (snapshotEnabled && snapshotYear && snapshotMonth) return;
              const latest = snapshots[0];
              if (latest) goSnapshot(latest.period_year, latest.period_month);
            }}>Ver último cerrado</Chip>
            {!canSeeSnapshot && <span className="text-xs text-slate-500">Todavía no hay meses cerrados.</span>}
            {snapshotEnabled && snapshotYear && snapshotMonth ? <span className="ml-auto rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Visualizando {pad2(snapshotMonth)}/{snapshotYear}</span> : null}
          </div>
        </Card>
      )}

      {tab === 'cerrados' && (
        <Card title="MESES CERRADOS" subtitle="Seleccioná un snapshot guardado para visualizarlo." badge={`${snapshots.length} TOTAL`} action={
          <button type="button" onClick={fetchSnapshots} disabled={snapLoading} className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">
            <RefreshCw className={['h-3.5 w-3.5', snapLoading ? 'animate-spin' : ''].join(' ')} /> Actualizar
          </button>
        }>
          {snapLoading && <div className="text-sm text-slate-600">Cargando períodos…</div>}
          {snapError && <div className="text-sm text-red-600">{snapError}</div>}
          {!snapLoading && !snapError && snapshots.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Todavía no hay meses cerrados.</div>}
          <div className="flex flex-wrap gap-2">
            {snapshots.map((item) => {
              const active = snapshotEnabled && item.period_year === snapshotYear && item.period_month === snapshotMonth;
              return <Chip key={item.id} active={active} onClick={() => goSnapshot(item.period_year, item.period_month)} title={`Cerrado: ${new Date(item.closed_at).toLocaleString()}`}>{pad2(item.period_month)}/{item.period_year}</Chip>;
            })}
          </div>
        </Card>
      )}

      {tab === 'cerrar' && isAdmin && (
        <Card title="CERRAR MES" subtitle="Creá un snapshot definitivo del período seleccionado." badge="ADMIN">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_1.1fr] lg:items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Año a cerrar</label>
              <input type="number" value={closeYear} onChange={(event) => setCloseYear(Number(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mes a cerrar</label>
              <select value={closeMonth} onChange={(event) => setCloseMonth(Number(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                {Array.from({ length: 12 }).map((_, index) => <option key={index + 1} value={index + 1}>{pad2(index + 1)}</option>)}
              </select>
            </div>
            <button type="button" onClick={handleCloseMonth} disabled={saving || liveLoading || !liveData || !!detected.reason} className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-extrabold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-45">
              <CalendarClock className="h-4 w-4" /> {saving ? 'Guardando…' : 'Cerrar período'}
            </button>
          </div>
          <div className="mt-3 min-h-5 text-xs text-slate-600">
            {liveLoading && 'Preparando datos actuales…'}
            {liveError && <span className="text-red-600">Error: {liveError}</span>}
            {saveErr && <span className="text-red-600">{saveErr}</span>}
            {saveMsg && <span className="font-semibold text-emerald-700">{saveMsg}</span>}
          </div>
        </Card>
      )}
    </div>
  );
}
