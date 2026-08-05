'use client';

import { useMemo } from 'react';
import { BarChart3, Flame, Table } from 'lucide-react';
import BranchResourcesSection from '@/components/BranchResourcesSection';
import Container from '@/components/Container';
import ConfiguredWorkbookCard from '@/components/analytics/ConfiguredWorkbookCard';
import LookerEmbed from '@/components/LookerEmbed';
import LookerTabs from '@/components/LookerTabs';
import PageHeader from '@/components/PageHeader';
import { RequireAuth } from '@/components/RouteGuards';
import { useModulePermissions } from '@/components/permissions/ModulePermissionsProvider';
import {
  corrientesRefrigerados,
  corrientesRefrigeradosKilosBultos,
} from '@/lib/data';

export default function CorrientesRefrigerados() {
  const { canAccessModule } = useModulePermissions();

  const visibleProducts = useMemo(
    () =>
      corrientesRefrigerados.filter(
        (product) => !product.permissionKey || canAccessModule(product.permissionKey),
      ),
    [canAccessModule],
  );

  const visibleProductsKB = useMemo(
    () =>
      corrientesRefrigeradosKilosBultos.filter(
        (product) => !product.permissionKey || canAccessModule(product.permissionKey),
      ),
    [canAccessModule],
  );

  const canSeeAnalytics = canAccessModule('branch_analytics');

  const lookerTabs = useMemo(
    () => [
      {
        key: 'dashboard',
        label: 'Dashboard volumen',
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
    <RequireAuth branches={['refrigerados']}>
      <PageHeader
        title="Refrigerados"
        bg="bg-gradient-to-tl from-sky-700 to-transparent to-[55%]"
        bg2="bg-gradient-to-bl from-sky-400/70 from-0% via-[20%] to-transparent to-[35%]"
        bgImage="/mapa-corrientes.png"
      />

      <div className="min-h-screen bg-white">
        <BranchResourcesSection
          branchName="Corrientes Refrigerados"
          products={visibleProducts}
        />

        {canSeeAnalytics && (
          <section className="bg-white py-12 sm:py-14">
            <Container>
              <ConfiguredWorkbookCard scopeKey="corrientes_refrigerados" icon={<Table />} />
            </Container>
          </section>
        )}

        {visibleProductsKB.length > 0 && (
          <BranchResourcesSection
            branchName="Refrigerados"
            products={visibleProductsKB}
            eyebrow="Análisis comercial"
            title="Kilos y bultos"
            description="Accedé a las planillas de análisis, objetivos y sensibilización de kilos y bultos."
            searchPlaceholder="Buscar una herramienta de kilos o bultos..."
          />
        )}

        {canSeeAnalytics && (
          <LookerTabs
            tabs={lookerTabs}
            defaultTab="dashboard"
            className="mt-14"
            eyebrow="Inteligencia comercial · Corrientes Refrigerados"
            title="Dashboard y mapa de calor"
            description="Revisá el desempeño comercial de Refrigerados desde las vistas oficiales: tablero de volumen y lectura territorial por zona."
          >
            {({ activeTab }) => (
              <LookerEmbed
                looker_id="refrigerados"
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
