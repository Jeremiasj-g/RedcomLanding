'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, Flame, Table, TrendingUp } from 'lucide-react';
import BranchResourcesSection from '@/components/BranchResourcesSection';
import Container from '@/components/Container';
import FullScreenEmbedCard from '@/components/FullScreenEmbedCard';
import LookerEmbed from '@/components/LookerEmbed';
import LookerTabs from '@/components/LookerTabs';
import PageHeader from '@/components/PageHeader';
import { RequireAuth } from '@/components/RouteGuards';
import { gerenciaProducts, urls } from '@/lib/data';

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
          {({ activeTab }) => (
            <LookerEmbed
              looker_id="gerencia"
              type={activeTab.key}
              bgImage={activeTab.bgImage}
            />
          )}
        </LookerTabs>
      </div>
    </RequireAuth>
  );
}
