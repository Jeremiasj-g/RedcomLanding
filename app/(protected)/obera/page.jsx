'use client';

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
import { Table } from 'lucide-react';

export default function Obera() {

  // const mapaMisiones = urls.mapas[3].misiones
  const tableroObera = urls.tableros[5].obera

  return (

    <RequireAuth roles={['admin', 'supervisor']} branches={['obera']}>
      <div className="min-h-screen">
        <PageHeader
          title="Oberá"
          bg="border-2 bg-gradient-to-tr from-gray-900 via-cyan-900 to-gray-900"
          bgImage="/mapa-obera.png"
        />

        <section className="pt-24 pb-14">
          <Container>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6">
              {oberaProducts.map((product, index) => (
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
          <FullScreenEmbedCard {...tableroObera} icon={<Table />} />
        </Container>

        <Container>
          <SectionDivider title='Dashboard de ventas' icon={<IconAnalytics />} />
        </Container>

        <LookerEmbed looker_id="obera" />
      </div>
    </RequireAuth>

  );
}