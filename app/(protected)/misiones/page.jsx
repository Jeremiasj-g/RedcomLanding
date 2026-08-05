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
import { misionesProducts, urls } from '@/lib/data';
import PageHeader from '@/components/PageHeader';

export default function Misiones() {
  const tableroMisiones = urls.tableros[3].misiones;
  const { canAccessModule } = useModulePermissions();

  const visibleProducts = useMemo(
    () =>
      misionesProducts.filter(
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
        bgImage: 'dash_mnes.webp',
      },
      {
        key: 'heatmap',
        label: 'Mapa de calor',
        icon: <Flame className="h-4 w-4" />,
        bgImage: 'heatmap_mnes.webp',
      },
    ],
    [],
  );

  return (
    <RequireAuth branches={['misiones']}>
      <PageHeader
        title="Misiones"
        bg="bg-gradient-to-tl from-emerald-900 to-transparent to-[55%]"
        bg2="bg-gradient-to-bl from-lime-400/90 from-0% via-[20%] to-transparent to-[35%]"
        bgImage="/mapa-misiones.png"
      />

      <div className="min-h-screen bg-white">
        <BranchResourcesSection branchName="Misiones" products={visibleProducts} />

        {(canSeeCategories || canSeeAnalytics) && (
          <section className="bg-white py-12 sm:py-14">
            <Container>
              {canSeeCategories && (
                <CategoryBannerLink
                  branchLabel="Misiones"
                  href="/misiones/categorias"
                  title="Categorías"
                  description="Ranking por vendedor, puntajes y comparación por criterios."
                  buttonLabel="Abrir"
                />
              )}

              {canSeeAnalytics && (
                <div className={canSeeCategories ? 'mt-8' : ''}>
                  <FullScreenEmbedCard {...tableroMisiones} icon={<Table />} />
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
            eyebrow="Inteligencia comercial · Misiones"
            title="Ventas y mapa de calor"
            description="Revisá el desempeño comercial de Misiones desde las vistas oficiales: tablero de ventas y lectura territorial por zona."
          >
            {({ activeTab }) => (
              <LookerEmbed
                looker_id="misiones"
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
