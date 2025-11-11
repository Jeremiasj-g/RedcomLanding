'use client';

import { useState, useEffect, useCallback, ReactNode, ElementType } from 'react';
import { motion } from 'framer-motion';
import { IconMapPoint } from '@/components/Icons/IconMapPoint';

type FullScreenEmbedCardProps = {
  title: string;
  description?: string;
  embedUrl: string;
  /** 👇 ahora puede recibir cualquier ícono de lucide-react */
  icon?: ReactNode | ElementType;
  buttonLabel?: string;
  preload?: boolean;
  className?: string;
  gradientFrom?: string;
  gradientVia?: string;
  gradientTo?: string;
  accentColor?: string;
};

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

  const open = () => {
    if (!mounted) setMounted(true);
    setVisible(true);
  };
  const close = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, close]);

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
                <h3 className="text-lg font-semibold text-white tracking-tight">
                  {title}
                </h3>
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

      {/* Modal full-screen */}
      {mounted && (
        <div
          className={`fixed inset-0 z-[999] transition-opacity duration-300 ${
            visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          } bg-black/80 backdrop-blur-sm`}
          role="dialog"
          aria-modal="true"
          aria-hidden={!visible}
        >
          <div className="absolute inset-0" onClick={close} />

          <div className="relative mx-auto h-screen w-screen">
            <button
              onClick={close}
              className="absolute right-4 top-4 z-[1000] rounded-full px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/15"
              style={{
                backgroundColor: `${accentColor}25`,
                borderColor: `${accentColor}60`,
              }}
            >
              Cerrar
            </button>

            {embedUrl ? (
              <iframe
                title={title}
                src={embedUrl}
                className={`h-full w-full ${visible ? '' : 'invisible'}`}
                loading={preload ? 'eager' : 'lazy'}
                referrerPolicy="no-referrer-when-downgrade"
              />
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
