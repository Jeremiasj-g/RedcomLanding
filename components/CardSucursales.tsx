"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CalendarClock,
  ExternalLink,
  FileSpreadsheet,
  Layers,
  PieChart,
  Receipt,
  Target,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

function isExternalLink(href = "") {
  return /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

type ResourceIcon =
  | "pie-chart"
  | "user-plus"
  | "calendar-clock"
  | "users"
  | "layers"
  | "receipt"
  | "target"
  | "spreadsheet";

type ResourceAccent =
  | "blue"
  | "green"
  | "violet"
  | "amber"
  | "red"
  | "slate"
  | "cyan";

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
  variant?: "legacy" | "resource";
  icon?: ResourceIcon;
  accent?: ResourceAccent;
  actionLabel?: string;
};

const resourceIcons: Record<ResourceIcon, LucideIcon> = {
  "pie-chart": PieChart,
  "user-plus": UserPlus,
  "calendar-clock": CalendarClock,
  users: Users,
  layers: Layers,
  receipt: Receipt,
  target: Target,
  spreadsheet: FileSpreadsheet,
};

const accentStyles: Record<
  ResourceAccent,
  { icon: string; category: string; action: string; hoverBorder: string }
> = {
  blue: {
    icon: "bg-blue-50 text-blue-600 ring-blue-100",
    category: "text-blue-600",
    action: "text-blue-600",
    hoverBorder: "hover:border-blue-200",
  },
  green: {
    icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    category: "text-emerald-600",
    action: "text-emerald-600",
    hoverBorder: "hover:border-emerald-200",
  },
  violet: {
    icon: "bg-violet-50 text-violet-600 ring-violet-100",
    category: "text-violet-600",
    action: "text-violet-600",
    hoverBorder: "hover:border-violet-200",
  },
  amber: {
    icon: "bg-amber-50 text-amber-600 ring-amber-100",
    category: "text-amber-600",
    action: "text-amber-600",
    hoverBorder: "hover:border-amber-200",
  },
  red: {
    icon: "bg-red-50 text-red-600 ring-red-100",
    category: "text-red-600",
    action: "text-red-600",
    hoverBorder: "hover:border-red-200",
  },
  slate: {
    icon: "bg-slate-100 text-slate-600 ring-slate-200",
    category: "text-slate-500",
    action: "text-slate-700",
    hoverBorder: "hover:border-slate-300",
  },
  cyan: {
    icon: "bg-cyan-50 text-cyan-600 ring-cyan-100",
    category: "text-cyan-600",
    action: "text-cyan-600",
    hoverBorder: "hover:border-cyan-200",
  },
};

const Card = ({
  image,
  title,
  description,
  category,
  link,
  gradientFrom = "from-slate-950",
  gradientVia = "via-slate-800",
  gradientTo = "to-slate-900",
  borderColor = "#57C2E8",
  variant = "legacy",
  icon = "spreadsheet",
  accent = "blue",
  actionLabel = "Abrir herramienta",
}: CardProps) => {
  if (variant === "resource") {
    const Icon = resourceIcons[icon] ?? FileSpreadsheet;
    const palette = accentStyles[accent] ?? accentStyles.blue;

    const resourceCard = (
      <motion.article
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.99 }}
        transition={{ duration: 0.1, ease: "easeOut" }}
        className={`group flex h-full min-h-[245px] flex-col rounded-2xl border shadow-2xl border-slate-200/90 bg-white p-6 transition-[border-color,box-shadow] duration-300 ${palette.hoverBorder} hover:shadow-[0_18px_45px_rgba(15,23,42,0.10)]`}
      >
        <div className="mb-7 flex items-start justify-between gap-4">
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ${palette.icon}`}
          >
            <Icon className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
          </span>

          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-colors duration-200 group-hover:border-slate-300 group-hover:bg-slate-50 group-hover:text-slate-700">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>

        {category && (
          <span
            className={`mb-2 text-[11px] font-bold uppercase tracking-[0.14em] ${palette.category}`}
          >
            {category}
          </span>
        )}

        <h3 className="text-xl font-bold tracking-tight text-slate-900">
          {title}
        </h3>

        {description && (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500">
            {description}
          </p>
        )}

        <span
          className={`mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold ${palette.action}`}
        >
          {actionLabel}
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
            aria-hidden="true"
          />
        </span>
      </motion.article>
    );

    if (isExternalLink(link)) {
      return (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="block h-full rounded-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20"
          aria-label={`${title} (se abre en una pestaña nueva)`}
        >
          {resourceCard}
        </a>
      );
    }

    return (
      <Link
        href={link || "#"}
        className="block h-full rounded-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20"
        prefetch
        aria-label={title}
      >
        {resourceCard}
      </Link>
    );
  }

  const cardBase = (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
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

      {category && (
        <span
          className="
            absolute top-6 left-8
            text-[11px] md:text-xs border border-[#57C2E8] rounded-xl px-2 py-0.5
            bg-black/20 text-[#57C2E8] backdrop-blur-sm
            z-10
            transition-opacity duration-150
            group-hover:opacity-0
          "
        >
          {category}
        </span>
      )}

      {description && (
        <p
          className="
            mb-3 max-w-[70%] text-xs md:text-sm text-white/85
            z-10 relative
            transition-opacity duration-150
            group-hover:opacity-0
          "
        >
          {description}
        </p>
      )}

      <span
        className="
          absolute bottom-4 left-8
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

  return (
    <Link
      href={link || "#"}
      className="block h-full"
      prefetch
      aria-label={title}
    >
      {cardBase}
    </Link>
  );
};

export default Card;
