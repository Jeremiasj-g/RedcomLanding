'use client';

import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import LookerEmbed from '@/components/LookerEmbed';
import Card from '@/components/Card';
import Container from '@/components/Container';
import { misionesProducts } from '@/lib/data';
import { SectionDivider } from '@/components/SectionDivider';
import { IconAnalytics } from '@/components/Icons/IconAnalytics';
import FullScreenEmbedCard from '@/components/FullScreenEmbedCard';
import { RequireAuth } from '@/components/RouteGuards';
import { urls } from '@/lib/data';
import { Table } from 'lucide-react';

export default function Misiones() {

  const mapaMisiones = urls.mapas[3].misiones
  const tableroMisiones = urls.tableros[3].misiones

  return (

    <RequireAuth roles={['admin', 'supervisor']} branches={['misiones']}>
      <div className="min-h-screen">
        <PageHeader
          title="Misiones"
          bg="border-2 bg-gradient-to-tr from-gray-900 via-cyan-900 to-gray-900"
          bgImage='/mapa-misiones.png'
        />

        <section className="pt-24 pb-14">
          <Container>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {misionesProducts.map((product, index) => (
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
                  <Card {...product} />
                </motion.div>
              ))}
            </div>
          </Container>
        </section>

        <Container>
          <FullScreenEmbedCard {...mapaMisiones} />
          <FullScreenEmbedCard {...tableroMisiones} icon={<Table />} />
        </Container>

        <Container>
          <SectionDivider title='Dashboard de ventas' icon={<IconAnalytics />} />
        </Container>

        <LookerEmbed looker_id='misiones' />

      </div>
    </RequireAuth>
  );
}