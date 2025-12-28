'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  getCategoriaByKey,
  type CategoriaKey,
  CATEGORIA_ACCENTS,
} from '@/utils/categories';
import { useCategoriasVendedoresFromPath } from '@/hooks/useCategoriasVendedoresFromPath';
import { parseFloatSafe, parseIntSafe } from '@/utils/vendors/parsers';
import CategoriaCard from './CategoriaCard';
import CategoriaDetailsModal from './CategoriaDetailsModal';
import QuadSpinner from '@/components/ui/QuadSpinner';
import CategoriasFiltersBar from '@/components/categoria/CategoriasFiltersBar';
import CategoriasSummaryCards from '@/components/categoria/CategoriasSummaryCards';

import { AnimatePresence, motion } from 'framer-motion';

import { useSearchParams, usePathname } from 'next/navigation';
import { getBranchKeyFromPath } from '@/utils/branchFromPath';

/** =========================
 *  Normalización LIVE vs SNAPSHOT
 *  ========================= */
function normalizeCategoriaKey(raw: any): string {
  const v = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  if (v === 'PLAN_DE_MEJORA' || v === 'PLANDEMEJORA') return 'PLAN_DE_MEJORA';
  if (v === 'JUNIOR') return 'JUNIOR';
  if (v === 'SEMI_SENIOR' || v === 'SEMISENIOR') return 'SEMI_SENIOR';
  if (v === 'SENIOR') return 'SENIOR';

  return 'PLAN_DE_MEJORA';
}


function normalizeRowForUI(r: any) {
  // LIVE: suele traer categoriaKey ya armada.
  // SNAPSHOT: trae Categoria_alcanzada (SheetDB crudo).
  const categoriaKey: CategoriaKey =
    (r?.categoriaKey as CategoriaKey) ??
    normalizeCategoriaKey(r?.Categoria_alcanzada);

  // Proyección puede venir con mayúsculas/espacios, la dejamos tal cual en la row
  const proyeccion =
    r?.Categoria_segun_proyeccion ?? r?.Categoria_segun_proyeccion ?? r?.proyeccion;

  return {
    ...r,
    categoriaKey,
    Categoria_segun_proyeccion: proyeccion,
  };
}

export default function CategoriasGrid() {
  // ✅ Live (siempre lo mantenemos)
  const live = useCategoriasVendedoresFromPath();

  // ✅ Snapshot params
  const search = useSearchParams();
  const pathname = usePathname();

  const snapshotEnabled = search.get('snapshot') === '1';
  const snapshotYear = Number(search.get('year'));
  const snapshotMonth = Number(search.get('month'));

  const branchKey = useMemo(() => getBranchKeyFromPath(pathname), [pathname]);

  const [snapshotData, setSnapshotData] = useState<any[] | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  // ✅ Si snapshot está activado, traemos payload desde BD
  useEffect(() => {
    if (!snapshotEnabled) {
      setSnapshotData(null);
      setSnapshotError(null);
      setSnapshotLoading(false);
      return;
    }

    if (!branchKey || !snapshotYear || !snapshotMonth) {
      setSnapshotData(null);
      setSnapshotError('Faltan parámetros: branch/year/month');
      setSnapshotLoading(false);
      return;
    }

    const run = async () => {
      setSnapshotLoading(true);
      setSnapshotError(null);

      try {
        const res = await fetch(
          `/api/categorias/snapshot?branch_key=${encodeURIComponent(
            branchKey
          )}&year=${snapshotYear}&month=${snapshotMonth}`,
          { cache: 'no-store' }
        );

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error ?? 'No se pudo leer snapshot');
        }

        const payload = Array.isArray(json?.snapshot?.payload)
          ? json.snapshot.payload
          : [];

        setSnapshotData(payload);
      } catch (e: any) {
        setSnapshotError(e?.message ?? 'Error');
        setSnapshotData(null);
      } finally {
        setSnapshotLoading(false);
      }
    };

    run();
  }, [snapshotEnabled, branchKey, snapshotYear, snapshotMonth]);

  // ✅ filtros
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoria, setCategoria] = useState<CategoriaKey | 'ALL'>('ALL');
  const [supervisor, setSupervisor] = useState<string | 'ALL'>('ALL');

  // ✅ cuando cambias snapshot, cerramos modal por las dudas
  useEffect(() => {
    setSelectedId(null);
  }, [snapshotEnabled, snapshotYear, snapshotMonth]);

  // ✅ Fuente final a renderizar (RAW)
  const rawToRender = snapshotEnabled ? (snapshotData ?? []) : live.data;

  // ✅ Normalizamos SIEMPRE para que LIVE y SNAPSHOT tengan las mismas keys
  const dataToRender = useMemo(() => {
    return (rawToRender ?? []).map(normalizeRowForUI);
  }, [rawToRender]);

  const loadingToRender = snapshotEnabled ? snapshotLoading : live.loading;
  const errorToRender = snapshotEnabled ? snapshotError : live.error;

  // ✅ Validación de ruta (si snapshotEnabled, nos alcanza con branchKey)
  const isBranchValid = snapshotEnabled ? Boolean(branchKey) : live.isBranchValid;

  // ✅ selected / modal
  const selected = useMemo(
    () => dataToRender.find((x: any) => x.id === selectedId) ?? null,
    [dataToRender, selectedId]
  );

  // ✅ lista de supervisores (según data actual)
  const supervisors = useMemo(() => {
    const uniq = Array.from(
      new Set(
        dataToRender
          .map((r: any) => String(r.Supervisor ?? '').trim())
          .filter(Boolean)
      )
    );
    uniq.sort((a, b) => a.localeCompare(b));
    return uniq;
  }, [dataToRender]);

  // ✅ filtrado
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return dataToRender.filter((r: any) => {
      const vendedor = String(r.vendedor ?? '').toLowerCase();
      const sup = String(r.Supervisor ?? '').trim();
      const cat = r.categoriaKey as CategoriaKey;

      const okQuery = !q || vendedor.includes(q);
      const okCat = categoria === 'ALL' || cat === categoria;
      const okSup = supervisor === 'ALL' || sup === supervisor;

      return okQuery && okCat && okSup;
    });
  }, [dataToRender, query, categoria, supervisor]);

  if (!isBranchValid) {
    return (
      <div className="text-sm text-slate-600">Ruta no mapeada a sucursal.</div>
    );
  }

  if (loadingToRender) {
    return (
      <div className="grid min-h-[80vh] place-items-center">
        <QuadSpinner size={64} thickness={3} />
      </div>
    );
  }

  if (errorToRender) {
    return <div className="text-sm text-red-600">Error: {errorToRender}</div>;
  }

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

      {/* ✅ Grid animada */}
      <motion.div
        layout
        className="grid grid-cols-1 mt-16 sm:grid-cols-2 xl:grid-cols-3 gap-6 min-h-[1000px]"
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      >
        <AnimatePresence initial={false}>
          {filtered.map((row: any) => {
            const cat = getCategoriaByKey(row.categoriaKey);

            const eficiencia = parseFloatSafe(row.eficiencia);
            const cobertura = parseIntSafe(row.cobertura);
            const volumen = parseIntSafe(row.volumen);
            const pop = parseFloatSafe(row['%_POP']);
            const exhib = parseFloatSafe(row['%_Exhibición']);

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
                  accentColor={accentColor}
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
