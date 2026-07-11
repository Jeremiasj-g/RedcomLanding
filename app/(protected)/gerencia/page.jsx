'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, Building2, Flame, MapPinned, Table, TrendingUp } from 'lucide-react';
import BranchResourcesSection from '@/components/BranchResourcesSection';
import Container from '@/components/Container';
import FullScreenEmbedCard from '@/components/FullScreenEmbedCard';
import LookerTabs from '@/components/LookerTabs';
import PageHeader from '@/components/PageHeader';
import { RequireAuth } from '@/components/RouteGuards';
import { gerenciaProducts, urls } from '@/lib/data';

const GERENCIA_LOOKER_VIEWS = {
  gerencia: {
    dashboard: 'https://datastudio.google.com/embed/reporting/448cb6d2-7c09-4ceb-8205-bb71ad87f355/page/knZ3F',
    heatmap: '',
  },
  masivos: {
    dashboard: 'https://datastudio.google.com/embed/reporting/2ecfc88c-9070-4498-8a28-75a1fb347c26/page/9jv2F',
    heatmap: 'https://datastudio.google.com/embed/reporting/8b4b18c4-21b2-4fba-b1d1-be4dd1b28c51/page/uLA3F',
  },
  refrigerados: {
    dashboard: 'https://datastudio.google.com/embed/reporting/02c9a8a8-1e04-46ab-a655-14f32933d372/page/VQ02F',
    heatmap: '',
  },
  chaco: {
    dashboard: 'https://datastudio.google.com/embed/reporting/0ade1098-b0d4-464d-8921-ce34ee5aa6ca/page/35y2F',
    heatmap: 'https://datastudio.google.com/embed/reporting/e7c3de2e-a16b-4a6f-99dc-57a858c25549/page/5TA3F',
  },
  misiones: {
    dashboard: 'https://datastudio.google.com/embed/reporting/fea1c84b-03f7-40f4-bd9f-59b362e5ed1f/page/BKz2F',
    heatmap: 'https://datastudio.google.com/embed/reporting/53d95184-a8df-42fd-983a-ca944a7622dd/page/8tA3F',
  },
  obera: {
    dashboard: 'https://datastudio.google.com/embed/reporting/5d398019-4654-4c01-b587-03f5137b71a2/page/Cdz2F',
    heatmap: 'https://datastudio.google.com/embed/reporting/151511b7-a341-4061-8605-2598e26d1cf3/page/75A3F',
  },
};

const LOOKER_BRANCHES = [
  {
    key: 'gerencia',
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
  const gerenciaTablero = urls.tableros[2].gerencia;

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
            <FullScreenEmbedCard {...gerenciaTablero} icon={<Table />} />
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
  const currentType = activeTab?.key ?? 'dashboard';

  const availableBranches = useMemo(() => {
    return LOOKER_BRANCHES.filter((branch) => Boolean(GERENCIA_LOOKER_VIEWS[branch.key]?.[currentType]));
  }, [currentType]);

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
  const activeEmbedKey = `${activeBranch.key}:${activeType}`;
  const activeUrl = GERENCIA_LOOKER_VIEWS[activeBranch.key]?.[activeType];

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
    const url = GERENCIA_LOOKER_VIEWS[branchKey]?.[type];

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
