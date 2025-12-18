'use client';

import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import LookerEmbed from '@/components/LookerEmbed';
import Card from '@/components/Card';
import Container from '@/components/Container';
import { gerenciaProducts } from '@/lib/data';
import { SectionDivider } from '@/components/SectionDivider';
import { IconAnalytics } from '@/components/Icons/IconAnalytics';
import FullScreenEmbedCard from '@/components/FullScreenEmbedCard';
import { urls } from '@/lib/data';
import { Table } from 'lucide-react';
import { RequireAuth } from '@/components/RouteGuards';
import CardSucursales from '@/components/CardSucursales';
// (opcional) import { IconMapPoint } from '@/components/Icons/IconMapPoint';

/* const MAP_URL = 'https://www.google.com/maps/d/u/0/embed?mid=19y6MniEXtnVs3QBIZOlaXGOnkRMVTkI&ehbc=2E312F'; */

export default function Gerencia() {

  const gerenciaMapa = urls.mapas[2].gerencia
  const gerenciaTablero = urls.tableros[2].gerencia

  return (
    <RequireAuth roles={['admin']}>

      <div className="min-h-screen">
        <PageHeader
          title="Gerencia"
          bg="border-2 bg-gradient-to-tr from-gray-900 via-cyan-900 to-gray-900"
          bgImage="/mapa-corrientes.png"
        />

        <section className="pt-24 pb-14">
          <Container>
            <div className="grid md:grid-cols-3 lg:grid-cols-3 gap-6">
              {gerenciaProducts.map((product, index) => (
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

        {/* Card + Modal reutilizable */}
        <section className="pb-14">
          <Container>
            <FullScreenEmbedCard {...gerenciaMapa} />
            <FullScreenEmbedCard {...gerenciaTablero} icon={<Table />} />
          </Container>
        </section>
        <Container>
          <SectionDivider title="Dashboard de ventas" icon={<IconAnalytics />} />
        </Container>

        <LookerEmbed looker_id="gerencia" />


      </div>
    </RequireAuth>

  );
}
