'use client';

import { motion } from 'framer-motion';
import React from 'react';
import Link from 'next/link';
import { ArrowRight, Layers } from 'lucide-react';
import { CATEGORIA_ACCENTS } from '@/utils/categories';

type Props = {
  branchLabel: string;
  title?: string;
  description?: string;
  href: string;
  buttonLabel?: string;
  className?: string;
};

export default function CategoryBannerLink({
  branchLabel,
  title = 'Categorías',
  description = 'Visualizá la categoría alcanzada y el detalle por criterios.',
  href,
  buttonLabel = 'Abrir',
  className = '',
}: Props) {
  const COLORS = CATEGORIA_ACCENTS;

  return (
    <motion.button
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="group w-full"
    >

      <Link
        href={href}
        aria-label={`Abrir ${title} - ${branchLabel}`}
        className={[
          'group relative block rounded-2xl overflow-hidden',
          'border border-white/10 bg-slate-950',
          'shadow-xl transition-transform duration-200 group-hover:scale-105',
          className,
        ].join(' ')}
      >
        {/* ================= FONDO CON BLOBS ================= */}
        <div className="absolute inset-0 pointer-events-none">
          {/* base */}
          <div className="absolute inset-0 bg-slate-950" />

          {/* blobs */}
          <div className="absolute inset-0 blur-[90px]">
            {/* Senior */}
            <span
              className="absolute rounded-full"
              style={{
                width: 360,
                height: 360,
                left: '10%',
                top: '0%',
                background: COLORS.SENIOR,
                opacity: 1,
              }}
            />

            {/* Semi Senior */}
            <span
              className="absolute rounded-full"
              style={{
                width: 420,
                height: 420,
                left: '0%',
                top: '0%',
                background: COLORS.SEMI_SENIOR,
                opacity: 0.90,
              }}
            />

            {/* Junior */}
            <span
              className="absolute rounded-full"
              style={{
                width: 340,
                height: 340,
                left: '75%',
                top: '0%',
                background: COLORS.JUNIOR,
                opacity: 0.98,
              }}
            />

            {/* Plan de mejora */}
            <span
              className="absolute rounded-full"
              style={{
                width: 300,
                height: 300,
                left: '30%',
                top: '5%',
                background: COLORS.PLAN_MEJORA,
                opacity: 0.95,
              }}
            />
          </div>

          {/* vignette / overlay premium */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/60 via-slate-950/20 to-slate-950/60" />
        </div>

        {/* ================= CONTENIDO ================= */}
        <div className="relative z-10 flex items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="grid place-items-center h-12 w-12 rounded-xl bg-white/10 border border-white/10">
              <Layers className="h-5 w-5 text-white/80" />
            </div>

            <div className="min-w-0">
              <div className="text-white font-semibold truncate flex">
                {title} {branchLabel ? `· ${branchLabel}` : ''}
              </div>
              <div className="text-sm text-white/70 truncate">
                {description}
              </div>
            </div>
          </div>

          <div
            className="
            shrink-0 inline-flex items-center gap-2
            rounded-full px-4 py-2 text-sm font-medium
            bg-white/10 border border-white/15 text-white
            group-hover:bg-white/20 transition
          "
          >
            {buttonLabel}
            <ArrowRight className="h-4 w-4 opacity-90" />
          </div>
        </div>
      </Link>

    </motion.button>
  );
}
