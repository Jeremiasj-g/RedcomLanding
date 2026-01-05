'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

function severityBadge(sev: string) {
  if (sev === 'critical') return 'bg-red-600 text-white';
  if (sev === 'warning') return 'bg-amber-600 text-white';
  return 'bg-sky-600 text-white';
}

function initials(nameOrEmail?: string) {
  const s = (nameOrEmail || '').trim();
  if (!s) return 'U';
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase()).join('');
}

export default function PanelFocoDrawer({
  foco,
  onClose,
}: {
  foco: any | null;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!foco?.id) return;

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('foco_completion_users')
          .select('*')
          .eq('foco_id', foco.id)
          .order('completed_at', { ascending: false });

        if (error) throw error;
        setUsers(data || []);
      } catch (e) {
        console.error('[FOCOS] load foco_completion_users error', e);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [foco?.id]);

  const rate = useMemo(() => Number(foco?.completion_rate || 0), [foco?.completion_rate]);
  const completed = useMemo(() => Number(foco?.completed_count || 0), [foco?.completed_count]);
  const targetUsers = useMemo(() => Number(foco?.target_users_count || 0), [foco?.target_users_count]);

  const targets = useMemo(() => {
    try {
      return Array.isArray(foco?.targets) ? foco.targets : [];
    } catch {
      return [];
    }
  }, [foco?.targets]);

  if (!foco) return null;

  return (
    <Drawer open={!!foco} onOpenChange={() => onClose()}>
      <DrawerContent className="p-0">
        <div className="mx-auto w-full max-w-3xl">
          <DrawerHeader className="px-6 pt-6">
            <div className="flex flex-col gap-2">
              <DrawerTitle className="text-xl">{foco.title}</DrawerTitle>

              <div className="flex flex-wrap items-center gap-2">
                <Badge className={severityBadge(foco.severity)}>{foco.severity}</Badge>
                <Badge variant="secondary">{foco.type}</Badge>
                {foco.is_active ? (
                  <Badge className="bg-emerald-600 text-white">Activo</Badge>
                ) : (
                  <Badge variant="secondary">Cerrado</Badge>
                )}
              </div>
            </div>
          </DrawerHeader>

          <div className="px-6 pb-6">
            <Separator className="my-4" />

            {/* Resumen */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border p-4">
                <p className="text-sm text-muted-foreground">Contenido</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                  {foco.content}
                </p>
              </div>

              <div className="rounded-2xl border p-4">
                <p className="text-sm text-muted-foreground">Cumplimiento</p>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{completed} / {targetUsers || 0}</span>
                    <span>{rate}%</span>
                  </div>
                  <Progress value={rate} />
                  <p className="text-xs text-muted-foreground">
                    Destinatarios estimados: usuarios asignados a las sucursales objetivo.
                  </p>
                </div>

                {targets.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">Sucursales destino</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {targets.map((t: any) => (
                        <Badge key={t.branch_id} variant="outline">
                          {t.branch_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <Separator className="my-4" />

            {/* Quién cumplió */}
            <div className="rounded-2xl border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Quién cumplió</p>
                  <p className="text-sm text-muted-foreground">
                    Registro de usuarios que marcaron “cumplido”.
                  </p>
                </div>
                <Badge variant="secondary">{users.length}</Badge>
              </div>

              <div className="mt-4">
                <ScrollArea className="h-[320px] pr-2">
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Cargando…</p>
                  ) : users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Todavía nadie marcó este foco como cumplido.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {users.map((u) => {
                        const display = u.full_name || u.email || 'Usuario';
                        return (
                          <div
                            key={`${u.foco_id}-${u.user_id}`}
                            className="flex items-center justify-between rounded-xl border px-3 py-2"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback>{initials(display)}</AvatarFallback>
                              </Avatar>

                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{display}</span>
                                <span className="text-xs text-muted-foreground">
                                  {u.branch_name ? `Sucursal: ${u.branch_name}` : 'Sucursal: —'}
                                </span>
                              </div>
                            </div>

                            <span className="text-xs text-muted-foreground">
                              {new Date(u.completed_at).toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
