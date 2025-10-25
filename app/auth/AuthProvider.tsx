'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Me = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  branches: string[];
} | null;

type AuthCtx = {
  me: Me;
  loading: boolean;                   // solo true en el primer boot
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;     // revalida sin flicker
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);      // solo para el arranque
  const bootstrapped = useRef(false);                // evita flashes luego del primer load

  const fetchMe = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setMe(null); return; }

    // 1) Vista preferida
    const { data, error } = await supabase
      .from('v_user_with_branches')
      .select('*')
      .eq('id', auth.user.id)
      .single();

    if (!error && data) {
      setMe({
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        is_active: data.is_active,
        branches: (data.branches ?? []).map((x: string) => x?.toLowerCase?.() ?? x),
      });
      return;
    }

    // 2) Fallback profiles + user_branches
    const [{ data: p }, { data: ub }] = await Promise.all([
      supabase.from('profiles').select('id,email,full_name,role,is_active').eq('id', auth.user.id).single(),
      supabase.from('user_branches').select('branch').eq('user_id', auth.user.id),
    ]);

    if (p) {
      setMe({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role,
        is_active: p.is_active,
        branches: (ub ?? []).map((r: any) => String(r.branch).toLowerCase()),
      });
    } else {
      setMe(null);
    }
  };

  const loadFirstTime = async () => {
    await fetchMe();
    setLoading(false);
    bootstrapped.current = true;
  };

  useEffect(() => {
    loadFirstTime();

    // auth events: actualizar en silencio (sin setLoading(true))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setMe(null);
        return;
      }
      // SIGNED_IN / TOKEN_REFRESHED → revalida suave
      fetchMe();
    });

    // al volver a la pestaña, revalida sin flicker
    const onVis = () => {
      if (document.visibilityState === 'visible' && bootstrapped.current) {
        fetchMe();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setMe(null);
    router.push('/login'); // sin window.location.replace (evita reload duro)
  };

  const value = useMemo<AuthCtx>(
    () => ({
      me,
      loading,
      signOut,
      refreshMe: fetchMe,
    }),
    [me, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>.');
  return ctx;
}
