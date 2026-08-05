'use client';

import { useMemo } from 'react';
import { BarChart3, Flame, Table } from 'lucide-react';
import BranchResourcesSection from '@/components/BranchResourcesSection';
import CategoryBannerLink from '@/components/categoria/CategoryBannerLink';
import Container from '@/components/Container';
import FullScreenEmbedCard from '@/components/FullScreenEmbedCard';
import LookerEmbed from '@/components/LookerEmbed';
import LookerTabs from '@/components/LookerTabs';
import { RequireAuth } from '@/components/RouteGuards';
import { useModulePermissions } from '@/components/permissions/ModulePermissionsProvider';
import { chacoProducts, urls } from '@/lib/data';
import PageHeader from '@/components/PageHeader';

export default function Chaco() {
  const resistenciaTablero = urls.tableros[4].resistencia;
  const { canAccessModule } = useModulePermissions();

  const visibleProducts = useMemo(
    () =>
      chacoProducts.filter(
        (product) => !product.permissionKey || canAccessModule(product.permissionKey),
      ),
    [canAccessModule],
  );

  const canSeeCategories = canAccessModule('branch_categories');
  const canSeeAnalytics = canAccessModule('branch_analytics');

  const lookerTabs = useMemo(
    () => [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: <BarChart3 className="h-4 w-4" />,
        bgImage: 'dash_rcia.webp',
      },
      {
        key: 'heatmap',
        label: 'Mapa de calor',
        icon: <Flame className="h-4 w-4" />,
        bgImage: 'heatmap_rcia.webp',
      },
    ],
    [],
  );

  return (
    <RequireAuth branches={['chaco']}>
      <PageHeader
        title="Chaco"
        bg="bg-gradient-to-tl from-red-800 to-transparent to-[55%]"
        bg2="bg-gradient-to-bl from-pink-400/70 from-0% via-[20%] to-transparent to-[35%]"
        bgImage="/mapa-chaco.png"
      />

      <div className="min-h-screen bg-white">
        <BranchResourcesSection branchName="Chaco" products={visibleProducts} />

        {(canSeeCategories || canSeeAnalytics) && (
          <section className="bg-white py-12 sm:py-14">
            <Container>
              {canSeeCategories && (
                <CategoryBannerLink
                  branchLabel="Resistencia"
                  href="/chaco/categorias"
                  title="Categorías"
                  description="Ranking por vendedor, puntajes y comparación por criterios."
                  buttonLabel="Abrir"
                />
              )}

              {canSeeAnalytics && (
                <div className={canSeeCategories ? 'mt-8' : ''}>
                  <FullScreenEmbedCard {...resistenciaTablero} icon={<Table />} />
                </div>
              )}
            </Container>
          </section>
        )}

        {canSeeAnalytics && (
          <LookerTabs
            tabs={lookerTabs}
            defaultTab="dashboard"
            className="mt-14"
            eyebrow="Inteligencia comercial · Chaco"
            title="Ventas y mapa de calor"
            description="Revisá el desempeño comercial de Chaco desde las vistas oficiales: tablero de ventas y lectura territorial por zona."
          >
            {({ activeTab }) => (
              <LookerEmbed
                looker_id="chaco"
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
