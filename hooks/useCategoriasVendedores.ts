'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CategoriaKey } from '@/utils/categories';
import { SHEETDB_ENDPOINTS, type BranchKey } from '@/utils/sheetdbEndpoints';

export type VendedorCategoriaRow = {
  Supervisor: string;
  id: string;
  vendedor: string;

  facturacion: string;
  total_de_ventas: string;
  visitados: string;

  venta_a_distancia: string;
  venta_en_el_pdv: string;
  visitas_planeadas: string;

  efectividad: string;
  porcentaje_de_ventas_en_el_PDV: string;
  porcentaje_de_ventas_a_distancia: string;

  eficiencia: string;
  horas_promedio_ruta: string;
  cumple_horario_ruta: string; // "TRUE"/"FALSE"
  cumple_efectividad: string;  // "TRUE"/"FALSE"

  cobertura: string;
  volumen: string;

  dias_considerados: string;
  promedio_boletas_diarias: string;
  facturacion_promedio: string;
  promedio_$_boletas: string;

  Categoria_segun_proyeccion: string;

  '%_POP': string;
  '%_Exhibición': string;

  Categoria_alcanzada: string;

  // ✅ agregado: normalizado
  categoriaKey: CategoriaKey;
};

const normalizeCategoria = (raw: string | null | undefined): CategoriaKey => {
  const v = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  // ej: "PLAN DE MEJORA" -> "PLAN_DE_MEJORA"
  if (v === 'PLAN_DE_MEJORA') return 'PLAN_MEJORA';
  if (v === 'SEMI_SENIOR') return 'SEMI_SENIOR';
  if (v === 'SEMI-SENIOR') return 'SEMI_SENIOR';
  if (v === 'JUNIOR') return 'JUNIOR';
  if (v === 'SENIOR') return 'SENIOR';

  // fallback
  return 'PLAN_MEJORA';
};

export function useCategoriasVendedores(branch: BranchKey) {
  const url = useMemo(() => SHEETDB_ENDPOINTS[branch], [branch]);

  const [data, setData] = useState<VendedorCategoriaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetcher = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal,
        headers: { 'Accept': 'application/json' },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = (await res.json()) as any[];

      const normalized: VendedorCategoriaRow[] = (json ?? []).map((row) => ({
        ...row,
        categoriaKey: normalizeCategoria(row?.Categoria_alcanzada),
      }));

      setData(normalized);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e?.message ?? 'Error al cargar categorías');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetcher(ctrl.signal);
    return () => ctrl.abort();
  }, [fetcher]);

  const refetch = useCallback(() => {
    const ctrl = new AbortController();
    fetcher(ctrl.signal);
    // si querés cancelación manual después, retornamos el abort:
    return () => ctrl.abort();
  }, [fetcher]);

  return { data, loading, error, refetch, url };
}
