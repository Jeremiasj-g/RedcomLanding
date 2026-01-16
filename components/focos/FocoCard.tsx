'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Loader2, ShieldAlert, Info, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FocoRow } from './focos.types';

function sevIcon(sev: string) {
  if (sev === 'critical') return <ShieldAlert className="h-4 w-4" />;
  if (sev === 'warning') return <AlertTriangle className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

function sevBadgeClass(sev: string) {
  if (sev === 'critical') return 'bg-red-600 text-white';
  if (sev === 'warning') return 'bg-amber-600 text-white';
  return 'bg-sky-600 text-white';
}

function sanitizeHtmlBasic(html: string) {
  if (!html) return '';
  let out = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/\son\w+="[^"]*"/gi, '');
  out = out.replace(/\son\w+='[^']*'/gi, '');
  out = out.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
  return out;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function useStableCallback<T extends (...args: any[]) => any>(fn: T) {
  const ref = React.useRef(fn);
  React.useEffect(() => {
    ref.current = fn;
  }, [fn]);
  return React.useCallback((...args: Parameters<T>) => ref.current(...args), []);
}

function AssetCarousel({
  images,
  accent = '#7a1f2b',
}: {
  images: { url: string; label?: string | null }[];
  accent?: string;
}) {
  const count = images.length;
  const [index, setIndex] = React.useState(0);

  // drag state
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const dragStartX = React.useRef(0);
  const dragDeltaX = React.useRef(0);
  const trackWidth = React.useRef(1);

  // keep index valid if images change
  React.useEffect(() => {
    setIndex((i) => clamp(i, 0, Math.max(0, count - 1)));
  }, [count]);

  const go = useStableCallback((next: number) => {
    setIndex((prev) => clamp(next, 0, count - 1));
  });

  const prev = useStableCallback(() => go(index - 1));
  const next = useStableCallback(() => go(index + 1));

  React.useEffect(() => {
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

    // translate while dragging (no state re-render heavy)
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

    // decide slide
    if (dx > threshold) go(index - 1);
    else if (dx < -threshold) go(index + 1);
    else go(index);

    dragDeltaX.current = 0;
  };

  // apply transform on index change
  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    trackWidth.current = w;
    el.style.transition = dragging ? 'none' : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.transform = `translate3d(${-index * w}px,0,0)`;
  }, [index, dragging, count]);

  const canPrev = index > 0;
  const canNext = index < count - 1;

  return (
    <div className="w-full">
      <div
        className={[
          'relative w-full overflow-hidden rounded-2xl border bg-slate-50',
          'select-none',
        ].join(' ')}
      >
        {/* Track */}
        <div
          ref={trackRef}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.label ?? `Imagen ${i + 1}`}
                className={[
                  'block w-full h-auto object-contain',
                  'max-h-[260px] sm:max-h-[360px] md:max-h-[440px]',
                  'mx-auto',
                ].join(' ')}
                loading="lazy"
                draggable={false}
              />
            </div>
          ))}
        </div>

        {/* Controls */}
        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              disabled={!canPrev}
              aria-label="Anterior"
              className={[
                'absolute left-3 top-1/2 -translate-y-1/2',
                'h-10 w-10 rounded-full border bg-white/85 backdrop-blur',
                'shadow-sm transition',
                'flex items-center justify-center',
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
                'absolute right-3 top-1/2 -translate-y-1/2',
                'h-10 w-10 rounded-full border bg-white/85 backdrop-blur',
                'shadow-sm transition',
                'flex items-center justify-center',
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

            {/* Dots (sutil) */}
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

export default function FocoCard({
  foco,
  completed,
  onToggleCompleted,
  busy,
  showCheck,
}: {
  foco: FocoRow;
  completed: boolean;
  busy: boolean;
  showCheck: boolean;
  onToggleCompleted: () => void;
}) {
  const html = sanitizeHtmlBasic(foco.content ?? '');
  const canShowCompletedButton = foco.type === 'foco' || foco.type === 'critico';

  const images = React.useMemo(() => {
    return (foco.assets ?? [])
      .filter((a) => (a.kind ?? 'image') === 'image' && !!a.url)
      .map((a) => ({ url: a.url, label: a.label }));
  }, [foco.assets]);

  return (
    <Card
      className={[
        'w-full rounded-2xl border p-6 transition',
        showCheck && completed ? 'border-emerald-200 bg-emerald-50' : 'bg-white',
      ].join(' ')}
    >
      <div className="flex w-full flex-col items-start justify-between gap-8">
        <div className="min-w-0 w-full">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={sevBadgeClass(foco.severity)}>
              <span className="mr-1 inline-flex items-center gap-1">
                {sevIcon(foco.severity)}
                {foco.severity}
              </span>
            </Badge>

            <Badge variant="secondary">{foco.type}</Badge>

            {foco.is_active ? (
              <Badge className="bg-emerald-600 text-white">Activo</Badge>
            ) : (
              <Badge variant="secondary">Cerrado</Badge>
            )}
          </div>

          <h3 className="mt-4 truncate text-base font-semibold">{foco.title}</h3>

          {Array.isArray(foco.targets) && foco.targets.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {foco.targets.slice(0, 6).map((t) => (
                <Badge key={t.branch_id} variant="outline">
                  {t.branch_name}
                </Badge>
              ))}
              {foco.targets.length > 6 ? (
                <Badge variant="secondary">+{foco.targets.length - 6}</Badge>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ✅ Swiper casero */}
        {images.length > 0 ? <AssetCarousel images={images} /> : null}

        {/* ✅ contenido HTML */}
        <div
          className={[
            'w-full text-sm leading-relaxed text-foreground/90',
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
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {showCheck && canShowCompletedButton ? (
          <Button
            variant={completed ? 'secondary' : 'default'}
            onClick={onToggleCompleted}
            disabled={busy || !foco.is_active}
            className={['shrink-0', !completed ? 'bg-[#7a1f2b] hover:bg-[#6a1b26] text-white' : ''].join(' ')}
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando…
              </span>
            ) : completed ? (
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Cumplido
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Marcar cumplido
              </span>
            )}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
