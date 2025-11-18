'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

function isExternalLink(href = '') {
  return /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

type CardProps = {
  image?: string;
  title: string;
  description?: string;
  category?: string;
  link?: string;
  gradientFrom?: string;
  gradientVia?: string;
  gradientTo?: string;
  borderColor?: string;
};

const Card = ({
  image,
  title,
  description,
  category,
  link,
  gradientFrom = 'from-sky-900',
  gradientVia = 'via-sky-700',
  gradientTo = 'to-sky-500',
  borderColor = 'border-sky-900',
}: CardProps) => {
  const cardBase = (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      // 👉 usamos tween y quitamos spring totalmente
      transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
      className={`
        relative rounded-3xl overflow-hidden
        bg-gradient-to-br ${gradientFrom} ${gradientVia} ${gradientTo}
        ${borderColor} border
        flex flex-col items-start justify-between
        hover:contrast-125
        /* ⚠️ importante: NO usamos transition-transform aquí para no pelear con Framer */
        transition-[filter] duration-150
        group h-full px-6 py-20 md:py-16 md:px-6
        shadow-xl
      `}
    >
      {/* Pill / categoría arriba */}
      {category && (
        <span className="absolute top-3 left-4 text-[11px] md:text-xs border rounded-xl px-2 py-0.5 bg-black/10 text-white/90 backdrop-blur-sm">
          {category}
        </span>
      )}

      {/* Descripción */}
      {description && (
        <p className="mt-4 max-w-[70%] text-xs md:text-sm text-white/80">
          {description}
        </p>
      )}

      {/* Título */}
      <span
        className="
          absolute bottom-3 left-4 font-bold text-xl md:text-2xl text-white
          drop-shadow-sm
          transition-transform duration-150
          group-hover:-translate-y-1
        "
      >
        {title}
      </span>

      {/* Imagen como logo abajo a la derecha */}
      {image && (
        <div
          className="
            absolute -right-5 -bottom-6
            w-24 h-24 md:w-32 md:h-32
            drop-shadow-[0_8px_20px_rgba(0,0,0,1)]
            brightness-200
            transition-transform duration-150
            group-hover:-rotate-12 group-hover:scale-125
          "
        >
          <Image
            src={image}
            alt={title}
            width={112}
            height={112}
            className="
              object-contain opacity-95
              -rotate-6
              transition-transform duration-150
            "
          />
        </div>
      )}
    </motion.div>
  );

  // Links externos
  if (isExternalLink(link)) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full"
      >
        {cardBase}
      </a>
    );
  }

  // Links internos
  return (
    <Link href={link || '#'} className="block h-full" prefetch aria-label={title}>
      {cardBase}
    </Link>
  );
};

export default Card;
