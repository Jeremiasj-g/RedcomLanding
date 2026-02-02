'use client';

import React from 'react';
import { motion, type Variants, type Transition } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

function isExternalLink(href = ''): boolean {
  return /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

export type CardProps = {
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

type MotionState = 'rest' | 'hover';

const cardVariants: Variants = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.03, y: -4 },
};

const imageVariants: Variants = {
  rest: { scale: 1, rotate: -6 },
  hover: { scale: 1.25, rotate: -12 },
};

// ✅ Transition tipado correctamente
const transition: Transition = {
  type: 'tween',
  duration: 0.1,
  ease: 'easeOut', // ahora TS lo acepta como Easing válido
};

const titleVariants: Variants = {
  rest: { y: 0 },
  hover: { y: -4 },
};

const Card: React.FC<CardProps> = ({
  image,
  title,
  description,
  category,
  link,
  gradientFrom = 'from-sky-900',
  gradientVia = 'via-sky-700',
  gradientTo = 'to-sky-500',
  borderColor = 'border-sky-900',
}) => {
  const cardBase = (
    <motion.div
      initial="rest"
      animate="rest"
      whileHover="hover"
      variants={cardVariants}
      transition={transition}
      className={`
        relative rounded-3xl overflow-hidden
        bg-gradient-to-br ${gradientFrom} ${gradientVia} ${gradientTo}
        ${borderColor} border
        flex flex-col items-start justify-between
        h-full px-6 py-20 md:py-16 md:px-6
        shadow-xl
        will-change-transform
      `}
    >
      {category && (
        <span className="absolute top-3 left-4 text-xs border rounded-xl px-2 py-0.5 bg-black/10 text-white/90 backdrop-blur-sm">
          {category}
        </span>
      )}

      {description && (
        <p className="mt-4 max-w-[70%] text-sm text-white/80">{description}</p>
      )}

      <motion.span
        variants={titleVariants}
        transition={transition}
        className="absolute bottom-3 left-4 font-bold text-xl md:text-2xl text-white"
      >
        {title}
      </motion.span>

      {image && (
        <motion.div
          variants={imageVariants}
          transition={transition}
          className="
            absolute -right-5 -bottom-6
            w-24 h-24 md:w-32 md:h-32
            drop-shadow-[0_8px_20px_rgba(0,0,0,1)]
            brightness-200
            will-change-transform
          "
        >
          <Image
            src={image}
            alt={title}
            width={128}
            height={128}
            className="object-contain opacity-95"
            priority={false}
          />
        </motion.div>
      )}
    </motion.div>
  );

  if (isExternalLink(link)) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full"
        aria-label={title}
      >
        {cardBase}
      </a>
    );
  }

  return (
    <Link href={link || '#'} className="block h-full" aria-label={title}>
      {cardBase}
    </Link>
  );
};

export default Card;