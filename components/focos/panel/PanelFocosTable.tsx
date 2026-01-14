'use client';

import * as React from 'react';
import {
  Copy,
  Eye,
  Lock,
  Trash2,
  Unlock,
  Loader2,
  ChevronDown,
  Pencil,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';

import type { PanelFocoRow } from '@/components/focos/focos.panel.api';

/* -------------------------------- utils -------------------------------- */

function severityBadgeClass(sev: string) {
  if (sev === 'critical') return 'bg-red-600 text-white';
  if (sev === 'warning') return 'bg-amber-600 text-white';
  return 'bg-sky-600 text-white';
}

function typeBadgeClass(t: string) {
  if (t === 'critico') return 'bg-red-50 text-red-700 border border-red-200';
  if (t === 'promo') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (t === 'capacitacion') return 'bg-violet-50 text-violet-700 border border-violet-200';
  return 'bg-slate-50 text-slate-700 border border-slate-200';
}

function ClosedBadge() {
  return (
    <Badge variant="secondary" className="bg-slate-100 text-slate-700 border border-slate-200">
      CERRADO
    </Badge>
  );
}

/* ------------------------------ headers ------------------------------ */

function SectionHeader({
  title,
  subtitle,
  count,
  collapsible,
  open,
  onToggle,
}: {
  title: string;
  subtitle?: string;
  count: number;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={collapsible ? onToggle : undefined}
      className={[
        'w-full text-left rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3',
        'flex items-center justify-between gap-3',
        collapsible ? 'hover:bg-slate-100 transition' : '',
      ].join(' ')}
    >
      <div>
        <div className="font-extrabold text-slate-900">{title}</div>
        {subtitle && <div className="text-xs text-slate-600 mt-0.5">{subtitle}</div>}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-white">
          {count}
        </Badge>

        {collapsible && (
          <ChevronDown
            className={[
              'h-4 w-4 text-slate-500 transition-transform',
              open ? 'rotate-180' : '',
            ].join(' ')}
          />
        )}
      </div>
    </button>
  );
}

/* ------------------------------ row ------------------------------ */

function FocoRow({
  r,
  busyId,
  selectedIds,
  toggleOne,
  onView,
  onEdit,
  onDuplicate,
  onClose,
  onReopen,
  onDeleteOne,
}: {
  r: PanelFocoRow;
  busyId: string | null;
  selectedIds: Set<string>;
  toggleOne: (id: string, checked: boolean) => void;

  onView: (row: PanelFocoRow) => void;
  onEdit: (row: PanelFocoRow) => void;
  onDuplicate: (row: PanelFocoRow) => void;
  onClose: (row: PanelFocoRow) => void;
  onReopen: (row: PanelFocoRow) => void;
  onDeleteOne: (row: PanelFocoRow) => void;
}) {
  const locked = !r.is_active;
  const pct = Number(r.completion_rate ?? 0);
  const isRowSelected = selectedIds.has(r.id);
  const disabled = busyId === r.id;

  return (
    <div className="grid grid-cols-12 py-4 items-center">
      {/* checkbox */}
      <div className="col-span-1">
        <Checkbox
          checked={isRowSelected}
          onCheckedChange={(v) => toggleOne(r.id, !!v)}
          aria-label="Seleccionar foco"
        />
      </div>

      {/* título */}
      <div className="col-span-3">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-slate-900 line-clamp-1">{r.title}</div>
          {!r.is_active && <ClosedBadge />}
        </div>
        <div className="text-xs text-slate-500">
          {r.target_branches_count} suc. • {new Date(r.created_at).toLocaleDateString()}
        </div>
      </div>

      {/* tipo */}
      <div className="col-span-1">
        <Badge variant="outline" className={typeBadgeClass(r.type)}>
          {r.type}
        </Badge>
      </div>

      {/* severidad */}
      <div className="col-span-1">
        <Badge className={severityBadgeClass(r.severity)}>{r.severity}</Badge>
      </div>

      {/* progreso */}
      <div className="col-span-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>
            {r.completed_count} / {r.target_users_count}
          </span>
          <span>{pct}%</span>
        </div>
        <Progress value={Math.max(0, Math.min(100, pct))} />
      </div>

      {/* acciones */}
      <div className="col-span-3 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => onView(r)} disabled={disabled}>
          <Eye className="h-4 w-4" />
        </Button>

        <Button size="sm" variant="outline" onClick={() => onEdit(r)} disabled={disabled}>
          <Pencil className="h-4 w-4" />
        </Button>

        <Button size="sm" variant="outline" onClick={() => onDuplicate(r)} disabled={disabled}>
          <Copy className="h-4 w-4" />
        </Button>

        {locked ? (
          <Button size="sm" variant="outline" onClick={() => onReopen(r)} disabled={disabled}>
            <Unlock className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => onClose(r)} disabled={disabled}>
            <Lock className="h-4 w-4" />
          </Button>
        )}

        <Button
          size="sm"
          variant="destructive"
          onClick={() => onDeleteOne(r)}
          disabled={disabled}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ table ------------------------------ */

export default function PanelFocosTable({
  loading,
  error,
  rows,
  busyId,
  selectedIds,
  onChangeSelectedIds,
  onDeleteSelected,
  onDeleteAll,
  onView,
  onEdit,
  onDuplicate,
  onClose,
  onReopen,
  onDeleteOne,
  onlyActive,
}: {
  loading?: boolean;
  error?: string | null;
  rows?: PanelFocoRow[];
  busyId: string | null;

  selectedIds: Set<string>;
  onChangeSelectedIds: (next: Set<string>) => void;
  onDeleteSelected: () => void;
  onDeleteAll: () => void;

  onView: (row: PanelFocoRow) => void;
  onEdit: (row: PanelFocoRow) => void;
  onDuplicate: (row: PanelFocoRow) => void;
  onClose: (row: PanelFocoRow) => void;
  onReopen: (row: PanelFocoRow) => void;
  onDeleteOne: (row: PanelFocoRow) => void;

  onlyActive: boolean;
}) {
  const safeRows = Array.isArray(rows) ? rows : [];

  const activos = React.useMemo(() => safeRows.filter((r) => r.is_active), [safeRows]);
  const cerrados = React.useMemo(() => safeRows.filter((r) => !r.is_active), [safeRows]);

  const [historyOpen, setHistoryOpen] = React.useState(true);

  const visibleRows = React.useMemo(
    () => (onlyActive ? activos : safeRows),
    [onlyActive, activos, safeRows]
  );
  const visibleIds = React.useMemo(() => visibleRows.map((r) => r.id), [visibleRows]);

  const selectedCount = selectedIds.size;
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someChecked = selectedCount > 0 && !allChecked;

  function toggleAll(checked: boolean) {
    onChangeSelectedIds(checked ? new Set(visibleIds) : new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    const next = new Set(selectedIds);
    checked ? next.add(id) : next.delete(id);
    onChangeSelectedIds(next);
  }

  /* ------------------------------ render ------------------------------ */

  return (
    <div className="rounded-3xl border bg-white overflow-hidden">
      <div className="p-4 sm:p-5 border-b bg-slate-50 flex justify-between">
        <div>
          <div className="font-extrabold text-slate-900">Focos publicados</div>
          <div className="text-sm text-slate-600">
            Activos + histórico, con seguimiento de cumplimiento.
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDeleteSelected}
              disabled={busyId === 'bulk'}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar seleccionados ({selectedCount})
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onDeleteAll}
            disabled={busyId === 'all' || safeRows.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar todos
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {error ? (
          <div className="rounded-2xl border bg-white p-4 text-sm">{error}</div>
        ) : loading ? (
          <div className="flex items-center gap-2 rounded-2xl border bg-white p-4 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : safeRows.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
            No hay focos para mostrar.
          </div>
        ) : (
          <>
            {/* header */}
            <div className="grid grid-cols-12 gap-3 border-b pb-3 text-xs font-semibold text-slate-500">
              <div className="col-span-1">
                <Checkbox
                  checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                  onCheckedChange={(v) => toggleAll(!!v)}
                />
              </div>
              <div className="col-span-3">Título</div>
              <div className="col-span-1">Tipo</div>
              <div className="col-span-1">Severidad</div>
              <div className="col-span-3">Cumplimiento</div>
              <div className="col-span-3 text-right">Acciones</div>
            </div>

            {/* activos */}
            <div className="mt-4">
              <SectionHeader
                title="Activos"
                subtitle="Focos actualmente visibles"
                count={activos.length}
              />

              <div className="divide-y">
                {activos.map((r) => (
                  <FocoRow
                    key={r.id}
                    r={r}
                    busyId={busyId}
                    selectedIds={selectedIds}
                    toggleOne={toggleOne}
                    onView={onView}
                    onEdit={onEdit}
                    onDuplicate={onDuplicate}
                    onClose={onClose}
                    onReopen={onReopen}
                    onDeleteOne={onDeleteOne}
                  />
                ))}
              </div>
            </div>

            {/* cerrados */}
            {!onlyActive && (
              <div className="mt-6">
                <SectionHeader
                  title="Histórico (Cerrados)"
                  subtitle="Focos ya cerrados"
                  count={cerrados.length}
                  collapsible
                  open={historyOpen}
                  onToggle={() => setHistoryOpen((v) => !v)}
                />

                {historyOpen && (
                  <div className="divide-y">
                    {cerrados.map((r) => (
                      <FocoRow
                        key={r.id}
                        r={r}
                        busyId={busyId}
                        selectedIds={selectedIds}
                        toggleOne={toggleOne}
                        onView={onView}
                        onEdit={onEdit}
                        onDuplicate={onDuplicate}
                        onClose={onClose}
                        onReopen={onReopen}
                        onDeleteOne={onDeleteOne}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
