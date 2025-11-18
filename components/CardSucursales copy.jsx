'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

function isExternalLink(href = '') {
  // http(s)://, //, mailto:, tel:, etc.
  return /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

const Card = ({ image, title, description, category, link }) => {
  const cardContent = (
    <motion.div
      whileHover={{ scale: 1.03, y: -5 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl shadow-xl hover:shadow-xl overflow-hidden transition-shadow duration-300 h-full"
    >
      <div className="aspect-video overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
        />
      </div>

      <div className="p-4">
        {category && (
          <span className="inline-block bg-rose-100 text-rose-600 text-xs font-medium px-2 py-1 rounded-full mb-2">
            {category}
          </span>
        )}

        <h3 className="font-bold text-gray-900 text-sm md:text-base mb-2 line-clamp-2">
          {title}
        </h3>

        {description && (
          <p className="text-gray-600 text-xs md:text-sm mb-4 line-clamp-3">
            {description}
          </p>
        )}

        <motion.div
          whileHover={{ x: 5 }}
          transition={{ duration: 0.2 }}
          className="text-rose-500 text-sm font-medium flex items-center"
        >
          Ver más
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </motion.div>
      </div>
    </motion.div>
  );

  if (!link) return cardContent;

  // Externo → <a target="_blank"> | Interno → <Link>
  if (isExternalLink(link)) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full"
        aria-label={`${title} (se abre en una pestaña nueva)`}
      >
        {cardContent}
      </a>
    );
  }

  return (
    <Link href={link} className="block h-full" prefetch aria-label={title}>
      {cardContent}
    </Link>
  );
};

export default Card;