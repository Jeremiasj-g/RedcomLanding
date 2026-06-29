'use client';

import { useMemo } from 'react';
import { BarChart3, Flame, Table } from 'lucide-react';
import BranchResourcesSection from '@/components/BranchResourcesSection';
import CategoryBannerLink from '@/components/categoria/CategoryBannerLink';
import Container from '@/components/Container';
import FullScreenEmbedCard from '@/components/FullScreenEmbedCard';
import LookerEmbed from '@/components/LookerEmbed';
import LookerTabs from '@/components/LookerTabs';
import PageHeader from '@/components/PageHeader';
import { RequireAuth } from '@/components/RouteGuards';
import { useMe } from '@/hooks/useMe';
import { corrientesMasivos, urls } from '@/lib/data';

export default function CorrientesMasivos() {
  const corrientesTablero = urls.tableros[0].corrientes;
  const { me } = useMe();
  const role = me?.role ?? 'vendedor';

  const visibleProducts = corrientesMasivos.filter((product) =>
    (product.roles ?? []).includes(role),
  );

  const canSeeAnalytics = ['admin', 'supervisor', 'jdv'].includes(role);

  const lookerTabs = useMemo(
    () => [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: <BarChart3 className="h-4 w-4" />,
        bgImage: 'dash_ctes.webp',
      },
      {
        key: 'heatmap',
        label: 'Mapa de calor',
        icon: <Flame className="h-4 w-4" />,
        bgImage: 'heatmap_ctes.webp',
      },
    ],
    [],
  );

  return (
    <RequireAuth
      roles={['admin', 'supervisor', 'jdv', 'vendedor', 'rrhh']}
      branches={['corrientes']}
    >
      <PageHeader
        title="Corrientes"
        bg="bg-gradient-to-tl from-sky-700 to-transparent to-[55%]"
        bg2="bg-gradient-to-bl from-sky-400/70 from-0% via-[20%] to-transparent to-[35%]"
        bgImage="/mapa-corrientes.png"
      />

      <div className="min-h-screen bg-white">
        <BranchResourcesSection
          branchName="Corrientes Masivos"
          products={visibleProducts}
        />

        <section className="bg-white py-12 sm:py-14">
          <Container>
            <CategoryBannerLink
              branchLabel="Corrientes"
              href="/corrientes/masivos/categorias"
              title="Categorías"
              description="Ranking por vendedor, puntajes y comparación por criterios."
              buttonLabel="Abrir"
            />

            {canSeeAnalytics && (
              <div className="mt-8">
                <FullScreenEmbedCard {...corrientesTablero} icon={<Table />} />
              </div>
            )}
          </Container>
        </section>

        {canSeeAnalytics && (
          <LookerTabs
            tabs={lookerTabs}
            defaultTab="dashboard"
            className="mt-14"
          >
            {({ activeTab }) => (
              <LookerEmbed
                looker_id="masivos"
                type={activeTab.key}
                bgImage={activeTab.bgImage}
              />
            )}
          </LookerTabs>
        )}
      </div>
    </RequireAuth>
  );
}
