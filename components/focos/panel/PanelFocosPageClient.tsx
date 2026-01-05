'use client';

import * as React from 'react';

import { RequireAuth } from '@/components/RouteGuards';
import Container from '@/components/Container';

import PanelFocosStats from './PanelFocosStats';
import PanelFocosTable from './PanelFocosTable';

// NUEVO (si lo pusiste en components/focos)
import PanelFocosToolbar from '@/components/focos/PanelFocosToolbar';
import PanelFocoCreateDialog from '@/components/focos/panel/PanelFocoCreateDialog';
import PanelFocoDetailsSheet from '@/components/focos/PanelFocoDetailsSheet';

import {
  closeFoco,
  duplicateFoco,
  getFocoPanelList,
  reopenFoco,
  type PanelFocoRow,
  type FocoSeverity,
  type FocoType,
} from '@/components/focos/focos.panel.api';

import { Button } from '@/components/ui/button';

export default function PanelFocosPageClient() {
  // filtros panel
  const [q, setQ] = React.useState('');
  const [onlyActive, setOnlyActive] = React.useState(true);
  const [severity, setSeverity] = React.useState<FocoSeverity | 'all'>('all');
  const [type, setType] = React.useState<FocoType | 'all'>('all');

  // data
  const [rows, setRows] = React.useState<PanelFocoRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // ui
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<PanelFocoRow | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await getFocoPanelList({ onlyActive, q, severity, type });
      setRows(data);
    } catch (e: any) {
      console.error('[FOCOS] panel list error', e);
      setErr(e?.message ?? 'No se pudo cargar el panel.');
    } finally {
      setLoading(false);
    }
  }, [onlyActive, q, severity, type]);

  React.useEffect(() => {
    load();
  }, [load]);

  // métricas para el header de stats
  const stats = React.useMemo(() => {
    const total = rows.length;
    const activos = rows.filter((r) => r.is_active).length;
    const criticos = rows.filter((r) => r.severity === 'critical' && r.is_active).length;
    const cumplimientos = rows.reduce((acc, r) => acc + (r.completed_count ?? 0), 0);

    return { total, activos, criticos, cumplimientos };
  }, [rows]);

  function onView(row: PanelFocoRow) {
    setSelected(row);
    setDetailOpen(true);
  }

  async function onDuplicate(row: PanelFocoRow) {
    setBusyId(row.id);
    try {
      await duplicateFoco(row.id);
      await load();
      alert('Duplicado ✅');
    } catch (e: any) {
      console.error('[FOCOS] duplicate error', e);
      alert(e?.message ?? 'No se pudo duplicar.');
    } finally {
      setBusyId(null);
    }
  }

  async function onClose(row: PanelFocoRow) {
    if (!confirm('¿Cerrar este foco? (dejará de aparecer como activo)')) return;

    setBusyId(row.id);
    try {
      await closeFoco(row.id);
      await load();
    } catch (e: any) {
      console.error('[FOCOS] close error', e);
      alert(e?.message ?? 'No se pudo cerrar.');
    } finally {
      setBusyId(null);
    }
  }

  async function onReopen(row: PanelFocoRow) {
    setBusyId(row.id);
    try {
      await reopenFoco(row.id);
      await load();
    } catch (e: any) {
      console.error('[FOCOS] reopen error', e);
      alert(e?.message ?? 'No se pudo reabrir.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <RequireAuth roles={['admin', 'jdv', 'supervisor']}>
      <Container>
        {/* tu header se mantiene */}
        <div className="relative px-4 py-6 mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-900 shadow-sm">
            Panel de focos
          </div>

          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Gestión, seguimiento y cumplimiento de focos diarios y semanales.
          </h1>
          <p className="mt-1 text-sm text-slate-600">Publicá y gestioná focos/criticos.</p>
        </div>

        <div className="mt-6 space-y-6">
          {/* NUEVO: toolbar filtros */}
          <PanelFocosToolbar
            q={q}
            onQ={setQ}
            onlyActive={onlyActive}
            onOnlyActive={setOnlyActive}
            severity={severity}
            onSeverity={setSeverity}
            type={type}
            onType={setType}
          />

          {/* Stats con props */}
          <PanelFocosStats
            loading={loading}
            activos={stats.activos}
            criticos={stats.criticos}
            cumplimientos={stats.cumplimientos}
            total={stats.total}
          />

          {/* CTA + tabla */}
          <div className="flex justify-end">
            <Button onClick={() => setCreateOpen(true)}>Crear foco</Button>
          </div>

          <PanelFocosTable
            loading={loading}
            error={err}
            rows={rows}
            busyId={busyId}
            onView={onView}
            onDuplicate={onDuplicate}
            onClose={onClose}
            onReopen={onReopen}
          />
        </div>

        {/* Dialog crear */}
        <PanelFocoCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={load}
        />

        {/* Sheet detalle */}
        <PanelFocoDetailsSheet open={detailOpen} onOpenChange={setDetailOpen} foco={selected} />
      </Container>
    </RequireAuth>
  );
}
