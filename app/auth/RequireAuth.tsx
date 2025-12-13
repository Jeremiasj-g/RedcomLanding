'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import DualSpinner from '@/components/ui/DualSpinner';
import QuadSpinner from '@/components/ui/QuadSpinner';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    if (me && me.is_active === false) router.replace('/login');
  }, [me, loading, router, pathname]);

  if (loading) {
    const isCategorias =
      pathname === '/corrientes/masivos/categorias';

    return (
      <div className="grid min-h-[80vh] place-items-center">
        {isCategorias ? (
          <QuadSpinner size={72} thickness={4} />
        ) : (
          <DualSpinner size={60} thickness={4} />
        )}
      </div>
    );
  }

  if (!me) return null;

  return <>{children}</>;
}
