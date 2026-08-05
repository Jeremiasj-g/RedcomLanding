'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, Building2, Flame, MapPinned, Table, TrendingUp } from 'lucide-react';
import BranchResourcesSection from '@/components/BranchResourcesSection';
import Container from '@/components/Container';
import ConfiguredWorkbookCard from '@/components/analytics/ConfiguredWorkbookCard';
import { useAnalyticsConfig } from '@/components/analytics/AnalyticsConfigProvider';
import LookerTabs from '@/components/LookerTabs';
import PageHeader from '@/components/PageHeader';
import { RequireAuth } from '@/components/RouteGuards';
import { gerenciaProducts } from '@/lib/data';

const LOOKER_BRANCHES = [
  {
    key: 'gerencia',
    scopeKey: 'gerencia',
    label: 'Consolidado',
    shortLabel: 'General',
    icon: <Building2 className="h-4 w-4" />,
    bg: {
      dashboard: 'gerencias_dash.webp',
      heatmap: 'heatmap_gerencia.webp',
    },
  },
  {
    key: 'masivos',
    scopeKey: 'corrientes_masivos',
    label: 'Corrientes · Masivos',
    shortLabel: 'Ctes. Masivos',
    icon: <MapPinned className="h-4 w-4" />,
    bg: {
      dashboard: 'dash_ctes.webp',
      heatmap: 'heatmap_ctes.webp',
    },
  },
  {
    key: 'refrigerados',
    scopeKey: 'corrientes_refrigerados',
    label: 'Corrientes · Refrigerados',
    shortLabel: 'Refrigerados',
    icon: <MapPinned className="h-4 w-4" />,
    bg: {
      dashboard: 'dash_refri.webp',
      heatmap: 'heatmap_ctes.webp',
    },
  },
  {
    key: 'chaco',
    scopeKey: 'chaco',
    label: 'Chaco · Masivos',
    shortLabel: 'Chaco',
    icon: <MapPinned className="h-4 w-4" />,
    bg: {
      dashboard: 'dash_rcia.webp',
      heatmap: 'heatmap_rcia.webp',
    },
  },
  {
    key: 'misiones',
    scopeKey: 'misiones',
    label: 'Misiones · Masivos',
    shortLabel: 'Misiones',
    icon: <MapPinned className="h-4 w-4" />,
    bg: {
      dashboard: 'dash_mnes.webp',
      heatmap: 'heatmap_mnes.webp',
    },
  },
  {
    key: 'obera',
    scopeKey: 'obera',
    label: 'Oberá · Masivos',
    shortLabel: 'Oberá',
    icon: <MapPinned className="h-4 w-4" />,
    bg: {
      dashboard: 'dash_obera.webp',
      heatmap: 'heatmap_obera.webp',
    },
  },
];

export default function Gerencia() {
  const lookerTabs = useMemo(
    () => [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: <BarChart3 className="h-4 w-4" />,
        bgImage: 'gerencias_dash.webp',
      },
      {
        key: 'heatmap',
        label: 'Mapa de calor',
        icon: <Flame className="h-4 w-4" />,
        bgImage: 'heatmap_gerencia.webp',
      },
    ],
    [],
  );

  return (
    <RequireAuth roles={['admin']}>
      <PageHeader
        title="Gerencia"
        bg=""
        bg2="bg-white/10"
        bgImage="/mapa-corrientes.png"
        bgStyle={{
          background:
            'radial-gradient(circle at 12% 18%, rgba(14, 165, 233, 0.72), transparent 30%), radial-gradient(circle at 78% 16%, rgba(220, 38, 38, 0.52), transparent 30%), radial-gradient(circle at 28% 88%, rgba(22, 163, 74, 0.52), transparent 32%), radial-gradient(circle at 88% 82%, rgba(147, 51, 234, 0.58), transparent 32%), linear-gradient(135deg, #f8fafc 0%, #e2e8f0 36%, #0f172a 100%)',
        }}
      />

      <div className="min-h-screen bg-white">
        <BranchResourcesSection
          branchName="Gerencia"
          products={gerenciaProducts}
          description="Accedé rápidamente a las planillas y recursos de seguimiento utilizados por Gerencia."
        />

        <section className="bg-white py-10 sm:py-12">
          <Container>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)] md:p-7">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                    <TrendingUp className="h-3.5 w-3.5" /> Nuevo tablero gerencial
                  </div>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                    Análisis histórico de categorías
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                    Revisá el desempeño por empresa, sucursal, mesa de supervisión y vendedor desde una pantalla dedicada para Gerencia.
                  </p>
                </div>

                <Link
                  href="/gerencia/analisis-categorias"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
                >
                  Abrir análisis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </Container>
        </section>

        <section className="bg-white py-12 sm:py-14">
          <Container>
            <ConfiguredWorkbookCard scopeKey="gerencia" icon={<Table />} />
          </Container>
        </section>

        <LookerTabs
          tabs={lookerTabs}
          defaultTab="dashboard"
          className="mt-14"
          eyebrow="Inteligencia comercial · Gerencia"
          title="Panel ejecutivo y mapa de calor"
          description="Consultá las vistas consolidadas de Gerencia para seguir desempeño general, distribución territorial y lectura comercial de alto nivel."
        >
          {({ activeTab }) => <GerenciaLookerBranchExplorer activeTab={activeTab} />}
        </LookerTabs>
      </div>
    </RequireAuth>
  );
}

function GerenciaLookerBranchExplorer({ activeTab }) {
  const { getUrl } = useAnalyticsConfig();
  const currentType = activeTab?.key ?? 'dashboard';

  const availableBranches = useMemo(() => {
    return LOOKER_BRANCHES.filter((branch) => Boolean(getUrl(currentType, branch.scopeKey)));
  }, [currentType, getUrl]);

  const [activeByType, setActiveByType] = useState({
    dashboard: 'gerencia',
    heatmap: 'masivos',
  });

  const activeBranchKey = activeByType[currentType] ?? availableBranches[0]?.key;

  useEffect(() => {
    if (!availableBranches.length) return;

    if (!availableBranches.some((branch) => branch.key === activeBranchKey)) {
      setActiveByType((prev) => ({
        ...prev,
        [currentType]: availableBranches[0].key,
      }));
    }
  }, [availableBranches, activeBranchKey, currentType]);

  const activeBranch = useMemo(() => {
    return availableBranches.find((branch) => branch.key === activeBranchKey) ?? availableBranches[0] ?? null;
  }, [availableBranches, activeBranchKey]);

  const setActiveBranch = (branchKey) => {
    setActiveByType((prev) => ({
      ...prev,
      [currentType]: branchKey,
    }));
  };

  if (!activeBranch) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-5">
      <div className="flex w-full flex-wrap items-center gap-2 rounded-3xl border border-slate-200 bg-white p-2 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
        {availableBranches.map((branch) => {
          const isActive = branch.key === activeBranch.key;

          return (
            <button
              key={`${currentType}-${branch.key}`}
              type="button"
              onClick={() => setActiveBranch(branch.key)}
              className={`group inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-slate-900/10 sm:flex-none sm:min-w-[170px] ${
                isActive
                  ? 'bg-slate-950 text-white shadow-xl shadow-slate-900/20'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              <span className={isActive ? 'text-sky-200' : 'text-slate-400 group-hover:text-slate-600'}>
                {branch.icon}
              </span>
              <span>{branch.shortLabel}</span>
            </button>
          );
        })}
      </div>

      <GerenciaLookerDeck activeBranch={activeBranch} activeType={currentType} />
    </div>
  );
}

function GerenciaLookerDeck({ activeBranch, activeType }) {
  const { getUrl } = useAnalyticsConfig();
  const activeEmbedKey = `${activeBranch.key}:${activeType}`;
  const activeUrl = getUrl(activeType, activeBranch.scopeKey);

  const [visitedEmbeds, setVisitedEmbeds] = useState(() => {
    return activeUrl ? [activeEmbedKey] : [];
  });

  useEffect(() => {
    if (!activeUrl) return;

    setVisitedEmbeds((prev) => {
      if (prev.includes(activeEmbedKey)) return prev;
      return [...prev, activeEmbedKey];
    });
  }, [activeEmbedKey, activeUrl]);

  const getEmbedByKey = (embedKey) => {
    const [branchKey, type] = embedKey.split(':');
    const branch = LOOKER_BRANCHES.find((item) => item.key === branchKey);
    const url = branch ? getUrl(type, branch.scopeKey) : '';

    return {
      branch,
      type,
      url,
      bgImage: branch?.bg?.[type],
    };
  };

  const backgroundImage = activeBranch.bg?.[activeType]
    ? `url('/${activeBranch.bg[activeType]}')`
    : 'linear-gradient(135deg, #020617, #020617)';

  return (
    <section className="relative z-0 py-8">
      <div className="relative isolate h-[1000px] w-full overflow-hidden rounded-2xl bg-slate-950 shadow-2xl">
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl bg-cover bg-center opacity-25"
          style={{ backgroundImage }}
        />
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-slate-950/35" />

        {visitedEmbeds.map((embedKey) => {
          const { branch, type, url } = getEmbedByKey(embedKey);
          if (!branch || !url) return null;

          const isActive = embedKey === activeEmbedKey;

          return (
            <iframe
              key={embedKey}
              title={`Redcom ${branch.label} - ${type}`}
              src={url}
              loading="lazy"
              allowFullScreen
              className={`absolute inset-0 z-10 h-full w-full rounded-2xl border-0 transition-opacity duration-300 ${
                isActive ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
              }`}
            />
          );
        })}

        <div className="pointer-events-none absolute inset-0 z-40 rounded-2xl ring-1 ring-white/10" />
      </div>
    </section>
  );
}
