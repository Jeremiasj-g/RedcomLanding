'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import LookerEmbed from '@/components/LookerEmbed';
import Card from '@/components/Card';
import Container from '@/components/Container';
import { gerenciaProducts } from '@/lib/data';
import ClientGate from '@/components/ClientGate';
import { SectionDivider } from '@/components/SectionDivider';
import { IconAnalytics } from '@/components/Icons/IconAnalytics';
import { IconMapPoint } from '@/components/Icons/IconMapPoint';
// import MapsEmbed from '@/components/MapsEmbed'; // opcional si querés reemplazar el iframe

const MAP_URL =
  'https://www.google.com/maps/d/u/0/embed?mid=19y6MniEXtnVs3QBIZOlaXGOnkRMVTkI&ehbc=2E312F';

export default function Gerencia() {
  // modal visible/invisible (sin desmontar)
  const [visibleMap, setVisibleMap] = useState(false);
  // montamos el mapa una sola vez y lo dejamos persistir en memoria
  const [mountedMap, setMountedMap] = useState(false);

  const open = () => {
    if (!mountedMap) setMountedMap(true); // primera vez: montamos
    setVisibleMap(true); // luego solo mostramos/ocultamos
  };
  const close = useCallback(() => setVisibleMap(false), []);

  // Cerrar con ESC
  useEffect(() => {
    if (!visibleMap) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visibleMap, close]);

  useEffect(() => {
    setMountedMap(true); // monta el iframe oculto al cargar la página
  }, []);

  return (
    <ClientGate area="gerencia">
      <div className="min-h-screen">
        <PageHeader
          title="Gerencia"
          bg="border-2 bg-gradient-to-tr from-gray-900 via-cyan-900 to-gray-900"
        />

        <section className="pt-24 pb-14">
          <Container>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {gerenciaProducts.map((product, index) => (
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

        {/* Card "Mapa de cobertura" debajo del Looker */}
        <section>
          <Container>
            <motion.button
              onClick={open}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="group w-full"
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl transition-transform duration-200 hover:scale-105">
                <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(1200px_200px_at_50%_-20%,rgba(59,130,246,0.20),transparent)]"/>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                    <IconMapPoint className="h-6 w-6 text-rose-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-lg font-semibold text-white tracking-tight">
                      Mapa de cobertura
                    </h3>
                    <p className="text-sm text-white/70">
                      Visualizá el mapa de cobertura en pantalla completa.
                    </p>
                  </div>
                  <div
                    aria-hidden
                    className="ml-auto rounded-full px-3 py-1 text-xs font-medium text-rose-600/90 ring-1 bg-rose-100/30 group-hover:text-rose-600/70"
                  >
                    Abrir
                  </div>
                </div>
              </div>
            </motion.button>
          </Container>
        </section>
        {/* Modal full-screen: siempre montada cuando mountedMap=true, solo cambia visibilidad */}
        {mountedMap && (
          <div
            className={`fixed inset-0 z-[999] transition-opacity duration-300 ${visibleMap ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              } bg-black/80 backdrop-blur-sm`}
            role="dialog"
            aria-modal="true"
            aria-hidden={!visibleMap}
          >
            {/* Cerrar al clickear el fondo */}
            <div className="absolute inset-0" onClick={close} />

            <div className="relative mx-auto h-screen w-screen">
              {/* Botón cerrar */}
              <button
                onClick={close}
                className="absolute right-4 top-4 z-[1000] rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/15"
              >
                Cerrar
              </button>

              {/* Iframe siempre montado (no se desmonta al cerrar) */}
              <iframe
                title="Mapa de cobertura"
                src={MAP_URL}
                className={`h-full w-full ${visibleMap ? '' : 'invisible'}`}
                loading="eager"
                referrerPolicy="no-referrer-when-downgrade"
              />
              {/* Si preferís tu componente:
                  <MapsEmbed src={MAP_URL} className={`h-full w-full ${visibleMap ? '' : 'invisible'}`} />
              */}
            </div>
          </div>
        )}

        <Container>
          <SectionDivider title="Dashboard de ventas" icon={<IconAnalytics />} />
        </Container>

        <LookerEmbed looker_id="gerencia" />

      </div>
    </ClientGate>
  );
}
