'use client';

import { useEffect, useMemo, useState } from 'react';
import { DatabaseZap, LayoutDashboard, Sparkles } from 'lucide-react';

export default function LookerEmbed({ looker_id, type = 'dashboard', bgImage }) {
  const LOOKER_LINKS = {
    masivos: {
      dashboard: 'https://datastudio.google.com/embed/reporting/95672365-963d-4337-88aa-e321226a30b9/page/MKU0F',
      heatmap: 'https://datastudio.google.com/embed/reporting/ee4a9dfc-1e5c-406f-bcc3-1f6025f5a4db/page/mTc0F',
    },
    refrigerados: {
      dashboard: 'https://datastudio.google.com/embed/reporting/68a79e0b-4d5c-4ccc-87f6-3932e9b17cc5/page/lJc0F',
      heatmap: 'https://datastudio.google.com/embed/reporting/81f660d5-7781-4b90-8198-fbf6586d3a1e/page/JXj0F',
    },
    refrigeradosKilos: {
      dashboard: '',
      heatmap: '',
    },
    chaco: {
      dashboard: 'https://datastudio.google.com/embed/reporting/0055785b-135c-4e10-be1e-06a5c03e5df8/page/VbU0F',
      heatmap: 'https://datastudio.google.com/embed/reporting/a4537dfb-132a-4e00-91ab-27ede67961cb/page/tsc0F',
    },
    misiones: {
      dashboard: 'https://datastudio.google.com/embed/reporting/17fb6121-b0a9-4352-b802-af6516113e5d/page/3pU0F',
      heatmap: 'https://datastudio.google.com/embed/reporting/d2f15f65-c9bf-475a-b54c-a25a996886b7/page/f4c0F',
    },
    obera: {
      dashboard: 'https://datastudio.google.com/embed/reporting/3bc16cef-4cd0-4daa-9c93-750572b9f30a/page/hYY0F',
      heatmap: 'https://datastudio.google.com/embed/reporting/f5cee063-8518-409b-bf15-2a18433a782e/page/cud0F',
    },
    gerencia: {
      dashboard: 'https://datastudio.google.com/embed/reporting/8a7134c3-4aa4-4955-ab87-3c651813ceaf/page/zu70F',
      heatmap: 'https://datastudio.google.com/embed/reporting/5ebd3719-32ee-4345-a0f0-881623ac0630/page/dED1F',
    },
  };

  const branch = useMemo(() => {
    return LOOKER_LINKS[looker_id] || LOOKER_LINKS.masivos;
  }, [looker_id]);

  const availableTypes = useMemo(() => {
    return Object.entries(branch)
      .filter(([, url]) => Boolean(url))
      .map(([key]) => key);
  }, [branch]);

  const [visitedTypes, setVisitedTypes] = useState(() => {
    return branch[type] ? [type] : [];
  });

  useEffect(() => {
    if (branch[type] && !visitedTypes.includes(type)) {
      setVisitedTypes((prev) => [...prev, type]);
    }
  }, [type, branch, visitedTypes]);

  const backgroundImage = bgImage
    ? `url('/${bgImage}')`
    : 'linear-gradient(135deg, #020617, #020617)';

  const hasCurrentUrl = Boolean(branch[type]);

  const getFriendlyLabel = (value) => {
    if (value === 'dashboard') return 'Dashboard';
    if (value === 'heatmap') return 'Mapa de calor';
    return value;
  };

  return (
    <section className="relative z-0 mx-auto max-w-7xl px-4 py-8">
      <div className="relative">
        {/* glow / blur de fondo */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 scale-[1.2] rounded-[2rem] bg-cover bg-center blur-3xl saturate-150"
          style={{ backgroundImage }}
        />

        {/* card principal */}
        <div className="relative isolate h-[1000px] w-full overflow-hidden rounded-2xl bg-slate-950 shadow-2xl">
          {/* imagen interna suavizada */}
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl bg-cover bg-center opacity-25"
            style={{ backgroundImage }}
          />

          {/* overlay oscuro */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-slate-950/35" />

          {/* iframes visitados */}
          {visitedTypes.map((visitedType) => {
            const url = branch[visitedType];
            if (!url) return null;

            const isActive = visitedType === type;

            return (
              <iframe
                key={visitedType}
                title={`Dashboard Ventas Redcom - ${visitedType}`}
                src={url}
                loading="lazy"
                allowFullScreen
                className={`absolute inset-0 z-10 h-full w-full rounded-2xl border-0 transition-opacity duration-300 ${
                  isActive
                    ? 'pointer-events-auto opacity-100'
                    : 'pointer-events-none opacity-0'
                }`}
              />
            );
          })}

          {/* empty state */}
          {!hasCurrentUrl && (
            <div className="absolute inset-0 z-30 flex items-center justify-center p-6">
              <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
                <div className="pointer-events-none absolute -left-10 top-0 h-32 w-32 rounded-full bg-cyan-500/10 blur-3xl" />
                <div className="pointer-events-none absolute -right-10 bottom-0 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />

                <div className="relative flex flex-col items-center text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 shadow-lg shadow-cyan-500/10">
                    {type === 'dashboard' ? (
                      <LayoutDashboard className="h-8 w-8" />
                    ) : (
                      <DatabaseZap className="h-8 w-8" />
                    )}
                  </div>

                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                    <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                    Visualización no disponible
                  </div>

                  <h3 className="text-2xl font-semibold tracking-tight text-white">
                    Todavía no hay información para mostrar
                  </h3>

                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                    La vista de{' '}
                    <span className="font-medium text-white">
                      {getFriendlyLabel(type)}
                    </span>{' '}
                    para esta sucursal aún no fue configurada o no tiene una URL
                    disponible en este momento.
                  </p>

                  {availableTypes.length > 0 && (
                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                      <span className="text-slate-400">Vistas disponibles: </span>
                      <span className="font-medium text-white">
                        {availableTypes.map(getFriendlyLabel).join(' · ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* borde glass */}
          <div className="pointer-events-none absolute inset-0 z-40 rounded-2xl ring-1 ring-white/10" />
        </div>
      </div>
    </section>
  );
}