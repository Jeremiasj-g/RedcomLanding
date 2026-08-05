'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  Gauge,
  KeyRound,
  ListChecks,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  UsersRound,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { notify } from '@/lib/notifications';
import {
  MODULE_PERMISSION_DEFINITIONS,
  getConfiguredRoleModulePermissions,
  getDefaultModulePermissions,
  permissionMapsEqual,
  type ModulePermissionDefinition,
  type ModulePermissionGroup,
  type ModulePermissionKey,
  type ModulePermissionMap,
  type RoleModulePermissionRow,
} from '@/lib/module-permissions';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import DualSpinner from '@/components/ui/DualSpinner';

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  branches: string[];
};

type PermissionRow = {
  user_id: string;
  module_key: ModulePermissionKey;
  can_access: boolean;
  updated_at: string;
};

type RoleFilter = 'all' | string;
type StatusFilter = 'all' | 'active' | 'inactive';
type PermissionsView = 'users' | 'roles';

type RoleCatalogRow = {
  id?: number;
  code: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
  is_system?: boolean;
  sort_order?: number;
};

const GROUP_ORDER: ModulePermissionGroup[] = [
  'Sucursales',
  'Herramientas de sucursal',
  'Espacio de trabajo',
  'Paneles',
];

const MODULE_ICONS: Record<ModulePermissionKey, ComponentType<{ className?: string }>> = {
  branch_dashboards: Building2,
  branch_categories: BarChart3,
  branch_sigo: CalendarCheck2,
  branch_buyers: Users,
  branch_coverages: Gauge,
  branch_billing: BriefcaseBusiness,
  branch_objectives: CheckCircle2,
  branch_operational_news: Sparkles,
  branch_critical_accounts: KeyRound,
  branch_current_accounts: ClipboardList,
  branch_kilos_bultos: LayoutDashboard,
  branch_analytics: BarChart3,
  news: Sparkles,
  personal_tasks: CalendarCheck2,
  projects: FolderKanban,
  boards: LayoutDashboard,
  focus: ListChecks,
  quarterly_indicators: Gauge,
  vendo_requests: Smartphone,
  hr_panel: UsersRound,
  tasks_panel: ClipboardList,
  focus_panel: BarChart3,
  management_resources: BriefcaseBusiness,
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  jdv: 'JDV',
  supervisor: 'Supervisor',
  vendedor: 'Vendedor',
  rrhh: 'RRHH',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Administración completa del sistema. Este rol siempre conserva acceso total.',
  jdv: 'Jefatura de ventas, seguimiento de equipos y herramientas de gestión comercial.',
  supervisor: 'Supervisión operativa, tareas, proyectos e indicadores de sus sucursales.',
  vendedor: 'Accesos operativos básicos para vendedores y colaboradores comerciales.',
  rrhh: 'Novedades, contenidos internos, solicitudes y herramientas de Recursos Humanos.',
};

const BRANCH_LABELS: Record<string, string> = {
  corrientes: 'Corrientes',
  chaco: 'Chaco',
  misiones: 'Misiones',
  obera: 'Oberá',
  refrigerados: 'Refrigerados',
};

function roleLabel(role: string, catalog: RoleCatalogRow[] = []) {
  return (
    catalog.find((item) => item.code === role)?.name ??
    ROLE_LABELS[role] ??
    role.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function roleDescription(role: string, catalog: RoleCatalogRow[] = []) {
  return (
    catalog.find((item) => item.code === role)?.description ??
    ROLE_DESCRIPTIONS[role] ??
    'Permisos predeterminados del rol.'
  );
}

function effectivePermissions(
  user: UserRow,
  userRows: PermissionRow[],
  roleRows: RoleModulePermissionRow[],
): ModulePermissionMap {
  const permissions = getConfiguredRoleModulePermissions(user.role, roleRows);
  userRows.forEach((row) => {
    permissions[row.module_key] = row.can_access;
  });
  if (user.role === 'admin') {
    MODULE_PERMISSION_DEFINITIONS.forEach((definition) => {
      permissions[definition.key] = true;
    });
  }
  return permissions;
}

function isMissingTableError(
  error: { code?: string | null; message?: string | null } | null,
  tableName: string,
) {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    message.includes(tableName.toLowerCase())
  );
}

export default function AdminModulePermissionsPage() {
  const [view, setView] = useState<PermissionsView>('users');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RoleModulePermissionRow[]>([]);
  const [roleCatalog, setRoleCatalog] = useState<RoleCatalogRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('vendedor');
  const [draft, setDraft] = useState<ModulePermissionMap | null>(null);
  const [roleDraft, setRoleDraft] = useState<ModulePermissionMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roleLoadError, setRoleLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setRoleLoadError(null);

    const [usersResult, permissionsResult, rolePermissionsResult, roleCatalogResult] = await Promise.all([
      supabase.rpc('admin_list_users'),
      supabase
        .from('user_module_permissions')
        .select('user_id,module_key,can_access,updated_at')
        .order('updated_at', { ascending: false }),
      supabase
        .from('role_module_permissions')
        .select('role_key,module_key,can_access,updated_at')
        .order('role_key', { ascending: true }),
      supabase.from('user_types').select('*').order('id', { ascending: true }),
    ]);

    if (usersResult.error) {
      setLoadError(usersResult.error.message);
      setLoading(false);
      return;
    }

    if (permissionsResult.error) {
      setLoadError(
        isMissingTableError(permissionsResult.error, 'user_module_permissions')
          ? 'Todavía no se ejecutó PERMISOS_MODULOS_BD.sql en Supabase.'
          : permissionsResult.error.message,
      );
      setLoading(false);
      return;
    }

    if (rolePermissionsResult.error) {
      setRolePermissions([]);
      setRoleLoadError(
        isMissingTableError(rolePermissionsResult.error, 'role_module_permissions')
          ? 'Ejecutá PERMISOS_PREDETERMINADOS_ROL_BD.sql en Supabase para habilitar esta configuración.'
          : rolePermissionsResult.error.message,
      );
    } else {
      setRolePermissions((rolePermissionsResult.data ?? []) as RoleModulePermissionRow[]);
    }

    if (!roleCatalogResult.error) {
      const nextCatalog = ((roleCatalogResult.data ?? []) as RoleCatalogRow[])
        .map((role) => ({
          ...role,
          code: String(role.code || '').trim(),
          name: String(role.name || role.code || '').trim(),
        }))
        .filter((role) => Boolean(role.code))
        .sort((a, b) =>
          Number(a.sort_order ?? 100) - Number(b.sort_order ?? 100) ||
          a.name.localeCompare(b.name),
        );
      setRoleCatalog(nextCatalog);
    }

    const nextUsers = ((usersResult.data ?? []) as UserRow[]).map((user) => ({
      ...user,
      branches: Array.isArray(user.branches) ? user.branches : [],
    }));

    setUsers(nextUsers);
    setPermissions((permissionsResult.data ?? []) as PermissionRow[]);
    setSelectedUserId((current) => {
      if (current && nextUsers.some((user) => user.id === current)) return current;
      return (
        nextUsers.find((user) => user.role !== 'admin' && user.is_active)?.id ??
        nextUsers[0]?.id ??
        null
      );
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get('view');
    const requestedRole = params.get('role');
    if (requestedView === 'roles') setView('roles');
    if (requestedView === 'users') setView('users');
    if (requestedRole) setSelectedRole(requestedRole);
  }, []);

  const permissionsByUser = useMemo(() => {
    return permissions.reduce<Record<string, PermissionRow[]>>((acc, row) => {
      (acc[row.user_id] ??= []).push(row);
      return acc;
    }, {});
  }, [permissions]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const selectedStoredRows = useMemo(
    () => (selectedUser ? permissionsByUser[selectedUser.id] ?? [] : []),
    [permissionsByUser, selectedUser],
  );

  const selectedRoleDefaults = useMemo(
    () =>
      selectedUser
        ? getConfiguredRoleModulePermissions(selectedUser.role, rolePermissions)
        : null,
    [rolePermissions, selectedUser],
  );

  const savedEffective = useMemo(
    () =>
      selectedUser
        ? effectivePermissions(selectedUser, selectedStoredRows, rolePermissions)
        : null,
    [rolePermissions, selectedStoredRows, selectedUser],
  );

  useEffect(() => {
    setDraft(savedEffective ? { ...savedEffective } : null);
  }, [savedEffective, selectedUserId]);

  const savedRoleDefaults = useMemo(
    () => getConfiguredRoleModulePermissions(selectedRole, rolePermissions),
    [rolePermissions, selectedRole],
  );

  const recommendedRoleDefaults = useMemo(
    () => getDefaultModulePermissions(selectedRole),
    [selectedRole],
  );

  useEffect(() => {
    setRoleDraft({ ...savedRoleDefaults });
  }, [savedRoleDefaults, selectedRole]);

  const roles = useMemo(
    () =>
      Array.from(new Set(users.map((user) => user.role))).sort((a, b) =>
        roleLabel(a, roleCatalog).localeCompare(roleLabel(b, roleCatalog)),
      ),
    [roleCatalog, users],
  );

  const configurableRoles = useMemo(() => {
    const discovered = users.map((user) => user.role);
    const catalogCodes = roleCatalog.map((role) => role.code);
    return Array.from(new Set([...catalogCodes, ...discovered]))
      .filter(Boolean)
      .sort((a, b) => roleLabel(a, roleCatalog).localeCompare(roleLabel(b, roleCatalog)));
  }, [roleCatalog, users]);

  useEffect(() => {
    if (!configurableRoles.length) return;
    if (!configurableRoles.includes(selectedRole)) {
      setSelectedRole(
        configurableRoles.find((role) => role !== 'admin') ?? configurableRoles[0],
      );
    }
  }, [configurableRoles, selectedRole]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        !normalized ||
        [user.full_name, user.email, user.role, ...(user.branches ?? [])].some((value) =>
          String(value ?? '').toLowerCase().includes(normalized),
        );
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? user.is_active : !user.is_active);
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [query, roleFilter, statusFilter, users]);

  const configuredUsers = useMemo(
    () => new Set(permissions.map((permission) => permission.user_id)).size,
    [permissions],
  );

  const configuredRoles = useMemo(
    () =>
      configurableRoles.filter((role) => {
        if (role === 'admin') return false;
        return !permissionMapsEqual(
          getConfiguredRoleModulePermissions(role, rolePermissions),
          getDefaultModulePermissions(role),
        );
      }).length,
    [configurableRoles, rolePermissions],
  );

  const customOverridesCount = selectedStoredRows.length;
  const enabledModulesCount = draft
    ? MODULE_PERMISSION_DEFINITIONS.filter((definition) => draft[definition.key]).length
    : 0;
  const dirty = Boolean(draft && savedEffective && !permissionMapsEqual(draft, savedEffective));

  const roleEnabledModulesCount = roleDraft
    ? MODULE_PERMISSION_DEFINITIONS.filter((definition) => roleDraft[definition.key]).length
    : 0;
  const roleChangesFromRecommended = roleDraft
    ? MODULE_PERMISSION_DEFINITIONS.filter(
        (definition) =>
          roleDraft[definition.key] !== recommendedRoleDefaults[definition.key],
      ).length
    : 0;
  const roleDirty = Boolean(
    roleDraft && !permissionMapsEqual(roleDraft, savedRoleDefaults),
  );

  const setAll = (value: boolean) => {
    if (!selectedUser || selectedUser.role === 'admin') return;
    setDraft(
      MODULE_PERMISSION_DEFINITIONS.reduce<ModulePermissionMap>((acc, definition) => {
        acc[definition.key] = value;
        return acc;
      }, {} as ModulePermissionMap),
    );
  };

  const restoreRoleDefaults = () => {
    if (!selectedUser || selectedUser.role === 'admin' || !selectedRoleDefaults) return;
    setDraft({ ...selectedRoleDefaults });
  };

  const persistPermissions = async () => {
    if (
      !selectedUser ||
      !draft ||
      !selectedRoleDefaults ||
      selectedUser.role === 'admin'
    ) {
      return;
    }
    setSaving(true);

    try {
      const overrides = MODULE_PERMISSION_DEFINITIONS.filter(
        (definition) =>
          draft[definition.key] !== selectedRoleDefaults[definition.key],
      ).map((definition) => ({
        user_id: selectedUser.id,
        module_key: definition.key,
        can_access: draft[definition.key],
        updated_at: new Date().toISOString(),
      }));

      const { error: saveError } = await supabase.rpc(
        'admin_set_user_module_permissions',
        {
          p_user_id: selectedUser.id,
          p_permissions: overrides.map(({ module_key, can_access }) => ({
            module_key,
            can_access,
          })),
        },
      );
      if (saveError) throw saveError;

      setPermissions((current) => [
        ...current.filter((permission) => permission.user_id !== selectedUser.id),
        ...overrides,
      ]);

      window.dispatchEvent(new Event('redcom:module-permissions-changed'));
      notify.success(
        overrides.length
          ? `Permisos personalizados guardados para ${
              selectedUser.full_name || selectedUser.email
            }.`
          : `Se restauraron los permisos predeterminados de ${roleLabel(
              selectedUser.role,
              roleCatalog,
            )}.`,
      );
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : 'No se pudieron guardar los permisos.',
      );
    } finally {
      setSaving(false);
    }
  };

  const resetStoredPermissions = async () => {
    if (!selectedUser || selectedUser.role === 'admin' || !selectedRoleDefaults) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_set_user_module_permissions', {
        p_user_id: selectedUser.id,
        p_permissions: [],
      });
      if (error) throw error;

      setPermissions((current) =>
        current.filter((permission) => permission.user_id !== selectedUser.id),
      );
      setDraft({ ...selectedRoleDefaults });
      window.dispatchEvent(new Event('redcom:module-permissions-changed'));
      notify.success(
        `Permisos restablecidos según la configuración de ${roleLabel(
          selectedUser.role,
          roleCatalog,
        )}.`,
      );
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : 'No se pudieron restablecer los permisos.',
      );
    } finally {
      setSaving(false);
    }
  };

  const setAllForRole = (value: boolean) => {
    if (selectedRole === 'admin') return;
    setRoleDraft(
      MODULE_PERMISSION_DEFINITIONS.reduce<ModulePermissionMap>((acc, definition) => {
        acc[definition.key] = value;
        return acc;
      }, {} as ModulePermissionMap),
    );
  };

  const restoreRecommendedRoleDefaults = () => {
    if (selectedRole === 'admin') return;
    setRoleDraft({ ...recommendedRoleDefaults });
  };

  const persistRolePermissions = async () => {
    if (!roleDraft || selectedRole === 'admin' || roleLoadError) return;
    setRoleSaving(true);
    try {
      const payload = MODULE_PERMISSION_DEFINITIONS.map((definition) => ({
        module_key: definition.key,
        can_access: roleDraft[definition.key],
      }));

      const { error } = await supabase.rpc('admin_set_role_module_permissions', {
        p_role_key: selectedRole,
        p_permissions: payload,
      });
      if (error) throw error;

      const updatedAt = new Date().toISOString();
      setRolePermissions((current) => [
        ...current.filter((permission) => permission.role_key !== selectedRole),
        ...payload.map((permission) => ({
          role_key: selectedRole,
          module_key: permission.module_key,
          can_access: permission.can_access,
          updated_at: updatedAt,
        })),
      ]);

      window.dispatchEvent(new Event('redcom:role-module-permissions-changed'));
      window.dispatchEvent(new Event('redcom:module-permissions-changed'));
      notify.success(
        `Permisos predeterminados actualizados para el rol ${roleLabel(selectedRole, roleCatalog)}.`,
      );
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : 'No se pudieron guardar los permisos predeterminados.',
      );
    } finally {
      setRoleSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[65vh] place-items-center">
        <DualSpinner size={60} thickness={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-red-700">
            <ShieldCheck className="h-3.5 w-3.5" /> Control de acceso
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">
            Permisos por módulo
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Configurá los accesos predeterminados de cada rol y aplicá excepciones a
            usuarios específicos sin modificar sus sucursales ni responsabilidades.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={load}
          className="gap-2 rounded-xl border-slate-300 bg-white"
        >
          <RefreshCw className="h-4 w-4" /> Actualizar
        </Button>
      </header>

      {loadError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-red-800">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">No se pudo cargar el módulo de permisos.</p>
              <p className="mt-1">{loadError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs
        value={view}
        onValueChange={(value) => setView(value as PermissionsView)}
        className="space-y-5"
      >
        <TabsList className="h-auto w-full justify-start gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:w-auto">
          <TabsTrigger
            value="users"
            className="gap-2 rounded-xl px-4 py-2.5 data-[state=active]:bg-slate-950 data-[state=active]:text-white"
          >
            <Users className="h-4 w-4" /> Permisos por usuario
          </TabsTrigger>
          <TabsTrigger
            value="roles"
            className="gap-2 rounded-xl px-4 py-2.5 data-[state=active]:bg-slate-950 data-[state=active]:text-white"
          >
            <ShieldCheck className="h-4 w-4" /> Predeterminados por rol
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-0 space-y-5">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              title="Usuarios"
              value={users.length}
              icon={<Users className="h-5 w-5 text-slate-700" />}
            />
            <Metric
              title="Activos"
              value={users.filter((user) => user.is_active).length}
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-700" />}
              tone="emerald"
            />
            <Metric
              title="Con permisos personalizados"
              value={configuredUsers}
              icon={<KeyRound className="h-5 w-5 text-violet-700" />}
              tone="violet"
            />
            <Metric
              title="Módulos administrables"
              value={MODULE_PERMISSION_DEFINITIONS.length}
              icon={<Gauge className="h-5 w-5 text-blue-700" />}
              tone="blue"
            />
          </section>

          <section className="grid min-h-[640px] gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/70 p-5">
                <CardTitle className="text-base font-black text-slate-950">
                  Seleccionar usuario
                </CardTitle>
                <CardDescription>Buscá por nombre, correo, rol o sucursal.</CardDescription>
                <div className="relative pt-2">
                  <Search className="absolute left-3 top-[22px] h-4 w-4 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar usuario..."
                    className="h-11 rounded-xl border-slate-200 bg-white pl-9"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                      <SelectValue placeholder="Todos los roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los roles</SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabel(role, roleCatalog)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Activos</SelectItem>
                      <SelectItem value="inactive">Inactivos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <ScrollArea className="h-[500px]">
                <div className="space-y-2 p-3">
                  {filteredUsers.map((user) => {
                    const selected = user.id === selectedUserId;
                    const userRows = permissionsByUser[user.id] ?? [];
                    const effective = effectivePermissions(
                      user,
                      userRows,
                      rolePermissions,
                    );
                    const enabled = MODULE_PERMISSION_DEFINITIONS.filter(
                      (definition) => effective[definition.key],
                    ).length;
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => setSelectedUserId(user.id)}
                        className={cn(
                          'w-full rounded-2xl border p-3 text-left transition',
                          selected
                            ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black">
                              {user.full_name || 'Sin nombre'}
                            </p>
                            <p
                              className={cn(
                                'mt-0.5 truncate text-xs',
                                selected ? 'text-slate-300' : 'text-slate-500',
                              )}
                            >
                              {user.email}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'h-2.5 w-2.5 shrink-0 rounded-full',
                              user.is_active ? 'bg-emerald-400' : 'bg-slate-300',
                            )}
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <Badge
                            className={cn(
                              'border text-[10px]',
                              selected
                                ? 'border-white/20 bg-white/10 text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-700',
                            )}
                          >
                            {roleLabel(user.role, roleCatalog)}
                          </Badge>
                          <Badge
                            className={cn(
                              'border text-[10px]',
                              selected
                                ? 'border-white/20 bg-white/10 text-white'
                                : 'border-blue-100 bg-blue-50 text-blue-700',
                            )}
                          >
                            {enabled}/{MODULE_PERMISSION_DEFINITIONS.length} módulos
                          </Badge>
                          {userRows.length > 0 && (
                            <Badge
                              className={cn(
                                'border text-[10px]',
                                selected
                                  ? 'border-violet-300/30 bg-violet-400/15 text-violet-100'
                                  : 'border-violet-100 bg-violet-50 text-violet-700',
                              )}
                            >
                              Personalizado
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <div className="px-4 py-12 text-center text-sm text-slate-500">
                      No se encontraron usuarios.
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="border-t border-slate-100 bg-white px-4 py-3 text-xs text-slate-500">
                Mostrando{' '}
                <strong className="text-slate-900">{filteredUsers.length}</strong> de{' '}
                {users.length} usuarios.
              </div>
            </Card>

            <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
              {!selectedUser || !draft || !selectedRoleDefaults ? (
                <EmptySelection text="Seleccioná un usuario para administrar sus permisos." />
              ) : (
                <>
                  <CardHeader className="border-b border-slate-100 bg-white p-5 lg:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="truncate text-xl font-black text-slate-950">
                            {selectedUser.full_name || selectedUser.email}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="border-slate-200 bg-slate-50 text-slate-700"
                          >
                            {roleLabel(selectedUser.role, roleCatalog)}
                          </Badge>
                          {!selectedUser.is_active && (
                            <Badge
                              variant="outline"
                              className="border-red-200 bg-red-50 text-red-700"
                            >
                              Inactivo
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="mt-1 break-all">
                          {selectedUser.email}
                        </CardDescription>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {(selectedUser.branches ?? []).length > 0 ? (
                            selectedUser.branches.map((branch) => (
                              <Badge
                                key={branch}
                                variant="outline"
                                className="border-blue-100 bg-blue-50 text-blue-700"
                              >
                                {BRANCH_LABELS[branch] ?? branch}
                              </Badge>
                            ))
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 text-amber-700"
                            >
                              Sin sucursales asignadas
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAll(true)}
                          disabled={selectedUser.role === 'admin' || saving}
                          className="rounded-xl"
                        >
                          Habilitar todo
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAll(false)}
                          disabled={selectedUser.role === 'admin' || saving}
                          className="rounded-xl"
                        >
                          Quitar todo
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={selectedUser.role === 'admin' || saving}
                              className="gap-2 rounded-xl"
                            >
                              <RefreshCw className="h-3.5 w-3.5" /> Según rol
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Restablecer permisos del rol
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminarán las excepciones personalizadas de{' '}
                                {selectedUser.full_name || selectedUser.email} y volverá a
                                utilizar la configuración predeterminada actual de{' '}
                                {roleLabel(selectedUser.role, roleCatalog)}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={resetStoredPermissions}>
                                Restablecer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <SummaryChip
                        label="Módulos habilitados"
                        value={`${enabledModulesCount}/${MODULE_PERMISSION_DEFINITIONS.length}`}
                      />
                      <SummaryChip
                        label="Excepciones guardadas"
                        value={String(customOverridesCount)}
                      />
                      <SummaryChip
                        label="Modo actual"
                        value={
                          selectedUser.role === 'admin'
                            ? 'Acceso total'
                            : customOverridesCount
                              ? 'Personalizado'
                              : 'Según rol'
                        }
                      />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6 p-5 lg:p-6">
                    {selectedUser.role === 'admin' && <AdminAccessNotice />}

                    {GROUP_ORDER.map((group) => (
                      <PermissionGroup
                        key={group}
                        group={group}
                        values={draft}
                        baseline={selectedRoleDefaults}
                        mode="user"
                        disabled={selectedUser.role === 'admin' || saving}
                        onChange={(key, checked) =>
                          setDraft((current) =>
                            current ? { ...current, [key]: checked } : current,
                          )
                        }
                      />
                    ))}
                  </CardContent>

                  <StickySaveBar
                    dirty={dirty}
                    saving={saving}
                    disabled={selectedUser.role === 'admin'}
                    idleText="Los permisos guardados están actualizados."
                    onPreview={restoreRoleDefaults}
                    previewLabel="Previsualizar según rol"
                    onSave={persistPermissions}
                    saveLabel="Guardar permisos"
                  />
                </>
              )}
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="roles" className="mt-0 space-y-5">
          {roleLoadError && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-900">
                <KeyRound className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold">
                    Falta habilitar los permisos predeterminados por rol.
                  </p>
                  <p className="mt-1">{roleLoadError}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              title="Roles configurables"
              value={configurableRoles.length}
              icon={<ShieldCheck className="h-5 w-5 text-slate-700" />}
            />
            <Metric
              title="Roles personalizados"
              value={configuredRoles}
              icon={<KeyRound className="h-5 w-5 text-violet-700" />}
              tone="violet"
            />
            <Metric
              title="Usuarios que heredan"
              value={users.length - configuredUsers}
              icon={<Users className="h-5 w-5 text-emerald-700" />}
              tone="emerald"
            />
            <Metric
              title="Módulos administrables"
              value={MODULE_PERMISSION_DEFINITIONS.length}
              icon={<Gauge className="h-5 w-5 text-blue-700" />}
              tone="blue"
            />
          </section>

          <Card className="rounded-2xl border-blue-100 bg-blue-50/70 shadow-sm">
            <CardContent className="flex items-start gap-3 p-4 text-sm text-blue-900">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">Estos accesos se aplican automáticamente.</p>
                <p className="mt-1 leading-6 text-blue-800">
                  Todo usuario nuevo hereda la configuración de su rol desde su primer
                  ingreso. Los usuarios existentes sin excepciones también se actualizan;
                  las excepciones individuales permanecen y siguen teniendo prioridad.
                </p>
              </div>
            </CardContent>
          </Card>

          <section className="grid min-h-[640px] gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/70 p-5">
                <CardTitle className="text-base font-black text-slate-950">
                  Seleccionar rol
                </CardTitle>
                <CardDescription>
                  Definí qué recibe una persona al ser creada con cada rol.
                </CardDescription>
              </CardHeader>
              <div className="space-y-2 p-3">
                {configurableRoles.map((role) => {
                  const selected = role === selectedRole;
                  const roleDefaults = getConfiguredRoleModulePermissions(
                    role,
                    rolePermissions,
                  );
                  const recommended = getDefaultModulePermissions(role);
                  const enabled = MODULE_PERMISSION_DEFINITIONS.filter(
                    (definition) => roleDefaults[definition.key],
                  ).length;
                  const customized = !permissionMapsEqual(roleDefaults, recommended);
                  const usersInRole = users.filter((user) => user.role === role).length;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      className={cn(
                        'w-full rounded-2xl border p-4 text-left transition',
                        selected
                          ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'grid h-10 w-10 shrink-0 place-items-center rounded-xl border',
                            selected
                              ? 'border-white/15 bg-white/10'
                              : 'border-slate-200 bg-slate-50 text-slate-700',
                          )}
                        >
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black">{roleLabel(role, roleCatalog)}</p>
                          <p
                            className={cn(
                              'mt-1 line-clamp-2 text-xs leading-5',
                              selected ? 'text-slate-300' : 'text-slate-500',
                            )}
                          >
                            {roleDescription(role, roleCatalog)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <Badge
                          className={cn(
                            'border text-[10px]',
                            selected
                              ? 'border-white/20 bg-white/10 text-white'
                              : 'border-blue-100 bg-blue-50 text-blue-700',
                          )}
                        >
                          {enabled}/{MODULE_PERMISSION_DEFINITIONS.length} módulos
                        </Badge>
                        <Badge
                          className={cn(
                            'border text-[10px]',
                            selected
                              ? 'border-white/20 bg-white/10 text-white'
                              : 'border-slate-200 bg-slate-50 text-slate-700',
                          )}
                        >
                          {usersInRole} usuario{usersInRole === 1 ? '' : 's'}
                        </Badge>
                        {customized && role !== 'admin' && (
                          <Badge
                            className={cn(
                              'border text-[10px]',
                              selected
                                ? 'border-violet-300/30 bg-violet-400/15 text-violet-100'
                                : 'border-violet-100 bg-violet-50 text-violet-700',
                            )}
                          >
                            Personalizado
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
              {!roleDraft ? (
                <EmptySelection text="Seleccioná un rol para configurar sus accesos predeterminados." />
              ) : (
                <>
                  <CardHeader className="border-b border-slate-100 bg-white p-5 lg:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-xl font-black text-slate-950">
                            {roleLabel(selectedRole, roleCatalog)}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="border-violet-200 bg-violet-50 text-violet-700"
                          >
                            Predeterminado del rol
                          </Badge>
                        </div>
                        <CardDescription className="mt-2 max-w-2xl leading-6">
                          {roleDescription(selectedRole, roleCatalog)}
                        </CardDescription>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAllForRole(true)}
                          disabled={
                            selectedRole === 'admin' || roleSaving || Boolean(roleLoadError)
                          }
                          className="rounded-xl"
                        >
                          Habilitar todo
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAllForRole(false)}
                          disabled={
                            selectedRole === 'admin' || roleSaving || Boolean(roleLoadError)
                          }
                          className="rounded-xl"
                        >
                          Quitar todo
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                selectedRole === 'admin' ||
                                roleSaving ||
                                Boolean(roleLoadError)
                              }
                              className="gap-2 rounded-xl"
                            >
                              <RefreshCw className="h-3.5 w-3.5" /> Valores recomendados
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Recuperar valores recomendados
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Se preparará la configuración original recomendada para{' '}
                                {roleLabel(selectedRole, roleCatalog)}. Podrás revisarla antes de guardar.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={restoreRecommendedRoleDefaults}>
                                Recuperar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <SummaryChip
                        label="Módulos habilitados"
                        value={`${roleEnabledModulesCount}/${MODULE_PERMISSION_DEFINITIONS.length}`}
                      />
                      <SummaryChip
                        label="Cambios vs. recomendado"
                        value={String(roleChangesFromRecommended)}
                      />
                      <SummaryChip
                        label="Usuarios con este rol"
                        value={String(users.filter((user) => user.role === selectedRole).length)}
                      />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6 p-5 lg:p-6">
                    {selectedRole === 'admin' && <AdminAccessNotice />}

                    {GROUP_ORDER.map((group) => (
                      <PermissionGroup
                        key={group}
                        group={group}
                        values={roleDraft}
                        baseline={recommendedRoleDefaults}
                        mode="role"
                        disabled={
                          selectedRole === 'admin' ||
                          roleSaving ||
                          Boolean(roleLoadError)
                        }
                        onChange={(key, checked) =>
                          setRoleDraft((current) =>
                            current ? { ...current, [key]: checked } : current,
                          )
                        }
                      />
                    ))}
                  </CardContent>

                  <StickySaveBar
                    dirty={roleDirty}
                    saving={roleSaving}
                    disabled={selectedRole === 'admin' || Boolean(roleLoadError)}
                    idleText="Los accesos predeterminados del rol están actualizados."
                    onPreview={restoreRecommendedRoleDefaults}
                    previewLabel="Previsualizar recomendados"
                    onSave={persistRolePermissions}
                    saveLabel="Guardar predeterminados"
                  />
                </>
              )}
            </Card>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PermissionGroup({
  group,
  values,
  baseline,
  mode,
  disabled,
  onChange,
}: {
  group: ModulePermissionGroup;
  values: ModulePermissionMap;
  baseline: ModulePermissionMap;
  mode: 'user' | 'role';
  disabled: boolean;
  onChange: (key: ModulePermissionKey, checked: boolean) => void;
}) {
  const definitions = MODULE_PERMISSION_DEFINITIONS.filter(
    (definition) => definition.group === group,
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.12em] text-slate-700">
            {group}
          </h2>
          {group === 'Sucursales' && (
            <p className="mt-1 text-xs text-slate-500">
              Controla el ingreso general y respeta las sucursales asignadas en la pestaña Usuarios.
            </p>
          )}
          {group === 'Herramientas de sucursal' && (
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
              Configurá de forma independiente las planillas, categorías y analítica que se muestran dentro de cada sucursal. Los permisos se combinan con las sucursales asignadas al usuario.
            </p>
          )}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {definitions.map((definition) => (
          <ModulePermissionCard
            key={definition.key}
            definition={definition}
            checked={values[definition.key]}
            baseline={baseline[definition.key]}
            mode={mode}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(definition.key, checked)}
          />
        ))}
      </div>
      {group !== GROUP_ORDER[GROUP_ORDER.length - 1] && (
        <Separator className="mt-6" />
      )}
    </div>
  );
}

function ModulePermissionCard({
  definition,
  checked,
  baseline,
  mode,
  disabled,
  onCheckedChange,
}: {
  definition: ModulePermissionDefinition;
  checked: boolean;
  baseline: boolean;
  mode: 'user' | 'role';
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const Icon = MODULE_ICONS[definition.key];
  const customized = checked !== baseline;

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition',
        checked
          ? 'border-emerald-200 bg-emerald-50/45'
          : 'border-slate-200 bg-slate-50/70',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl border',
            checked
              ? 'border-emerald-200 bg-white text-emerald-700'
              : 'border-slate-200 bg-white text-slate-500',
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">{definition.label}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {definition.description}
              </p>
            </div>
            <Switch
              checked={checked}
              onCheckedChange={onCheckedChange}
              disabled={disabled}
              aria-label={`Permitir acceso a ${definition.label}`}
              className="data-[state=checked]:bg-emerald-600"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'text-[10px]',
                checked
                  ? 'border-emerald-200 bg-white text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500',
              )}
            >
              {checked ? 'Acceso habilitado' : 'Sin acceso'}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px]',
                customized
                  ? 'border-violet-200 bg-violet-50 text-violet-700'
                  : 'border-slate-200 bg-white text-slate-500',
              )}
            >
              {customized
                ? mode === 'user'
                  ? 'Excepción personalizada'
                  : 'Ajustado por administrador'
                : mode === 'user'
                  ? `Según rol: ${baseline ? 'habilitado' : 'deshabilitado'}`
                  : `Recomendado: ${baseline ? 'habilitado' : 'deshabilitado'}`}
            </Badge>
            {definition.branchAware && (
              <Badge
                variant="outline"
                className="border-blue-100 bg-blue-50 text-[10px] text-blue-700"
              >
                Respeta sucursales
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StickySaveBar({
  dirty,
  saving,
  disabled,
  idleText,
  onPreview,
  previewLabel,
  onSave,
  saveLabel,
}: {
  dirty: boolean;
  saving: boolean;
  disabled: boolean;
  idleText: string;
  onPreview: () => void;
  previewLabel: string;
  onSave: () => void;
  saveLabel: string;
}) {
  return (
    <div className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:px-6">
      <div className="text-xs text-slate-500">
        {dirty ? (
          <span className="font-semibold text-amber-700">
            Hay cambios pendientes de guardar.
          </span>
        ) : (
          <span>{idleText}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          onClick={onPreview}
          disabled={disabled || saving}
          className="rounded-xl"
        >
          {previewLabel}
        </Button>
        <Button
          onClick={onSave}
          disabled={!dirty || disabled || saving}
          className="gap-2 rounded-xl bg-slate-950 text-white hover:bg-slate-800"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

function AdminAccessNotice() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-bold">Los administradores siempre tienen acceso completo.</p>
        <p className="mt-1 text-amber-800">
          Esta protección evita que el sistema quede sin una cuenta capaz de administrar
          usuarios y permisos.
        </p>
      </div>
    </div>
  );
}

function EmptySelection({ text }: { text: string }) {
  return (
    <div className="grid min-h-[640px] place-items-center p-8 text-center">
      <div>
        <ShieldCheck className="mx-auto h-12 w-12 text-slate-300" />
        <p className="mt-4 font-bold text-slate-700">{text}</p>
      </div>
    </div>
  );
}

function Metric({
  title,
  value,
  icon,
  tone = 'slate',
}: {
  title: string;
  value: number;
  icon: ReactNode;
  tone?: 'slate' | 'emerald' | 'violet' | 'blue';
}) {
  const tones = {
    slate: 'border-slate-200',
    emerald: 'border-emerald-200',
    violet: 'border-violet-200',
    blue: 'border-blue-200',
  };
  return (
    <Card className={cn('rounded-2xl bg-white shadow-sm', tones[tone])}>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-100">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}
