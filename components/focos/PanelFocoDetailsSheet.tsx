'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExternalLink, Loader2 } from 'lucide-react';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

import type { PanelFocoRow } from '@/components/focos/focos.panel.api';
import { getFocoCompletionsUsers, type CompletionUserRow } from '@/components/focos/focos.panel.api';

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    return format(new Date(iso), "dd/MM/yyyy '•' HH:mm", { locale: es });
  } catch {
    return iso;
  }
}

function typeLabel(t: string) {
  const map: Record<string, string> = {
    foco: 'Foco',
    critico: 'Crítico',
    promo: 'Promo',
    capacitacion: 'Capacitación',
  };
  return map[t] ?? t;
}

export default function PanelFocoDetailsSheet({
  open,
  onOpenChange,
  foco,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  foco: PanelFocoRow | null;
}) {
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<CompletionUserRow[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !foco?.id) return;

    setLoading(true);
    setErr(null);

    getFocoCompletionsUsers(foco.id)
      .then(setRows)
      .catch((e: any) => {
        console.error('[FOCOS] completions users error', e);
        setErr(e?.message ?? 'No se pudo cargar quién cumplió.');
      })
      .finally(() => setLoading(false));
  }, [open, foco?.id]);

  const targets = foco?.targets ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-3">
            <span>Detalle del foco</span>
            {foco ? (
              <Badge variant={foco.is_active ? 'secondary' : 'outline'}>
                {foco.is_active ? 'Activo' : 'Cerrado'}
              </Badge>
            ) : null}
          </SheetTitle>
        </SheetHeader>

        {!foco ? (
          <div className="mt-6 text-sm text-muted-foreground">Seleccioná un foco para ver el detalle.</div>
        ) : (
          <div className="mt-6 space-y-5">
            {/* encabezado */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{typeLabel(foco.type)}</Badge>
                <Badge
                  className={
                    foco.severity === 'critical'
                      ? 'bg-red-600 text-white'
                      : foco.severity === 'warning'
                      ? 'bg-amber-600 text-white'
                      : 'bg-sky-600 text-white'
                  }
                >
                  {foco.severity}
                </Badge>

                <Badge variant="outline">
                  {foco.completed_count}/{foco.target_users_count} • {foco.completion_rate}%
                </Badge>
              </div>

              <div className="text-lg font-semibold">{foco.title}</div>
              <div className="whitespace-pre-wrap rounded-xl border bg-muted/20 p-3 text-sm leading-relaxed">
                {foco.content}
              </div>

              <div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground/70">Creado:</span> {fmtDate(foco.created_at)}
                </div>
                <div>
                  <span className="font-semibold text-foreground/70">Últ. update:</span> {fmtDate(foco.updated_at)}
                </div>
                <div>
                  <span className="font-semibold text-foreground/70">Inicio:</span> {fmtDate(foco.start_at)}
                </div>
                <div>
                  <span className="font-semibold text-foreground/70">Fin:</span> {fmtDate(foco.end_at)}
                </div>
              </div>

              <div className="pt-1">
                <Progress value={Math.max(0, Math.min(100, Number(foco.completion_rate ?? 0)))} />
              </div>
            </div>

            <Separator />

            {/* targets */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">Sucursales destino</div>
              <div className="flex flex-wrap gap-2">
                {targets.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Sin targets</span>
                ) : (
                  targets.map((t) => (
                    <Badge key={t.branch_id} variant="secondary">
                      {t.branch_name}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <Separator />

            {/* quién cumplió */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">Quién cumplió</div>
                  <div className="text-xs text-muted-foreground">
                    Registrado por usuario (como RRHH con ACK).
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // simple: abrir consola con los datos
                    console.log('[FOCOS] foco_completion_users', rows);
                    alert('Listo. Mirá la consola (rows).');
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Debug
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center gap-2 rounded-xl border bg-white p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando…
                </div>
              ) : err ? (
                <div className="rounded-xl border bg-white p-3 text-sm">
                  <div className="font-semibold">No se pudo cargar.</div>
                  <div className="text-xs text-muted-foreground">{err}</div>
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-xl border bg-white p-3 text-sm text-muted-foreground">
                  Nadie marcó “cumplido” todavía.
                </div>
              ) : (
                <div className="rounded-xl border bg-white">
                  <div className="grid grid-cols-12 gap-2 border-b p-3 text-xs font-semibold text-muted-foreground">
                    <div className="col-span-5">Usuario</div>
                    <div className="col-span-3">Sucursal</div>
                    <div className="col-span-4 text-right">Fecha</div>
                  </div>

                  <div className="max-h-[340px] overflow-auto">
                    {rows.map((r) => (
                      <div key={`${r.user_id}-${r.completed_at}`} className="grid grid-cols-12 gap-2 p-3 text-sm">
                        <div className="col-span-5">
                          <div className="font-medium">{r.full_name ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">{r.email ?? r.user_id}</div>
                        </div>
                        <div className="col-span-3">
                          <Badge variant="outline">{r.branch_name ?? '—'}</Badge>
                        </div>
                        <div className="col-span-4 text-right text-xs text-muted-foreground">
                          {fmtDate(r.completed_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
