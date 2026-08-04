'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import DualSpinner from '@/components/ui/DualSpinner';
import { getModulePermissionForPath } from '@/lib/module-permissions';
import { useModulePermissions } from './ModulePermissionsProvider';

export default function ModuleAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, canAccessModule } = useModulePermissions();
  const moduleKey = useMemo(() => getModulePermissionForPath(pathname), [pathname]);
  const allowed = !moduleKey || canAccessModule(moduleKey);

  useEffect(() => {
    if (!loading && moduleKey && !allowed) {
      router.replace(`/acceso-denegado?modulo=${encodeURIComponent(moduleKey)}`);
    }
  }, [allowed, loading, moduleKey, router]);

  if (loading && moduleKey) {
    return (
      <div className="grid min-h-[75vh] place-items-center">
        <DualSpinner size={60} thickness={4} />
      </div>
    );
  }

  if (!allowed) return null;
  return <>{children}</>;
}
