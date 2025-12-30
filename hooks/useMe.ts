'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* ---------------------------------------------
 * Roles del sistema
 * ------------------------------------------- */
export type UserRole =
  | 'admin'
  | 'supervisor'
  | 'vendedor'
  | 'rrhh';

/* ---------------------------------------------
 * Tipo Me
 * ------------------------------------------- */
export type Me = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  branches: string[];
};

/* ---------------------------------------------
 * Utils
 * ------------------------------------------- */
const normalizeBranches = (arr?: Array<string | null>) =>
  Array.from(
    new Set(
      (arr ?? [])
        .filter(Boolean)
        .map(b => String(b).toLowerCase())
    )
  ).sort();

/* ---------------------------------------------
 * Hook principal
 * ------------------------------------------- */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();

      if (!auth?.user) {
        setMe(null);
        setLoading(false);
        return;
      }

      /* ---------------------------------------------
       * 1) Intentar desde la VIEW (camino feliz)
       * ------------------------------------------- */
      const { data: vData, error: vErr } = await supabase
        .from('v_user_with_branches')
        .select('*')
        .eq('id', auth.user.id)
        .single();

      if (!vErr && vData) {
        const profile: Me = {
          id: vData.id,
          email: vData.email,
          full_name: vData.full_name,
          role: vData.role as UserRole,
          is_active: vData.is_active,
          branches: normalizeBranches(vData.branches),
        };

        if (!profile.is_active) {
          await supabase.auth.signOut();
          setMe(null);
          setLoading(false);
          return;
        }

        setMe(profile);
        setLoading(false);
        return;
      }

      /* ---------------------------------------------
       * 2) Fallback: profiles + user_branches
       * ------------------------------------------- */
      const [{ data: p, error: pErr }, { data: ub }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id,email,full_name,role,is_active')
          .eq('id', auth.user.id)
          .single(),
        supabase
          .from('user_branches')
          .select('branch')
          .eq('user_id', auth.user.id),
      ]);

      if (pErr || !p) {
        // Perfil inconsistente => cerramos sesión
        await supabase.auth.signOut();
        setMe(null);
        setLoading(false);
        return;
      }

      const profile: Me = {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role as UserRole,
        is_active: p.is_active,
        branches: normalizeBranches(ub?.map(r => r.branch)),
      };

      if (!profile.is_active) {
        await supabase.auth.signOut();
        setMe(null);
        setLoading(false);
        return;
      }

      setMe(profile);
      setLoading(false);
    } catch (err) {
      console.error('[useMe] error:', err);
      setMe(null);
      setLoading(false);
    }
  };

  /* ---------------------------------------------
   * Lifecycle
   * ------------------------------------------- */
  useEffect(() => {
    // carga inicial
    load();

    // reaccionar a auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setLoading(true);
          load();
        } else if (event === 'SIGNED_OUT' || !session) {
          setMe(null);
          setLoading(false);
        }
      }
    );

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  /* ---------------------------------------------
   * Derivados útiles
   * ------------------------------------------- */
  const firstName = useMemo(() => {
    if (!me?.full_name) return '';
    return me.full_name.split(' ').filter(Boolean)[0] ?? '';
  }, [me?.full_name]);

  const isAdmin = me?.role === 'admin';
  const isRRHH = me?.role === 'rrhh';
  const isSupervisor = me?.role === 'supervisor';

  return {
    me,
    firstName,
    loading,
    isAdmin,
    isRRHH,
    isSupervisor,
    refetch: load,
  };
}
