'use client';

import { useMemo } from 'react';
import { BarChart3, Flame, Table } from 'lucide-react';
import BranchResourcesSection from '@/components/BranchResourcesSection';
import Container from '@/components/Container';
import FullScreenEmbedCard from '@/components/FullScreenEmbedCard';
import LookerEmbed from '@/components/LookerEmbed';
import LookerTabs from '@/components/LookerTabs';
import PageHeader from '@/components/PageHeader';
import { RequireAuth } from '@/components/RouteGuards';
import { useMe } from '@/hooks/useMe';
import {
  corrientesRefrigerados,
  corrientesRefrigeradosKilosBultos,
  urls,
} from '@/lib/data';

export default function CorrientesRefrigerados() {
  const refrigeradosTablero = urls.tableros[1].refrigerados;
  const { me } = useMe();
  const role = me?.role ?? 'vendedor';

  const visibleProducts = corrientesRefrigerados.filter((product) =>
    (product.roles ?? []).includes(role),
  );

  const visibleProductsKB = corrientesRefrigeradosKilosBultos.filter(
    (product) => (product.roles ?? []).includes(role),
  );

  const canSeeAnalytics = ['admin', 'supervisor', 'jdv'].includes(role);

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

  const lookerTabsKilos = useMemo(
    () => [
      {
        key: 'dashboard',
        label: 'Dashboard kilos',
        icon: <BarChart3 className="h-4 w-4" />,
        bgImage: 'dash_ctes.webp',
      },
    ],
    [],
  );

  return (
    <RequireAuth
      roles={['admin', 'supervisor', 'jdv', 'vendedor', 'rrhh']}
      branches={['refrigerados']}
    >
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
          <>
            <section className="bg-white py-12 sm:py-14">
              <Container>
                <FullScreenEmbedCard
                  {...refrigeradosTablero}
                  icon={<Table />}
                />
              </Container>
            </section>

            <BranchResourcesSection
              branchName="Refrigerados"
              products={visibleProductsKB}
              eyebrow="Análisis comercial"
              title="Kilos y bultos"
              description="Accedé a las planillas de análisis, objetivos y sensibilización de kilos y bultos."
              searchPlaceholder="Buscar una herramienta de kilos o bultos..."
            />

            <LookerTabs
              tabs={lookerTabs}
              defaultTab="dashboard"
              className="mt-14"
              eyebrow="Inteligencia comercial · Corrientes Refrigerados"
              title="Dashboard volumen y mapa de calor"
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

            <LookerTabs
              tabs={lookerTabsKilos}
              defaultTab="dashboard"
              className="mt-14"
              eyebrow="Análisis operativo · Refrigerados"
              title="Dashboard de kilos y bultos"
              description="Consultá la lectura específica de kilos y bultos para controlar objetivos, volumen físico y comportamiento operativo del canal."
            >
              {({ activeTab }) => (
                <LookerEmbed
                  looker_id="refrigeradosKilos"
                  type={activeTab.key}
                  bgImage={activeTab.bgImage}
                />
              )}
            </LookerTabs>
          </>
        )}
      </div>
    </RequireAuth>
  );
}
