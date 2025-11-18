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
  gradientFrom = 'from-slate-950',
  gradientVia = 'via-slate-800',
  gradientTo = 'to-slate-900',
  borderColor = '#57C2E8',
}: CardProps) => {
  const cardBase = (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
      className={`
        relative overflow-hidden rounded-3xl
        bg-gradient-to-br ${gradientFrom} ${gradientVia} ${gradientTo}
        ${borderColor} border
        flex flex-col items-start justify-between
        hover:contrast-125
        transition-[filter] duration-150
        group h-full px-6 py-20 md:py-20 md:px-8
        shadow-xl
      `}
    >
      {/* 🔵 Fondo imagen con reveal circular */}
      {image && (
        <div
          className="
            absolute inset-0 z-0 pointer-events-none
            [clip-path:circle(0%_at_100%_0%)]
            group-hover:[clip-path:circle(150%_at_100%_0%)]
            transition-[clip-path] duration-300 ease-out
          "
        >
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover opacity-90"
          />
        </div>
      )}

      {/* Pill / categoría arriba */}
      {category && (
        <span
          className= {`
            absolute top-6 left-8
            text-[11px] md:text-xs border border-[${borderColor}] rounded-xl px-2 py-0.5
            bg-black/20 text-[${borderColor}] backdrop-blur-sm
            z-10
            transition-opacity duration-150
            group-hover:opacity-0
          `} 
        >
          {category}
        </span>
      )}

      {/* Descripción */}
      {description && (
        <p
          className="
          text-white/90
            mt-3 max-w-[70%] text-xs md:text-sm text-white/85
            z-10 relative
            transition-opacity duration-150
            group-hover:opacity-0
          "
        >
          {description}
        </p>
      )}

      {/* Título */}
      <span
        className="
          absolute bottom-6 left-8
          font-bold text-xl md:text-2xl text-white
          drop-shadow-sm
          z-10
          transition-all duration-150
          group-hover:opacity-0
        "
      >
        {title}
      </span>
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
