'use client';

import { useAuth } from '../app/auth/AuthProvider'; // ajustá el path si hace falta
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

type RoleCode = 'admin' | 'supervisor' | 'vendedor' | 'rrhh';

type RequireAuthProps = {
  children: React.ReactNode;
  /** roles permitidos, si se omite cualquier rol logueado pasa */
  roles?: RoleCode[];
  /** sucursales permitidas, si se omite se ignora */
  branches?: string[];
};

export function RequireAuth({ children, roles, branches }: RequireAuthProps) {
  const { me, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // 1) no logueado → al login
    if (!me) {
      const search = new URLSearchParams({ redirectTo: pathname }).toString();
      router.replace(`/login?${search}`);
      return;
    }

    // 2) filtro por rol
    if (roles && roles.length > 0 && !roles.includes(me.role)) {
      router.replace('/acceso-denegado'); // o '/'
      return;
    }

    // 3) filtro por sucursal (admin siempre pasa)
    if (branches && branches.length > 0 && me.role !== 'admin') {
      const hasBranch = me.branches.some(b =>
        branches.map(x => x.toLowerCase()).includes(b.toLowerCase())
      );
      if (!hasBranch) {
        router.replace('/acceso-denegado');
        return;
      }
    }
  }, [me, loading, roles, branches, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-slate-600 animate-spin" />
      </div>
    );
  }

  // Mientras hace el redirect no mostramos nada
  if (!me) return null;

  return <>{children}</>;
}
