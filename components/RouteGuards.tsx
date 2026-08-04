'use client';

import { useAuth } from '../app/auth/AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { getModulePermissionForPath } from '@/lib/module-permissions';
import { useModulePermissions } from '@/components/permissions/ModulePermissionsProvider';

type RequireAuthProps = {
  children: React.ReactNode;
  /** roles permitidos, si se omite cualquier rol logueado pasa */
  roles?: string[];
  /** sucursales permitidas, si se omite se ignora */
  branches?: string[];
};

export function RequireAuth({ children, roles, branches }: RequireAuthProps) {
  const { me, loading } = useAuth();
  const { loading: permissionsLoading, canAccessModule } = useModulePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const moduleKey = useMemo(() => getModulePermissionForPath(pathname), [pathname]);

  // Un permiso de módulo, ya sea heredado del rol o configurado como
  // excepción individual, puede habilitar una ruta aunque el componente
  // histórico todavía tenga una lista fija de roles.
  const modulePermissionGrant = Boolean(moduleKey && canAccessModule(moduleKey));
  const roleAllowed = Boolean(
    !roles || roles.length === 0 || (me && roles.includes(me.role)) || modulePermissionGrant,
  );
  const branchAllowed = Boolean(
    !branches ||
      branches.length === 0 ||
      me?.role === 'admin' ||
      me?.branches.some((branch) =>
        branches.map((value) => value.toLowerCase()).includes(branch.toLowerCase()),
      ),
  );

  useEffect(() => {
    if (loading || (moduleKey && permissionsLoading)) return;

    if (!me) {
      const search = new URLSearchParams({ redirectTo: pathname }).toString();
      router.replace(`/login?${search}`);
      return;
    }

    if (!roleAllowed || !branchAllowed) {
      router.replace('/acceso-denegado');
    }
  }, [
    branchAllowed,
    loading,
    me,
    moduleKey,
    pathname,
    permissionsLoading,
    roleAllowed,
    router,
  ]);

  if (loading || (moduleKey && permissionsLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
      </div>
    );
  }

  if (!me || !roleAllowed || !branchAllowed) return null;
  return <>{children}</>;
}
