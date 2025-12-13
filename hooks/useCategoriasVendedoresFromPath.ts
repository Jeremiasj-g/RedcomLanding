'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useCategoriasVendedores } from '@/hooks/useCategoriasVendedores';
import { getBranchKeyFromPath } from '@/utils/branchFromPath';

export function useCategoriasVendedoresFromPath() {
  const pathname = usePathname();

  const branchKey = useMemo(() => getBranchKeyFromPath(pathname), [pathname]);

  // Si no matchea, evitamos fetch (y devolvemos estado controlado)
  const hook = useCategoriasVendedores(branchKey ?? 'corrientes_masivos');

  return {
    ...hook,
    branchKey,
    isBranchValid: Boolean(branchKey),
  };
}
