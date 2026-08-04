export type ModulePermissionKey =
  | 'branch_dashboards'
  | 'news'
  | 'personal_tasks'
  | 'projects'
  | 'boards'
  | 'focus'
  | 'quarterly_indicators'
  | 'vendo_requests'
  | 'hr_panel'
  | 'tasks_panel'
  | 'focus_panel'
  | 'management_resources';

export type ModulePermissionGroup = 'Sucursales' | 'Espacio de trabajo' | 'Paneles';

export type ModulePermissionDefinition = {
  key: ModulePermissionKey;
  label: string;
  shortLabel: string;
  description: string;
  group: ModulePermissionGroup;
  routePrefixes: string[];
  defaultRoles: string[];
  branchAware?: boolean;
};

export const MODULE_PERMISSION_ROLES = [
  'admin',
  'jdv',
  'supervisor',
  'vendedor',
  'rrhh',
] as const;

export type ModulePermissionRole = (typeof MODULE_PERMISSION_ROLES)[number];

export type RoleModulePermissionRow = {
  role_key: string;
  module_key: ModulePermissionKey;
  can_access: boolean;
  updated_at?: string | null;
};

export type ModulePermissionMap = Record<ModulePermissionKey, boolean>;

const ALL_ACTIVE_ROLES = [...MODULE_PERMISSION_ROLES];

export const MODULE_PERMISSION_DEFINITIONS: ModulePermissionDefinition[] = [
  {
    key: 'branch_dashboards',
    label: 'Dashboards de sucursal',
    shortLabel: 'Sucursales',
    description:
      'Permite ingresar a los tableros comerciales y categorías de las sucursales asignadas al usuario.',
    group: 'Sucursales',
    routePrefixes: ['/corrientes', '/chaco', '/misiones', '/obera'],
    defaultRoles: ALL_ACTIVE_ROLES,
    branchAware: true,
  },
  {
    key: 'news',
    label: 'Novedades',
    shortLabel: 'Novedades',
    description: 'Acceso al feed de novedades y comunicaciones internas.',
    group: 'Espacio de trabajo',
    routePrefixes: ['/novedades'],
    defaultRoles: ALL_ACTIVE_ROLES,
  },
  {
    key: 'personal_tasks',
    label: 'Mis tareas',
    shortLabel: 'Tareas',
    description: 'Creación, seguimiento y organización personal de tareas.',
    group: 'Espacio de trabajo',
    routePrefixes: ['/tareas'],
    defaultRoles: ['admin', 'jdv', 'supervisor'],
  },
  {
    key: 'projects',
    label: 'Proyectos',
    shortLabel: 'Proyectos',
    description: 'Acceso a proyectos, asignaciones, avances y seguimiento colaborativo.',
    group: 'Espacio de trabajo',
    routePrefixes: ['/proyectos'],
    defaultRoles: ['admin', 'jdv', 'supervisor'],
  },
  {
    key: 'boards',
    label: 'Tableros',
    shortLabel: 'Tableros',
    description: 'Acceso al espacio colaborativo de tableros, listas, tarjetas y checklists.',
    group: 'Espacio de trabajo',
    routePrefixes: ['/tableros'],
    defaultRoles: ALL_ACTIVE_ROLES,
  },
  {
    key: 'focus',
    label: 'Focos',
    shortLabel: 'Focos',
    description: 'Acceso al feed operativo de focos y sus publicaciones.',
    group: 'Espacio de trabajo',
    routePrefixes: ['/focos'],
    defaultRoles: ALL_ACTIVE_ROLES,
  },
  {
    key: 'quarterly_indicators',
    label: 'Indicadores trimestrales',
    shortLabel: 'CCC Calificados',
    description: 'Acceso a CCC Calificados, MIX de artículos y DROPSIZE.',
    group: 'Espacio de trabajo',
    routePrefixes: ['/ccc-calificados'],
    defaultRoles: ['admin', 'jdv', 'supervisor', 'rrhh'],
    branchAware: true,
  },
  {
    key: 'vendo_requests',
    label: 'Alta de Vendo',
    shortLabel: 'Vendo',
    description: 'Carga y consulta del historial de solicitudes de alta y baja de dispositivos VENDO.',
    group: 'Espacio de trabajo',
    routePrefixes: ['/alta-vendo'],
    defaultRoles: ['admin', 'jdv', 'supervisor', 'rrhh'],
    branchAware: true,
  },
  {
    key: 'hr_panel',
    label: 'Panel de recursos humanos',
    shortLabel: 'RRHH',
    description: 'Administración de publicaciones, cumpleaños y contenidos de recursos humanos.',
    group: 'Paneles',
    routePrefixes: ['/rrhh'],
    defaultRoles: ['admin', 'rrhh'],
  },
  {
    key: 'tasks_panel',
    label: 'Panel de tareas',
    shortLabel: 'Panel tareas',
    description: 'Seguimiento consolidado de tareas de supervisores y jefes de venta.',
    group: 'Paneles',
    routePrefixes: ['/tareas/panel-tareas'],
    defaultRoles: ['admin', 'jdv'],
  },
  {
    key: 'focus_panel',
    label: 'Panel de focos',
    shortLabel: 'Panel focos',
    description: 'Gestión y seguimiento administrativo de focos comerciales.',
    group: 'Paneles',
    routePrefixes: ['/focos/panel'],
    defaultRoles: ['admin', 'jdv', 'supervisor'],
  },
  {
    key: 'management_resources',
    label: 'Recursos de gerencia',
    shortLabel: 'Gerencia',
    description: 'Acceso a recursos y análisis gerenciales reservados.',
    group: 'Paneles',
    routePrefixes: ['/gerencia'],
    defaultRoles: ['admin'],
  },
];

export const MODULE_PERMISSION_KEYS = MODULE_PERMISSION_DEFINITIONS.map(
  (definition) => definition.key,
);

export const MODULE_PERMISSION_BY_KEY = Object.fromEntries(
  MODULE_PERMISSION_DEFINITIONS.map((definition) => [definition.key, definition]),
) as Record<ModulePermissionKey, ModulePermissionDefinition>;

const ROUTE_MATCHERS = MODULE_PERMISSION_DEFINITIONS.flatMap((definition) =>
  definition.routePrefixes.map((prefix) => ({ key: definition.key, prefix })),
).sort((a, b) => b.prefix.length - a.prefix.length);

export function normalizeModulePermissionRole(role: string | null | undefined) {
  return String(role || '').trim().toLowerCase();
}

export function getModulePermissionForPath(
  pathname: string | null | undefined,
): ModulePermissionKey | null {
  const normalized = String(pathname || '').split('?')[0].replace(/\/$/, '') || '/';
  const match = ROUTE_MATCHERS.find(
    ({ prefix }) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
  return match?.key ?? null;
}

/**
 * Valores recomendados incorporados en el código. Funcionan como fallback
 * mientras la tabla role_module_permissions todavía no exista o no tenga filas.
 */
export function hasDefaultModulePermission(role: string, key: ModulePermissionKey) {
  const normalizedRole = normalizeModulePermissionRole(role);
  if (normalizedRole === 'admin') return true;
  return MODULE_PERMISSION_BY_KEY[key].defaultRoles.includes(normalizedRole);
}

export function getDefaultModulePermissions(role: string): ModulePermissionMap {
  return MODULE_PERMISSION_DEFINITIONS.reduce<ModulePermissionMap>(
    (acc, definition) => {
      acc[definition.key] = hasDefaultModulePermission(role, definition.key);
      return acc;
    },
    {} as ModulePermissionMap,
  );
}

/**
 * Combina los valores recomendados del código con la configuración guardada
 * para un rol. Las filas de Supabase prevalecen sobre el fallback estático.
 */
export function getConfiguredRoleModulePermissions(
  role: string,
  rows: RoleModulePermissionRow[] | null | undefined,
): ModulePermissionMap {
  const normalizedRole = normalizeModulePermissionRole(role);
  const permissions = getDefaultModulePermissions(normalizedRole);

  for (const row of rows ?? []) {
    if (normalizeModulePermissionRole(row.role_key) !== normalizedRole) continue;
    if (!MODULE_PERMISSION_BY_KEY[row.module_key]) continue;
    permissions[row.module_key] = Boolean(row.can_access);
  }

  if (normalizedRole === 'admin') {
    MODULE_PERMISSION_DEFINITIONS.forEach((definition) => {
      permissions[definition.key] = true;
    });
  }

  return permissions;
}

export function permissionMapsEqual(
  a: ModulePermissionMap,
  b: ModulePermissionMap,
) {
  return MODULE_PERMISSION_DEFINITIONS.every(
    (definition) => a[definition.key] === b[definition.key],
  );
}
