'use client';

import React, { useMemo, useState } from 'react';
import { getCategoriaByKey } from '@/utils/categories';
import { useCategoriasVendedoresFromPath } from '@/hooks/useCategoriasVendedoresFromPath';
import { parseFloatSafe, parseIntSafe } from '@/utils/vendors/parsers';
import CategoriaCard from './CategoriaCard';
import CategoriaDetailsModal from './CategoriaDetailsModal';
import QuadSpinner from '@/components/ui/QuadSpinner';

export default function CategoriasGrid() {
  const { data, loading, error, isBranchValid } = useCategoriasVendedoresFromPath();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => data.find(x => x.id === selectedId) ?? null,
    [data, selectedId]
  );

  if (!isBranchValid) {
    return <div className="text-sm text-slate-600">Ruta no mapeada a sucursal.</div>;
  }

  if (loading) return <div className="grid min-h-[80vh] place-items-center"><QuadSpinner size={64} thickness={3} /></div>;
  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;

  return (
    <>
      <div className="grid grid-cols-1 mt-24 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {data.map((row) => {
          const cat = getCategoriaByKey(row.categoriaKey);

          // Ejemplos de métricas para pintar la card
          const eficiencia = parseFloatSafe(row.eficiencia);
          const cobertura = parseIntSafe(row.cobertura);
          const volumen = parseIntSafe(row.volumen);
          const pop = parseFloatSafe(row['%_POP']);
          const exhib = parseFloatSafe(row['%_Exhibición']);

          return (
            <CategoriaCard
              key={row.id}
              id={row.id}
              vendedor={row.vendedor}
              categoriaLabel={cat.label}
              categoriaColor={cat.color} // {bg,text,border}
              eficiencia={eficiencia}
              cobertura={cobertura}
              volumen={volumen}
              pop={pop}
              exhibicion={exhib}
              onDetails={() => setSelectedId(row.id)}
            />
          );
        })}
      </div>

      <CategoriaDetailsModal
        open={Boolean(selected)}
        onOpenChange={(v) => !v && setSelectedId(null)}
        row={selected}
      />
    </>
  );
}
