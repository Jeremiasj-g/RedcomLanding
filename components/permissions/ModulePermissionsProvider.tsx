'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { supabase } from '@/lib/supabaseClient';
import {
  getConfiguredRoleModulePermissions,
  getDefaultModulePermissions,
  type ModulePermissionKey,
  type ModulePermissionMap,
  type RoleModulePermissionRow,
} from '@/lib/module-permissions';

type PermissionMap = Partial<Record<ModulePermissionKey, boolean>>;

type ModulePermissionsContextValue = {
  loading: boolean;
  overrides: PermissionMap;
  roleDefaults: ModulePermissionMap | null;
  canAccessModule: (key: ModulePermissionKey) => boolean;
  hasExplicitPermission: (key: ModulePermissionKey) => boolean;
  refreshPermissions: () => Promise<void>;
};

const ModulePermissionsContext = createContext<ModulePermissionsContextValue | null>(null);

function isMissingRoleDefaultsTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    message.includes('role_module_permissions')
  );
}

export default function ModulePermissionsProvider({ children }: { children: React.ReactNode }) {
  const { me, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<PermissionMap>({});
  const [roleDefaults, setRoleDefaults] = useState<ModulePermissionMap | null>(null);

  const refreshPermissions = useCallback(async () => {
    if (!me?.id) {
      setOverrides({});
      setRoleDefaults(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [userPermissionsResult, rolePermissionsResult] = await Promise.all([
      supabase
        .from('user_module_permissions')
        .select('module_key,can_access')
        .eq('user_id', me.id),
      supabase
        .from('role_module_permissions')
        .select('role_key,module_key,can_access')
        .eq('role_key', me.role),
    ]);

    if (userPermissionsResult.error) {
      // La aplicación conserva el comportamiento por rol mientras la migración
      // todavía no haya sido aplicada, evitando bloquear el sistema existente.
      console.warn(
        '[module-permissions] No se pudieron cargar los permisos individuales:',
        userPermissionsResult.error.message,
      );
      setOverrides({});
    } else {
      const nextOverrides = (userPermissionsResult.data ?? []).reduce<PermissionMap>(
        (acc, row: any) => {
          acc[row.module_key as ModulePermissionKey] = Boolean(row.can_access);
          return acc;
        },
        {},
      );
      setOverrides(nextOverrides);
    }

    if (rolePermissionsResult.error) {
      if (!isMissingRoleDefaultsTable(rolePermissionsResult.error)) {
        console.warn(
          '[module-permissions] No se pudieron cargar los permisos predeterminados del rol:',
          rolePermissionsResult.error.message,
        );
      }
      // Fallback seguro: mantiene los accesos históricos definidos en el código.
      setRoleDefaults(getDefaultModulePermissions(me.role));
    } else {
      setRoleDefaults(
        getConfiguredRoleModulePermissions(
          me.role,
          (rolePermissionsResult.data ?? []) as RoleModulePermissionRow[],
        ),
      );
    }

    setLoading(false);
  }, [me?.id, me?.role]);

  useEffect(() => {
    if (authLoading) return;
    refreshPermissions();
  }, [authLoading, refreshPermissions]);

  useEffect(() => {
    if (!me?.id) return;

    const userChannel = supabase
      .channel(`module_permissions_${me.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_module_permissions',
          filter: `user_id=eq.${me.id}`,
        },
        () => refreshPermissions(),
      )
      .subscribe();

    const roleChannel = supabase
      .channel(`role_module_permissions_${me.role}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'role_module_permissions',
          filter: `role_key=eq.${me.role}`,
        },
        () => refreshPermissions(),
      )
      .subscribe();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshPermissions();
    };
    const onManualRefresh = () => refreshPermissions();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('redcom:module-permissions-changed', onManualRefresh);
    window.addEventListener('redcom:role-module-permissions-changed', onManualRefresh);

    return () => {
      supabase.removeChannel(userChannel);
      supabase.removeChannel(roleChannel);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('redcom:module-permissions-changed', onManualRefresh);
      window.removeEventListener('redcom:role-module-permissions-changed', onManualRefresh);
    };
  }, [me?.id, me?.role, refreshPermissions]);

  const hasExplicitPermission = useCallback(
    (key: ModulePermissionKey) => Object.prototype.hasOwnProperty.call(overrides, key),
    [overrides],
  );

  const canAccessModule = useCallback(
    (key: ModulePermissionKey) => {
      if (!me || !me.is_active) return false;
      if (me.role === 'admin') return true;
      if (hasExplicitPermission(key)) return Boolean(overrides[key]);
      if (roleDefaults) return Boolean(roleDefaults[key]);
      return getDefaultModulePermissions(me.role)[key];
    },
    [hasExplicitPermission, me, overrides, roleDefaults],
  );

  const value = useMemo<ModulePermissionsContextValue>(
    () => ({
      loading: authLoading || loading,
      overrides,
      roleDefaults,
      canAccessModule,
      hasExplicitPermission,
      refreshPermissions,
    }),
    [
      authLoading,
      canAccessModule,
      hasExplicitPermission,
      loading,
      overrides,
      refreshPermissions,
      roleDefaults,
    ],
  );

  return (
    <ModulePermissionsContext.Provider value={value}>
      {children}
    </ModulePermissionsContext.Provider>
  );
}

export function useModulePermissions() {
  const context = useContext(ModulePermissionsContext);
  if (!context) {
    throw new Error('useModulePermissions debe utilizarse dentro de ModulePermissionsProvider.');
  }
  return context;
}
