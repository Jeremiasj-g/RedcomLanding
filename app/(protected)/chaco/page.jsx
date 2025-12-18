'use client';

import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import CardSucursales from '@/components/CardSucursales';
import Container from '@/components/Container';
import { chacoProducts } from '@/lib/data';
import LookerEmbed from '@/components/LookerEmbed';
import { SectionDivider } from '@/components/SectionDivider';
import { IconAnalytics } from '@/components/Icons/IconAnalytics';
import FullScreenEmbedCard from '@/components/FullScreenEmbedCard';
import { urls } from '@/lib/data';
import { Table } from 'lucide-react';
import { useMe } from '@/hooks/useMe';
import { RequireAuth } from '@/components/RouteGuards';
import CategoryBannerLink from '@/components/categoria/CategoryBannerLink';


export default function Chaco() {
  const { me } = useMe();

  const resistenciaMapa = urls.mapas[1].resistencia
  const resistenciaTablero = urls.tableros[4].resistencia

  const role = me?.role ?? 'vendedor';

  const visibleProducts = chacoProducts.filter((product) =>
    (product.roles ?? []).includes(role),
  );

  const PERMISSIONS = {
    analytics: ['admin', 'supervisor'],
  };

  const canSeeAnalytics = PERMISSIONS.analytics.includes(role);


  return (

    <RequireAuth roles={['admin', 'supervisor', 'vendedor']} branches={['chaco']}>

      <div className="min-h-screen">
        <PageHeader
          title="Chaco"
          bg='border-2 bg-gradient-to-tr from-gray-900 via-cyan-900 to-gray-900'
          bgImage="/mapa-chaco.png"
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

        {/* ✅ banner a categorías */}
        <Container>
          <div className="mt-6">
            <CategoryBannerLink
              branchLabel="Resistencia"
              href="/chaco/categorias"
              title="Categorías"
              description="Ranking por vendedor, puntajes y comparación por criterios."
              buttonLabel="Abrir"
            />
          </div>
        </Container>

        {canSeeAnalytics && (
          <>
            <Container>
              <FullScreenEmbedCard {...resistenciaMapa} />
              <FullScreenEmbedCard {...resistenciaTablero} icon={<Table />} />
            </Container>

            <Container>
              <SectionDivider title='Dashboard de ventas' icon={<IconAnalytics />} />
            </Container>

            <LookerEmbed looker_id='chaco' />
          </>
        )}

      </div>

    </RequireAuth>
  );
}