'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

const slides = [
  {
    id: 1,
    image: 'redcom_portada.png',
    title: 'Generando vinculos',
    subtitle: 'Más de 13 años de experiencia',
    description: 'Distribución en toda la región, conectamos productores y comercios con eficiencia y confianza'
  },
  /* {
    id: 1,
    image: 'REDCOM_PORTADA.PNG',
    title: 'Distribución en toda la región',
    subtitle: 'Más de 13 años de experiencia',
    description: 'Conectamos productores y comercios con eficiencia y confianza'
  }, */
/*   {
    id: 2,
    image: 'slide2.PNG',
    title: 'Logística especializada',
    subtitle: 'Productos masivos y refrigerados',
    description: 'Mantenemos la cadena de frío y garantizamos la calidad'
  },
  {
    id: 3,
    image: 'slide3.PNG',
    title: 'Cobertura regional',
    subtitle: 'Corrientes, Chaco, Misiones y Oberá',
    description: 'Llegamos donde otros no pueden con nuestra red de distribución'
  },
  {
    id: 4,
    image: 'slide4.PNG',
    title: 'Calidad garantizada',
    subtitle: 'Productos seleccionados',
    description: 'Trabajamos solo con proveedores de confianza y productos de primera'
  } */
];

const Carousel = ({ onCTAClick }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="relative h-[70vh] md:h-[80vh] w-full overflow-hidden">
      <Swiper
        modules={[Navigation, Pagination, Autoplay]}
        spaceBetween={0}
        slidesPerView={1}
        navigation={{
          nextEl: '.swiper-button-next',
          prevEl: '.swiper-button-prev',
        }}
        pagination={{
          el: '.swiper-pagination',
          clickable: true,
          bulletClass: 'swiper-pagination-bullet',
          bulletActiveClass: 'swiper-pagination-bullet-active',
        }}
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
        }}
        loop={true}
        onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
        className="h-full w-full"
      >
        {slides.map((slide, index) => (
          <SwiperSlide key={slide.id} className="relative">
            <div className="absolute inset-0 backdrop-blur-[3px] bg-black/40 z-10" />
            <img
              src={slide.image}
              alt={slide.title}
              className="w-full h-full object-cover"
            />

            <div className="absolute inset-0 z-20 flex items-center">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <AnimatePresence mode="wait">
                  {activeIndex === index && (
                    <motion.div
                      key={`slide-${index}`}
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -50 }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="text-white max-w-2xl"
                    >
                      <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-rose-400 font-medium mb-2 text-sm md:text-base"
                      >
                        {slide.subtitle}
                      </motion.p>

                      <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4"
                      >
                        {slide.title}
                      </motion.h1>

                      <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.5 }}
                        className="text-lg md:text-xl text-gray-200 mb-8 max-w-xl"
                      >
                        {slide.description}
                      </motion.p>

                      <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.7 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onCTAClick}
                        className="bg-rose-500 hover:bg-rose-600 text-white px-8 py-4 rounded-full text-lg font-semibold transition-colors duration-300 shadow-lg hover:shadow-xl"
                      >
                        Empezar
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Custom Navigation Buttons */}
      <button className="swiper-button-prev absolute left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-300">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button className="swiper-button-next absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-300">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Custom Pagination */}
      <div className="swiper-pagination absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex space-x-2">
        {slides.map((_, index) => (
          <div
            key={index}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${activeIndex === index ? 'bg-rose-500 w-8' : 'bg-white/50'
              }`}
          />
        ))}
      </div>
    </div>
  );
};

export default Carousel;