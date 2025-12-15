'use client';

import React, { useMemo, useState } from 'react';
import {
  getCategoriaByKey,
  type CategoriaKey,
  CATEGORIA_ACCENTS, // ✅ IMPORTANTE
} from '@/utils/categories';
import { useCategoriasVendedoresFromPath } from '@/hooks/useCategoriasVendedoresFromPath';
import { parseFloatSafe, parseIntSafe } from '@/utils/vendors/parsers';
import CategoriaCard from './CategoriaCard';
import CategoriaDetailsModal from './CategoriaDetailsModal';
import QuadSpinner from '@/components/ui/QuadSpinner';
import CategoriasFiltersBar from '@/components/categoria/CategoriasFiltersBar';
import CategoriasSummaryCards from '@/components/categoria/CategoriasSummaryCards';

import { AnimatePresence, motion } from 'framer-motion';

export default function CategoriasGrid() {
  const { data, loading, error, isBranchValid } = useCategoriasVendedoresFromPath();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ✅ filtros
  const [query, setQuery] = useState('');
  const [categoria, setCategoria] = useState<CategoriaKey | 'ALL'>('ALL');
  const [supervisor, setSupervisor] = useState<string | 'ALL'>('ALL');

  const selected = useMemo(
    () => data.find((x) => x.id === selectedId) ?? null,
    [data, selectedId],
  );

  const supervisors = useMemo(() => {
    const uniq = Array.from(
      new Set(
        data
          .map((r: any) => String(r.Supervisor ?? '').trim())
          .filter(Boolean),
      ),
    );
    uniq.sort((a, b) => a.localeCompare(b));
    return uniq;
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return data.filter((r: any) => {
      const vendedor = String(r.vendedor ?? '').toLowerCase();
      const sup = String(r.Supervisor ?? '').trim();
      const cat = r.categoriaKey as CategoriaKey;

      const okQuery = !q || vendedor.includes(q);
      const okCat = categoria === 'ALL' || cat === categoria;
      const okSup = supervisor === 'ALL' || sup === supervisor;

      return okQuery && okCat && okSup;
    });
  }, [data, query, categoria, supervisor]);

  if (!isBranchValid) {
    return <div className="text-sm text-slate-600">Ruta no mapeada a sucursal.</div>;
  }

  if (loading) {
    return (
      <div className="grid min-h-[80vh] place-items-center">
        <QuadSpinner size={64} thickness={3} />
      </div>
    );
  }

  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;

  return (
    <>
      {/* ✅ Barra de filtros */}
      <div className="mt-16">
        <CategoriasFiltersBar
          query={query}
          onQueryChange={setQuery}
          categoria={categoria}
          onCategoriaChange={setCategoria}
          supervisor={supervisor}
          onSupervisorChange={setSupervisor}
          supervisors={supervisors}
        />
      </div>

      {/* ✅ Summary (usa filtered para respetar filtros) */}
      <div className="mt-6">
        <CategoriasSummaryCards rows={filtered} />
      </div>

      {/* ✅ Grid animada (reacomodo suave) */}
      <motion.div
        layout
        className="grid grid-cols-1 mt-16 sm:grid-cols-2 xl:grid-cols-3 gap-6 min-h-[1000px]"
        transition={{ type: 'spring', stiffness: 500, damping: 28 }} // ✅ más “snappy”
      >
        <AnimatePresence initial={false}>
          {filtered.map((row: any) => {
            const cat = getCategoriaByKey(row.categoriaKey);

            const eficiencia = parseFloatSafe(row.eficiencia);
            const cobertura = parseIntSafe(row.cobertura);
            const volumen = parseIntSafe(row.volumen);
            const pop = parseFloatSafe(row['%_POP']);
            const exhib = parseFloatSafe(row['%_Exhibición']);

            // ✅ HEX REAL para SVG (no tailwind)
            const accentColor =
              CATEGORIA_ACCENTS?.[cat.key as CategoriaKey] ?? '#0f172a';

            return (
              <motion.div
                key={row.id}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <CategoriaCard
                  id={row.id}
                  vendedor={row.vendedor}
                  categoriaLabel={cat.label}
                  categoriaColor={cat.color}
                  accentColor={accentColor} // ✅ NUEVO PROP
                  eficiencia={eficiencia}
                  cobertura={cobertura}
                  volumen={volumen}
                  pop={pop}
                  exhibicion={exhib}
                  onDetails={() => setSelectedId(row.id)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* ✅ Modal */}
      <CategoriaDetailsModal
        open={Boolean(selected)}
        onOpenChange={(v) => !v && setSelectedId(null)}
        row={selected}
      />
    </>
  );
}
