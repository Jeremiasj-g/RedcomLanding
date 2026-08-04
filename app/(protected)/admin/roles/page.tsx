'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Copy,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { notify } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import DualSpinner from '@/components/ui/DualSpinner';
import { MODULE_PERMISSION_DEFINITIONS } from '@/lib/module-permissions';

type RoleRow = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  created_at?: string | null;
  updated_at?: string | null;
};

type UserRow = {
  id: string;
  role: string;
  is_active: boolean;
};

type RolePermissionRow = {
  role_key: string;
  module_key: string;
  can_access: boolean;
};

type RoleForm = {
  code: string;
  name: string;
  description: string;
  templateRole: string;
  isActive: boolean;
  sortOrder: number;
};

const EMPTY_FORM: RoleForm = {
  code: '',
  name: '',
  description: '',
  templateRole: '',
  isActive: true,
  sortOrder: 100,
};

function normalizeCode(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

function errorText(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || fallback);
  }
  return fallback;
}

function isMigrationMissing(error: unknown) {
  const message = errorText(error, '').toLowerCase();
  return (
    message.includes('admin_create_user_role') ||
    message.includes('admin_update_user_role') ||
    message.includes('admin_delete_user_role') ||
    message.includes('description') ||
    message.includes('is_system') ||
    message.includes('is_active')
  );
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [migrationReady, setMigrationReady] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleRow | null>(null);
  const [deleteRole, setDeleteRole] = useState<RoleRow | null>(null);
  const [form, setForm] = useState<RoleForm>(EMPTY_FORM);
  const [codeTouched, setCodeTouched] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const [rolesResult, usersResult, permissionsResult] = await Promise.all([
      supabase.from('user_types').select('*').order('sort_order', { ascending: true }).order('id'),
      supabase.rpc('admin_list_users'),
      supabase
        .from('role_module_permissions')
        .select('role_key,module_key,can_access'),
    ]);

    if (rolesResult.error) {
      setLoadError(rolesResult.error.message);
      setMigrationReady(!isMigrationMissing(rolesResult.error));
      setLoading(false);
      return;
    }

    const rawRoles = (rolesResult.data ?? []) as Array<Partial<RoleRow> & { id: number; code: string; name: string }>;
    const ready = rawRoles.every(
      (role) =>
        Object.prototype.hasOwnProperty.call(role, 'description') &&
        Object.prototype.hasOwnProperty.call(role, 'is_active') &&
        Object.prototype.hasOwnProperty.call(role, 'is_system'),
    );
    setMigrationReady(ready);
    setRoles(
      rawRoles.map((role, index) => ({
        id: Number(role.id),
        code: String(role.code || ''),
        name: String(role.name || role.code || ''),
        description: role.description ?? null,
        is_active: role.is_active ?? true,
        is_system: role.is_system ?? ['admin', 'jdv', 'supervisor', 'vendedor', 'rrhh'].includes(String(role.code)),
        sort_order: Number(role.sort_order ?? (index + 1) * 10),
        created_at: role.created_at ?? null,
        updated_at: role.updated_at ?? null,
      })),
    );

    if (usersResult.error) {
      setLoadError(usersResult.error.message);
    } else {
      setUsers((usersResult.data ?? []) as UserRow[]);
    }

    if (!permissionsResult.error) {
      setRolePermissions((permissionsResult.data ?? []) as RolePermissionRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('admin_roles_catalog')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_types' },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const usersByRole = useMemo(() => {
    return users.reduce<Record<string, { total: number; active: number }>>((acc, user) => {
      const current = acc[user.role] ?? { total: 0, active: 0 };
      current.total += 1;
      if (user.is_active) current.active += 1;
      acc[user.role] = current;
      return acc;
    }, {});
  }, [users]);

  const enabledModulesByRole = useMemo(() => {
    return rolePermissions.reduce<Record<string, number>>((acc, permission) => {
      if (permission.can_access) acc[permission.role_key] = (acc[permission.role_key] ?? 0) + 1;
      return acc;
    }, {});
  }, [rolePermissions]);

  const filteredRoles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return roles.filter((role) => {
      const matchesQuery =
        !needle ||
        [role.code, role.name, role.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      const matchesStatus =
        status === 'all' || (status === 'active' ? role.is_active : !role.is_active);
      return matchesQuery && matchesStatus;
    });
  }, [query, roles, status]);

  const metrics = useMemo(
    () => ({
      total: roles.length,
      active: roles.filter((role) => role.is_active).length,
      custom: roles.filter((role) => !role.is_system).length,
      assigned: roles.filter((role) => (usersByRole[role.code]?.total ?? 0) > 0).length,
    }),
    [roles, usersByRole],
  );

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, templateRole: '', sortOrder: (roles.at(-1)?.sort_order ?? 90) + 10 });
    setCodeTouched(false);
    setCreateOpen(true);
  };

  const openEdit = (role: RoleRow) => {
    setForm({
      code: role.code,
      name: role.name,
      description: role.description ?? '',
      templateRole: '',
      isActive: role.is_active,
      sortOrder: role.sort_order,
    });
    setEditRole(role);
  };

  const createRole = async () => {
    if (!migrationReady) return;
    if (!form.code.trim() || !form.name.trim()) {
      notify.error('Completá el código y el nombre del rol.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_create_user_role', {
        p_code: normalizeCode(form.code),
        p_name: form.name.trim(),
        p_description: form.description.trim() || null,
        p_template_role: form.templateRole || null,
      });
      if (error) throw error;

      setCreateOpen(false);
      await load();
      window.dispatchEvent(new Event('redcom:role-catalog-changed'));
      window.dispatchEvent(new Event('redcom:role-module-permissions-changed'));
      notify.success(`Rol ${form.name.trim()} creado correctamente.`);
    } catch (error) {
      notify.error(errorText(error, 'No se pudo crear el rol.'));
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async () => {
    if (!editRole || !migrationReady) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_update_user_role', {
        p_role_id: editRole.id,
        p_name: form.name.trim(),
        p_description: form.description.trim() || null,
        p_is_active: form.isActive,
        p_sort_order: form.sortOrder,
      });
      if (error) throw error;

      setEditRole(null);
      await load();
      window.dispatchEvent(new Event('redcom:role-catalog-changed'));
      notify.success(`Rol ${form.name.trim()} actualizado.`);
    } catch (error) {
      notify.error(errorText(error, 'No se pudo actualizar el rol.'));
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async () => {
    if (!deleteRole || !migrationReady) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_delete_user_role', {
        p_role_id: deleteRole.id,
      });
      if (error) throw error;

      const deletedName = deleteRole.name;
      setDeleteRole(null);
      await load();
      window.dispatchEvent(new Event('redcom:role-catalog-changed'));
      window.dispatchEvent(new Event('redcom:role-module-permissions-changed'));
      notify.success(`Rol ${deletedName} eliminado definitivamente.`);
    } catch (error) {
      notify.error(errorText(error, 'No se pudo eliminar el rol.'));
    } finally {
      setSaving(false);
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
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            <UserCog className="h-3.5 w-3.5" /> Catálogo de accesos
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Roles del sistema</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Creá y administrá los roles disponibles al dar de alta usuarios. Cada rol puede
            heredar una plantilla de permisos y luego configurarse desde la pestaña Permisos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} className="gap-2 rounded-xl bg-white">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </Button>
          <Button onClick={openCreate} disabled={!migrationReady} className="gap-2 rounded-xl bg-slate-950 hover:bg-slate-800">
            <Plus className="h-4 w-4" /> Nuevo rol
          </Button>
        </div>
      </header>

      {!migrationReady && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <Shield className="h-4 w-4" />
          <AlertTitle>Falta habilitar el CRUD de roles</AlertTitle>
          <AlertDescription>
            Ejecutá <strong>CRUD_ROLES_BD.sql</strong> en Supabase. El catálogo actual sigue
            funcionando, pero no podrá modificarse hasta aplicar esa migración.
          </AlertDescription>
        </Alert>
      )}

      {loadError && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo cargar toda la información</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ShieldCheck} label="Roles registrados" value={metrics.total} />
        <MetricCard icon={BadgeCheck} label="Roles activos" value={metrics.active} tone="green" />
        <MetricCard icon={KeyRound} label="Roles personalizados" value={metrics.custom} tone="violet" />
        <MetricCard icon={Users} label="Roles en uso" value={metrics.assigned} tone="blue" />
      </section>

      <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/60 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg font-black text-slate-950">Catálogo de roles</CardTitle>
              <CardDescription className="mt-1">
                Los roles base están protegidos para no romper reglas internas del sistema.
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <div className="relative min-w-0 sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nombre o código..."
                  className="rounded-xl border-slate-300 bg-white pl-9"
                />
              </div>
              <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                <SelectTrigger className="w-full rounded-xl bg-white sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredRoles.length === 0 ? (
            <div className="grid min-h-52 place-items-center p-8 text-center text-sm text-slate-500">
              No se encontraron roles con los filtros seleccionados.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRoles.map((role) => {
                const roleUsers = usersByRole[role.code] ?? { total: 0, active: 0 };
                const enabledModules = enabledModulesByRole[role.code] ?? 0;
                const canDelete = !role.is_system && roleUsers.total === 0;

                return (
                  <article
                    key={role.id}
                    className="grid gap-4 p-5 transition-colors hover:bg-slate-50/70 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,.8fr)_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className={cn('grid h-10 w-10 place-items-center rounded-xl', role.is_active ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-400')}>
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate font-black text-slate-950">{role.name}</h2>
                            <Badge variant="outline" className="font-mono text-[10px] text-slate-600">
                              {role.code}
                            </Badge>
                            {role.is_system && (
                              <Badge className="border border-blue-100 bg-blue-50 text-[10px] text-blue-700 hover:bg-blue-50">
                                Rol base
                              </Badge>
                            )}
                            <Badge
                              className={cn(
                                'border text-[10px]',
                                role.is_active
                                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-50'
                                  : 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-100',
                              )}
                            >
                              {role.is_active ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-5 text-slate-500">
                            {role.description || 'Sin descripción administrativa.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                      <SmallStat label="Usuarios" value={roleUsers.total} helper={`${roleUsers.active} activos`} />
                      <SmallStat label="Módulos" value={enabledModules} helper={`de ${MODULE_PERMISSION_DEFINITIONS.length}`} />
                      <SmallStat label="Orden" value={role.sort_order} helper="en selectores" className="hidden xl:block" />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl">
                        <Link href={`/admin/permisos?view=roles&role=${encodeURIComponent(role.code)}`}>
                          <KeyRound className="h-3.5 w-3.5" /> Permisos
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openEdit(role)}
                        disabled={!migrationReady}
                        className="h-9 w-9 rounded-xl"
                        title="Editar rol"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setDeleteRole(role)}
                        disabled={!migrationReady || !canDelete}
                        className="h-9 w-9 rounded-xl text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        title={
                          role.is_system
                            ? 'Los roles base no pueden eliminarse'
                            : roleUsers.total > 0
                              ? 'Reasigná primero los usuarios de este rol'
                              : 'Eliminar rol'
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <RoleDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        form={form}
        setForm={setForm}
        roles={roles}
        saving={saving}
        codeTouched={codeTouched}
        setCodeTouched={setCodeTouched}
        onSubmit={createRole}
      />

      <RoleDialog
        mode="edit"
        open={Boolean(editRole)}
        onOpenChange={(open) => !open && setEditRole(null)}
        form={form}
        setForm={setForm}
        roles={roles}
        saving={saving}
        codeTouched
        setCodeTouched={() => undefined}
        role={editRole}
        onSubmit={updateRole}
      />

      <AlertDialog open={Boolean(deleteRole)} onOpenChange={(open) => !open && setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar rol definitivamente</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteRole?.name}</strong> y su configuración de permisos.
              Esta acción solo está disponible cuando el rol no tiene usuarios asignados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeRole}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar rol
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RoleDialog({
  mode,
  open,
  onOpenChange,
  form,
  setForm,
  roles,
  saving,
  codeTouched,
  setCodeTouched,
  role,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: RoleForm;
  setForm: React.Dispatch<React.SetStateAction<RoleForm>>;
  roles: RoleRow[];
  saving: boolean;
  codeTouched: boolean;
  setCodeTouched: (value: boolean) => void;
  role?: RoleRow | null;
  onSubmit: () => void;
}) {
  const isCreate = mode === 'create';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Crear nuevo rol' : `Editar ${role?.name ?? 'rol'}`}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? 'El rol quedará disponible inmediatamente en el alta y edición de usuarios.'
              : 'El código interno se conserva para no romper usuarios ni políticas existentes.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${mode}-role-name`}>Nombre visible</Label>
            <Input
              id={`${mode}-role-name`}
              value={form.name}
              onChange={(event) => {
                const name = event.target.value;
                setForm((current) => ({
                  ...current,
                  name,
                  code: isCreate && !codeTouched ? normalizeCode(name) : current.code,
                }));
              }}
              placeholder="Ej: Analista comercial"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${mode}-role-code`}>Código interno</Label>
            <Input
              id={`${mode}-role-code`}
              value={form.code}
              disabled={!isCreate}
              onChange={(event) => {
                setCodeTouched(true);
                setForm((current) => ({ ...current, code: normalizeCode(event.target.value) }));
              }}
              placeholder="analista_comercial"
              className="rounded-xl font-mono"
            />
            <p className="text-xs text-slate-500">
              Minúsculas, números y guion bajo. El código no puede cambiarse después de crear el rol.
            </p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${mode}-role-description`}>Descripción</Label>
            <Textarea
              id={`${mode}-role-description`}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Explicá para qué tipo de usuario se utilizará este rol."
              className="min-h-24 rounded-xl"
            />
          </div>

          {isCreate ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>Copiar permisos iniciales de <span className="font-normal text-slate-400">(opcional)</span></Label>
              <Select
                value={form.templateRole || '__none__'}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    templateRole: value === '__none__' ? '' : value,
                  }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Sin plantilla de permisos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No copiar permisos</SelectItem>
                  {roles.filter((item) => item.is_active).map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Copy className="h-3.5 w-3.5" /> Si no elegís una plantilla, el rol se crea sin accesos habilitados y luego podés configurarlos desde Permisos.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="role-order">Orden</Label>
                <Input
                  id="role-order"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))}
                  className="rounded-xl"
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div>
                  <Label htmlFor="role-active">Rol activo</Label>
                  <p className="mt-1 text-xs text-slate-500">Disponible para nuevas asignaciones.</p>
                </div>
                <Switch
                  id="role-active"
                  checked={form.isActive}
                  disabled={role?.code === 'admin'}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="rounded-xl">
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={saving || !form.name.trim() || !form.code.trim()} className="gap-2 rounded-xl bg-slate-950 hover:bg-slate-800">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isCreate ? <Plus className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {isCreate ? 'Crear rol' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = 'slate',
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: number;
  tone?: 'slate' | 'green' | 'violet' | 'blue';
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700',
    blue: 'bg-blue-50 text-blue-700',
  };
  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
        </div>
        <div className={cn('grid h-11 w-11 place-items-center rounded-2xl', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function SmallStat({
  label,
  value,
  helper,
  className,
}: {
  label: string;
  value: number;
  helper: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white px-3 py-2', className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <div className="mt-0.5 flex items-baseline gap-1">
        <strong className="text-base text-slate-900">{value}</strong>
        <span className="text-[10px] text-slate-400">{helper}</span>
      </div>
    </div>
  );
}
