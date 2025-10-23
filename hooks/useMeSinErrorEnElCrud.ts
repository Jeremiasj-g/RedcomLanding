'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Me = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  branches: string[];
};

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMe(null);
      setLoading(false);
      return;
    }

    // Intenta vista; cae a profiles + user_branches
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
    } else {
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
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    // carga inicial
    load();

    // reacciona a cambios de sesión
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setLoading(true);
        load();
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

  return { me, firstName, loading };
}
