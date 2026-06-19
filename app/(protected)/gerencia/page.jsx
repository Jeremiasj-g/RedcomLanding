'use client';

import { useMemo } from 'react';
import { BarChart3, Flame, Table } from 'lucide-react';
import BranchResourcesSection from '@/components/BranchResourcesSection';
import GerenciaCategoriasDashboard from '@/components/categoria/GerenciaCategoriasDashboard';
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
        bg="bg-gradient-to-tl from-sky-700 to-transparent to-[55%]"
        bg2="bg-gradient-to-bl from-sky-400/70 from-0% via-[20%] to-transparent to-[35%]"
        bgImage="/mapa-corrientes.png"
      />

      <div className="min-h-screen bg-white">
        <BranchResourcesSection
          branchName="Gerencia"
          products={gerenciaProducts}
          description="Accedé rápidamente a las planillas y recursos de seguimiento utilizados por Gerencia."
        />



        <section className="bg-white py-12 sm:py-14">
          <Container>
            <GerenciaCategoriasDashboard />
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
