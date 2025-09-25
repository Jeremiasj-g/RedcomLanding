'use client';

import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import Card from '@/components/Card';
import Container from '@/components/Container';
import { chacoProducts } from '@/lib/data';
import LookerEmbed from '@/components/LookerEmbed';
import ClientGate from '@/components/ClientGate';
import { SectionDivider } from '@/components/SectionDivider';
import { IconAnalytics } from '@/components/Icons/IconAnalytics';

export default function Chaco() {
  return (

    <ClientGate area="chaco">
      <div className="min-h-screen">
        <PageHeader
          title="Chaco"
          bg='border-2 bg-gradient-to-tr from-gray-900 via-cyan-900 to-gray-900'
        />

        <section className="pt-24 pb-14">
          <Container>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {chacoProducts.map((product, index) => (
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
          <SectionDivider title='Dashboard de ventas' icon={<IconAnalytics />} />
        </Container>

        <LookerEmbed looker_id='chaco' />

        <iframe width="100%" height="600" frameborder="0" scrolling="no" src="https://1drv.ms/x/c/520c6123535e3dab/IQQcOkzzuq4USKxaX9DBz9PnAa4edbigZE-wWZ4oK4T7y3U?em=2&wdHideGridlines=True&wdHideHeaders=True&wdDownloadButton=True&wdInConfigurator=True&wdInConfigurator=True"></iframe>
      </div>

    </ClientGate>
  );
}