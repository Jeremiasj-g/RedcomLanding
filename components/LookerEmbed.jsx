'use client';

import { useMemo, useState } from 'react';

export default function LookerEmbed({ looker_id, bgImage }) {
  const [active, setActive] = useState(false);

  const LOOKER_LINKS = {
    masivos:
      'https://lookerstudio.google.com/embed/reporting/b37f7c00-c237-404d-9cc3-34c568658ee6/page/zWgkF',
    refrigerados:
      'https://lookerstudio.google.com/embed/reporting/b1165fcb-7d52-4856-9c09-04dfdfe1acf2/page/1f9lF',
    refrigeradosKilos:
      'https://lookerstudio.google.com/embed/reporting/c8441ded-1073-41a0-ba7c-6b5826637c41/page/yy9lF',
    chaco:
      'https://lookerstudio.google.com/embed/reporting/95f84fe1-d5b8-4b6d-b877-fe5c4015c135/page/3eLiF',
    misiones:
      'https://lookerstudio.google.com/embed/reporting/535423b7-c192-49b3-a2bf-a1d03f070110/page/iSnkF',
    obera:
      'https://lookerstudio.google.com/embed/reporting/02da7063-7bb9-4398-b53a-da040bc4355e/page/p1nkF',
    gerencia:
      'https://lookerstudio.google.com/embed/reporting/27614a4d-463e-485f-a9c6-b229948be202/page/OzFlF',
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