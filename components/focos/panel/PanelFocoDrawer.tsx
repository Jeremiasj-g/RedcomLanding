'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

import { ChevronLeft, ChevronRight } from 'lucide-react';

function severityBadge(sev: string) {
  if (sev === 'critical') return 'bg-red-600 text-white';
  if (sev === 'warning') return 'bg-amber-600 text-white';
  return 'bg-sky-600 text-white';
}

function initials(nameOrEmail?: string) {
  const s = (nameOrEmail || '').trim();
  if (!s) return 'U';
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join('');
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function useStableCallback<T extends (...args: any[]) => any>(fn: T) {
  const ref = (globalThis as any).React?.useRef ? (globalThis as any).React.useRef(fn) : null;
  // fallback simple (igual funciona sin esto, pero mejor no)
  // como estamos en React real, usamos el hook normal:
  // @ts-ignore
  const r = (ref ?? null) as any;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const realRef = useState(() => ({ current: fn }))[0];
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    realRef.current = fn;
  }, [fn, realRef]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useMemo(() => ((...args: any[]) => realRef.current(...args)) as T, [realRef]);
}

/**
 * ✅ Carousel casero (Tailwind)
 * - Swipe touch / drag mouse
 * - Progress bar + dots
 * - ✅ Flechas solo desktop (sm+)
 * - ✅ Fondo blur con la misma imagen (solo desktop) para rellenar laterales
 */
function AssetCarousel({
  images,
  accent = '#7a1f2b',
}: {
  images: { url: string; label?: string | null }[];
  accent?: string;
}) {
  const count = images.length;
  const [index, setIndex] = useState(0);

  const trackRef = useState<{ current: HTMLDivElement | null }>({ current: null })[0];
  const [dragging, setDragging] = useState(false);
  const dragStartX = useState({ current: 0 })[0];
  const dragDeltaX = useState({ current: 0 })[0];
  const trackWidth = useState({ current: 1 })[0];

  useEffect(() => {
    setIndex((i) => clamp(i, 0, Math.max(0, count - 1)));
  }, [count]);

  const go = useStableCallback((next: number) => {
    setIndex(() => clamp(next, 0, count - 1));
  });

  const prev = useStableCallback(() => go(index - 1));
  const next = useStableCallback(() => go(index + 1));

  // teclado (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (count <= 1) return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, prev, next]);

  const beginDrag = (clientX: number) => {
    if (count <= 1) return;
    setDragging(true);
    dragStartX.current = clientX;
    dragDeltaX.current = 0;
    trackWidth.current = trackRef.current?.clientWidth || 1;
  };

  const moveDrag = (clientX: number) => {
    if (!dragging) return;
    dragDeltaX.current = clientX - dragStartX.current;

    const el = trackRef.current;
    if (!el) return;
    const base = -index * trackWidth.current;
    el.style.transition = 'none';
    el.style.transform = `translate3d(${base + dragDeltaX.current}px,0,0)`;
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);

    const threshold = Math.min(120, trackWidth.current * 0.18);
    const dx = dragDeltaX.current;

    if (dx > threshold) go(index - 1);
    else if (dx < -threshold) go(index + 1);
    else go(index);

    dragDeltaX.current = 0;
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const w = el.clientWidth || 1;
    trackWidth.current = w;

    el.style.transition = dragging ? 'none' : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.transform = `translate3d(${-index * w}px,0,0)`;
  }, [index, dragging, count, trackRef, trackWidth]);

  const canPrev = index > 0;
  const canNext = index < count - 1;

  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden rounded-2xl border bg-slate-50 select-none">
        {/* Track */}
        <div
          ref={(node) => {
            trackRef.current = node;
          }}
          className="flex w-full"
          onMouseDown={(e) => beginDrag(e.clientX)}
          onMouseMove={(e) => moveDrag(e.clientX)}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={(e) => beginDrag(e.touches[0].clientX)}
          onTouchMove={(e) => moveDrag(e.touches[0].clientX)}
          onTouchEnd={endDrag}
        >
          {images.map((img, i) => (
            <div key={`${img.url}_${i}`} className="w-full shrink-0">
              {/* ✅ Slide con blur background (solo sm+) */}
              <div className="relative w-full">
                <div className="pointer-events-none absolute inset-0 hidden sm:block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover blur-2xl scale-125 opacity-70"
                    loading="lazy"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-white/20" />
                </div>

                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.label ?? `Imagen ${i + 1}`}
                    className={[
                      'block w-full',
                      // ✅ alto generoso
                      'h-[360px] sm:h-[520px]',
                      // ✅ no recorta el flyer (mantiene todo)
                      'object-contain',
                      'mx-auto',
                      // ✅ en mobile evitamos fondo blanco “duro”
                      'bg-white',
                    ].join(' ')}
                    loading="lazy"
                    draggable={false}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        {count > 1 ? (
          <>
            {/* Flechas SOLO desktop (sm+) */}
            <button
              type="button"
              onClick={prev}
              disabled={!canPrev}
              aria-label="Anterior"
              className={[
                'hidden sm:flex',
                'absolute left-3 top-1/2 -translate-y-1/2',
                'h-10 w-10 rounded-full border bg-white/85 backdrop-blur',
                'shadow-sm transition items-center justify-center',
                canPrev ? 'hover:bg-white' : 'opacity-40 cursor-not-allowed',
              ].join(' ')}
              style={{ borderColor: 'rgba(122,31,43,0.22)' }}
            >
              <ChevronLeft className="h-5 w-5" style={{ color: accent }} />
            </button>

            <button
              type="button"
              onClick={next}
              disabled={!canNext}
              aria-label="Siguiente"
              className={[
                'hidden sm:flex',
                'absolute right-3 top-1/2 -translate-y-1/2',
                'h-10 w-10 rounded-full border bg-white/85 backdrop-blur',
                'shadow-sm transition items-center justify-center',
                canNext ? 'hover:bg-white' : 'opacity-40 cursor-not-allowed',
              ].join(' ')}
              style={{ borderColor: 'rgba(122,31,43,0.22)' }}
            >
              <ChevronRight className="h-5 w-5" style={{ color: accent }} />
            </button>

            {/* Progressbar */}
            <div className="absolute left-0 right-0 top-0">
              <div className="h-[6px] w-full bg-[#7a1f2b]/15">
                <div
                  className="h-full bg-[#7a1f2b] transition-[width] duration-300 ease-out"
                  style={{ width: `${((index + 1) / count) * 100}%` }}
                />
              </div>
            </div>

            {/* Dots */}
            <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Ir a imagen ${i + 1}`}
                  className={[
                    'h-1.5 rounded-full transition-all',
                    i === index ? 'w-6 bg-[#7a1f2b]' : 'w-2 bg-[#7a1f2b]/30 hover:bg-[#7a1f2b]/45',
                  ].join(' ')}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {images[index]?.label ? (
        <div className="mt-2 text-xs text-muted-foreground">{images[index]?.label}</div>
      ) : null}
    </div>
  );
}

export default function PanelFocoDrawer({
  foco,
  onClose,
}: {
  foco: any | null;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [assets, setAssets] = useState<{ id: number; url: string; label: string | null; kind: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);

  useEffect(() => {
    if (!foco?.id) return;

    // 1) users completions
    (async () => {
      setLoadingUsers(true);
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
        setLoadingUsers(false);
      }
    })();

    // 2) assets (imagenes)
    (async () => {
      setLoadingAssets(true);
      try {
        const { data, error } = await supabase
          .from('foco_assets')
          .select('id, kind, url, label, created_at')
          .eq('foco_id', foco.id)
          .order('created_at', { ascending: true });

        if (error) throw error;

        const imgs =
          (data || [])
            .filter((a: any) => (a.kind ?? 'image') === 'image' && !!a.url)
            .map((a: any) => ({
              id: a.id,
              kind: a.kind,
              url: a.url,
              label: a.label ?? null,
            })) ?? [];

        setAssets(imgs);
      } catch (e) {
        console.error('[FOCOS] load foco_assets error', e);
        setAssets([]);
      } finally {
        setLoadingAssets(false);
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

  const images = useMemo(
    () => assets.map((a) => ({ url: a.url, label: a.label })),
    [assets]
  );

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

            {/* ✅ IMÁGENES */}
            {loadingAssets ? (
              <div className="rounded-2xl border p-4 text-sm text-muted-foreground">Cargando imágenes…</div>
            ) : images.length > 0 ? (
              <div className="rounded-2xl border p-3">
                <AssetCarousel images={images} />
              </div>
            ) : null}

            {images.length > 0 ? <Separator className="my-4" /> : null}

            {/* Resumen */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border p-4">
                <p className="text-sm text-muted-foreground">Contenido</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{foco.content}</p>
              </div>

              <div className="rounded-2xl border p-4">
                <p className="text-sm text-muted-foreground">Cumplimiento</p>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {completed} / {targetUsers || 0}
                    </span>
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
                  <p className="text-sm text-muted-foreground">Registro de usuarios que marcaron “cumplido”.</p>
                </div>
                <Badge variant="secondary">{users.length}</Badge>
              </div>

              <div className="mt-4">
                <ScrollArea className="h-[320px] pr-2">
                  {loadingUsers ? (
                    <p className="text-sm text-muted-foreground">Cargando…</p>
                  ) : users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Todavía nadie marcó este foco como cumplido.</p>
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
