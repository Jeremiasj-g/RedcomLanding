'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace('/login');
    else if (me.role !== 'admin') router.replace('/app'); // o 403
  }, [me, loading, router]);

  if (loading || !me || me.role !== 'admin') return null;

  return <>{children}</>;
}
