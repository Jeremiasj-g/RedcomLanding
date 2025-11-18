'use client';

import { motion } from 'framer-motion';
import Carousel from '@/components/Carousel';
import Card from '@/components/Card';
import Container from '@/components/Container';
import { homeCategories } from '@/lib/data';

export default function Home() {
  const handleScrollToCategories = () => {
    document.getElementById('categories')?.scrollIntoView({
      behavior: 'smooth',
    });
  };

  // 🎨 Gradientes por card (ejemplos: azul, rojo, morado, verde)
  const cardGradients = [
    {
      from: 'from-sky-900',
      via: 'via-sky-700',
      to: 'to-sky-500',
      border: 'border-sky-900', // azul
    },
    {
      from: 'from-red-800',
      via: 'via-orange-500',
      to: 'to-rose-400',
      border: 'border-red-900', // rojo
    },
    {
      from: 'from-purple-900',
      via: 'via-fuchsia-700',
      to: 'to-pink-400',
      border: 'border-purple-900', // morado
    },
    {
      from: 'from-emerald-900',
      via: 'via-green-700',
      to: 'to-lime-400',
      border: 'border-emerald-900', // verde
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section with Carousel */}
      <section className="relative">
        <Carousel onCTAClick={handleScrollToCategories} />
      </section>

      {/* Categories Section */}
      <section id="categories" className="py-16 bg-gray-50">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Seleccionar sucursal
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Más de 13 años distribuyendo productos de calidad en toda la región
            </p>
          </motion.div>

          {/* Layout con flex, responsive y simple */}
          <div className="flex flex-wrap justify-between gap-2 border">
            {homeCategories.map((category, index) => {
              const gradient =
                cardGradients[index % cardGradients.length];

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
                  className="
                    w-full
                    sm:w-1/2
                    md:w-1/3
                    lg:w-1/4
                  "
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
        </Container>
      </section>
    </div>
  );
}
