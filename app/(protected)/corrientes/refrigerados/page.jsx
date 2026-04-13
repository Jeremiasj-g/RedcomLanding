'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import CardSucursales from '@/components/CardSucursales';
import Container from '@/components/Container';
import { corrientesRefrigerados } from '@/lib/data';
import { corrientesRefrigeradosKilosBultos } from '@/lib/data';
import ClientGate from '@/components/ClientGate';
import LookerEmbed from '@/components/LookerEmbed';
import { SectionDivider } from '@/components/SectionDivider';
import { IconAnalytics } from '@/components/Icons/IconAnalytics'
import { RequireAuth } from '@/components/RouteGuards';
import FullScreenEmbedCard from '@/components/FullScreenEmbedCard';
import { urls } from '@/lib/data';
import { Table, BarChart3, Flame } from 'lucide-react';
import { useMe } from '@/hooks/useMe';
import LookerTabs from '@/components/LookerTabs';

export default function CorrientesRefrigerados() {

  const refrigeradosTablero = urls.tableros[1].refrigerados
  const mapaTablero = urls.mapas[5].refrigerados

  const { me } = useMe();
  const role = me?.role ?? 'vendedor';

  const visibleProducts = corrientesRefrigerados.filter((product) =>
    (product.roles ?? []).includes(role),
  );
  const visibleProductsKB = corrientesRefrigeradosKilosBultos.filter((product) =>
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

    <RequireAuth roles={['admin', 'supervisor', 'jdv', 'vendedor', 'rrhh']} branches={['refrigerados']}>

      <div className="min-h-screen">
        <PageHeader
          title="Refrigerados"
          bg="border-2 bg-gradient-to-tr from-gray-900 via-cyan-900 to-gray-900"
          bgImage="/mapa-corrientes.png"
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




        {canSeeAnalytics && (
          <>
            <Container>
              <FullScreenEmbedCard {...refrigeradosTablero} icon={<Table />} />
              {/* <FullScreenEmbedCard {...mapaTablero} /> */}
            </Container>

            <Container>
              <SectionDivider title='Kílos - bultos' />
            </Container>

            <section className="py-12">
              <Container>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6">
                  {visibleProductsKB.map((product, index) => (
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

            <LookerTabs tabs={lookerTabs} defaultTab="dashboard" className='mt-28'>
              {({ activeTab }) => (
                <LookerEmbed
                  looker_id="refrigerados"
                  type={activeTab.key}
                  bgImage={activeTab.bgImage}
                />
              )}
            </LookerTabs>
            
            <LookerTabs tabs={lookerTabsKilos} defaultTab="dashboard" className='mt-28'>
              {({ activeTab }) => (
                <LookerEmbed
                  looker_id="refrigeradosKilos"
                  type={activeTab.key}
                  bgImage={activeTab.bgImage}
                />
              )}
            </LookerTabs>

            {/* <Container>
              <SectionDivider title='Dashboard de ventas BULTOS' icon={<IconAnalytics />} />
            </Container>

            <LookerEmbed looker_id='refrigerados' type="dashboard" bgImage="dash_refri.webp"/>
            
            <Container>
              <SectionDivider title='Dashboard de ventas KILOS' icon={<IconAnalytics />} />
            </Container>
            
            <LookerEmbed looker_id='refrigeradosKilos' type="dashboard" bgImage="dash_refri.webp"/> */}
          </>
        )}

      </div>
    </RequireAuth>




  );
}