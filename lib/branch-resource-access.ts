import type { BranchResource } from '@/lib/branchResources';
import type { ModulePermissionKey } from '@/lib/module-permissions';

/** Resolución única de visibilidad de herramientas:
 * 1) Administradores.
 * 2) Selección explícita de roles del recurso (prevalece sobre permisos anteriores).
 * 3) Recursos históricos: permisos efectivos del panel de administración, incluidos overrides.
 * 4) Sin configuración: visible.
 */
export function canViewBranchResource(
  resource: Pick<BranchResource, 'allowed_roles' | 'permission_key'>,
  role: string | null | undefined,
  canAccessModule: (key: ModulePermissionKey) => boolean,
): boolean {
  if (role === 'admin') return true;
  if (resource.allowed_roles != null) return resource.allowed_roles.includes(role ?? '');
  if (resource.permission_key) return canAccessModule(resource.permission_key);
  return true;
}
