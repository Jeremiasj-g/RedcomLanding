'use client';

import { motion } from 'framer-motion';
import Carousel from '@/components/Carousel';
import Card from '@/components/Card';
import Container from '@/components/Container';
import { homeCategories } from '@/lib/data';

export default function Home() {
  const handleScrollToCategories = () => {
    document.getElementById('categories')?.scrollIntoView({ 
      behavior: 'smooth' 
    });
  };

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

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {homeCategories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.5, 
                  delay: index * 0.1 
                }}
                viewport={{ once: true }}
              >
                <Card {...category} />
              </motion.div>
            ))}
          </div>
        </Container>
      </section>
    </div>
  );
}