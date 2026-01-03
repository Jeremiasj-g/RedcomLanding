'use client';

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
import { Table } from 'lucide-react';
import { useMe } from '@/hooks/useMe';

export default function CorrientesRefrigerados() {

  const refrigeradosTablero = urls.tableros[1].refrigerados

  const { me } = useMe();
  const role = me?.role ?? 'vendedor';

  const visibleProducts = corrientesRefrigerados.filter((product) =>
    (product.roles ?? []).includes(role),
  );
  const visibleProductsKB = corrientesRefrigeradosKilosBultos.filter((product) =>
    (product.roles ?? []).includes(role),
  );

  const PERMISSIONS = {
    analytics: ['admin', 'supervisor'],
  };

  const canSeeAnalytics = PERMISSIONS.analytics.includes(role);

  return (

    <RequireAuth roles={['admin', 'supervisor', 'vendedor', 'rrhh']} branches={['refrigerados']}>

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

            <Container>
              <SectionDivider title='Dashboard de ventas' icon={<IconAnalytics />} />
            </Container>

            <LookerEmbed looker_id='refrigerados' />
          </>
        )}

      </div>
    </RequireAuth>




  );
}