'use client';

import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import LookerEmbed from '@/components/LookerEmbed';
import Card from '@/components/Card';
import Container from '@/components/Container';
import { misionesProducts } from '@/lib/data';
import ClientGate from '@/components/ClientGate';
import { SectionDivider } from '@/components/SectionDivider';
import { IconAnalytics } from '@/components/Icons/IconAnalytics';
import FullScreenEmbedCard from '@/components/FullScreenEmbedCard';

export default function Misiones() {
  return (

    <ClientGate area="misiones">

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
          <FullScreenEmbedCard
            title="Mapa de cobertura"
            description="Visualizá el mapa de cobertura en pantalla completa."
            embedUrl={'misiones'}
            // icon={<IconMapPoint className="h-6 w-6 text-cyan-300" />} // opcional
            preload={true}  // monta el iframe al cargar para evitar recarga al abrir
            className=""
          />
        </Container>

        <Container>
          <SectionDivider title='Dashboard de ventas' icon={<IconAnalytics />} />
        </Container>

        <LookerEmbed looker_id='misiones' />

      </div>

    </ClientGate>

  );
}