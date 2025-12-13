export type CategoriaKey =
  | 'PLAN_MEJORA'
  | 'JUNIOR'
  | 'SEMI_SENIOR'
  | 'SENIOR';

export type CategoriaConfig = {
  key: CategoriaKey;
  label: string;

  // Reglas
  facturacion: CategoriaKey;
  horario_ruta: boolean;
  efectividad: boolean;

  // ✅ NUEVO: requisitos mínimos globales (o por categoría si querés)
  horas_ruta_min: string;     // "5:20:00"
  efectividad_min: number;    // 89

  eficiencia: number;
  cobertura: number;
  volumen: number;
  pop: number;
  exhibicion: number;
  total: number;

  // UI
  color: {
    bg: string;
    text: string;
    border: string;
  };
};

export const CATEGORIA_ACCENTS = {
  PLAN_MEJORA: '#ef4444',   // red-500
  JUNIOR: '#eab308',        // yellow-500
  SEMI_SENIOR: '#34d399',   // emerald-400
  SENIOR: '#047857',        // emerald-700
} as const;

export const CATEGORIA_RANK: Record<string, number> = {
  PLAN_MEJORA: 0,
  JUNIOR: 1,
  SEMI_SENIOR: 2,
  SENIOR: 3,
};

export const PUNTOS = {
  FACTURACION: 30,
  EFICIENCIA: 15,
  COBERTURA: 15,
  VOLUMEN: 15,
  POP: 5,
  EXHIBICION: 5,
};

export const CATEGORIA_COLORS = {
  PLAN_MEJORA: {
    bg: 'bg-red-500/10',
    text: 'text-red-600',
    border: 'border-red-500/30',
  },
  JUNIOR: {
    bg: 'bg-yellow-400/10',
    text: 'text-yellow-600',
    border: 'border-yellow-500/30',
  },
  SEMI_SENIOR: {
    bg: 'bg-emerald-400/10',
    text: 'text-emerald-600',
    border: 'border-emerald-500/30',
  },
  SENIOR: {
    bg: 'bg-emerald-700/10',
    text: 'text-emerald-700',
    border: 'border-emerald-700/30',
  },
};

export const CATEGORIAS: CategoriaConfig[] = [
  {
    key: 'SENIOR',
    label: 'Senior',
    facturacion: 'SENIOR',
    horario_ruta: true,
    efectividad: true,
    horas_ruta_min: '5:20:00',
    efectividad_min: 89,
    eficiencia: 84,
    cobertura: 7,
    volumen: 7,
    pop: 79.99,
    exhibicion: 69.99,
    total: 62.75,
    color: CATEGORIA_COLORS.SENIOR,
  },
  {
    key: 'SEMI_SENIOR',
    label: 'Semi Senior',
    facturacion: 'SEMI_SENIOR',
    horario_ruta: true,
    efectividad: true,
    horas_ruta_min: '5:20:00',
    efectividad_min: 89,
    eficiencia: 79,
    cobertura: 6,
    volumen: 6,
    pop: 74.99,
    exhibicion: 59.99,
    total: 62.75,
    color: CATEGORIA_COLORS.SEMI_SENIOR,
  },
  {
    key: 'JUNIOR',
    label: 'Junior',
    facturacion: 'JUNIOR',
    horario_ruta: true,
    efectividad: true,
    horas_ruta_min: '5:20:00',
    efectividad_min: 89,
    eficiencia: 74,
    cobertura: 5,
    volumen: 5,
    pop: 69.99,
    exhibicion: 49.99,
    total: 62.75,
    color: CATEGORIA_COLORS.JUNIOR,
  },
];


export const PLAN_MEJORA: CategoriaConfig = {
  key: 'PLAN_MEJORA',
  label: 'Plan de Mejora',
  facturacion: 'PLAN_MEJORA',
  horario_ruta: false,
  efectividad: false,
  horas_ruta_min: '5:20:00',
  efectividad_min: 89,
  eficiencia: 0,
  cobertura: 0,
  volumen: 0,
  pop: 0,
  exhibicion: 0,
  total: 0,
  color: CATEGORIA_COLORS.PLAN_MEJORA,
};


export const getCategoriaByKey = (key: CategoriaKey) =>
  CATEGORIAS.find(c => c.key === key) ?? PLAN_MEJORA;
