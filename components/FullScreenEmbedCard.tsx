'use client';

import { useState, useEffect, useCallback, useMemo, useRef, ReactNode, ElementType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconMapPoint } from '@/components/Icons/IconMapPoint';

type FullScreenEmbedCardProps = {
  title: string;
  description?: string;
  embedUrl: string;
  icon?: ReactNode | ElementType;
  buttonLabel?: string;
  preload?: boolean;
  className?: string;
  gradientFrom?: string;
  gradientVia?: string;
  gradientTo?: string;
  accentColor?: string;
};

/* ---------------- Loader claro con mensaje tardío ---------------- */
function EmbedLoader({ title, accentColor }: { title: string; accentColor: string }) {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(true), 10_000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="absolute inset-0 z-[1001] flex items-center justify-center">
      <div className="absolute inset-0 bg-white/75 backdrop-blur-md" />

      <div className="relative mx-4 w-[min(520px,92vw)] rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div
            className="mt-0.5 grid h-10 w-10 place-items-center rounded-2xl ring-1 ring-slate-200"
            style={{ color: accentColor }}
          >
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-current" aria-hidden />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900">Cargando {title}</div>
            <div className="mt-1 text-xs text-slate-600">Estamos trayendo el contenido…</div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full w-1/3 animate-[embedload_1.1s_ease-in-out_infinite] rounded-full"
                style={{ backgroundColor: `${accentColor}` }}
              />
            </div>

            <AnimatePresence>
              {showHint && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="mt-3 text-xs text-slate-500"
                >
                  El contenido es extenso y puede demorar un poco más en cargarse.
                </motion.div>
              )}
            </AnimatePresence>

            <style jsx>{`
              @keyframes embedload {
                0% { transform: translateX(-120%); width: 30%; }
                50% { transform: translateX(60%); width: 55%; }
                100% { transform: translateX(220%); width: 30%; }
              }
            `}</style>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- preconnect/dns-prefetch dinámico ---------------- */
function usePreconnect(url: string, enabled: boolean) {
  const origin = useMemo(() => {
    try {
      return new URL(url).origin;
    } catch {
      return '';
    }
  }, [url]);

  useEffect(() => {
    if (!enabled || !origin) return;

    const head = document.head;

    const mk = (rel: string) => {
      const l = document.createElement('link');
      l.rel = rel;
      l.href = origin;
      return l;
    };

    const dns = mk('dns-prefetch');
    const pre = mk('preconnect');
    pre.crossOrigin = 'anonymous';

    head.appendChild(dns);
    head.appendChild(pre);

    return () => {
      dns.remove();
      pre.remove();
    };
  }, [origin, enabled]);
}

export default function FullScreenEmbedCard({
  title,
  description = 'Visualizá el contenido en pantalla completa.',
  embedUrl,
  icon: IconProp,
  buttonLabel = 'Abrir',
  preload = false,
  className = '',
  gradientFrom = 'from-slate-900',
  gradientVia = 'via-slate-800',
  gradientTo = 'to-slate-900',
  accentColor = '#f59e0b',
}: FullScreenEmbedCardProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(preload);

  // ⬇️ Loader solo cuando realmente está cargando
  const [iframeLoading, setIframeLoading] = useState(false);

  // ✅ Persistente: ya cargó al menos una vez (queda “caliente”)
  const [iframeReady, setIframeReady] = useState(false);

  // 🔒 evita “doble arranque” en dev/strict mode
  const didStartRef = useRef(false);

  // src estable: solo se setea cuando abrís (y NO se vuelve a tocar)
  const [src, setSrc] = useState<string>(preload ? embedUrl : '');

  // Preconnect: si preload o si abriste modal
  usePreconnect(embedUrl, preload || visible);

  const open = () => {
    if (!mounted) setMounted(true);

    // iniciar carga una sola vez
    if (!didStartRef.current) {
      didStartRef.current = true;
      if (!src && embedUrl) setSrc(embedUrl);
    }

    // ✅ si ya está ready, NO muestres loader
    if (embedUrl && !iframeReady) setIframeLoading(true);

    setVisible(true);
  };

  const close = useCallback(() => {
    setVisible(false);
    // ❗ no tocamos iframeReady ni src: así queda caliente
    // y NO seteamos loading acá para evitar que “parpadee” al volver a abrir
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, close]);

  // si cambia la url (otro embed), permitir nuevo arranque
  useEffect(() => {
    didStartRef.current = false;

    // ✅ al cambiar embed, resetear estado de carga/ready
    setIframeReady(false);
    setIframeLoading(false);

    if (preload) setSrc(embedUrl);
    if (!preload) setSrc('');
  }, [embedUrl, preload]);

  return (
    <>
      <section className={className}>
        <motion.button
          onClick={open}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="group w-full"
        >
          <div
            className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${gradientFrom} ${gradientVia} ${gradientTo} p-6 shadow-xl transition-transform duration-200 group-hover:scale-105`}
          >
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                background: `radial-gradient(1200px 200px at 50% -20%, ${accentColor}33, transparent)`,
              }}
            />

            <div className="flex items-center gap-4 relative z-10">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10"
                style={{ color: accentColor }}
              >
                {typeof IconProp === 'function' ? (
                  <IconProp className="h-6 w-6" strokeWidth={1.5} />
                ) : (
                  IconProp ?? <IconMapPoint className="h-6 w-6" />
                )}
              </div>

              <div className="flex-1 text-left">
                <h3 className="text-lg font-semibold text-white tracking-tight">{title}</h3>
                <p className="text-sm text-white/70">{description}</p>
              </div>

              <div
                aria-hidden
                className="ml-auto rounded-full px-3 py-1 text-xs font-medium ring-1 group-hover:opacity-90 transition"
                style={{
                  color: accentColor,
                  borderColor: `${accentColor}80`,
                  backgroundColor: `${accentColor}15`,
                }}
              >
                {buttonLabel}
              </div>
            </div>
          </div>
        </motion.button>
      </section>

      {mounted && (
        <div
          className={`fixed inset-0 z-[999] transition-opacity duration-300 ${
            visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          } bg-black/80 backdrop-blur-sm`}
        >
          <div className="absolute inset-0" onClick={close} />

          <div className="relative mx-auto h-screen w-screen">
            <button
              onClick={close}
              className="absolute right-4 top-4 z-[1000] rounded-full shadow-2xl px-6 py-2 text-sm font-medium text-bold bg-rose-900 text-white backdrop-blur hover:bg-white/15"
            >
              Cerrar
            </button>

            {src ? (
              <div className="relative h-full w-full">
                <AnimatePresence>
                  {iframeLoading && visible && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <EmbedLoader title={title} accentColor={accentColor} />
                    </motion.div>
                  )}
                </AnimatePresence>

                <iframe
                  title={title}
                  src={src}
                  className={`h-full w-full ${visible ? '' : 'invisible'}`}
                  loading={preload ? 'eager' : 'eager'}
                  referrerPolicy="no-referrer-when-downgrade"
                  onLoad={() => {
                    setIframeLoading(false);
                    setIframeReady(true); // ✅ clave: a partir de acá no vuelve a mostrar loader al abrir
                  }}
                />
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/80">
                No hay contenido disponible.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
