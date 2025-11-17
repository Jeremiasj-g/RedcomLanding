'use client';

import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import Card from '@/components/Card';
import Container from '@/components/Container';
import { corrientesMasivos } from '@/lib/data';
import LookerEmbed from '@/components/LookerEmbed';
import { SectionDivider } from '@/components/SectionDivider';
import { IconAnalytics } from '@/components/Icons/IconAnalytics';
import FullScreenEmbedCard from '@/components/FullScreenEmbedCard';
import { urls } from '@/lib/data';
import { Table } from 'lucide-react';
import { RequireAuth } from '@/components/RouteGuards';

export default function CorrientesMasivos() {

  const corrientesMapa = urls.mapas[0].corrientes;
  const corrientesTablero = urls.tableros[0].corrientes;

  return (

    <RequireAuth roles={['admin', 'supervisor']} branches={['corrientes']}>

      <div className="min-h-screen">
        <PageHeader
          title="Corrientes"
          bg="border-2 bg-gradient-to-tr from-gray-900 via-cyan-900 to-gray-900"
          bgImage="/mapa-corrientes.png"
        />

        <section className="pt-24 pb-14">
          <Container>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {corrientesMasivos.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card {...product} />
                </motion.div>
              ))}
            </div>
          </Container>
        </section>

        <Container>
          <FullScreenEmbedCard {...corrientesMapa} />
          <FullScreenEmbedCard {...corrientesTablero} icon={<Table />} />
        </Container>

        <Container>
          <SectionDivider title='Dashboard de ventas' icon={<IconAnalytics />} />
        </Container>

        <LookerEmbed looker_id="masivos" />
      </div>

    </RequireAuth>

  );
}
