'use client';

import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import Card from '@/components/Card';
import Container from '@/components/Container';
import { corrientesMasivos } from '@/lib/data';
import LookerEmbed from '@/components/LookerEmbed';
import ClientGate from '@/components/ClientGate';
import { SectionDivider } from '@/components/SectionDivider';
import { IconAnalytics } from '@/components/Icons/IconAnalytics';
import MapsEmbed from '../../../components/MapsEmbed';
import { IconMapPoint } from '@/components/Icons/IconMapPoint';

export default function CorrientesMasivos() {
  return (
    <ClientGate area="masivos">
      <div className="min-h-screen">
        <PageHeader
          title="Masivos"
          bg="border-2 bg-gradient-to-tr from-gray-900 via-cyan-900 to-gray-900"
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
          <SectionDivider title='Dashboard de ventas' icon={<IconAnalytics />} />
        </Container>

        <LookerEmbed looker_id="masivos" />

        <Container>
          <SectionDivider title='Mapa de cobertura' icon={<IconMapPoint />} />
        </Container>

        <MapsEmbed map_id="masivos" />
      </div>
    </ClientGate>
  );
}
