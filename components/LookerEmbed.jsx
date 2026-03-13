'use client';

import { useEffect, useMemo, useState } from 'react';
import { DatabaseZap, LayoutDashboard, Sparkles } from 'lucide-react';

export default function LookerEmbed({ looker_id, type = 'dashboard', bgImage }) {
  const LOOKER_LINKS = {
    masivos: {
      dashboard:
        'https://lookerstudio.google.com/embed/reporting/76975544-c99b-4cb2-be4c-0e8600ef0a24/page/LwcrF',
      heatmap:
        'https://lookerstudio.google.com/embed/reporting/c8b99cb6-6276-4ef2-9ac6-9f755e14f9bc/page/UEjrF',
    },
    refrigerados: {
      dashboard: '',
      heatmap: '',
    },
    refrigeradosKilos: {
      dashboard: '',
      heatmap: '',
    },
    chaco: {
      dashboard: 'https://lookerstudio.google.com/embed/reporting/9520a7c3-3999-4710-9ad7-d5d4883730f9/page/1glrF',
      heatmap: 'https://lookerstudio.google.com/embed/reporting/acfb408f-1bd5-4f2f-aa24-ce0743abdfdd/page/0zlrF',
    },
    misiones: {
      dashboard: 'https://lookerstudio.google.com/embed/reporting/d45f4ffe-fe56-44ed-aee5-01772836d111/page/X6trF',
      heatmap: 'https://lookerstudio.google.com/embed/reporting/7be38458-43d8-4123-89c6-cc32391c13f0/page/xPurF',
    },
    obera: {
      dashboard: 'https://lookerstudio.google.com/embed/reporting/a4ad4a8e-c677-46c4-bc34-63dfc87f52c0/page/513rF',
      heatmap: 'https://lookerstudio.google.com/embed/reporting/bb5f1ff8-1372-4c93-93c4-d51d4b07aaf9/page/UC4rF',
    },
    gerencia: {
      dashboard: 'https://lookerstudio.google.com/embed/reporting/c71c0b8a-4e73-485d-8ea6-1617b683d01c/page/BTXrF',
      heatmap: '',
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