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
import {
  getFocoCompletionsUsers,
  type CompletionUserRow,
  getFocoTargetUsers,
  type TargetUserRow,
} from '@/components/focos/focos.panel.api';

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

function sanitizeHtmlBasic(html: string) {
  if (!html) return '';
  let out = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/\son\w+="[^"]*"/gi, '');
  out = out.replace(/\son\w+='[^']*'/gi, '');
  // fuerza target blank
  out = out.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
  return out;
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

  const [targetsLoading, setTargetsLoading] = React.useState(false);
  const [targetsErr, setTargetsErr] = React.useState<string | null>(null);
  const [targetsUsers, setTargetsUsers] = React.useState<TargetUserRow[] | null>(null);

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

  React.useEffect(() => {
    if (!open || !foco?.id) return;

    setTargetsLoading(true);
    setTargetsErr(null);

    getFocoTargetUsers(foco.id)
      .then((data) => setTargetsUsers(data ?? []))
      .catch((e: any) => {
        console.warn('[FOCOS] target users not available', e);
        setTargetsUsers(null);
        setTargetsErr(e?.message ?? 'No se pudieron cargar los destinatarios.');
      })
      .finally(() => setTargetsLoading(false));
  }, [open, foco?.id]);

  const targets = foco?.targets ?? [];

  const rate = Math.max(0, Math.min(100, Number(foco?.completion_rate ?? 0)));
  const completedCount = Number(foco?.completed_count ?? 0);
  const targetUsersCount = Number(foco?.target_users_count ?? 0);

  const doneSet = React.useMemo(() => new Set(rows.map((r) => r.user_id)), [rows]);

  const pendingUsers = React.useMemo(() => {
    if (!targetsUsers) return null;
    return targetsUsers.filter((u) => !doneSet.has(u.user_id));
  }, [targetsUsers, doneSet]);

  const pendingCount = React.useMemo(() => {
    if (pendingUsers) return pendingUsers.length;
    return Math.max(0, targetUsersCount - rows.length);
  }, [pendingUsers, targetUsersCount, rows.length]);

  const contentHtml = React.useMemo(() => sanitizeHtmlBasic(String(foco?.content ?? '')), [foco?.content]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* ✅ Alto fijo + layout interno */}
      <SheetContent side="right" className="w-full sm:max-w-2xl h-dvh p-0">
        {/* Header fijo */}
        <SheetHeader className="px-6 py-5 border-b bg-white">
          <SheetTitle className="flex items-center justify-between gap-3">
            <span>Detalle del foco</span>
            {foco ? (
              <Badge variant={foco.is_active ? 'secondary' : 'outline'}>
                {foco.is_active ? 'Activo' : 'Cerrado'}
              </Badge>
            ) : null}
          </SheetTitle>
        </SheetHeader>

        {/* Body scrolleable */}
        <div className="px-6 py-5 overflow-y-auto h-[calc(100dvh-76px)]">
          {!foco ? (
            <div className="text-sm text-muted-foreground">Seleccioná un foco para ver el detalle.</div>
          ) : (
            <div className="space-y-5">
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
                    {completedCount}/{targetUsersCount} • {rate}%
                  </Badge>
                </div>

                <div className="text-lg font-semibold">{foco.title}</div>

                <div className="rounded-xl border bg-muted/20 p-3">
                  <div
                    className={[
                      'text-sm leading-relaxed text-foreground/90',
                      '[&>p]:my-2',
                      '[&>h1]:my-2 [&>h1]:text-base [&>h1]:font-semibold',
                      '[&>h2]:my-2 [&>h2]:text-base [&>h2]:font-semibold',
                      '[&>h3]:my-2 [&>h3]:text-sm [&>h3]:font-semibold',
                      '[&>ul]:my-2 [&>ul]:pl-6 [&>ul]:list-disc',
                      '[&>ol]:my-2 [&>ol]:pl-6 [&>ol]:list-decimal',
                      '[&>ul>li]:my-1',
                      '[&>ol>li]:my-1',
                      '[&_ul]:pl-6 [&_ul]:list-disc',
                      '[&_ol]:pl-6 [&_ol]:list-decimal',
                      '[& a]:text-sky-700 [& a]:underline',
                      '[& strong]:font-semibold',
                    ].join(' ')}
                    dangerouslySetInnerHTML={{ __html: contentHtml }}
                  />
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
                  <Progress value={rate} />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="secondary">Cumplieron: {rows.length}</Badge>
                  <Badge variant="secondary">Faltan: {pendingCount}</Badge>
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
                    <div className="text-xs text-muted-foreground">Registrado por usuario (como RRHH con ACK).</div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      console.log('[FOCOS] foco_completion_users', rows);
                      console.log('[FOCOS] foco_target_users', targetsUsers);
                      alert('Listo. Mirá la consola (rows / targetsUsers).');
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

                    <div className="max-h-[240px] overflow-auto">
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

              <Separator />

              {/* quién falta */}
              <div className="space-y-2">
                <div className="text-sm font-semibold">Quién falta cumplir</div>
                <div className="text-xs text-muted-foreground">
                  Usuarios destinatarios que todavía no marcaron “cumplido”.
                </div>

                {targetsLoading ? (
                  <div className="flex items-center gap-2 rounded-xl border bg-white p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando destinatarios…
                  </div>
                ) : targetsUsers === null ? (
                  <div className="rounded-xl border bg-white p-3 text-sm text-muted-foreground">
                    No hay lista de destinatarios (view/permiso). Conteo estimado: {pendingCount}.
                  </div>
                ) : pendingUsers && pendingUsers.length === 0 ? (
                  <div className="rounded-xl border bg-white p-3 text-sm text-muted-foreground">
                    Perfecto: no queda nadie pendiente ✅
                  </div>
                ) : pendingUsers ? (
                  <div className="rounded-xl border bg-white">
                    <div className="grid grid-cols-12 gap-2 border-b p-3 text-xs font-semibold text-muted-foreground">
                      <div className="col-span-6">Usuario</div>
                      <div className="col-span-4">Sucursal</div>
                      <div className="col-span-2 text-right">Estado</div>
                    </div>

                    <div className="max-h-[260px] overflow-auto">
                      {pendingUsers.map((u) => (
                        <div key={u.user_id} className="grid grid-cols-12 gap-2 p-3 text-sm">
                          <div className="col-span-6">
                            <div className="font-medium">{u.full_name ?? '—'}</div>
                            <div className="text-xs text-muted-foreground">{u.email ?? u.user_id}</div>
                          </div>
                          <div className="col-span-4">
                            <Badge variant="outline">{u.branch_name ?? '—'}</Badge>
                          </div>
                          <div className="col-span-2 text-right">
                            <Badge variant="secondary" className="text-[10px]">
                              Pendiente
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : targetsErr ? (
                  <div className="rounded-xl border bg-white p-3 text-sm">
                    <div className="font-semibold">No se pudieron cargar destinatarios.</div>
                    <div className="text-xs text-muted-foreground">{targetsErr}</div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
