"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Briefcase,
  LayoutGrid,
  Search,
  Settings,
  SlidersHorizontal,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import CardSucursales from "@/components/CardSucursales";
import Container from "@/components/Container";

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

type ResourceProduct = {
  id: string | number;
  title: string;
  description?: string;
  category?: string;
  group?: string;
  link?: string;
  image?: string;
  icon?: ResourceIcon;
  accent?: ResourceAccent;
  actionLabel?: string;
};

type BranchResourcesSectionProps = {
  branchName: string;
  products: ResourceProduct[];
};

type FilterOption = {
  label: string;
  icon: LucideIcon;
};

const filters: FilterOption[] = [
  { label: "Todas", icon: LayoutGrid },
  { label: "Ventas", icon: TrendingUp },
  { label: "Reportes", icon: BarChart3 },
  { label: "Administración", icon: Briefcase },
  { label: "Operaciones", icon: Settings },
  { label: "RRHH", icon: Users },
];

function normalizeText(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function BranchResourcesSection({
  branchName,
  products,
}: BranchResourcesSectionProps) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todas");

  const visibleFilters = useMemo(() => {
    const groups = new Set(
      products.map((product) => product.group).filter(Boolean),
    );

    return filters.filter(
      (filter) => filter.label === "Todas" || groups.has(filter.label),
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return products.filter((product) => {
      const matchesFilter =
        activeFilter === "Todas" || product.group === activeFilter;

      const searchableText = normalizeText(
        [product.title, product.description, product.category, product.group]
          .filter(Boolean)
          .join(" "),
      );

      const matchesSearch =
        normalizedQuery.length === 0 ||
        searchableText.includes(normalizedQuery);

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, products, query]);

  return (
    <section className="border-b border-slate-200/80 bg-[#f6f8fb] py-12 sm:py-16 lg:py-20">
      <Container>
        <div className="mb-9 flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                Panel interno
              </span>
              <span
                className="h-1 w-1 rounded-full bg-slate-300"
                aria-hidden="true"
              />
              <span className="text-xs font-semibold text-slate-500">
                Sucursal {branchName}
              </span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-[42px]">
              Herramientas y recursos
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Accedé rápidamente a las aplicaciones y planillas utilizadas
              diariamente en Redcom.
            </p>
          </div>

          <div className="relative w-full lg:max-w-[410px]">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar una herramienta..."
              className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
              aria-label="Buscar una herramienta"
            />

            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mb-7 flex items-center gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleFilters.map(({ label, icon: Icon }) => {
            const isActive = activeFilter === label;

            return (
              <button
                key={label}
                type="button"
                onClick={() => setActiveFilter(label)}
                className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "border-blue-200 bg-blue-50 text-blue-600 shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
                aria-pressed={isActive}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>

        {filteredProducts.length > 0 ? (
          <motion.div
            layout
            className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            {filteredProducts.map((product, index) => (
              <motion.div
                layout
                key={`${product.id}-${product.title}`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.04 }}
              >
                <CardSucursales {...product} variant="resource" />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              No encontramos herramientas
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              Probá con otra búsqueda o seleccioná una categoría diferente.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveFilter("Todas");
              }}
              className="mt-5 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </Container>
    </section>
  );
}
