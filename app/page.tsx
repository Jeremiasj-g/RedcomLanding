'use client';

import { motion } from 'framer-motion';
import Carousel from '@/components/Carousel';
import Card from '@/components/Card';
import Container from '@/components/Container';
import { homeCategories } from '@/lib/data';
import Image from 'next/image'; // 👈 Imagen optimizada de Next

export default function Home() {
  const handleScrollToCategories = () => {
    document.getElementById('categories')?.scrollIntoView({
      behavior: 'smooth',
    });
  };

  const cardGradients = [
    {
      from: 'from-sky-900',
      via: 'via-sky-700',
      to: 'to-sky-500',
      border: 'border-sky-900',
    },
    {
      from: 'from-sky-900',
      via: 'via-sky-700',
      to: 'to-sky-500',
      border: 'border-sky-900',
    },
    {
      from: 'from-red-800',
      via: 'via-rose-700',
      to: 'to-rose-400',
      border: 'border-red-900',
    },
    {
      from: 'from-emerald-900',
      via: 'via-green-700',
      to: 'to-lime-400',
      border: 'border-emerald-900',
    },
    {
      from: 'from-purple-900',
      via: 'via-fuchsia-700',
      to: 'to-pink-400',
      border: 'border-purple-900',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section con carrusel */}
      <section className="relative">
        <Carousel onCTAClick={handleScrollToCategories} />
      </section>

      {/* Sección de categorías */}
      <section id="categories" className="py-16 bg-gray-50">
        <Container>
          {/* Título + subtítulo animado */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-5xl font-[900] text-gray-900 mb-4 tracking-tight">
              Seleccionar sucursal
            </h2>

            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Más de 13 años distribuyendo productos de calidad en toda la región
            </p>
          </motion.div>

          {/* Layout dividido: imagen izquierda, cards derecha */}
          <div className="flex flex-col lg:flex-row items-start h-max">
            {/* Columna izquierda: imagen */}
            <div className="flex flex-col lg:items-center lg:justify-center w-full h-full lg:w-1/2 lg:h-full">
              <div className="relative w-full h-full aspect-square rounded-3xl overflow-hidden">
                <Image
                  src="/seleccionar-ilustration.png"
                  alt="Ilustración de sucursales"
                  fill
                  className="object-contain drop-shadow-2xl"
                />
              </div>
            </div>

            {/* Columna derecha: grid de cards */}
            <div className="w-full lg:w-1/2">
              <div
                className="
    grid 
    md:grid-cols-2       /* tablet: 2 columnas */
    lg:grid-cols-6       /* desktop: 6 columnas para controlar spans */
    gap-6
  "
              >
                {homeCategories.map((category, index) => {
                  const gradient = cardGradients[index % cardGradients.length];

                  // BENTO PATRÓN CORREGIDO
                  let spanClasses = "";

                  switch (index % 5) {
                    case 0: // fila 1 - col 1
                      spanClasses = "lg:col-span-3"; // 50%
                      break;

                    case 1: // fila 1 - col 2
                      spanClasses = "lg:col-span-3"; // 50%
                      break;

                    case 2: // fila 2 - card completa
                      spanClasses = "lg:col-span-6"; // 100%
                      break;

                    case 3: // fila 3 - col 1
                      spanClasses = "lg:col-span-3"; // 50%
                      break;

                    case 4: // fila 3 - col 2
                      spanClasses = "lg:col-span-3"; // 50%
                      break;
                  }

                  return (
                    <motion.div
                      key={category.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.5,
                        delay: index * 0.1,
                      }}
                      viewport={{ once: true }}
                      className={spanClasses}
                    >
                      <Card
                        {...category}
                        gradientFrom={gradient.from}
                        gradientVia={gradient.via}
                        gradientTo={gradient.to}
                        borderColor={gradient.border}
                      />
                    </motion.div>
                  );
                })}
              </div>

            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
