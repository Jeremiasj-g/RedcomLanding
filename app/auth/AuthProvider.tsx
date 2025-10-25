'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
  loading: boolean;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setMe(null); setLoading(false); return; }

    // Primero intento la vista agregada v_user_with_branches
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
      setLoading(false);
      return;
    }

    // Fallback (profiles + user_branches)
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
    setLoading(false);
  };

  useEffect(() => {
    loadMe();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setLoading(true);
        loadMe();
      } else {
        setMe(null);
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setMe(null);
  };

  const value = useMemo<AuthCtx>(() => ({
    me, loading, signOut, refreshMe: loadMe,
  }), [me, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>.');
  return ctx;
}
