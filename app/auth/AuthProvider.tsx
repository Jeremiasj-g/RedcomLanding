'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Me = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  branches: string[];
  last_active?: string | null;
} | null;

type AuthCtx = {
  me: Me;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

function normalizeBranches(values?: Array<string | null>) {
  return Array.from(
    new Set(
      (values ?? [])
        .filter(Boolean)
        .map((value) => String(value).toLowerCase()),
    ),
  ).sort();
}

function sameUserState(previous: Me, next: Me) {
  if (previous === next) return true;
  if (!previous || !next) return false;

  return (
    previous.id === next.id &&
    previous.email === next.email &&
    previous.full_name === next.full_name &&
    previous.role === next.role &&
    previous.is_active === next.is_active &&
    previous.last_active === next.last_active &&
    previous.branches.length === next.branches.length &&
    previous.branches.every((branch, index) => branch === next.branches[index])
  );
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const commitMe = useCallback((next: Me) => {
    if (!mountedRef.current) return;
    setMe((previous) => (sameUserState(previous, next) ? previous : next));
  }, []);

  const fetchMe = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();

    if (!auth?.user) {
      commitMe(null);
      return;
    }

    const { data, error } = await supabase
      .from('v_user_with_branches')
      .select('*')
      .eq('id', auth.user.id)
      .single();

    if (!error && data) {
      commitMe({
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        is_active: data.is_active,
        branches: normalizeBranches(data.branches),
        last_active: data.last_active ?? null,
      });
      return;
    }

    const [{ data: profile }, { data: userBranches }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,email,full_name,role,is_active,last_active')
        .eq('id', auth.user.id)
        .single(),
      supabase.from('user_branches').select('branch').eq('user_id', auth.user.id),
    ]);

    if (!profile) {
      commitMe(null);
      return;
    }

    commitMe({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      is_active: profile.is_active,
      branches: normalizeBranches(
        (userBranches ?? []).map((row: { branch?: string | null }) => row.branch ?? null),
      ),
      last_active: profile.last_active ?? null,
    });
  }, [commitMe]);

  useEffect(() => {
    mountedRef.current = true;

    const bootstrap = async () => {
      try {
        await fetchMe();
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        commitMe(null);
        return;
      }

      // TOKEN_REFRESHED ocurre de forma automática, frecuentemente al volver a una
      // pestaña. La identidad y el perfil no cambiaron, por lo que no recargamos
      // el árbol completo de la aplicación.
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        window.setTimeout(() => {
          void fetchMe();
        }, 0);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.subscription.unsubscribe();
    };
  }, [commitMe, fetchMe]);

  useEffect(() => {
    if (!me?.id) return;

    let lastSent = 0;
    const updateLastActive = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastSent < 60_000) return;
      lastSent = now;

      try {
        await supabase
          .from('profiles')
          .update({ last_active: new Date().toISOString() })
          .eq('id', me.id);
      } catch {
        // La actividad es informativa y nunca debe interrumpir la interfaz.
      }
    };

    void updateLastActive(true);
    const interval = window.setInterval(() => {
      void updateLastActive(false);
    }, 120_000);

    const onActivity = () => {
      void updateLastActive(false);
    };

    window.addEventListener('scroll', onActivity, { passive: true });
    window.addEventListener('pointermove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('pointermove', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [me?.id]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    commitMe(null);
    router.push('/login');
  }, [commitMe, router]);

  const value = useMemo<AuthCtx>(
    () => ({
      me,
      loading,
      signOut,
      refreshMe: fetchMe,
    }),
    [fetchMe, loading, me, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>.');
  return ctx;
}
