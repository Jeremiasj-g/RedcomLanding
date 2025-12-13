import type { BranchKey } from '@/utils/sheetdbEndpoints';

export function getBranchKeyFromPath(pathname: string): BranchKey | null {
  // Normalizá a tu gusto (esto es un ejemplo)
  // /corrientes/masivos/categorias -> corrientes_masivos
  if (pathname.startsWith('/corrientes/masivos/categorias')) return 'corrientes_masivos';
  if (pathname.startsWith('/corrientes/refrigerados/categorias')) return 'corrientes_refrigerados';
  if (pathname.startsWith('/chaco/categorias')) return 'chaco_masivos';
  if (pathname.startsWith('/misiones/categorias')) return 'misiones_masivos';
  if (pathname.startsWith('/obera/categorias')) return 'obera_masivos';

  return null;
}
