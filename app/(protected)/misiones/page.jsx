'use client';

import { useMemo } from 'react';
import LookerTabs from '@/components/LookerTabs';
import { Table, BarChart3, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import LookerEmbed from '@/components/LookerEmbed';
import CardSucursales from '@/components/CardSucursales';
import Container from '@/components/Container';
import { misionesProducts } from '@/lib/data';
import { SectionDivider } from '@/components/SectionDivider';
import { IconAnalytics } from '@/components/Icons/IconAnalytics';
import FullScreenEmbedCard from '@/components/FullScreenEmbedCard';
import { RequireAuth } from '@/components/RouteGuards';
import { urls } from '@/lib/data';
import CategoryBannerLink from '@/components/categoria/CategoryBannerLink';
import { useMe } from '@/hooks/useMe';

export default function Misiones() {

  const mapaMisiones = urls.mapas[3].misiones
  const tableroMisiones = urls.tableros[3].misiones

  const { me } = useMe();
  const role = me?.role ?? 'vendedor';

  const visibleProducts = misionesProducts.filter((product) =>
    (product.roles ?? []).includes(role),
  );

  const PERMISSIONS = {
    analytics: ['admin', 'supervisor', 'jdv'],
  };

  const canSeeAnalytics = PERMISSIONS.analytics.includes(role);

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

    <RequireAuth roles={['admin', 'supervisor', 'jdv', 'vendedor', 'rrhh']} branches={['misiones']}>
      <div className="min-h-screen">
        <PageHeader
          title="Misiones"
          bg="border-2 bg-gradient-to-tr from-gray-900 via-cyan-900 to-gray-900"
          bgImage='/mapa-misiones.png'
        />

        <section className="pt-24 pb-14">
          <Container>
            <div className="grid md:grid-cols-3 lg:grid-cols-3 gap-6">
              {visibleProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.1
                  }}
                  viewport={{ once: true }}
                >
                  <CardSucursales {...product} />
                </motion.div>
              ))}
            </div>
          </Container>
        </section>

        {/* ✅ banner a categorías */}
        <Container>
          <div className="mt-6">
            <CategoryBannerLink
              branchLabel="Misiones"
              href="/misiones/categorias"
              title="Categorías"
              description="Ranking por vendedor, puntajes y comparación por criterios."
              buttonLabel="Abrir"
            />
          </div>
        </Container>



        {canSeeAnalytics && (
          <>
            <Container>
              <FullScreenEmbedCard {...mapaMisiones} />
              <FullScreenEmbedCard {...tableroMisiones} icon={<Table />} />
            </Container>

            <LookerTabs tabs={lookerTabs} defaultTab="dashboard" className='mt-28'>
              {({ activeTab }) => (
                <LookerEmbed
                  looker_id="misiones"
                  type={activeTab.key}
                  bgImage={activeTab.bgImage}
                />
              )}
            </LookerTabs>

            {/* <Container>
              <SectionDivider title='Dashboard de ventas' icon={<IconAnalytics />} />
            </Container> */}

            {/* <LookerEmbed looker_id='misiones' type="dashboard" bgImage="dash_mnes.webp" /> */}
          </>
        )}

      </div>
    </RequireAuth>
  );
}
