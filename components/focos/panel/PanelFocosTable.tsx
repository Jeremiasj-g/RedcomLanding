'use client';

import * as React from 'react';
import { Copy, Eye, Lock, Unlock, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import type { PanelFocoRow } from '@/components/focos/focos.panel.api';

function severityBadgeClass(sev: string) {
  if (sev === 'critical') return 'bg-red-600 text-white';
  if (sev === 'warning') return 'bg-amber-600 text-white';
  return 'bg-sky-600 text-white';
}

export default function PanelFocosTable({
  loading,
  error,
  rows,
  busyId,
  onView,
  onDuplicate,
  onClose,
  onReopen,
}: {
  loading?: boolean;
  error?: string | null;
  rows: PanelFocoRow[];
  busyId: string | null;

  onView: (row: PanelFocoRow) => void;
  onDuplicate: (row: PanelFocoRow) => void;
  onClose: (row: PanelFocoRow) => void;
  onReopen: (row: PanelFocoRow) => void;
}) {
  return (
    <div className="rounded-3xl border bg-white overflow-hidden">
      <div className="p-4 sm:p-5 border-b bg-slate-50">
        <div className="font-extrabold text-slate-900">Focos publicados</div>
        <div className="text-sm text-slate-600">Controlá cumplimiento y quién marcó cada foco.</div>
      </div>

      <div className="p-4 sm:p-5">
        {error ? (
          <div className="rounded-2xl border bg-white p-4">
            <p className="font-medium">No se pudieron cargar los focos.</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 rounded-2xl border bg-white p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">
            No hay focos para mostrar con estos filtros.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-3 border-b pb-3 text-xs font-semibold text-slate-500">
              <div className="col-span-4">Título</div>
              <div className="col-span-2">Severidad</div>
              <div className="col-span-4">Cumplimiento</div>
              <div className="col-span-2 text-right">Acciones</div>
            </div>

            <div className="divide-y">
              {rows.map((r) => {
                const locked = !r.is_active;
                const pct = Number(r.completion_rate ?? 0);

                return (
                  <div key={r.id} className="grid grid-cols-12 gap-3 py-4 items-center">
                    <div className="col-span-4">
                      <div className="font-semibold text-slate-900">{r.title}</div>
                      <div className="text-xs text-slate-500">
                        {r.type} • {r.target_branches_count} suc.
                      </div>
                    </div>

                    <div className="col-span-2">
                      <Badge className={severityBadgeClass(r.severity)}>{r.severity}</Badge>
                    </div>

                    <div className="col-span-4 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>
                          {r.completed_count} / {r.target_users_count}
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={Math.max(0, Math.min(100, pct))} />
                    </div>

                    <div className="col-span-2 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onView(r)}
                        disabled={busyId === r.id}
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDuplicate(r)}
                        disabled={busyId === r.id}
                        title="Duplicar"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>

                      {locked ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onReopen(r)}
                          disabled={busyId === r.id}
                          title="Reabrir"
                        >
                          <Unlock className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onClose(r)}
                          disabled={busyId === r.id}
                          title="Cerrar"
                        >
                          <Lock className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
