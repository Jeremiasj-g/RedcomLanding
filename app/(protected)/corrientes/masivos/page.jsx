'use client';

import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import CardSucursales from '@/components/CardSucursales';
import Container from '@/components/Container';
import { corrientesMasivos, urls } from '@/lib/data';
import LookerEmbed from '@/components/LookerEmbed';
import { SectionDivider } from '@/components/SectionDivider';
import { IconAnalytics } from '@/components/Icons/IconAnalytics';
import FullScreenEmbedCard from '@/components/FullScreenEmbedCard';
import { Table } from 'lucide-react';
import { RequireAuth } from '@/components/RouteGuards';
import { useMe } from '@/hooks/useMe';
import CategoryBannerLink from '@/components/categoria/CategoryBannerLink';

export default function CorrientesMasivos() {
  const { me } = useMe();

  const corrientesMapa = urls.mapas[0].corrientes;
  const corrientesTablero = urls.tableros[0].corrientes;

  const role = me?.role ?? 'vendedor';

  const visibleProducts = corrientesMasivos.filter((product) =>
    (product.roles ?? []).includes(role),
  );

  const PERMISSIONS = {
    analytics: ['admin', 'supervisor'],
  };

  const canSeeAnalytics = PERMISSIONS.analytics.includes(role);
  
  return (
    <RequireAuth
      roles={['admin', 'supervisor', 'vendedor']}
      branches={['corrientes']}
    >
      <div className="min-h-screen">
        <PageHeader
          title="Corrientes"
          bg="border-2 bg-gradient-to-tr from-gray-900 via-cyan-900 to-gray-900"
          bgImage="/mapa-corrientes.png"
        />

        <section className="pt-24 pb-14">
          <Container>
            <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-3">
              {visibleProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <CardSucursales {...product} />
                </motion.div>
              ))}
            </div>

            {visibleProducts.length === 0 && (
              <div className="mt-6 rounded-2xl border border-slate-800 bg-gray-900/70 p-4 text-sm text-slate-300">
                No tenés accesos habilitados para ver módulos en esta sección.
              </div>
            )}
          </Container>
        </section>

        {/* ✅ banner a categorías */}
        <Container>
          <div className="mt-6">
            <CategoryBannerLink
              branchLabel="Corrientes"
              href="/corrientes/masivos/categorias"
              title="Categorías"
              description="Ranking por vendedor, puntajes y comparación por criterios."
              buttonLabel="Abrir"
            />
          </div>
        </Container>

        {canSeeAnalytics && (
          <>
            <Container>
              <FullScreenEmbedCard {...corrientesMapa} />
              <FullScreenEmbedCard {...corrientesTablero} icon={<Table />} />
            </Container>

            <Container>
              <SectionDivider title="Dashboard de ventas" icon={<IconAnalytics />} />
            </Container>

            <LookerEmbed looker_id="masivos" />
          </>
        )}
      </div>
    </RequireAuth>
  );
}
