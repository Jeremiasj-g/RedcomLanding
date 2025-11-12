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
  last_active?: string | null; // opcional, por si lo querés usar en el cliente
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

  // -------------------------------
  // Carga de datos del usuario
  // -------------------------------
  const fetchMe = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) { setMe(null); return; }

    // 1) Vista preferida (incluye last_sign_in_at / created_at y ahora last_active si actualizaste la view)
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
        last_active: data.last_active ?? null,
      });
      return;
    }

    // 2) Fallback profiles + user_branches
    const [{ data: p }, { data: ub }] = await Promise.all([
      supabase.from('profiles').select('id,email,full_name,role,is_active,last_active').eq('id', auth.user.id).single(),
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
        last_active: p.last_active ?? null,
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

    // Eventos de autenticación: revalida suave al cambiar sesión
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setMe(null);
        return;
      }
      // SIGNED_IN / TOKEN_REFRESHED → revalida suave
      fetchMe();
    });

    // Al volver a la pestaña, revalida sin flicker
    const onVis = () => {
      if (document.visibilityState === 'visible' && bootstrapped.current) {
        fetchMe();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // -------------------------------
  // Actualizador de última actividad
  // Actualiza profiles.last_active:
  // - al montar si hay usuario
  // - cada 2 minutos
  // - al volver a la pestaña
  // - ante actividad del usuario (throttle 60s)
  // -------------------------------
  useEffect(() => {
    if (!me?.id) return;

    let lastSent = 0;
    let interval: ReturnType<typeof setInterval> | null = null;

    const updateLastActive = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastSent < 60_000) return; // throttle 60s
      lastSent = now;

      try {
        await supabase
          .from('profiles')
          .update({ last_active: new Date().toISOString() })
          .eq('id', me.id);
      } catch {
        // silencioso: no rompemos UX si falla una vez
      }
    };

    // 1) al montar (force)
    updateLastActive(true);

    // 2) cada 2 minutos
    interval = setInterval(() => updateLastActive(false), 120_000);

    // 3) visibilidad y actividad del usuario
    const onVisibility = () => {
      if (document.visibilityState === 'visible') updateLastActive(true);
    };
    const onActivity = () => updateLastActive(false);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('scroll', onActivity, { passive: true });
    window.addEventListener('pointermove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('pointermove', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [me?.id]);

  // -------------------------------
  // Sign out
  // -------------------------------
  const signOut = async () => {
    await supabase.auth.signOut();
    setMe(null);
    router.push('/login'); // evita reload duro
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
