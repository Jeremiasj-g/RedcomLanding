'use client';

import { useEffect, useMemo, useState } from 'react';
import { Shield, Mail, Lock, Building2, UserPlus, Users, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const ALL_BRANCHES = ['corrientes', 'chaco', 'misiones', 'obera', 'refrigerados'];

type RoleOption = { value: string; label: string };

export default function NewUser() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');

  // ✅ ahora es dinámico (codes de user_types)
  const [role, setRole] = useState<string>('supervisor');

  const [isActive, setIsActive] = useState(true);
  const [branches, setBranches] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ roles desde BD
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  // 👁️ mostrar/ocultar password
  const [showPwd, setShowPwd] = useState(false);

  const toggle = (b: string) =>
    setBranches((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));

  const loadRoles = async () => {
    setRolesLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_types')
        .select('code,name')
        .order('id', { ascending: true });

      if (error) throw error;

      const opts: RoleOption[] = (data ?? [])
        .map((r: any) => ({
          value: String(r.code ?? '').trim(),
          label: String(r.name ?? '').trim(),
        }))
        .filter((x) => x.value.length > 0)
        .map((x) => ({ value: x.value, label: x.label || x.value }));

      setRoleOptions(opts);

      // si el role actual no existe en BD, seteamos el primero
      if (opts.length > 0 && !opts.some((o) => o.value === role)) {
        setRole(opts[0].value);
      }
    } catch (e: any) {
      console.error('loadRoles(user_types) error:', e?.message ?? e);
      // fallback: dejamos roles por defecto si falla
      const fallback: RoleOption[] = [
        { value: 'admin', label: 'Administrador' },
        { value: 'supervisor', label: 'Supervisor' },
        { value: 'vendedor', label: 'Vendedor' },
        { value: 'rrhh', label: 'Recursos Humanos' },
      ];
      setRoleOptions(fallback);
      if (!fallback.some((o) => o.value === role)) setRole('supervisor');
    } finally {
      setRolesLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleLabelByValue = useMemo(() => {
    const map = new Map(roleOptions.map((r) => [r.value, r.label]));
    return map;
  }, [roleOptions]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(false);

    if (branches.length === 0) {
      setErr('Seleccioná al menos una sucursal.');
      return;
    }

    setLoading(true);

    const {
      data: { session },
      error: sessErr,
    } = await supabase.auth.getSession();

    if (sessErr || !session?.access_token) {
      setLoading(false);
      setErr('No se encontró una sesión válida. Volvé a iniciar sesión.');
      return;
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin_create_user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        branches,
        role, // ✅ code de user_types (admin/supervisor/vendedor/rrhh/...)
        is_active: isActive,
      }),
    });

    const j = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setErr(j.error ?? 'Error al crear el usuario');
      return;
    }

    setOk(true);
    setEmail('');
    setPassword('');
    setFullName('');
    setBranches([]);
    setRole(roleOptions?.[0]?.value ?? 'supervisor');
    setIsActive(true);
    setShowPwd(false);
    setTimeout(() => setOk(false), 5000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-lg bg-blue-600 p-2">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Crear Nuevo Usuario</h1>
          </div>
          <p className="ml-14 text-slate-600">Complete los datos del nuevo empleado</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <form onSubmit={submit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Users className="h-4 w-4 text-slate-400" />
                  Nombre Completo
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Mail className="h-4 w-4 text-slate-400" />
                  Correo Electrónico
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ejemplo@empresa.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* ✅ Password con botón de mostrar/ocultar */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Lock className="h-4 w-4 text-slate-400" />
                  Contraseña
                </label>

                <div className="relative">
                  <input
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-slate-900 placeholder-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Mínimo 8 caracteres"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    title={showPwd ? 'Ocultar' : 'Mostrar'}
                  >
                    {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <p className="text-xs text-slate-500">
                  Tip: usá una contraseña temporal y pedí al usuario que la cambie luego.
                </p>
              </div>

              {/* ✅ Rol dinámico desde user_types */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Shield className="h-4 w-4 text-slate-400" />
                  Rol del Usuario
                </label>

                <select
                  className="w-full cursor-pointer rounded-xl border border-slate-300 px-4 py-3 text-slate-900 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={rolesLoading}
                >
                  {rolesLoading ? (
                    <option value={role}>Cargando tipos…</option>
                  ) : (
                    roleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))
                  )}
                </select>

                {!rolesLoading && role && (
                  <p className="text-xs text-slate-500">
                    Seleccionado: <span className="font-semibold text-slate-700">{roleLabelByValue.get(role) ?? role}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Building2 className="h-4 w-4 text-slate-400" />
                Sucursales Asignadas
              </label>
              <div className="flex flex-wrap gap-3">
                {ALL_BRANCHES.map((b) => (
                  <button
                    type="button"
                    key={b}
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all hover:scale-105 ${
                      branches.includes(b)
                        ? 'border-2 border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200'
                        : 'border-2 border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                    onClick={() => toggle(b)}
                  >
                    <span className="capitalize">{b}</span>
                  </button>
                ))}
              </div>
              {branches.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">Seleccione al menos una sucursal</p>
              )}
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-slate-300 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
              <div>
                <p className="text-sm font-semibold text-slate-700">Usuario Activo</p>
                <p className="text-xs text-slate-500">El usuario podrá acceder al sistema inmediatamente</p>
              </div>
            </div>

            {err && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-500">
                  <span className="text-xs font-bold text-white">!</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-900">Error al crear usuario</p>
                  <p className="text-sm text-red-700">{err}</p>
                </div>
              </div>
            )}

            {ok && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500">
                  <span className="text-xs font-bold text-white">✓</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-900">Usuario creado exitosamente</p>
                  <p className="text-sm text-emerald-700">El nuevo empleado ha sido agregado al sistema</p>
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 transform rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white transition-all hover:scale-[1.02] hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                    Creando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Crear Usuario
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
