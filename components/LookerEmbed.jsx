'use client';

import { useMemo, useState } from 'react';

export default function LookerEmbed({ looker_id, bgImage }) {
  const [active, setActive] = useState(false);

  const LOOKER_LINKS = {
    masivos:
      'https://lookerstudio.google.com/embed/reporting/8a84b227-73a0-4465-ab4a-ffc4daf6be49/page/W41nF',
    refrigerados:
      'https://lookerstudio.google.com/embed/reporting/b1165fcb-7d52-4856-9c09-04dfdfe1acf2/page/1f9lF',
    refrigeradosKilos:
      'https://lookerstudio.google.com/embed/reporting/8e7c5cb0-1d73-41e0-b1a2-5279a8a73f2d/page/838nF',
    chaco:
      'https://lookerstudio.google.com/embed/reporting/80c6f92f-61f4-4d70-90c8-41c4b71f9930/page/Ie3nF',
    misiones:
      'https://lookerstudio.google.com/embed/reporting/c657a1d6-8c36-4359-a219-6e92537e175c/page/oJ8nF',
    obera:
      'https://lookerstudio.google.com/embed/reporting/d6f9ac8f-cf36-490d-aa9a-f9c79b317a9a/page/Yc8nF',
    gerencia:
      'https://lookerstudio.google.com/embed/reporting/c800f6e3-844d-4493-8600-5125845d547e/page/7y9nF',
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