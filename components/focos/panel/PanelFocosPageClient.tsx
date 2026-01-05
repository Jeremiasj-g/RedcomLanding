'use client';

import * as React from 'react';

import { useMe } from '@/hooks/useMe';
import { RequireAuth } from '@/components/RouteGuards';
import Container from '@/components/Container';

import PanelFocosStats from './PanelFocosStats';
import PanelFocosTable from './PanelFocosTable';

import PanelFocosToolbar from '@/components/focos/PanelFocosToolbar';
import PanelFocoUpsertDialog, {
  type FocoUpsertInitial,
} from '@/components/focos/panel/PanelFocoCreateDialog';
import PanelFocoDetailsSheet from '@/components/focos/PanelFocoDetailsSheet';

import {
  closeFoco,
  duplicateFoco,
  getFocoPanelList,
  reopenFoco,
  deleteFoco,
  deleteFocos,
  deleteAllFocos,
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
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<PanelFocoRow | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // create/edit dialog
  const [upsertOpen, setUpsertOpen] = React.useState(false);
  const [upsertMode, setUpsertMode] = React.useState<'create' | 'edit'>('create');
  const [upsertInitial, setUpsertInitial] = React.useState<FocoUpsertInitial | null>(null);

  // selección masiva
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const { me } = useMe();
  const isAdmin = me?.role === 'admin';

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

  // al cambiar filtros, reset selección
  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [q, onlyActive, severity, type]);

  // stats
  const stats = React.useMemo(() => {
    const total = rows.length;
    const activos = rows.filter((r) => r.is_active).length;
    const criticos = rows.filter((r) => r.severity === 'critical' && r.is_active).length;
    const cumplimientos = rows.reduce((acc, r) => acc + (r.completed_count ?? 0), 0);
    return { total, activos, criticos, cumplimientos };
  }, [rows]);

  function onView(row: PanelFocoRow) {
    setSelectedRow(row);
    setDetailOpen(true);
  }

  function onCreate() {
    setUpsertMode('create');
    setUpsertInitial(null);
    setUpsertOpen(true);
  }

  function onEdit(row: PanelFocoRow) {
    setUpsertMode('edit');
    setUpsertInitial({
      focoId: row.id,
      title: row.title,
      content: row.content,
      severity: row.severity as any,
      type: row.type as any,
      targetBranchIds: row.targets?.map((t) => t.branch_id) ?? [],
    });
    setUpsertOpen(true);
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

  async function onDeleteOne(row: PanelFocoRow) {
    if (!isAdmin) return;

    if (!confirm(`¿Eliminar el foco "${row.title}"? Esta acción no se puede deshacer.`)) return;

    setBusyId(row.id);
    try {
      await deleteFoco(row.id);
      await load();
    } catch (e: any) {
      console.error('[FOCOS] delete one error', e);
      alert(e?.message ?? 'No se pudo eliminar.');
    } finally {
      setBusyId(null);
    }
  }

  async function onDeleteSelected() {
    if (!isAdmin) return;

    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    if (!confirm(`¿Eliminar ${ids.length} focos seleccionados? Esta acción no se puede deshacer.`)) return;

    setBusyId('bulk');
    try {
      await deleteFocos(ids);
      setSelectedIds(new Set());
      await load();
    } catch (e: any) {
      console.error('[FOCOS] delete selected error', e);
      alert(e?.message ?? 'No se pudieron eliminar.');
    } finally {
      setBusyId(null);
    }
  }

  async function onDeleteAll() {
    if (!isAdmin) return;

    const ok = prompt('Escribí ELIMINAR para confirmar que querés borrar TODOS los focos:');
    if (ok !== 'ELIMINAR') return;

    setBusyId('all');
    try {
      await deleteAllFocos();
      setSelectedIds(new Set());
      await load();
    } catch (e: any) {
      console.error('[FOCOS] delete all error', e);
      alert(e?.message ?? 'No se pudieron eliminar todos.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <RequireAuth roles={['admin', 'jdv', 'supervisor']}>
      <Container>
        {/* Header */}
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
          {/* Filtros */}
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

          {/* Stats */}
          <PanelFocosStats
            loading={loading}
            activos={stats.activos}
            criticos={stats.criticos}
            cumplimientos={stats.cumplimientos}
            total={stats.total}
          />

          {/* CTA */}
          <div className="flex justify-end">
            <Button onClick={onCreate}>Crear foco</Button>
          </div>

          {/* Tabla */}
          <PanelFocosTable
            loading={loading}
            error={err}
            rows={rows}
            busyId={busyId}
            onlyActive={onlyActive}
            isAdmin={isAdmin}
            selectedIds={selectedIds}
            onChangeSelectedIds={setSelectedIds}
            onDeleteSelected={onDeleteSelected}
            onDeleteAll={onDeleteAll}
            onView={onView}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onClose={onClose}
            onReopen={onReopen}
            onDeleteOne={onDeleteOne}
          />
        </div>

        {/* Dialog Create/Edit */}
        <PanelFocoUpsertDialog
          open={upsertOpen}
          onOpenChange={setUpsertOpen}
          onSaved={load}
          mode={upsertMode}
          initial={upsertMode === 'edit' ? upsertInitial : null}
        />

        {/* Detalle */}
        <PanelFocoDetailsSheet open={detailOpen} onOpenChange={setDetailOpen} foco={selectedRow} />
      </Container>
    </RequireAuth>
  );
}
