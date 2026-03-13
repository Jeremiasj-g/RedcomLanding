'use client';

import { useMemo } from 'react';
import LookerTabs from '@/components/LookerTabs';
import { Table, BarChart3, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import CardSucursales from '@/components/CardSucursales';
import Container from '@/components/Container';
import { oberaProducts } from '@/lib/data';
import { SectionDivider } from '@/components/SectionDivider';
import { IconAnalytics } from '@/components/Icons/IconAnalytics';
import LookerEmbed from '@/components/LookerEmbed';
import { RequireAuth } from '@/components/RouteGuards';
import FullScreenEmbedCard from '@/components/FullScreenEmbedCard';
import { urls } from '@/lib/data';
import { useMe } from '@/hooks/useMe';

export default function Obera() {

  // const mapaMisiones = urls.mapas[3].misiones
  const tableroObera = urls.tableros[5].obera
  const mapaObera = urls.mapas[4].obera

  const { me } = useMe();
  const role = me?.role ?? 'vendedor';

  const visibleProducts = oberaProducts.filter((product) =>
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
          bgImage: 'dash_obera.webp',
        },
        {
          key: 'heatmap',
          label: 'Mapa de calor',
          icon: <Flame className="h-4 w-4" />,
          bgImage: 'heatmap_obera.webp',
        },
      ],
      [],
    );

  return (

    <RequireAuth roles={['admin', 'supervisor', 'jdv', 'vendedor', 'rrhh']} branches={['obera']}>
      <div className="min-h-screen">
        <PageHeader
          title="Oberá"
          bg="border-2 bg-gradient-to-tr from-gray-900 via-cyan-900 to-gray-900"
          bgImage="/mapa-obera.png"
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
              {/* <FullScreenEmbedCard {...mapaObera} /> */}
              <FullScreenEmbedCard {...tableroObera} icon={<Table />} />
            </Container>

            <LookerTabs tabs={lookerTabs} defaultTab="dashboard" className='mt-28'>
              {({ activeTab }) => (
                <LookerEmbed
                  looker_id="obera"
                  type={activeTab.key}
                  bgImage={activeTab.bgImage}
                />
              )}
            </LookerTabs>

            {/* <Container>
              <SectionDivider title='Dashboard de ventas' icon={<IconAnalytics />} />
            </Container>

            <LookerEmbed looker_id="obera" type="dashboard" bgImage="dash_obera.webp" /> */}
          </>
        )}
      </div>
    </RequireAuth>

  );
}