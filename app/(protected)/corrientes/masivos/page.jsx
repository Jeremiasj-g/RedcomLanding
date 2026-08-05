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
import { useModulePermissions } from '@/components/permissions/ModulePermissionsProvider';
import { corrientesMasivos, urls } from '@/lib/data';

export default function CorrientesMasivos() {
  const corrientesTablero = urls.tableros[0].corrientes;
  const { canAccessModule } = useModulePermissions();

  const visibleProducts = useMemo(
    () =>
      corrientesMasivos.filter(
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
    <RequireAuth branches={['corrientes']}>
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

        {(canSeeCategories || canSeeAnalytics) && (
          <section className="bg-white py-12 sm:py-14">
            <Container>
              {canSeeCategories && (
                <CategoryBannerLink
                  branchLabel="Corrientes"
                  href="/corrientes/masivos/categorias"
                  title="Categorías"
                  description="Ranking por vendedor, puntajes y comparación por criterios."
                  buttonLabel="Abrir"
                />
              )}

              {canSeeAnalytics && (
                <div className={canSeeCategories ? 'mt-8' : ''}>
                  <FullScreenEmbedCard {...corrientesTablero} icon={<Table />} />
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
            eyebrow="Inteligencia comercial · Corrientes Masivos"
            title="Ventas y mapa de calor"
            description="Revisá el desempeño comercial de Corrientes Masivos desde las vistas oficiales: tablero de ventas y lectura territorial por zona."
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
