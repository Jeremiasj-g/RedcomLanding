'use client';

import { motion } from 'framer-motion';
import Container from './Container';

export default function PageHeader(props) {
  const {
    title,
    subtitle = 'Recursos sucursal',
    bgImage = '',
    bg = ' ',
    actions = null,
    className = '',
  } = props;

  return (
    <header className={`relative h-[600px] min-h-[420px] overflow-hidden ${className}`}>
      {/* Fondo */}
      <div className="absolute inset-0">
        <img
          src="/redcom_portada.jpg"
          alt="Portada Redcom"
          className="h-full w-full object-cover"
        />
        {/* Overlay para contraste */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/10" />
        {/* Halo sutil */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_240px_at_50%_-10%,rgba(59,130,246,0.18),transparent)] opacity-60" />
      </div>

      {/* Card flotante (glass) */}
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute bottom-8 w-full -translate-x-1/2"
        >
          <div className="w-max rounded-2xl border border-white/15 bg-white/10 p-5 md:p-6 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-4 md:gap-6">
              {/* Avatar/Badge */}
              <div className={`h-40 w-40 p-4 shrink-0 overflow-hidden rounded-full ring-2 ring-white/40 bg-white/5 ${bg}`}>
                {bgImage ? (
                  <img src={bgImage} alt={bgImage} className="h-full w-full object-contain" />
                ) : (
                  <div className="h-full w-full" />
                )}
              </div>

              {/* Títulos */}
              <div className="flex min-w-0 flex-col">
                <span className="text-xs md:text-sm uppercase tracking-[0.12em] text-white/70">
                  {subtitle}
                </span>
                <h1 className="truncate text-2xl md:text-4xl font-bold text-white drop-shadow-sm">
                  {title}
                </h1>
              </div>

              {/* Acciones (opcional) */}
              {actions ? <div className="ml-auto flex items-center gap-3">{actions}</div> : null}
            </div>
          </div>
        </motion.div>
      </Container>
    </header>
  );
}
