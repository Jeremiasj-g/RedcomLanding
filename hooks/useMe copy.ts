'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Me = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  branches: string[];
};

const normalizeBranches = (arr: string[] | null | undefined) =>
  Array.from(new Set((arr ?? []).map(b => String(b).toLowerCase()))).sort();

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const reqIdRef = useRef(0); // evita condiciones de carrera

  const load = async () => {
    const reqId = ++reqIdRef.current;
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (reqId !== reqIdRef.current) return;
        setMe(null);
        setLoading(false);
        return;
      }

      // 1) Intentar vista
      const { data: vData, error: vErr } = await supabase
        .from('v_user_with_branches')
        .select('*')
        .eq('id', auth.user.id)
        .single();

      if (reqId !== reqIdRef.current) return;

      if (!vErr && vData) {
        const profile: Me = {
          id: vData.id,
          email: vData.email,
          full_name: vData.full_name,
          role: vData.role,
          is_active: vData.is_active,
          branches: normalizeBranches(vData.branches ?? []),
        };

        if (profile.is_active === false) {
          await supabase.auth.signOut();
          setMe(null);
          setLoading(false);
          return;
        }

        setMe(profile);
        setLoading(false);
        return;
      }

      // 2) Fallback: profiles + user_branches
      const [{ data: p, error: pErr }, { data: ub, error: ubErr }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id,email,full_name,role,is_active')
          .eq('id', auth.user.id)
          .single(),
        supabase.from('user_branches').select('branch').eq('user_id', auth.user.id),
      ]);

      if (reqId !== reqIdRef.current) return;

      if (pErr) {
        // si no se puede leer perfil, por seguridad cerrar sesión
        await supabase.auth.signOut();
        setMe(null);
        setLoading(false);
        return;
      }

      const profile: Me = {
        id: p!.id,
        email: p!.email,
        full_name: p!.full_name,
        role: p!.role,
        is_active: p!.is_active,
        branches: normalizeBranches((ubErr ? [] : (ub ?? []).map(r => String(r.branch))) as string[]),
      };

      if (profile.is_active === false) {
        await supabase.auth.signOut();
        setMe(null);
        setLoading(false);
        return;
      }

      setMe(profile);
      setLoading(false);
    } catch {
      // fallback defensivo
      setMe(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    // carga inicial
    load();

    // reacciona a cambios de sesión
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setLoading(true);
        await load();
      } else if (event === 'SIGNED_OUT' || !session) {
        setMe(null);
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const firstName = useMemo(
    () => (me?.full_name ?? '').split(' ').filter(Boolean)[0] ?? '',
    [me?.full_name]
  );

  return { me, firstName, loading, refetch: load };
}
