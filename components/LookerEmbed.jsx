'use client';

import { useMemo, useState } from 'react';

export default function LookerEmbed({ looker_id, bgImage }) {
  const [active, setActive] = useState(false);

  const LOOKER_LINKS = {
    masivos:
      'https://lookerstudio.google.com/embed/reporting/76975544-c99b-4cb2-be4c-0e8600ef0a24/page/LwcrF',
    refrigerados:
      '',
    refrigeradosKilos:
      '',
    chaco:
      '',
    misiones:
      '',
    obera:
      '',
    gerencia:
      '',
  };

  const src = useMemo(() => {
    return LOOKER_LINKS[looker_id] || LOOKER_LINKS.masivos;
  }, [looker_id]);

  // fallback por si no mandan imagen
  const backgroundImage = bgImage
    ? `url('/${bgImage}')`
    : "linear-gradient(135deg, #020617, #020617)";

  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div
        className="relative w-full h-[1000px] rounded-2xl shadow-2xl bg-slate-950"
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
      >
        {/* Fondo blur (imagen por props) */}
        <div
          className={`
            absolute inset-0
            bg-cover bg-center
            scale-[1.25] blur-2xl opacity-55
          `}
          style={{ backgroundImage }}
        />

        {/* Overlay oscuro para contraste */}
        <div className="absolute inset-0 bg-slate-950/40" />

        {/* Dashboard real */}
        <iframe
          title="Dashboard Ventas Redcom"
          src={src}
          loading="lazy"
          allowFullScreen
          className="relative z-10 h-full w-full border-0"
        />

        {/* Borde glass premium */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10 z-20" />
      </div>
    </section>
  );
}