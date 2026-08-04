'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type UserRole = string;

export type Me = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  branches: string[];
};

const normalizeBranches = (arr?: Array<string | null>) =>
  Array.from(
    new Set(
      (arr ?? [])
        .filter(Boolean)
        .map((branch) => String(branch).toLowerCase()),
    ),
  ).sort();

function sameProfile(previous: Me | null, next: Me | null) {
  if (previous === next) return true;
  if (!previous || !next) return false;

  return (
    previous.id === next.id &&
    previous.email === next.email &&
    previous.full_name === next.full_name &&
    previous.role === next.role &&
    previous.is_active === next.is_active &&
    previous.branches.length === next.branches.length &&
    previous.branches.every((branch, index) => branch === next.branches[index])
  );
}

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const initialLoadFinishedRef = useRef(false);

  const commitProfile = useCallback((next: Me | null) => {
    if (!mountedRef.current) return;
    setMe((previous) => (sameProfile(previous, next) ? previous : next));
  }, []);

  const load = useCallback(
    async (showLoader = false) => {
      if (showLoader && mountedRef.current) setLoading(true);

      try {
        const { data: auth } = await supabase.auth.getUser();

        if (!auth?.user) {
          commitProfile(null);
          return;
        }

        const { data: viewProfile, error: viewError } = await supabase
          .from('v_user_with_branches')
          .select('*')
          .eq('id', auth.user.id)
          .single();

        let profile: Me | null = null;

        if (!viewError && viewProfile) {
          profile = {
            id: viewProfile.id,
            email: viewProfile.email,
            full_name: viewProfile.full_name,
            role: viewProfile.role as UserRole,
            is_active: viewProfile.is_active,
            branches: normalizeBranches(viewProfile.branches),
          };
        } else {
          const [{ data: fallbackProfile, error: profileError }, { data: userBranches }] =
            await Promise.all([
              supabase
                .from('profiles')
                .select('id,email,full_name,role,is_active')
                .eq('id', auth.user.id)
                .single(),
              supabase.from('user_branches').select('branch').eq('user_id', auth.user.id),
            ]);

          if (!profileError && fallbackProfile) {
            profile = {
              id: fallbackProfile.id,
              email: fallbackProfile.email,
              full_name: fallbackProfile.full_name,
              role: fallbackProfile.role as UserRole,
              is_active: fallbackProfile.is_active,
              branches: normalizeBranches(
                (userBranches ?? []).map(
                  (row: { branch?: string | null }) => row.branch ?? null,
                ),
              ),
            };
          }
        }

        if (!profile || !profile.is_active) {
          if (profile && !profile.is_active) await supabase.auth.signOut();
          commitProfile(null);
          return;
        }

        commitProfile(profile);
      } catch (error) {
        console.error('[useMe] error:', error);
        // Una falla de red temporal no debe borrar una sesión ya cargada.
        if (!initialLoadFinishedRef.current) commitProfile(null);
      } finally {
        initialLoadFinishedRef.current = true;
        if (mountedRef.current) setLoading(false);
      }
    },
    [commitProfile],
  );

  useEffect(() => {
    mountedRef.current = true;
    void load(true);

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        commitProfile(null);
        if (mountedRef.current) setLoading(false);
        return;
      }

      // Supabase puede emitir TOKEN_REFRESHED al recuperar el foco de la pestaña.
      // No activamos loaders ni reconstruimos la página por ese evento.
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        window.setTimeout(() => {
          void load(false);
        }, 0);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.subscription.unsubscribe();
    };
  }, [commitProfile, load]);

  const firstName = useMemo(() => {
    if (!me?.full_name) return '';
    return me.full_name.split(' ').filter(Boolean)[0] ?? '';
  }, [me?.full_name]);

  return {
    me,
    firstName,
    loading,
    isAdmin: me?.role === 'admin',
    isJDV: me?.role === 'jdv',
    isRRHH: me?.role === 'rrhh',
    isSupervisor: me?.role === 'supervisor',
    refetch: () => load(false),
  };
}
